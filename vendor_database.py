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

    connection.commit()
    connection.close()

    return vendor_id

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
