# ==========================================
# ServePrint Backend (Part 1A)
# Imports
# ==========================================
import logging
import re
from pydantic import BaseModel
from pathlib import Path
from datetime import datetime
import shutil
import uuid

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
    Request
)
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pypdf import PdfReader

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
    start_printing,
    complete_printing,
    update_print_job
)

# ==========================================
# FastAPI App
# ==========================================

app = FastAPI(
    title="ServePrint API",
    description="Backend API for ServePrint",
    version="1.0.0"
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

initialize_database()

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
    ".doc",
    ".docx",
    ".ppt",
    ".pptx",
    ".xls",
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
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    # Mobile browsers / OS file pickers sometimes report PDFs as this
    # generic type. Extension check below is the real gatekeeper, this
    # just stops a valid PDF from being rejected on MIME alone.
    "application/octet-stream"
}

# ==========================================
# Pricing
# ==========================================

PRICE_PER_PAGE = 2.0
MAX_FILE_SIZE = 20 * 1024 * 1024


def calculate_price(pages: int, copies: int = 1):
    return pages * copies * PRICE_PER_PAGE


# ==========================================
# Waiting Time
# ==========================================

def estimate_wait_time(queue_number: int):
    return queue_number * 2


# ==========================================
# PDF Page Counter
# ==========================================

def count_pages(filepath: Path):

    if filepath.suffix.lower() != ".pdf":
        return 1

    try:
        reader = PdfReader(str(filepath))
        pages = len(reader.pages)
        logger.info(f"PDF Pages: {pages}")
        return pages

    except Exception as e:
        logger.error(f"PDF ERROR: {e}")
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
    file: UploadFile = File(...),
    copies: int = Form(1),
    print_type: str = Form("bw"),
    paper_size: str = Form("A4"),
    page_range: str = Form("All")
):
    # ------------------------------
    # Validate Copies
    # ------------------------------

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

    # ------------------------------
    # Validate Page Range
    # ------------------------------

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

    # ------------------------------
    # Validate Extension
    # (runs for EVERY upload, not just non-"All" page ranges)
    # ------------------------------

    extension = Path(file.filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type."
        )

    # ------------------------------
    # Block Videos
    # (runs for EVERY upload)
    # ------------------------------

    if file.content_type and file.content_type.startswith("video/"):
        raise HTTPException(
            status_code=400,
            detail="Video files are not allowed."
        )

    # ------------------------------
    # Validate MIME Type
    # (runs for EVERY upload)
    # ------------------------------

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported MIME type: {file.content_type}"
        )

    # ------------------------------
    # Validate Print Type
    # ------------------------------

    if print_type not in ["bw", "color"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid print type."
        )

    # ------------------------------
    # Generate Job
    # ------------------------------

    job_id = str(uuid.uuid4())
    filename = f"{job_id}{extension}"
    filepath = UPLOAD_FOLDER / filename

    # ------------------------------
    # Save File
    # ------------------------------

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = filepath.stat().st_size

    # ------------------------------
    # Validate File Size
    # ------------------------------

    if file_size > MAX_FILE_SIZE:
        filepath.unlink()
        raise HTTPException(
            status_code=400,
            detail="Maximum file size is 20 MB."
        )

    # ------------------------------
    # Count Pages
    # (this is the line that was never being reached before)
    # ------------------------------

    total_pages = count_pages(filepath)

    logger.info(f"Detected Pages: {total_pages}")

    # ------------------------------
    # Queue
    # ------------------------------

    queue_number = get_next_queue_number()
    waiting_time = estimate_wait_time(queue_number)

    # ------------------------------
    # Calculate Price
    # ------------------------------

    total_amount = calculate_price(
        pages=total_pages,
        copies=copies
    )

    # ------------------------------
    # Save Database
    # ------------------------------

    save_print_job(
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

    mark_payment_pending(job_id)

    # ------------------------------
    # Response
    # ------------------------------

    return {
        "success": True,
        "job_id": job_id,
        "original_name": file.filename,
        "saved_name": filename,
        "file_size": file_size,
        "uploaded_at": datetime.now().isoformat(),
        "queue_number": queue_number,
        "total_pages": total_pages,
        "total_amount": total_amount,
        "estimated_wait_time": waiting_time,
        "copies": copies,
        "print_type": print_type,
        "paper_size": paper_size,
        "page_range": page_range,
        "payment_status": "Pending",
        "printer_status": "Waiting"
    }


# ==========================================
# Create Print Job API
# ==========================================

class PrintJobRequest(BaseModel):
    job_id: str
    copies: int
    print_type: str
    paper_size: str
    orientation: str
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

    return dict(job)


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
def payment_status(job_id: str, status: str):
    update_payment_status(job_id, status)

    return {
        "success": True,
        "job_id": job_id,
        "payment_status": status
    }


# ==========================================
# Update Printer Status
# ==========================================

@app.put("/jobs/{job_id}/printer/{status}")
def printer_status(job_id: str, status: str):
    update_printer_status(job_id, status)

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
    mark_payment_success(job_id, payment_id)

    return {
        "success": True,
        "job_id": job_id,
        "payment_id": payment_id,
        "payment_status": "Paid"
    }


# ==========================================
# Start Printing
# ==========================================

@app.post("/jobs/{job_id}/start")
def start_job(job_id: str):
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
def complete_job(job_id: str):
    complete_printing(job_id)

    return {
        "success": True,
        "job_id": job_id,
        "printer_status": "Completed"
    }


# ==========================================
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


# ==========================================
# Startup Message
# ==========================================

print("=" * 50)
print("ServePrint Backend Loaded Successfully")
print("Version : 1.0.0")
print("FastAPI Ready")
print("=" * 50)
