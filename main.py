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

import razorpay

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
    Request,
    Header
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

from vendor_routes import (
    router as vendor_router,
    get_authenticated_vendor
)

from vendor_database import (
    get_vendor_by_id,
    get_vendor_settings,
    update_vendor_settings,
    update_vendor_maintenance,
    update_vendor_accept_orders,
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
    mark_payment_failed,
    save_razorpay_order,
    get_razorpay_order_id,
    save_razorpay_payment,
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
# FastAPI
# ==========================================

app = FastAPI(
    title="ServePrint API",
    description="Backend API for ServePrint",
    version="1.2.0"
)

app.include_router(vendor_router)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)


# ==========================================
# Background Cleanup
# ==========================================

async def cleanup_scheduler():

    while True:

        try:

            cleanup_expired_uploads()

            logger.info(
                "Expired jobs cleaned."
            )

        except Exception as e:

            logger.error(
                f"Cleanup Scheduler Error: {e}"
            )

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

UPLOAD_FOLDER = Path(
    "uploads"
)

UPLOAD_FOLDER.mkdir(
    exist_ok=True
)


LOG_FOLDER = Path(
    "logs"
)

LOG_FOLDER.mkdir(
    exist_ok=True
)


def cleanup_expired_uploads():

    expired_files =
        cleanup_expired_jobs()

    for filename in expired_files:

        file_path =
            UPLOAD_FOLDER / filename

        if file_path.exists():
            file_path.unlink()


app.mount(
    "/uploads",
    StaticFiles(
        directory="uploads"
    ),
    name="uploads"
)


# ==========================================
# File Types
# ==========================================

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".tif",
    ".tiff",
    ".heic",
    ".heif",
    ".docx",
    ".pptx",
    ".xlsx",
    ".txt"
}


ALLOWED_MIME_TYPES = {
    "application/pdf",

    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/tiff",
    "image/heic",
    "image/heif",

    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

    "application/vnd.openxmlformats-officedocument.presentationml.presentation",

    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

    "text/plain",

    "application/octet-stream"
}


# ==========================================
# Pricing
# ==========================================

BW_PRICE_PER_PAGE = 2.0

COLOR_PRICE_PER_PAGE = 10.0

MAX_FILE_SIZE = (
    20 * 1024 * 1024
)


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

def estimate_wait_time(
    queue_number: int
):

    return queue_number * 2


# ==========================================
# PDF PAGE COUNTER
# ==========================================

def count_pdf_pages(
    filepath: Path
) -> int:

    try:

        reader = PdfReader(
            str(filepath)
        )

        total =
            len(reader.pages)

        if total < 1:

            raise ValueError(
                "PDF contains no pages."
            )

        logger.info(
            f"PDF Pages: {total}"
        )

        return total

    except Exception as error:

        logger.exception(
            "PDF page counting failed."
        )

        raise ValueError(
            "Unable to read this PDF. "
            "Please make sure the PDF is not corrupted or password protected."
        ) from error


# ==========================================
# PPTX PAGE COUNTER
# ==========================================

def count_pptx_pages(
    filepath: Path
) -> int:

    try:

        presentation =
            Presentation(
                str(filepath)
            )

        total =
            len(
                presentation.slides
            )

        if total < 1:

            raise ValueError(
                "Presentation contains no slides."
            )

        logger.info(
            f"PPTX Slides: {total}"
        )

        return total

    except Exception as error:

        logger.exception(
            "PPTX page counting failed."
        )

        raise ValueError(
            "Unable to read this PowerPoint file."
        ) from error


# ==========================================
# DOCX PAGE COUNTER
# ==========================================

def count_docx_pages(
    filepath: Path
) -> int:

    app_xml_pages = 0

    try:

        with zipfile.ZipFile(
            filepath
        ) as docx_zip:

            with docx_zip.open(
                "docProps/app.xml"
            ) as f:

                tree =
                    ET.parse(f)

                ns = {
                    "ep":
                    "http://schemas.openxmlformats.org/"
                    "officeDocument/2006/extended-properties"
                }

                pages_el =
                    tree.find(
                        "ep:Pages",
                        ns
                    )

                if (
                    pages_el is not None
                    and
                    pages_el.text
                    and
                    pages_el.text.isdigit()
                ):

                    app_xml_pages =
                        int(
                            pages_el.text
                        )

    except Exception as error:

        logger.warning(
            f"DOCX app.xml page count unavailable: {error}"
        )


    page_break_pages = 0

    word_count_pages = 0


    try:

        document =
            Document(
                str(filepath)
            )

        page_breaks = 0

        word_count = 0


        for paragraph in document.paragraphs:

            word_count += len(
                paragraph.text.split()
            )

            for run in paragraph.runs:

                for br in run._element.findall(
                    qn("w:br")
                ):

                    if (
                        br.get(
                            qn("w:type")
                        )
                        ==
                        "page"
                    ):

                        page_breaks += 1


        page_break_pages =
            page_breaks + 1

        word_count_pages =
            max(
                1,
                math.ceil(
                    word_count / 400
                )
            )

    except Exception as error:

        logger.warning(
            f"DOCX parsing failed: {error}"
        )


    result =
        max(
            1,
            app_xml_pages,
            page_break_pages,
            word_count_pages
        )

    logger.info(
        f"DOCX Pages: {result}"
    )

    return result


# ==========================================
# XLSX PAGE COUNTER
# ==========================================

def count_xlsx_pages(
    filepath: Path
) -> int:

    try:

        workbook =
            openpyxl.load_workbook(
                filepath,
                read_only=True,
                data_only=True
            )

        sheets =
            len(
                workbook.sheetnames
            )

        workbook.close()

        return max(
            1,
            sheets
        )

    except Exception as error:

        logger.exception(
            "XLSX page counting failed."
        )

        raise ValueError(
            "Unable to read this Excel file."
        ) from error


# ==========================================
# TXT PAGE COUNTER
# ==========================================

def count_txt_pages(
    filepath: Path
) -> int:

    try:

        text =
            filepath.read_text(
                encoding="utf-8",
                errors="ignore"
            )

        lines =
            text.splitlines()

        lines_per_page = 55

        return max(
            1,
            math.ceil(
                len(lines) /
                lines_per_page
            )
        )

    except Exception as error:

        logger.exception(
            "TXT page counting failed."
        )

        raise ValueError(
            "Unable to read this text file."
        ) from error


# ==========================================
# UNIVERSAL PAGE COUNTER
# ==========================================

def count_pages(
    filepath: Path
) -> int:

    extension =
        filepath.suffix.lower()


    if extension == ".pdf":

        return count_pdf_pages(
            filepath
        )


    if extension == ".pptx":

        return count_pptx_pages(
            filepath
        )


    if extension == ".docx":

        return count_docx_pages(
            filepath
        )


    if extension == ".xlsx":

        return count_xlsx_pages(
            filepath
        )


    if extension == ".txt":

        return count_txt_pages(
            filepath
        )


    /*
     * Images are exactly one printable page.
     */

    if extension in {
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp",
        ".bmp",
        ".tif",
        ".tiff",
        ".heic",
        ".heif"
    }:

        return 1


    raise ValueError(
        "Unable to determine file page count."
    )


# ==========================================
# Basic APIs
# ==========================================

@app.get("/")
def home():

    return {
        "project":
            "ServePrint",

        "status":
            "Running",

        "version":
            "1.2.0"
    }


@app.get("/health")
def health():

    return {
        "server":
            "Online",

        "printer":
            "Waiting",

        "database":
            "Connected"
    }


@app.get("/status")
def status():

    return {
        "printer":
            "Offline",

        "queue":
            0,

        "jobs":
            0
    }


# ==========================================
# PUBLIC VENDOR STATUS
#
# IMPORTANT:
# Never return vendor ID,
# shop name, email, phone etc.
# ==========================================

@app.get(
    "/vendor/{vendor_id}/status"
)
def vendor_status(
    vendor_id: str
):

    vendor =
        get_vendor_by_id(
            vendor_id
        )

    if vendor is None:

        raise HTTPException(
            status_code=404,
            detail="Shop not found."
        )


    maintenance =
        bool(
            get_vendor_maintenance(
                vendor_id
            )
        )


    settings =
        get_vendor_settings(
            vendor_id
        )


    accept_orders = True


    if settings is not None:

        accept_orders =
            bool(
                settings.get(
                    "accept_orders",
                    True
                )
            )


    return {

        "maintenance":
            maintenance,

        "accept_orders":
            accept_orders
    }


# ==========================================
# UPLOAD API
# ==========================================

@app.post("/upload")
async def upload_file(

    vendor_id: str =
        Form(...),

    file: UploadFile =
        File(...),

    copies: int =
        Form(1),

    print_type: str =
        Form("bw"),

    paper_size: str =
        Form("A4"),

    page_range: str =
        Form("All")
):

    # --------------------------------------
    # Vendor validation
    # --------------------------------------

    vendor =
        get_vendor_by_id(
            vendor_id
        )

    if vendor is None:

        raise HTTPException(
            status_code=404,
            detail="Shop not found."
        )


    # --------------------------------------
    # Maintenance
    # --------------------------------------

    if get_vendor_maintenance(
        vendor_id
    ):

        raise HTTPException(
            status_code=503,
            detail=(
                "This shop is currently "
                "under maintenance."
            )
        )


    # --------------------------------------
    # Accept orders
    # --------------------------------------

    settings =
        get_vendor_settings(
            vendor_id
        )


    if settings is not None:

        accept_orders =
            bool(
                settings.get(
                    "accept_orders",
                    True
                )
            )

        if not accept_orders:

            raise HTTPException(
                status_code=403,
                detail=(
                    "This shop is currently "
                    "not accepting new orders."
                )
            )


    # --------------------------------------
    # Copies
    # --------------------------------------

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


    # --------------------------------------
    # Page range
    # --------------------------------------

    page_range =
        page_range.strip()


    if page_range == "":

        raise HTTPException(
            status_code=400,
            detail="Page range cannot be empty."
        )


    if page_range.lower() != "all":

        pattern =
            r"^[0-9,\-\s]+$"

        if not re.match(
            pattern,
            page_range
        ):

            raise HTTPException(
                status_code=400,
                detail="Invalid page range."
            )


    # --------------------------------------
    # Filename
    # --------------------------------------

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="No file selected."
        )


    extension =
        Path(
            file.filename
        ).suffix.lower()


    if extension not in ALLOWED_EXTENSIONS:

        raise HTTPException(
            status_code=400,
            detail="Unsupported file type."
        )


    # --------------------------------------
    # Block videos
    # --------------------------------------

    if (
        file.content_type
        and
        file.content_type.startswith(
            "video/"
        )
    ):

        raise HTTPException(
            status_code=400,
            detail="Video files are not allowed."
        )


    # --------------------------------------
    # MIME validation
    # --------------------------------------

    if (
        file.content_type
        and
        file.content_type
        not in ALLOWED_MIME_TYPES
    ):

        /*
         * Some Android browsers return
         * an empty or unusual MIME type.
         *
         * Extension remains the primary
         * validation mechanism.
         */

        if file.content_type != "":
            raise HTTPException(
                status_code=400,
                detail=(
                    "Unsupported file format."
                )
            )


    # --------------------------------------
    # Print type
    # --------------------------------------

    if print_type not in [
        "bw",
        "color"
    ]:

        raise HTTPException(
            status_code=400,
            detail="Invalid print type."
        )


    # --------------------------------------
    # Generate Job ID
    # --------------------------------------

    job_id =
        str(
            uuid.uuid4()
        )


    filename =
        f"{job_id}{extension}"


    filepath =
        UPLOAD_FOLDER / filename


    # --------------------------------------
    # Save file
    # --------------------------------------

    try:

        with open(
            filepath,
            "wb"
        ) as buffer:

            shutil.copyfileobj(
                file.file,
                buffer
            )

    except Exception as error:

        logger.exception(
            "File saving failed."
        )

        if filepath.exists():
            filepath.unlink()

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to save the uploaded file."
            )
        )


    # --------------------------------------
    # File size
    # --------------------------------------

    try:

        file_size =
            filepath.stat().st_size

    except Exception:

        if filepath.exists():
            filepath.unlink()

        raise HTTPException(
            status_code=500,
            detail="Unable to read uploaded file."
        )


    if file_size <= 0:

        filepath.unlink(
            missing_ok=True
        )

        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty."
        )


    if file_size > MAX_FILE_SIZE:

        filepath.unlink(
            missing_ok=True
        )

        raise HTTPException(
            status_code=400,
            detail="Maximum file size is 20 MB."
        )


    # --------------------------------------
    # Count pages
    # --------------------------------------

    try:

        total_pages =
            await run_in_threadpool(
                count_pages,
                filepath
            )

    except ValueError as error:

        filepath.unlink(
            missing_ok=True
        )

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except Exception as error:

        logger.exception(
            "Unexpected page counting error."
        )

        filepath.unlink(
            missing_ok=True
        )

        raise HTTPException(
            status_code=400,
            detail=(
                "Unable to read this file. "
                "Please try another file."
            )
        )


    if total_pages < 1:

        filepath.unlink(
            missing_ok=True
        )

        raise HTTPException(
            status_code=400,
            detail="The file contains no printable pages."
        )


    logger.info(
        f"Detected Pages: {total_pages}"
    )


    # --------------------------------------
    # Not paid yet
    # --------------------------------------

    queue_number = 0

    waiting_time = 0


    # --------------------------------------
    # Calculate price
    # --------------------------------------

    total_amount =
        calculate_price(
            pages=total_pages,
            copies=copies,
            print_type=print_type
        )


    # --------------------------------------
    # Save database
    # --------------------------------------

    try:

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


        update_job_details(
            job_id,
            total_pages,
            total_amount,
            queue_number,
            copies,
            print_type,
            paper_size
        )


        mark_payment_pending(
            job_id
        )

    except Exception as error:

        logger.exception(
            "Database job creation failed."
        )

        filepath.unlink(
            missing_ok=True
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to create the print job. "
                "Please try again."
            )
        )


    # --------------------------------------
    # CUSTOMER RESPONSE
    #
    # Vendor ID is intentionally NOT returned.
    # --------------------------------------

    return {

        "success":
            True,

        "job_id":
            job_id,

        "original_name":
            file.filename,

        "saved_name":
            filename,

        "file_size":
            file_size,

        "uploaded_at":
            datetime.now().isoformat(),

        "queue_number":
            queue_number,

        "total_pages":
            total_pages,

        "total_amount":
            total_amount,

        "estimated_wait_time":
            waiting_time,

        "copies":
            copies,

        "print_type":
            print_type,

        "paper_size":
            paper_size,

        "page_range":
            page_range,

        "payment_status":
            "Pending",

        "printer_status":
            "Pending Payment"
    }


# ==========================================
# PRINT JOB
# ==========================================

class PrintJobRequest(
    BaseModel
):

    job_id: str

    copies: int

    print_type: str

    paper_size: str

    orientation: Optional[str] = (
        "Portrait"
    )

    page_range: str


@app.post("/print")
def create_print_job(
    request: PrintJobRequest
):

    update_print_job(
        job_id=request.job_id,
        copies=request.copies,
        print_type=request.print_type,
        paper_size=request.paper_size,
        orientation=request.orientation,
        page_range=request.page_range
    )

    return {

        "success":
            True,

        "message":
            "Print Job Created",

        "job_id":
            request.job_id
    }

# ==========================================
# UPDATE EXISTING JOB
# ==========================================

@app.put(
    "/jobs/{job_id}"
)
def update_existing_job(

    job_id: str,

    request: PrintJobRequest
):

    job =
        get_print_job(
            job_id
        )


    if not job:

        raise HTTPException(
            status_code=404,
            detail="Job not found."
        )


    if job[
        "payment_status"
    ] == "Paid":

        raise HTTPException(
            status_code=400,
            detail=(
                "Paid jobs cannot be modified."
            )
        )


    total_pages =
        job["total_pages"]


    total_amount =
        calculate_price(
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
        queue_number=job[
            "queue_number"
        ],
        copies=request.copies,
        print_type=request.print_type,
        paper_size=request.paper_size
    )


    return {

        "success":
            True,

        "job_id":
            job_id,

        "total_pages":
            total_pages,

        "total_amount":
            total_amount,

        "queue_number":
            job["queue_number"],

        "estimated_wait_time":
            max(
                0,
                (
                    job[
                        "queue_number"
                    ] - 1
                ) * 2
            ),

        "printer_status":
            job["printer_status"]
    }


# ==========================================
# SINGLE JOB
# ==========================================

@app.get(
    "/jobs/{job_id}"
)
def fetch_job(
    job_id: str
):

    job =
        get_print_job(
            job_id
        )


    if not job:

        raise HTTPException(
            status_code=404,
            detail="Job not found."
        )


    job =
        dict(job)


    job["orders_ahead"] =
        max(
            0,
            job["queue_number"] - 1
        )


    job[
        "estimated_wait_time"
    ] =
        job["orders_ahead"] * 2


    /*
     * Remove internal vendor identifier
     * from customer-facing job response.
     */

    job.pop(
        "vendor_id",
        None
    )


    return job


# ==========================================
# ALL JOBS
# ==========================================

@app.get("/jobs")
def fetch_all_jobs():

    jobs =
        get_all_print_jobs()

    return [
        {
            key: value
            for key, value in dict(job).items()
            if key != "vendor_id"
        }
        for job in jobs
    ]


# ==========================================
# CUSTOMER VENDOR VALIDATION
# ==========================================

@app.get(
    "/customer/vendor/{vendor_id}/validate"
)
def validate_customer_vendor(
    vendor_id: str
):

    vendor =
        get_vendor_by_id(
            vendor_id
        )


    if vendor is None:

        return {

            "valid":
                False,

            "message":
                "Shop not found."
        }


    maintenance =
        bool(
            get_vendor_maintenance(
                vendor_id
            )
        )


    settings =
        get_vendor_settings(
            vendor_id
        )


    accept_orders = True


    if settings is not None:

        accept_orders =
            bool(
                settings.get(
                    "accept_orders",
                    True
                )
            )


    /*
     * Do not expose:
     * vendor_id
     * owner details
     * internal information
     */

    return {

        "valid":
            True,

        "maintenance":
            maintenance,

        "accept_orders":
            accept_orders,

        "active":
            True
    }

# ==========================================
# GLOBAL EXCEPTION HANDLER
# ==========================================

@app.exception_handler(
    Exception
)
async def global_exception_handler(
    request: Request,
    exc: Exception
):

    logger.error(
        f"SERVER ERROR: {exc}"
    )

    logger.exception(
        "Unhandled exception"
    )


    return JSONResponse(
        status_code=500,
        content={
            "success":
                False,

            "message":
                "Internal Server Error"
        }
    )