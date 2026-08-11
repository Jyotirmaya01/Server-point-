# ==========================================
# ServePrint Backend (Part 1A)
# Imports
# ==========================================
import logging
import re
import math
import zipfile
from xml.etree import ElementTree as ET
from typing import Optional
from pydantic import BaseModel
from pathlib import Path
from datetime import datetime
import asyncio
import shutil
import uuid

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
    Request,
    Header
)
from vendor_routes import (
    router as vendor_router,
    get_authenticated_vendor
)


from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.concurrency import run_in_threadpool
from pypdf import PdfReader
from pptx import Presentation
from docx import Document
from docx.oxml.ns import qn
import openpyxl
from vendor_database import (
    get_vendor_by_id,
    get_vendor_settings,
    update_vendor_settings,
    update_vendor_maintenance,
    get_vendor_maintenance,
)

from database import (
    initialize_database,
    save_print_job,
    get_print_job,
    get_all_print_jobs,
    update_payment_status,
    update_printer_status,
    update_job_details,
    get_next_queue_number,
    mark_payment_pending,
    mark_payment_success,
    assign_queue_after_payment,
    start_printing,
    complete_printing,
    cleanup_expired_jobs,
    update_print_job,
    get_vendor_dashboard,
    get_vendor_orders,
    get_vendor_queue,

)

# ==========================================
# FastAPI App
# ==========================================

app = FastAPI(
    title="ServePrint API",
    description="Backend API for ServePrint",
    version="1.0.0"
)

app.include_router(vendor_router)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

# ==========================================
# Background Cleanup Scheduler
# ==========================================

async def cleanup_scheduler():

    while True:

        try:

            cleanup_expired_uploads()

            logger.info("Expired jobs cleaned.")

        except Exception as e:

            logger.error(f"Cleanup Scheduler Error: {e}")

        await asyncio.sleep(30)

initialize_database()

@app.on_event("startup")
async def startup_event():

    asyncio.create_task(
        cleanup_scheduler()
    )
# ==========================================
# CORS
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# Folders
# ==========================================

UPLOAD_FOLDER = Path("uploads")
UPLOAD_FOLDER.mkdir(exist_ok=True)

def cleanup_expired_uploads():

    expired_files = cleanup_expired_jobs()

    for filename in expired_files:

        file_path = UPLOAD_FOLDER / filename

        if file_path.exists():
            file_path.unlink()

LOG_FOLDER = Path("logs")
LOG_FOLDER.mkdir(exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory="uploads"),
    name="uploads"
)

# ==========================================
# Allowed Extensions
# ==========================================

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".docx",
    ".pptx",
    ".xlsx",
    ".txt"
}

# ==========================================
# Allowed MIME Types
# ==========================================

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    # Mobile browsers / OS file pickers sometimes report office files as
    # this generic type. Extension check above is the real gatekeeper,
    # this just stops a valid file from being rejected on MIME alone.
    "application/octet-stream"
}

# ==========================================
# Pricing
# ==========================================

BW_PRICE_PER_PAGE = 2.0
COLOR_PRICE_PER_PAGE = 10.0

MAX_FILE_SIZE = 20 * 1024 * 1024


def calculate_price(
    pages: int,
    copies: int = 1,
    print_type: str = "bw"
):
    rate = (
        COLOR_PRICE_PER_PAGE
        if print_type == "color"
        else BW_PRICE_PER_PAGE
    )

    return pages * copies * rate

# ==========================================
# Waiting Time
# ==========================================

def estimate_wait_time(queue_number: int):
    return queue_number * 2


# ==========================================
# Page Counter (PDF + PPTX + fallback)
# ==========================================

# ==========================================
# DOCX Page Counter
# ==========================================

def count_docx_pages(filepath: Path) -> int:
    """
    Word documents don't store a true page count internally - real
    pagination depends on the renderer (fonts, margins, printer
    driver etc). Three signals are combined here, since none of them
    is reliable alone:

    1. docProps/app.xml <Pages> - Word/LibreOffice write their own
       last-computed page count here when saved from the app. BUT
       this is often a stale default of "1" on files that were never
       actually opened/saved in a real Word app (e.g. generated by a
       script) - so it can't be trusted on its own.
    2. Explicit page breaks in the document body, +1.
    3. A rough estimate from word count (~400 words per page).

    We take the strongest (highest) of these: under-counting a print
    job is worse for a print shop than over-counting by a page or
    two.
    """

    app_xml_pages = 0

    try:

        with zipfile.ZipFile(filepath) as docx_zip:

            with docx_zip.open("docProps/app.xml") as f:

                tree = ET.parse(f)

                ns = {
                    "ep": "http://schemas.openxmlformats.org/"
                          "officeDocument/2006/extended-properties"
                }

                pages_el = tree.find("ep:Pages", ns)

                if (
                    pages_el is not None and
                    pages_el.text and
                    pages_el.text.isdigit()
                ):

                    app_xml_pages = int(pages_el.text)

    except Exception as e:
        logger.warning(f"DOCX app.xml page count unavailable: {e}")

    page_break_pages = 0
    word_count_pages = 0

    try:

        document = Document(str(filepath))

        page_breaks = 0
        word_count = 0

        for paragraph in document.paragraphs:

            word_count += len(paragraph.text.split())

            for run in paragraph.runs:

                for br in run._element.findall(qn("w:br")):

                    if br.get(qn("w:type")) == "page":
                        page_breaks += 1

        if page_breaks > 0:
            page_break_pages = page_breaks + 1

        if word_count > 0:
            word_count_pages = max(1, round(word_count / 400))

    except Exception as e:
        logger.error(f"DOCX fallback page count failed: {e}")

    candidates = [
        p for p in (app_xml_pages, page_break_pages, word_count_pages)
        if p > 0
    ]

    return max(candidates) if candidates else 1


# ==========================================
# XLSX Page Counter
# ==========================================

def count_xlsx_pages(filepath: Path) -> int:
    """
    Spreadsheets don't have real "pages" until printed - actual page
    breaks depend on print area, column widths and scale, which
    Excel itself computes at print time. As a practical approximation
    for a print shop, we treat each worksheet as at least one page.
    """

    try:

        workbook = openpyxl.load_workbook(
            str(filepath),
            read_only=True
        )

        sheet_count = len(workbook.sheetnames)

        workbook.close()

        return max(1, sheet_count)

    except Exception as e:
        logger.error(f"XLSX page count failed: {e}")
        return 1


# ==========================================
# TXT Page Counter
# ==========================================

def count_txt_pages(filepath: Path) -> int:
    """
    Plain text has no page concept either - estimate using a rough
    characters-per-printed-page figure (~3000 chars, typical for an
    A4 page at 11-12pt single spaced).
    """

    try:

        text = filepath.read_text(encoding="utf-8", errors="ignore")

        chars = len(text)

        if chars == 0:
            return 1

        return max(1, math.ceil(chars / 3000))

    except Exception as e:
        logger.error(f"TXT page count failed: {e}")
        return 1


# ==========================================
# Page Counter (PDF + PPTX + DOCX + XLSX + TXT + fallback)
# ==========================================

def count_pages(filepath: Path):
    """
    Runs inside a threadpool (see /upload) so it never blocks
    FastAPI's event loop, no matter how large the file is.
    """

    ext = filepath.suffix.lower()

    if ext == ".pdf":

        try:
            reader = PdfReader(str(filepath))
            pages = len(reader.pages)
            logger.info(f"PDF Pages: {pages}")
            return pages

        except Exception as e:
            logger.error(f"PDF ERROR: {e}")
            return 1

    if ext in (".pptx", ".ppt"):

        try:
            presentation = Presentation(str(filepath))
            slides = len(presentation.slides)
            logger.info(f"PPTX Slides: {slides}")
            return slides

        except Exception as e:
            # .ppt (old binary format) isn't readable by python-pptx,
            # only .pptx is. Falls back to 1 rather than crashing.
            logger.error(f"PPTX ERROR: {e}")
            return 1

    if ext == ".docx":

        pages = count_docx_pages(filepath)
        logger.info(f"DOCX Pages: {pages}")
        return pages

    if ext == ".doc":

        # Legacy binary Word format - python-docx can't read it, and
        # there's no LibreOffice on this server to convert it. This
        # honestly stays a 1-page fallback until that's added.
        logger.warning(".doc (legacy Word) - page count defaults to 1")
        return 1

    if ext == ".xlsx":

        pages = count_xlsx_pages(filepath)
        logger.info(f"XLSX Pages: {pages}")
        return pages

    if ext == ".xls":

        logger.warning(".xls (legacy Excel) - page count defaults to 1")
        return 1

    if ext == ".txt":

        pages = count_txt_pages(filepath)
        logger.info(f"TXT Pages: {pages}")
        return pages

    # Images: always exactly 1 page.
    return 1


# ==========================================
# Basic APIs
# ==========================================

@app.get("/")
def home():
    return {
        "project": "ServePrint",
        "status": "Running",
        "version": "1.0.0"
    }


@app.get("/health")
def health():
    return {
        "server": "Online",
        "printer": "Waiting",
        "database": "Connected"
    }


@app.get("/status")
def status():
    return {
        "printer": "Offline",
        "queue": 0,
        "jobs": 0
    }


# ==========================================
# Upload API
# ==========================================

@app.post("/upload")
async def upload_file(
    vendor_id: str = Form(...),
    file: UploadFile = File(...),
    copies: int = Form(1),
    print_type: str = Form("bw"),
    paper_size: str = Form("A4"),
    page_range: str = Form("All")
):
    # Validate Vendor
    vendor = get_vendor_by_id(vendor_id)

    if vendor is None:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found."
        )

    # Maintenance Protection
    maintenance = get_vendor_maintenance(vendor_id)

    if maintenance:
        raise HTTPException(
            status_code=503,
            detail="This shop is currently under maintenance. Please try again later."
        )

    # Validate Copies
    if copies < 1:
        raise HTTPException(
            status_code=400,
            detail="Copies must be at least 1."
        )

    if copies > 100:
        raise HTTPException(
            status_code=400,
            detail="Maximum 100 copies allowed."
        )

    # Validate Page Range
    page_range = page_range.strip()

    if page_range == "":
        raise HTTPException(
            status_code=400,
            detail="Page range cannot be empty."
        )

    if page_range.lower() != "all":
        pattern = r"^[0-9,\-\s]+$"

        if not re.match(pattern, page_range):
            raise HTTPException(
                status_code=400,
                detail="Invalid page range."
            )

    # Validate Extension
    extension = Path(file.filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type."
        )

    # Block Videos
    if file.content_type and file.content_type.startswith("video/"):
        raise HTTPException(
            status_code=400,
            detail="Video files are not allowed."
        )

    # Validate MIME Type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported MIME type: {file.content_type}"
        )

    # Validate Print Type
    if print_type not in ["bw", "color"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid print type."
        )

    # Generate Job
    job_id = str(uuid.uuid4())
    filename = f"{job_id}{extension}"
    filepath = UPLOAD_FOLDER / filename

    # Save File
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = filepath.stat().st_size

    # Validate File Size
    if file_size > MAX_FILE_SIZE:
        filepath.unlink()
        raise HTTPException(
            status_code=400,
            detail="Maximum file size is 20 MB."
        )

    # Count Pages without blocking FastAPI
    total_pages = await run_in_threadpool(
        count_pages,
        filepath
    )

    logger.info(f"Detected Pages: {total_pages}")

    # Job has not been paid yet, so it is not in the queue.
    queue_number = 0
    waiting_time = 0

    # Calculate Price
    total_amount = calculate_price(
        pages=total_pages,
        copies=copies,
        print_type=print_type
    )

    # Save Database
    save_print_job(
        vendor_id=vendor_id,
        job_id=job_id,
        original_name=file.filename,
        saved_name=filename,
        file_size=file_size,
        total_pages=total_pages,
        queue_number=queue_number,
        total_amount=total_amount
    )

    # Update Job Details
    update_job_details(
        job_id,
        total_pages,
        total_amount,
        queue_number,
        copies,
        print_type,
        paper_size
    )

    # Payment Pending
    mark_payment_pending(job_id)

    # Response
    return {
        "success": True,
        "job_id": job_id,
        "original_name": file.filename,
        "saved_name": filename,
        "file_size": file_size,
        "uploaded_at": datetime.now().isoformat(),
        "queue_number": 0,
        "total_pages": total_pages,
        "total_amount": total_amount,
        "estimated_wait_time": waiting_time,
        "copies": copies,
        "print_type": print_type,
        "paper_size": paper_size,
        "page_range": page_range,
        "payment_status": "Pending",
        "printer_status": "Pending Payment"
    }


# ==========================================
# Create Print Job API
# ==========================================

class PrintJobRequest(BaseModel):
    job_id: str
    copies: int
    print_type: str
    paper_size: str
    orientation: Optional[str] = "Portrait"
    page_range: str


@app.post("/print")
def create_print_job(request: PrintJobRequest):
    update_print_job(
        job_id=request.job_id,
        copies=request.copies,
        print_type=request.print_type,
        paper_size=request.paper_size,
        orientation=request.orientation,
        page_range=request.page_range
    )

    return {
        "success": True,
        "message": "Print Job Created",
        "job_id": request.job_id
    }


@app.put("/jobs/{job_id}")
def update_existing_job(
    job_id: str,
    request: PrintJobRequest
):
    job = get_print_job(job_id)

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    if job["payment_status"] == "Paid":
        raise HTTPException(
            status_code=400,
            detail="Paid jobs cannot be modified."
        )

    total_pages = job["total_pages"]

    total_amount = calculate_price(
        pages=total_pages,
        copies=request.copies,
        print_type=request.print_type
    )

    update_print_job(
        job_id=job_id,
        copies=request.copies,
        print_type=request.print_type,
        paper_size=request.paper_size,
        orientation=request.orientation,
        page_range=request.page_range
    )

    update_job_details(
        job_id=job_id,
        total_pages=total_pages,
        total_amount=total_amount,
        queue_number=job["queue_number"],
        copies=request.copies,
        print_type=request.print_type,
        paper_size=request.paper_size
    )

    return {
        "success": True,
        "job_id": job_id,
        "total_pages": total_pages,
        "total_amount": total_amount,
        "queue_number": job["queue_number"],
        "estimated_wait_time": (job["queue_number"] - 1) * 2,
        "printer_status": job["printer_status"]
    }


# ==========================================
# Get Single Job
# ==========================================

@app.get("/jobs/{job_id}")
def fetch_job(job_id: str):

    job = get_print_job(job_id)

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job Not Found"
        )

    job = dict(job)

    job["orders_ahead"] = max(
        0,
        job["queue_number"] - 1
    )

    job["estimated_wait_time"] = (
        job["orders_ahead"] * 2
    )

    return job


# ==========================================
# Get All Jobs
# ==========================================

@app.get("/jobs")
def fetch_all_jobs():
    jobs = get_all_print_jobs()
    return [dict(job) for job in jobs]


# ==========================================
# Update Payment Status
# ==========================================

@app.put("/jobs/{job_id}/payment/{status}")
def payment_status(
    job_id: str,
    status: str,
    authorization: str | None = Header(default=None)
):

    vendor = get_authenticated_vendor(
        authorization
    )

    job = get_print_job(job_id)

    if not job:

        raise HTTPException(
            status_code=404,
            detail="Job not found."
        )

    if job["vendor_id"] != vendor["vendor_id"]:

        raise HTTPException(
            status_code=403,
            detail="You are not authorized to modify this job."
        )

    update_payment_status(
        job_id,
        status
    )

    return {

        "success": True,

        "job_id": job_id,

        "payment_status": status

    }

# ==========================================
# Update Printer Status
# ==========================================

@app.put("/jobs/{job_id}/printer/{status}")
def printer_status(
    job_id: str,
    status: str,
    authorization: str | None = Header(default=None)
):

    vendor = get_authenticated_vendor(
        authorization
    )

    job = get_print_job(job_id)

    if not job:

        raise HTTPException(
            status_code=404,
            detail="Job not found."
          )

    if job["vendor_id"] != vendor["vendor_id"]:

        raise HTTPException(
            status_code=403,
            detail="You are not authorized to modify this job."
        )

    update_printer_status(
        job_id,
        status
    )

    return {

        "success": True,

        "job_id": job_id,

        "printer_status": status

    }
# ==========================================
# Verify Payment
# ==========================================

@app.post("/payment/{job_id}")
def verify_payment(job_id: str, payment_id: str):
    job = get_print_job(job_id)

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    queue_number = assign_queue_after_payment(
        job["vendor_id"],
        job_id,
        payment_id
    )

    return {
        "success": True,
        "job_id": job_id,
        "payment_id": payment_id,
        "payment_status": "Paid",
        "queue_number": queue_number,
        "estimated_wait_time": (queue_number - 1) * 2,
        "printer_status": "Waiting"
    }


# ==========================================
# Start Printing
# ==========================================

@app.post("/jobs/{job_id}/start")
def start_job(
    job_id: str,
    authorization: str | None = Header(default=None)
):

    vendor = get_authenticated_vendor(
        authorization
    )

    job = get_print_job(job_id)

    if not job:

        raise HTTPException(
            status_code=404,
            detail="Job not found."
        )

    if job["vendor_id"] != vendor["vendor_id"]:

        raise HTTPException(
            status_code=403,
            detail="You are not authorized to start this job."
        )

    start_printing(job_id)

    return {

        "success": True,

        "job_id": job_id,

        "printer_status": "Printing"

    }

# ==========================================
# Complete Printing
# ==========================================

@app.post("/jobs/{job_id}/complete")
def complete_job(
    job_id: str,
    authorization: str | None = Header(default=None)
):

    vendor = get_authenticated_vendor(
        authorization
    )

    job = get_print_job(job_id)

    if not job:

        raise HTTPException(
            status_code=404,
            detail="Job not found."
        )

    if job["vendor_id"] != vendor["vendor_id"]:

        raise HTTPException(
            status_code=403,
            detail="You are not authorized to complete this job."
        )

    complete_printing(job_id)

    return {

        "success": True,

        "job_id": job_id,

        "printer_status": "Completed"

    }
# ==========================================
# Vendor Dashboard API
# ==========================================

@app.get("/vendor/{vendor_id}/dashboard")
def vendor_dashboard(vendor_id:str):

    return get_vendor_dashboard(vendor_id)


# ==========================================
# Vendor Orders API
# ==========================================

@app.get("/vendor/{vendor_id}/orders")
def vendor_orders(vendor_id: str):

    return get_vendor_orders(vendor_id)


# ==========================================
# Vendor Queue API
# ==========================================

@app.get("/vendor/{vendor_id}/queue")
def vendor_queue(vendor_id: str):

    return get_vendor_queue(vendor_id)

# ==========================================
# Vendor QR API
# ==========================================

@app.get("/vendor/{vendor_id}/qr")
def vendor_qr(vendor_id: str):

    vendor = get_vendor_by_id(vendor_id)

    if vendor is None:

        raise HTTPException(
            status_code=404,
            detail="Vendor not found"
        )

    frontend_url = (
        "https://server-point-1vrst74ki-jyotirmaya01s-projects.vercel.app"
    )

    return {

        "vendor_id": vendor["vendor_id"],

        "shop_name": vendor["shop_name"],

        "url": f"{frontend_url}/?vendor_id={vendor['vendor_id']}"

    }


# ==========================================
# Vendor Settings Model
# ==========================================

class VendorSettingsUpdate(BaseModel):

    shop_name: str

    owner_name: str

    phone: str

    address: str

    maintenance: bool

    accept_orders: bool

    razorpay_key: str = ""

    razorpay_secret: str = ""

    google_sheet_id: str = ""

    service_email: str = ""

    smtp_host: str = ""

    smtp_port: int = 587

    smtp_email: str = ""

    smtp_password: str = ""
# ==========================================
# Vendor Settings API
# ==========================================

@app.get("/vendor/{vendor_id}/settings")
def vendor_settings(vendor_id: str):

    settings = get_vendor_settings(vendor_id)

    if settings is None:

        raise HTTPException(
            status_code=404,
            detail="Vendor settings not found."
        )

    return settings

# ==========================================
# Update Vendor Settings API
# ==========================================

@app.put("/vendor/{vendor_id}/settings")
def save_vendor_settings(

    vendor_id: str,

    data: VendorSettingsUpdate

):

    update_vendor_settings(

        vendor_id,

        data

    )

    return {

        "success": True,

        "message": "Settings updated successfully."

    }

# ==========================================
# Vendor Maintenance API
# ==========================================

@app.post("/vendor/{vendor_id}/maintenance")
def set_vendor_maintenance(
    vendor_id: str,
    enabled: bool
):

    # Make sure vendor exists
    vendor = get_vendor_by_id(vendor_id)

    if vendor is None:

        raise HTTPException(
            status_code=404,
            detail="Vendor not found."
        )

    success = update_vendor_maintenance(
        vendor_id,
        enabled
    )

    if not success:

        raise HTTPException(
            status_code=404,
            detail="Vendor settings not found."
        )

    return {
        "success": True,
        "vendor_id": vendor_id,
        "maintenance": enabled
    }

# ==========================================
# Public Vendor Status API
# ==========================================
@app.get("/vendor/{vendor_id}/status")
def get_vendor_status(vendor_id: str):

    vendor = get_vendor_by_id(vendor_id)

    if vendor is None:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found."
        )

    maintenance = get_vendor_maintenance(
        vendor_id
    )

    if maintenance is None:
        maintenance = False

    settings = get_vendor_settings(
        vendor_id
    )

    if settings is None:
        accept_orders = True
    else:
        accept_orders = bool(
            settings.get(
                "accept_orders",
                True
            )
        )

    return {
        "valid": True,
        "active": True,
        "vendor_id": vendor_id,
        "shop_name": vendor["shop_name"],
        "maintenance": maintenance,
        "accept_orders": accept_orders
    }

# ==========================================
# Customer Vendor Validation API
# ==========================================

@app.get("/customer/vendor/{vendor_id}/validate")
def validate_customer_vendor(vendor_id: str):

    vendor = get_vendor_by_id(
        vendor_id
    )

    # --------------------------------------
    # Vendor does not exist
    # --------------------------------------

    if vendor is None:

        return {
            "valid": False,
            "vendor_id": vendor_id,
            "message": "Shop not found."
        }

    # --------------------------------------
    # Maintenance
    # --------------------------------------

    maintenance = get_vendor_maintenance(
        vendor_id
    )

    if maintenance is None:
        maintenance = False

    # --------------------------------------
    # Vendor Settings
    # --------------------------------------

    settings = get_vendor_settings(
        vendor_id
    )

    if settings is None:

        accept_orders = True

    else:

        accept_orders = bool(
            settings.get(
                "accept_orders",
                True
            )
        )

    # --------------------------------------
    # Response
    # --------------------------------------

    return {
        "valid": True,
        "vendor_id": vendor_id,
        "shop_name": vendor["shop_name"],
        "maintenance": maintenance,
        "accept_orders": accept_orders,
        "active": True
    }
#==========================================
# Global Exception Handler
# ==========================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"SERVER ERROR: {exc}")
    logger.exception("Unhandled exception")

    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Internal Server Error",
        }
    )
