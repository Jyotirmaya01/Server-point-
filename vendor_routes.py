from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from vendor_database import (
    register_vendor,
    verify_vendor,
    get_vendor_by_id,
    hash_password,
)

import os
import time
import hmac
import hashlib
import base64


# ==========================================
# Vendor Router
# ==========================================

router = APIRouter(
    prefix="/vendor",
    tags=["Vendor"]
)


# ==========================================
# Authentication Secret
# ==========================================

VENDOR_AUTH_SECRET = os.getenv(
    "VENDOR_AUTH_SECRET",
    "SERVEPRINT_CHANGE_THIS_SECRET_2026"
)


# ==========================================
# Token Creation
# ==========================================

def create_vendor_token(vendor_id: str):

    timestamp = str(int(time.time()))

    payload = f"{vendor_id}:{timestamp}"

    signature = hmac.new(
        VENDOR_AUTH_SECRET.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()

    token_data = f"{payload}:{signature}"

    token = base64.urlsafe_b64encode(
        token_data.encode()
    ).decode()

    return token


# ==========================================
# Token Verification
# ==========================================

def get_authenticated_vendor(
    authorization: str | None
):

    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authentication required."
        )

    if not authorization.startswith("Bearer "):

        raise HTTPException(
            status_code=401,
            detail="Invalid authentication format."
        )

    token = authorization.replace(
        "Bearer ",
        "",
        1
    ).strip()

    try:

        decoded = base64.urlsafe_b64decode(
            token.encode()
        ).decode()

        parts = decoded.split(":")

        if len(parts) != 3:

            raise ValueError()

        vendor_id = parts[0]
        timestamp = parts[1]
        received_signature = parts[2]

        payload = f"{vendor_id}:{timestamp}"

        expected_signature = hmac.new(
            VENDOR_AUTH_SECRET.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(
            received_signature,
            expected_signature
        ):

            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token."
            )

        # Token expires after 7 days
        token_age = int(time.time()) - int(timestamp)

        if token_age > 7 * 24 * 60 * 60:

            raise HTTPException(
                status_code=401,
                detail="Authentication token expired."
            )

        vendor = get_vendor_by_id(vendor_id)

        if vendor is None:

            raise HTTPException(
                status_code=401,
                detail="Vendor account not found."
            )

        return vendor

    except HTTPException:
        raise

    except Exception:

        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token."
        )


# ==========================================
# Vendor Signup
# ==========================================

class VendorSignup(BaseModel):

    shop_name: str
    owner_name: str
    email: str
    password: str
    phone: str = ""
    address: str = ""


# ==========================================
# Vendor Login
# ==========================================

class VendorLogin(BaseModel):

    email: str
    password: str


# ==========================================
# Signup
# ==========================================

@router.post("/signup")
def vendor_signup(data: VendorSignup):

    vendor_id = register_vendor(

        shop_name=data.shop_name,
        owner_name=data.owner_name,
        email=data.email,
        password_hash=hash_password(data.password),
        phone=data.phone,
        address=data.address

    )

    return {

        "success": True,
        "vendor_id": vendor_id,
        "message": "Vendor Registered Successfully"

    }


# ==========================================
# Login
# ==========================================

@router.post("/login")
def vendor_login(data: VendorLogin):

    vendor = verify_vendor(
        data.email,
        data.password
    )

    if not vendor:

        raise HTTPException(
            status_code=401,
            detail="Invalid Email or Password"
        )

    token = create_vendor_token(
        vendor["vendor_id"]
    )

    return {

        "success": True,

        "vendor_id": vendor["vendor_id"],

        "shop_name": vendor["shop_name"],

        "owner_name": vendor["owner_name"],

        "token": token

    }


# ==========================================
# Vendor Profile
# ==========================================

@router.get("/{vendor_id}")
def vendor_profile(vendor_id: str):

    vendor = get_vendor_by_id(vendor_id)

    if not vendor:

        raise HTTPException(
            status_code=404,
            detail="Vendor Not Found"
        )

    return dict(vendor)