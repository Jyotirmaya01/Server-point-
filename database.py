from database import initialize_database

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

            original_name TEXT NOT NULL,

            saved_name TEXT NOT NULL,

            file_size INTEGER,

            copies INTEGER DEFAULT 1,

            paper_size TEXT DEFAULT 'A4',

            print_type TEXT DEFAULT 'Black & White',

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
    job_id,
    original_name,
    saved_name,
    file_size
):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute("""

        INSERT INTO print_jobs (

            job_id,
            original_name,
            saved_name,
            file_size

        )

        VALUES (?, ?, ?, ?)

    """, (

        job_id,
        original_name,
        saved_name,
        file_size

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

  def update_print_job(

    job_id,
    copies,
    print_type,
    paper_size,
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
            page_range=?

        WHERE job_id=?

    """, (

        copies,
        print_type,
        paper_size,
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

    update_printer_status(

        job_id,

        "Completed"

    )

  # ==========================
# Queue Number
# ==========================

def get_next_queue_number():

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute("""

        SELECT MAX(queue_number)

        FROM print_jobs

    """)

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