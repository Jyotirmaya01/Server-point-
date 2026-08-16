/* =========================================================
   ServePrint Vendor Login
   Final Version
   Part 1
========================================================= */

// =========================================================
// Backend
// =========================================================

const API_URL = "https://server-point-xiir.onrender.com";

// =========================================================
// DOM
// =========================================================

const loginForm =
document.getElementById("loginForm");

const email =
document.getElementById("email");

const password =
document.getElementById("password");

const rememberMe =
document.getElementById("rememberMe");

const loginBtn =
document.getElementById("loginBtn");

const loginText =
document.getElementById("loginText");

const loginLoader =
document.getElementById("loginLoader");

const errorBox =
document.getElementById("errorBox");

const togglePassword =
document.getElementById("togglePassword");

const dashboardBtn =
document.getElementById("dashboardBtn");

const loginSuccessPopup =
document.getElementById("loginSuccessPopup");

const shopNameDisplay =
document.getElementById("shopNameDisplay");

const welcomeBackOverlay =
document.getElementById("welcomeBackOverlay");

const welcomeBackShopName =
document.getElementById("welcomeBackShopName");

const welcomeBackContinue =
document.getElementById("welcomeBackContinue");

const welcomeBackLogout =
document.getElementById("welcomeBackLogout");

// =========================================================
// Helpers
// =========================================================

function showError(message){

    errorBox.textContent = message;

    errorBox.classList.add("active");

}

function hideError(){

    errorBox.textContent = "";

    errorBox.classList.remove("active");

}

// =========================================================
// Loading
// =========================================================

function startLoading(){

    loginBtn.disabled = true;

    loginBtn.classList.add("loading");

}

function stopLoading(){

    loginBtn.disabled = false;

    loginBtn.classList.remove("loading");

}

// =========================================================
// Email Validation
// =========================================================

function isValidEmail(emailAddress){

    const regex =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return regex.test(emailAddress);

}

// =========================================================
// Validation
// =========================================================

function validateForm(){

    hideError();

    const emailValue =
    email.value.trim();

    const passwordValue =
    password.value;

    if(emailValue===""){

        showError(
            "Please enter email."
        );

        email.focus();

        return false;

    }

    if(!isValidEmail(emailValue)){

        showError(
            "Invalid email address."
        );

        email.focus();

        return false;

    }

    if(passwordValue===""){

        showError(
            "Please enter password."
        );

        password.focus();

        return false;

    }

    if(passwordValue.length<8){

        showError(
            "Password should be at least 8 characters."
        );

        password.focus();

        return false;

    }

    return true;

}

// =========================================================
// Password Toggle
// =========================================================

togglePassword.addEventListener(

    "click",

    function(){

        if(password.type==="password"){

            password.type="text";

            togglePassword.innerHTML=

            '<i class="fa-solid fa-eye-slash"></i>';

        }

        else{

            password.type="password";

            togglePassword.innerHTML=

            '<i class="fa-solid fa-eye"></i>';

        }

    }

);

// =========================================================
// Vendor Session
// =========================================================

function saveVendorSession(data){

    const session = {
    vendor_id: data.vendor_id,
    shop_name: data.shop_name,
    owner_name: data.owner_name,
    email: data.email || email.value.trim(),
    token: data.token || null,
    login_time: new Date().toISOString()
};

    localStorage.setItem(

        "serveprint_vendor",

        JSON.stringify(session)

    );

    if(rememberMe.checked){

        localStorage.setItem(

            "remember_vendor",

            "true"

        );

    }

    else{

        localStorage.removeItem(

            "remember_vendor"

        );

    }

}

// =========================================================
// Read Session
// =========================================================

function getVendorSession(){

    const data=

    localStorage.getItem(

        "serveprint_vendor"

    );

    if(!data){

        return null;

    }

    return JSON.parse(data);

}


// =========================================================
// Auto Login ("Remember Me")
// =========================================================
// Previously this silently redirected straight to the
// dashboard with zero visual feedback, which made it look
// like the login form itself was broken. It now shows a
// clear "Welcome Back" screen with an explicit way to log
// out and see the real login form again.
// =========================================================

window.addEventListener("load", function () {

    hideError();

    const session = getVendorSession();

    if (session && localStorage.getItem("remember_vendor") === "true") {

        showWelcomeBack(session);
        return;

    }

    email.focus();

});

function showWelcomeBack(session) {

    if (welcomeBackShopName) {
        welcomeBackShopName.textContent =
            session.shop_name || "Print Shop";
    }

    if (welcomeBackOverlay) {
        welcomeBackOverlay.classList.add("active");
    }

}

if (welcomeBackContinue) {

    welcomeBackContinue.addEventListener("click", function () {

        window.location.href = "vendor_dashboard.html";

    });

}

if (welcomeBackLogout) {

    welcomeBackLogout.addEventListener("click", function () {

        localStorage.removeItem("serveprint_vendor");
        localStorage.removeItem("remember_vendor");

        if (welcomeBackOverlay) {
            welcomeBackOverlay.classList.remove("active");
        }

        email.focus();

    });

}

// =========================================================
// Login API
// =========================================================

loginForm.addEventListener(

    "submit",

    async function (e) {

        e.preventDefault();

        hideError();

        if (!validateForm()) {

            return;

        }

        startLoading();

        try {

            const response = await fetch(

                API_URL + "/vendor/login",

                {

                    method: "POST",

                    headers: {

                        "Content-Type": "application/json"

                    },

                    body: JSON.stringify({

                        email: email.value.trim(),

                        password: password.value

                    })

                }

            );

            const result = await response.json();

            stopLoading();

            if (!response.ok) {

                showError(

                    result.detail ||

                    "Invalid email or password."

                );

                return;

            }

            saveVendorSession(result);

showSuccess(

    result.shop_name

);

        }

        catch (error) {

            console.error(error);

            stopLoading();

            showError(

                "Unable to connect to the server."

            );

        }

    }

);

// =========================================================
// Continue To Dashboard
// =========================================================

dashboardBtn.addEventListener(

    "click",

    function () {

        window.location.href =

        "vendor_dashboard.html";

    }

);

// =========================================================
// Auto Redirect
// =========================================================

function redirectDashboard() {

    setTimeout(function () {

        window.location.href =

        "vendor_dashboard.html";

    }, 3000);

}

// =========================================================
// Success Popup
// =========================================================

function showSuccess(shopName) {

    shopNameDisplay.textContent =

    shopName;

    loginSuccessPopup.classList.add(

        "active"

    );

    redirectDashboard();

}

// =========================================================
// Logout
// =========================================================

function logoutVendor(){

    localStorage.removeItem(

        "serveprint_vendor"

    );

    localStorage.removeItem(

        "remember_vendor"

    );

    window.location.href =

    "vendor_login.html";

}

// =========================================================
// Route Protection
// =========================================================

function requireVendorLogin(){

    const session =

    getVendorSession();

    if(!session){

        window.location.href =

        "vendor_login.html";

        return false;

    }

    return true;

}

// =========================================================
// Get Current Vendor
// =========================================================

function currentVendor(){

    return getVendorSession();

}

// =========================================================
// Hide Error While Typing
// =========================================================

email.addEventListener(

    "input",

    hideError

);

password.addEventListener(

    "input",

    hideError

);

// =========================================================
// Enter Key Support
// =========================================================

document.addEventListener(

    "keydown",

    function(e){

        if(

            e.key==="Enter" &&

            document.activeElement.tagName!=="TEXTAREA"

        ){

            e.preventDefault();

            loginForm.requestSubmit();

        }

    }

);

// =========================================================
// Session Expiry
// =========================================================

function sessionExpired(){

    const session =

    getVendorSession();

    if(!session){

        return true;

    }

    const loginTime =

    new Date(

        session.login_time

    );

    const now =

    new Date();

    const hours =

    (now-loginTime)/1000/60/60;

    return hours>=24;

}

// =========================================================
// Auto Logout
// =========================================================

if(sessionExpired()){

    localStorage.removeItem(

        "serveprint_vendor"

    );

}

// =========================================================
// Dashboard Helpers
// =========================================================

function getVendorId(){

    const session =

    getVendorSession();

    return session ?

    session.vendor_id :

    null;

}

function getShopName(){

    const session =

    getVendorSession();

    return session ?

    session.shop_name :

    "";

}

function getOwnerName(){

    const session =

    getVendorSession();

    return session ?

    session.owner_name :

    "";

}

// =========================================================
// Future API Helper
// =========================================================

async function vendorFetch(

    endpoint,

    options={}

){

    const response =

    await fetch(

        API_URL+endpoint,

        options

    );

    if(!response.ok){

        throw new Error(

            "Server Error"

        );

    }

    return await response.json();

}

// =========================================================
// Developer Log
// =========================================================

console.log(

    "ServePrint Vendor Login Ready"

);