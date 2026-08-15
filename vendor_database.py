import sqlite3
import uuid

from pathlib import Path
from datetime import datetime
from passlib.context import CryptContext


pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

# ==========================================
# Vendor Database Configuration
# ==========================================

DATABASE_NAME = "serveprint.db"
DATABASE_PATH = Path(DATABASE_NAME)

# ==========================================
# Database Connection
# ==========================================

def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection

# ==========================================
# Vendor Table
# ==========================================

def initialize_vendor_database():
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS vendors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor_id TEXT UNIQUE NOT NULL,
            shop_name TEXT NOT NULL,
            owner_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            logo TEXT DEFAULT '',
            qr_code TEXT DEFAULT '',
            razorpay_key TEXT DEFAULT '',
            razorpay_secret TEXT DEFAULT '',
            bw_price REAL DEFAULT 2,
            color_price REAL DEFAULT 10,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS vendor_settings (
            vendor_id TEXT PRIMARY KEY,
            maintenance INTEGER DEFAULT 0,
            accept_orders INTEGER DEFAULT 1,
            razorpay_key TEXT DEFAULT '',
            razorpay_secret TEXT DEFAULT '',
            google_sheet_id TEXT DEFAULT '',
            service_email TEXT DEFAULT '',
            smtp_host TEXT DEFAULT '',
            smtp_port INTEGER DEFAULT 587,
            smtp_email TEXT DEFAULT '',
            smtp_password TEXT DEFAULT '',
            subscription_plan TEXT DEFAULT 'Trial',
            subscription_status TEXT DEFAULT 'Active',
            subscription_expiry TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (vendor_id)
                REFERENCES vendors(vendor_id)
        )
    """)

    connection.commit()
    connection.close()

     

# ==========================================
# Register Vendor
# ==========================================
def register_vendor(
    shop_name,
    owner_name,
    email,
    password_hash,
    phone="",
    address=""
):
    connection = get_connection()
    cursor = connection.cursor()

    vendor_id = generate_vendor_id()

    cursor.execute("""
        INSERT INTO vendors (
            vendor_id,
            shop_name,
            owner_name,
            email,
            password_hash,
            phone,
            address
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        vendor_id,
        shop_name,
        owner_name,
        email,
        password_hash,
        phone,
        address
    ))

    cursor.execute("""
        INSERT INTO vendor_settings (
            vendor_id
        )
        VALUES (?)
    """, (
        vendor_id,
    ))

    connection.commit()
    connection.close()

    return vendor_id
    

# ==========================================
# Get Vendor Settings
# ==========================================

def get_vendor_settings(vendor_id):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute("""
    SELECT

        v.vendor_id,
        v.shop_name,
        v.owner_name,
        v.phone,
        v.address,

        s.maintenance,
        s.accept_orders,

        s.razorpay_key,
        s.razorpay_secret,

        s.google_sheet_id,

        s.service_email,

        s.smtp_host,
        s.smtp_port,
        s.smtp_email,
        s.smtp_password,

        s.subscription_plan,
        s.subscription_status,
        s.subscription_expiry

    FROM vendors v

    JOIN vendor_settings s

        ON v.vendor_id = s.vendor_id

    WHERE v.vendor_id = ?

    """, (vendor_id,))

    data = cursor.fetchone()

    connection.close()

    if data is None:

        return None

    return dict(data)


# ==========================================
# Update Maintenance Mode
# ==========================================

def update_vendor_maintenance(vendor_id, maintenance):

    connection = get_connection()
    cursor = connection.cursor()

    try:

        cursor.execute("""
            UPDATE vendor_settings
            SET maintenance = ?
            WHERE vendor_id = ?
        """, (
            int(bool(maintenance)),
            vendor_id
        ))

        if cursor.rowcount == 0:
            return False

        connection.commit()

        return True

    except Exception:

        connection.rollback()
        raise

    finally:

        connection.close()


# ==========================================
# Get Maintenance Status
# ==========================================

def get_vendor_maintenance(vendor_id):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT maintenance
        FROM vendor_settings
        WHERE vendor_id = ?
    """, (vendor_id,))

    row = cursor.fetchone()

    connection.close()

    if row is None:
        return None

    return bool(row["maintenance"])
# ==========================================
# Get Vendor By Email
# ==========================================

def get_vendor_by_email(email):
    connection = get_connection()
    cursor = connection.cursor()
    
    cursor.execute("""
        SELECT *
        FROM vendors
        WHERE email=?
    """, (email,))
    
    vendor = cursor.fetchone()
    connection.close()
    
    return vendor

# ==========================================
# Get Vendor By Vendor ID
# ==========================================

def get_vendor_by_id(vendor_id):
    connection = get_connection()
    cursor = connection.cursor()
    
    cursor.execute("""
        SELECT *
        FROM vendors
        WHERE vendor_id=?
    """, (vendor_id,))
    
    vendor = cursor.fetchone()
    connection.close()
    
    return vendor

# ==========================================
# Verify Vendor Login
# ==========================================

def verify_vendor(email, password_hash):
    vendor = get_vendor_by_email(email)
    
    if not vendor:
        return None

    if not verify_password(password_hash, vendor["password_hash"]):
        return None

    return vendor

# ==========================================
# Generate Vendor ID
# ==========================================

def generate_vendor_id():
    return "SP-" + uuid.uuid4().hex[:10].upper()

# ==========================================
# Password Security
# ==========================================

def hash_password(password):
    return pwd_context.hash(password)

def verify_password(password, hashed_password):
    return pwd_context.verify(
        password,
        hashed_password
    )

initialize_vendor_database()

print("Vendor Database Ready")


# ==========================================
# Update Vendor Settings
# ==========================================

def update_vendor_settings(vendor_id, data):

    connection = get_connection()

    cursor = connection.cursor()

    try:

        cursor.execute("""
        UPDATE vendors
        SET

            shop_name=?,
            owner_name=?,
            phone=?,
            address=?

        WHERE vendor_id=?

        """, (

            data.shop_name,
            data.owner_name,
            data.phone,
            data.address,
            vendor_id

        ))

        cursor.execute("""
        UPDATE vendor_settings
        SET

            maintenance=?,
            accept_orders=?,

            razorpay_key=?,
            razorpay_secret=?,

            google_sheet_id=?,

            service_email=?,

            smtp_host=?,
            smtp_port=?,
            smtp_email=?,
            smtp_password=?

        WHERE vendor_id=?

        """, (

            int(data.maintenance),
            int(data.accept_orders),

            data.razorpay_key,
            data.razorpay_secret,

            data.google_sheet_id,

            data.service_email,

            data.smtp_host,
            data.smtp_port,
            data.smtp_email,
            data.smtp_password,

            vendor_id

        ))

        connection.commit()

        return True

    except Exception:

        connection.rollback()

        raise

    finally:

        connection.close()

# ==========================================
# Update Accept Orders
# ==========================================

def update_vendor_accept_orders(
    vendor_id,
    accept_orders
):
    connection = get_connection()
    cursor = connection.cursor()

    try:

        cursor.execute("""
            UPDATE vendor_settings
            SET accept_orders = ?
            WHERE vendor_id = ?
        """, (
            int(bool(accept_orders)),
            vendor_id
        ))

        if cursor.rowcount == 0:
            return False

        connection.commit()

        return True

    except Exception:

        connection.rollback()
        raise

    finally:

        connection.close()