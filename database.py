import sqlite3
from pathlib import Path

# ==========================
# Database Configuration
# ==========================

DATABASE_NAME = "serveprint.db"

DATABASE_PATH = Path(DATABASE_NAME)

# ==========================
# Database Connection
# ==========================

def get_connection():

    connection = sqlite3.connect(DATABASE_PATH)

    connection.row_factory = sqlite3.Row

    return connection

# ==========================
# Create Database
# ==========================

def initialize_database():

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute("""

        CREATE TABLE IF NOT EXISTS print_jobs (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            job_id TEXT UNIQUE NOT NULL,

            vendor_id TEXT NOT NULL,

            original_name TEXT NOT NULL,

            saved_name TEXT NOT NULL,

            file_size INTEGER,

            copies INTEGER DEFAULT 1,

            paper_size TEXT DEFAULT 'A4',

            orientation TEXT DEFAULT 'Portrait',

            print_type TEXT DEFAULT 'bw',

            page_range TEXT DEFAULT 'All',

            total_pages INTEGER DEFAULT 0,

            total_amount REAL DEFAULT 0,

            payment_status TEXT DEFAULT 'Pending',

            printer_status TEXT DEFAULT 'Waiting',

            queue_number INTEGER DEFAULT 0,

            payment_id TEXT DEFAULT '',

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

        )

    """)

    connection.commit()

    connection.close()

# ==========================
# Initialize Database
# ==========================

initialize_database()

print("ServePrint Database Ready")

# ==========================
# Save Print Job
# ==========================

def save_print_job(
  vendor_id,
    job_id,
    original_name,
    saved_name,
    file_size,
    total_pages,
    queue_number,
    total_amount
):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        INSERT INTO print_jobs (
        vendor_id,
            job_id,
            original_name,
            saved_name,
            file_size,
            total_pages,
            queue_number,
            total_amount
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
      vendor_id,
        job_id,
        original_name,
        saved_name,
        file_size,
        total_pages,
        queue_number,
        total_amount
    ))

    connection.commit()
    connection.close()

# ==========================
# Get Print Job
# ==========================

def get_print_job(job_id):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(

        "SELECT * FROM print_jobs WHERE job_id=?",

        (job_id,)

    )

    job = cursor.fetchone()

    connection.close()

    return job

# ==========================
# Get All Print Jobs
# ==========================

def get_all_print_jobs():

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute("""

        SELECT *

        FROM print_jobs

        ORDER BY created_at DESC

    """)

    jobs = cursor.fetchall()

    connection.close()

    return jobs


# ==========================
# Update Payment Status
# ==========================

def update_payment_status(job_id, status):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute("""

        UPDATE print_jobs

        SET payment_status=?

        WHERE job_id=?

    """, (

        status,

        job_id

    ))

    connection.commit()

    connection.close()


# ==========================
# Update Printer Status
# ==========================

def update_printer_status(job_id, status):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute("""

        UPDATE print_jobs

        SET printer_status=?

        WHERE job_id=?

    """, (

        status,

        job_id

    ))

    connection.commit()

    connection.close()


# ==========================
# Update Print Job
# ==========================

def update_print_job(

    job_id,
    copies,
    print_type,
    paper_size,
    orientation,
    page_range

):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute("""

        UPDATE print_jobs

        SET

            copies=?,
            print_type=?,
            paper_size=?,
            orientation=?,
            page_range=?

        WHERE job_id=?

    """, (

        copies,
        print_type,
        paper_size,
        orientation,
        page_range,
        job_id

    ))

    connection.commit()

    connection.close()


# ==========================
# Start Printing
# ==========================

def start_printing(job_id):

    update_printer_status(

        job_id,

        "Printing"

    )


# ==========================
# Complete Printing
# ==========================

def complete_printing(job_id):

    job = get_print_job(job_id)

    update_printer_status(
        job_id,
        "Completed"
    )

    refresh_queue(
        job["vendor_id"]
    )


# ==========================
# Queue Number
# ==========================

def get_next_queue_number(vendor_id):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute("""

        SELECT MAX(queue_number)

        FROM print_jobs

        WHERE vendor_id = ?

    """, (vendor_id,))

    result = cursor.fetchone()

    connection.close()

    if result[0] is None:

        return 1

    return result[0] + 1


# ==========================
# Update Job Details
# ==========================

def update_job_details(

    job_id,

    total_pages,

    total_amount,

    queue_number,

    copies,

    print_type,

    paper_size

):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute("""

        UPDATE print_jobs

        SET

            total_pages=?,
            total_amount=?,
            queue_number=?,
            copies=?,
            print_type=?,
            paper_size=?

        WHERE job_id=?

    """, (

        total_pages,

        total_amount,

        queue_number,

        copies,

        print_type,

        paper_size,

        job_id

    ))

    connection.commit()

    connection.close()


# ==========================
# Update Payment Information
# ==========================

def update_payment(

    job_id,

    payment_id,

    payment_status

):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute("""

        UPDATE print_jobs

        SET

            payment_status=?,

            payment_id=?

        WHERE job_id=?

    """, (

        payment_status,

        payment_id,

        job_id

    ))

    connection.commit()

    connection.close()


# ==========================
# Payment Pending
# ==========================

def mark_payment_pending(job_id):

    update_payment(

        job_id,

        "",

        "Pending"

    )


# ==========================
# Payment Success
# ==========================

def mark_payment_success(

    job_id,

    payment_id

):

    update_payment(

        job_id,

        payment_id,

        "Paid"

    )

# ==========================
# Assign Queue After Payment
# Transaction Safe
# ==========================

def assign_queue_after_payment(vendor_id, job_id, payment_id):

    connection = get_connection()

    # Lock database for this transaction
    connection.execute("BEGIN IMMEDIATE")

    cursor = connection.cursor()

    cursor.execute("""
        SELECT COALESCE(MAX(queue_number), 0)
        FROM print_jobs
        WHERE vendor_id = ?
AND  payment_status='Paid'
        AND printer_status!='Completed'
    """, (vendor_id,))

    queue_number = cursor.fetchone()[0] + 1

    cursor.execute("""
        UPDATE print_jobs
        SET
            payment_status='Paid',
            payment_id=?,
            printer_status='Waiting',
            queue_number=?
        WHERE job_id=?
    """, (
      payment_id,
        queue_number,
        job_id
    ))

    connection.commit()

    connection.close()

    refresh_queue(vendor_id)

    return queue_number

# refresh queue 

def refresh_queue(vendor_id):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT job_id
        FROM print_jobs
        WHERE vendor_id = ?
AND payment_status='Paid'
AND printer_status!='Completed'
        ORDER BY created_at ASC
    """, (vendor_id,))

    jobs = cursor.fetchall()

    queue = 1

    for job in jobs:

        cursor.execute("""
            UPDATE print_jobs
            SET queue_number=?
            WHERE job_id=?
        """, (
            queue,
            job["job_id"]
        ))

        queue += 1

    connection.commit()
    connection.close()


from datetime import datetime, timedelta

def cleanup_expired_jobs():

    connection = get_connection()
    cursor = connection.cursor()

    expiry_time = (
        datetime.now() - timedelta(minutes=2)
    ).strftime("%Y-%m-%d %H:%M:%S")

    # ----------------------------------
    # Collect expired files
    # ----------------------------------

    cursor.execute("""
        SELECT saved_name
        FROM print_jobs
        WHERE payment_status='Pending'
        AND created_at <= ?
    """, (expiry_time,))

    expired_files = [
        row["saved_name"]
        for row in cursor.fetchall()
    ]

    # ----------------------------------
    # Collect affected vendors BEFORE delete
    # ----------------------------------

    cursor.execute("""
        SELECT DISTINCT vendor_id
        FROM print_jobs
        WHERE payment_status='Pending'
        AND created_at <= ?
    """, (expiry_time,))

    affected_vendors = [
        row["vendor_id"]
        for row in cursor.fetchall()
    ]

    # ----------------------------------
    # Delete expired jobs
    # ----------------------------------

    cursor.execute("""
        DELETE FROM print_jobs
        WHERE payment_status='Pending'
        AND created_at <= ?
    """, (expiry_time,))

    connection.commit()
    connection.close()

    # ----------------------------------
    # Refresh only affected vendors
    # ----------------------------------

    for vendor_id in affected_vendors:

        refresh_queue(vendor_id)

    return expired_files

# ==========================================
# Vendor Dashboard
# ==========================================

def get_vendor_dashboard(vendor_id):

    connection = get_connection()

    cursor = connection.cursor()

    # Today's Revenue
    cursor.execute("""
        SELECT COALESCE(SUM(total_amount),0)
        FROM print_jobs
        WHERE vendor_id=?
        AND payment_status='Paid'
        AND DATE(created_at)=DATE('now')
    """,(vendor_id,))

    today_revenue = cursor.fetchone()[0]

    # Today's Orders
    cursor.execute("""
        SELECT COUNT(*)
        FROM print_jobs
        WHERE vendor_id=?
        AND DATE(created_at)=DATE('now')
    """,(vendor_id,))

    today_orders = cursor.fetchone()[0]

    # Waiting Queue
    cursor.execute("""
        SELECT COUNT(*)
        FROM print_jobs
        WHERE vendor_id=?
        AND printer_status='Waiting'
    """,(vendor_id,))

    queue_jobs = cursor.fetchone()[0]

    # Printing Jobs
    cursor.execute("""
        SELECT COUNT(*)
        FROM print_jobs
        WHERE vendor_id=?
        AND printer_status='Printing'
    """,(vendor_id,))

    printing_jobs = cursor.fetchone()[0]

    # Completed
    cursor.execute("""
        SELECT COUNT(*)
        FROM print_jobs
        WHERE vendor_id=?
        AND printer_status='Completed'
        AND DATE(created_at)=DATE('now')
    """,(vendor_id,))

    completed_jobs = cursor.fetchone()[0]

    # Pages
    cursor.execute("""
        SELECT COALESCE(SUM(total_pages),0)
        FROM print_jobs
        WHERE vendor_id=?
        AND DATE(created_at)=DATE('now')
    """,(vendor_id,))

    total_pages = cursor.fetchone()[0]

    connection.close()

    return {

        "today_revenue":today_revenue,

        "today_orders":today_orders,

        "queue_jobs":queue_jobs,

        "printing_jobs":printing_jobs,

        "completed_jobs":completed_jobs,

        "average_wait":queue_jobs*2,

        "total_pages":total_pages,

        "rating":5.0

    }

# ==========================================
# Vendor Orders
# ==========================================

def get_vendor_orders(vendor_id):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute("""

        SELECT

            job_id,
            queue_number,
            original_name,
            copies,
            total_pages,
            total_amount,
            payment_status,
            printer_status,
            created_at

        FROM print_jobs

        WHERE vendor_id = ?

        ORDER BY queue_number ASC

    """, (vendor_id,))

    jobs = cursor.fetchall()

    connection.close()

    return [dict(job) for job in jobs]


 # ==========================================
# Vendor QR
# ==========================================
