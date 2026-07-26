const errorTitle = document.getElementById("errorTitle");
const errorMessage = document.getElementById("errorMessage");
const errorCode = document.getElementById("errorCode");

const retryBtn = document.getElementById("retryBtn");
const homeBtn = document.getElementById("homeBtn");

let errorData = {};

loadError();

showError();

function loadError(){

    const saved =
    localStorage.getItem("serveprint_error");

    if(saved){

        errorData = JSON.parse(saved);

    }

}

function showError(){

    if(errorTitle){

        errorTitle.textContent =
        errorData.title || "Payment Failed";

    }

    if(errorMessage){

        errorMessage.textContent =
        errorData.message ||
        "Unknown Error";

    }

    if(errorCode){

        errorCode.textContent =
        errorData.code ||
        "ERR001";

    }

}

console.log(errorData);

console.log("Error Page Loaded");

// ===============================
// ERROR.JS - PART 1B
// ===============================

// Retry Payment Button
if (retryBtn) {

    retryBtn.addEventListener("click", function () {

        retryPayment();

    });

}

// Back to Home Button
if (homeBtn) {

    homeBtn.addEventListener("click", function () {

        goHome();

    });

}

// Retry Payment
function retryPayment() {

    console.log("Retrying payment...");

    // Remove previous error
    localStorage.removeItem("serveprint_error");

    // Return to payment/upload page
    window.location.href = "index.html";

}

// Go Home
function goHome() {

    console.log("Returning to home...");

    localStorage.removeItem("serveprint_error");

    window.location.href = "index.html";

}

// Optional helper to save errors
function saveError(title, message, code) {

    const error = {

        title: title,

        message: message,

        code: code

    };

    localStorage.setItem(
        "serveprint_error",
        JSON.stringify(error)
    );

}

// Reset page when loaded from browser cache
window.addEventListener("pageshow", function () {

    if (errorTitle && !errorTitle.textContent.trim()) {

        showError();

    }

});

// Developer log
console.log("Error page ready.");