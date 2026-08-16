/* ==========================================
   ServePrint Vendor Signup
   Part 1
========================================== */

// ================================
// Backend URL
// ================================

const API_BASE =
    "https://server-point-xiir.onrender.com";

// ================================
// Form Elements
// ================================

const signupForm =
    document.getElementById("signupForm");

const shopName =
    document.getElementById("shopName");

const ownerName =
    document.getElementById("ownerName");

const email =
    document.getElementById("email");

const phone =
    document.getElementById("phone");

const password =
    document.getElementById("password");

const confirmPassword =
    document.getElementById("confirmPassword");

const address =
    document.getElementById("address");

const terms =
    document.getElementById("terms");

// ================================
// Buttons
// ================================

const signupBtn =
    document.getElementById("signupBtn");

const signupText =
    document.getElementById("signupText");

const signupLoader =
    document.getElementById("signupLoader");

const continueBtn =
    document.getElementById("continueBtn");

// ================================
// Password Toggle
// ================================

const togglePassword =
    document.getElementById("togglePassword");

const toggleConfirmPassword =
    document.getElementById("toggleConfirmPassword");

// ================================
// Messages
// ================================

const errorBox =
    document.getElementById("errorBox");

const successPopup =
    document.getElementById("successPopup");

const vendorId =
    document.getElementById("vendorId");

// ================================
// Terms / Privacy Modal
// ================================

const termsLink =
    document.getElementById("termsLink");

const privacyLink =
    document.getElementById("privacyLink");

const policyModal =
    document.getElementById("policyModal");

const policyModalTitle =
    document.getElementById("policyModalTitle");

const policyModalBody =
    document.getElementById("policyModalBody");

const policyModalClose =
    document.getElementById("policyModalClose");

// ================================
// Utility Functions
// ================================

function showError(message){

    errorBox.textContent = message;

    errorBox.classList.add("active");

}

function hideError(){

    errorBox.textContent = "";

    errorBox.classList.remove("active");

}

// ================================
// Loading
// ================================

function startLoading(){

    signupBtn.disabled = true;

    signupBtn.classList.add("loading");

}

function stopLoading(){

    signupBtn.disabled = false;

    signupBtn.classList.remove("loading");

}

// ================================
// Password Toggle
// ================================

togglePassword.addEventListener("click",function(){

    if(password.type==="password"){

        password.type="text";

        togglePassword.innerHTML=
        '<i class="fa-solid fa-eye-slash"></i>';

    }else{

        password.type="password";

        togglePassword.innerHTML=
        '<i class="fa-solid fa-eye"></i>';

    }

});

toggleConfirmPassword.addEventListener("click",function(){

    if(confirmPassword.type==="password"){

        confirmPassword.type="text";

        toggleConfirmPassword.innerHTML=
        '<i class="fa-solid fa-eye-slash"></i>';

    }else{

        confirmPassword.type="password";

        toggleConfirmPassword.innerHTML=
        '<i class="fa-solid fa-eye"></i>';

    }

});

/* ==========================================
   Part 2
   Validation Functions
========================================== */

// ================================
// Email Validation
// ================================

function isValidEmail(emailAddress){

    const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return emailPattern.test(
        emailAddress
    );

}

// ================================
// Phone Validation
// ================================

function isValidPhone(phoneNumber){

    const phonePattern =
    /^[6-9]\d{9}$/;

    return phonePattern.test(
        phoneNumber
    );

}

// ================================
// Password Validation
// ================================

function isStrongPassword(pass){

    if(pass.length < 8){

        return false;

    }

    return true;

}

// ================================
// Remove Extra Spaces
// ================================

function sanitizeInput(value){

    return value.trim();

}

// ================================
// Form Validation
// ================================

function validateForm(){

    hideError();

    const shop =
    sanitizeInput(shopName.value);

    const owner =
    sanitizeInput(ownerName.value);

    const emailValue =
    sanitizeInput(email.value);

    const phoneValue =
    sanitizeInput(phone.value);

    const passwordValue =
    password.value;

    const confirmValue =
    confirmPassword.value;

    const addressValue =
    sanitizeInput(address.value);

    // Shop name is optional - if left blank, the backend
    // will assign a default name automatically.

    if(owner===""){

        showError(
            "Please enter owner name."
        );

        ownerName.focus();

        return false;

    }

    if(emailValue===""){

        showError(
            "Please enter email address."
        );

        email.focus();

        return false;

    }

    if(!isValidEmail(emailValue)){

        showError(
            "Please enter a valid email."
        );

        email.focus();

        return false;

    }

    if(phoneValue===""){

        showError(
            "Please enter phone number."
        );

        phone.focus();

        return false;

    }

    if(!isValidPhone(phoneValue)){

        showError(
            "Phone number must contain 10 digits."
        );

        phone.focus();

        return false;

    }

    if(passwordValue===""){

        showError(
            "Please create a password."
        );

        password.focus();

        return false;

    }

    if(!isStrongPassword(passwordValue)){

        showError(
            "Password must contain at least 8 characters."
        );

        password.focus();

        return false;

    }

    if(confirmValue===""){

        showError(
            "Please confirm your password."
        );

        confirmPassword.focus();

        return false;

    }

    if(passwordValue!==confirmValue){

        showError(
            "Passwords do not match."
        );

        confirmPassword.focus();

        return false;

    }

    if(addressValue===""){

        showError(
            "Please enter shop address."
        );

        address.focus();

        return false;

    }

    if(!terms.checked){

        showError(
            "Please accept Terms & Conditions."
        );

        return false;

    }

    return true;

}

/* ==========================================
   Part 3
   Signup API
========================================== */

signupForm.addEventListener("submit", async function(e){

    e.preventDefault();

    hideError();

    if(!validateForm()){

        return;

    }

    startLoading();

    const vendorData={

        shop_name:shopName.value.trim(),

        owner_name:ownerName.value.trim(),

        email:email.value.trim().toLowerCase(),

        phone:phone.value.trim(),

        password:password.value,

        address:address.value.trim()

    };

    try{

        const response=await fetch(

            `${API_BASE}/vendor/signup`,

            {

                method:"POST",

                headers:{

                    "Content-Type":"application/json"

                },

                body:JSON.stringify(vendorData)

            }

        );

        const result=await response.json();

        stopLoading();

        if(!response.ok){

            showError(

                result.detail ||

                result.message ||

                "Unable to create vendor account."

            );

            return;

        }

        showSuccess(
    result.vendor_id || "SP-UNKNOWN"
);

} catch(error){

    console.error(error);
    stopLoading();

    showError(
        "Unable to connect to the server. Please try again."
    );

    }

});

/* ==========================================
   Part 4
   Success & Redirect
========================================== */

// ================================
// Continue Button
// ================================

continueBtn.addEventListener("click",function(){

    window.location.href="vendor_login.html";

});

// ================================
// Auto Redirect
// ================================

function redirectToLogin(){

    setTimeout(function(){

        window.location.href="vendor_login.html";

    },3000);

}

// ================================
// Show Success Popup
// ================================

function showSuccess(vendorID){

    vendorId.textContent=vendorID;

    successPopup.classList.add("active");

    redirectToLogin();

}

// ================================
// Phone Input
// ================================

phone.addEventListener("input",function(){

    this.value=this.value
        .replace(/\D/g,"")
        .slice(0,10);

});

// ================================
// Hide Error While Typing
// ================================

shopName.addEventListener("input",hideError);

ownerName.addEventListener("input",hideError);

email.addEventListener("input",hideError);

phone.addEventListener("input",hideError);

password.addEventListener("input",hideError);

confirmPassword.addEventListener("input",hideError);

address.addEventListener("input",hideError);

// ================================
// Enter Key
// ================================

document.addEventListener("keydown",function(e){

    if(e.key==="Enter"){

        if(document.activeElement.tagName!=="TEXTAREA"){

            e.preventDefault();

            signupForm.requestSubmit();

        }

    }

});

// ================================
// Terms & Privacy Content
// ================================

const TERMS_CONTENT = `
    <h4>1. Your Print Shop Account</h4>
    <p>By creating a vendor account you confirm that the shop
    details you provide are accurate and that you are authorised
    to operate the print shop being registered.</p>

    <h4>2. Orders & Payments</h4>
    <p>Customers pay for print jobs through ServePrint's payment
    flow. You are responsible for fulfilling paid orders promptly
    and keeping your shop's maintenance and order-acceptance
    status up to date in your dashboard.</p>

    <h4>3. Fair Use</h4>
    <p>You agree not to misuse the platform, including uploading
    unlawful content, attempting to access other vendors' data,
    or interfering with the normal operation of the service.</p>

    <h4>4. Account Suspension</h4>
    <p>ServePrint may suspend accounts found to be in violation of
    these terms or engaged in fraudulent activity.</p>
`;

const PRIVACY_CONTENT = `
    <h4>Information We Collect</h4>
    <p>We collect the shop, owner, and contact details you submit
    at signup, along with order and queue data generated while you
    use your vendor dashboard.</p>

    <h4>How We Use It</h4>
    <p>Your information is used to operate your vendor account,
    process customer orders placed through your QR code, and show
    you order/queue analytics.</p>

    <h4>Sharing</h4>
    <p>We do not sell your data. Customer-facing pages only ever
    receive the minimum information needed to place an order -
    your internal vendor ID is never shown to customers.</p>

    <h4>Your Choices</h4>
    <p>You can update your shop details from your dashboard at any
    time, or contact support to request account deletion.</p>
`;

function openPolicyModal(title, contentHTML){

    policyModalTitle.textContent = title;
    policyModalBody.innerHTML = contentHTML;
    policyModal.classList.add("active");

}

function closePolicyModal(){

    policyModal.classList.remove("active");

}

if (termsLink) {
    termsLink.addEventListener("click", function (e) {
        e.preventDefault();
        openPolicyModal("Terms & Conditions", TERMS_CONTENT);
    });
}

if (privacyLink) {
    privacyLink.addEventListener("click", function (e) {
        e.preventDefault();
        openPolicyModal("Privacy Policy", PRIVACY_CONTENT);
    });
}

if (policyModalClose) {
    policyModalClose.addEventListener("click", closePolicyModal);
}

if (policyModal) {
    policyModal.addEventListener("click", function (e) {
        if (e.target === policyModal) {
            closePolicyModal();
        }
    });
}

// ================================
// Page Loaded
// ================================

window.addEventListener("load",function(){

    hideError();

    shopName.focus();

    console.log("ServePrint Vendor Signup Loaded");

});