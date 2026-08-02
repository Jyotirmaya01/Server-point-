from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from vendor_database import (
    register_vendor,
    verify_vendor,
    get_vendor_by_id,
    hash_password,
)

router = APIRouter(
    prefix="/vendor",
    tags=["Vendor"]
)


class VendorSignup(BaseModel):

    shop_name: str
    owner_name: str
    email: str
    password: str
    phone: str = ""
    address: str = ""

class VendorLogin(BaseModel):

    email: str
    password: str

@router.post("/signup")
def vendor_signup(data: VendorSignup):

    vendor_id = register_vendor(

        shop_name=data.shop_name,
        owner_name=data.owner_name,
        email=data.email,
        password_hash=data.password,
        phone=data.phone,
        address=data.address

    )

    return {

        "success": True,
        "vendor_id": vendor_id,
        "message": "Vendor Registered Successfully"

    }

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

    return {

        "success": True,
        "vendor_id": vendor["vendor_id"],
        "shop_name": vendor["shop_name"],
        "owner_name": vendor["owner_name"]

    }

@router.get("/{vendor_id}")
def vendor_profile(vendor_id: str):

    vendor = get_vendor_by_id(vendor_id)

    if not vendor:

        raise HTTPException(
            status_code=404,
            detail="Vendor Not Found"
        )

    return dict(vendor)

