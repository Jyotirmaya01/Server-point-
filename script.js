const printFile = document.getElementById("printFile");
const uploadIcon = document.getElementById("uploadIcon");
const uploadTitle = document.getElementById("uploadTitle");
const uploadText = document.getElementById("uploadText");

const fileName = document.getElementById("fileName");
const pageCount = document.getElementById("pageCount");
const copyCount = document.getElementById("copyCount");
const printSummary = document.getElementById("printSummary");
const paperSummary = document.getElementById("paperSummary");
const price = document.getElementById("price");

const copies = document.getElementById("copies");
const paperSize = document.getElementById("paperSize");
const orientation = document.getElementById("orientation");
const pageRange = document.getElementById("pageRange");

const queueCount = document.getElementById("queueCount");
const waitingTime = document.getElementById("waitingTime");
const status = document.getElementById("status");
const progressBar = document.getElementById("progressBar");

const payBtn = document.getElementById("payBtn");

const printTypes = document.querySelectorAll(
    'input[name="printType"]'
);

let pages = 0;
let rate = 2;
let file = null;

// ==========================
// Backend API
// ==========================

const API_URL = "https://server-point-xiir.onrender.com";

// Must match backend ALLOWED_EXTENSIONS in main.py
const ALLOWED_EXTENSIONS = [
    "pdf", "jpg", "jpeg", "png",
    "docx", "pptx", "xlsx", "txt"
];

// ==========================
// TEMPORARY Mock Payment Gateway
// Replace this whole block once Razorpay (Phase 4, see Guide.txt)
// is integrated. Its only job right now is to actually simulate a
// payment step that can fail, so the error flow can be tested.
// ==========================

const MOCK_PAYMENT_FAIL_RATE = 0.2; // 20% of attempts simulate a decline

function simulatePayment() {

    return new Promise(function (resolve, reject) {

        setTimeout(function () {

            const approved = Math.random() > MOCK_PAYMENT_FAIL_RATE;

            if (approved) {

                resolve({
                    payment_id:
                        "MOCK_" + Date.now() +
                        "_" + Math.floor(Math.random() * 10000)
                });

            } else {

                const err = new Error(
                    "Payment was declined by the bank. Please try again."
                );
                err.isPaymentError = true;
                reject(err);

            }

        }, 1500); // simulated gateway delay

    });

}

init();

function init() {

    copyCount.textContent = copies.value;

    paperSummary.textContent = paperSize.value;

    printSummary.textContent = "Black & White";

    queueCount.textContent = random(0,5);

    waitingTime.textContent =
        queueCount.textContent * 2 + " min";

    updatePrice();

}

printFile.addEventListener("change", function(){

    if(!this.files.length) return;

    const selected = this.files[0];

    const ext = selected.name.split(".").pop().toLowerCase();

    // ------------------------------
    // Reject videos / unsupported types BEFORE showing any
    // success tick. Backend still re-validates this on upload,
    // this just stops the frontend from lying to the user.
    // ------------------------------

    if (
        (selected.type && selected.type.startsWith("video/")) ||
        !ALLOWED_EXTENSIONS.includes(ext)
    ) {

        alert(
            "Unsupported file type. Allowed: " +
            ALLOWED_EXTENSIONS.join(", ")
        );

        this.value = "";

        uploadIcon.textContent = "📂";
        uploadTitle.textContent = "Click to Upload";
        uploadText.textContent = "Select your document";
        fileName.textContent = "No File Selected";

        file = null;
        pages = 0;
        pageCount.textContent = "0";
        updatePrice();

        return;

    }

    file = selected;

    uploadIcon.textContent = "✅";

    uploadTitle.textContent = file.name;

    uploadText.textContent = formatSize(file.size);

    fileName.textContent = file.name;

    detectPages(file);

});

copies.addEventListener("input",function(){

    if(this.value < 1){

        this.value = 1;

    }

    copyCount.textContent = this.value;

    updatePrice();

});

copies.addEventListener("focus", function () {

    this.select();

});

paperSize.addEventListener("change",function(){

    paperSummary.textContent = this.value;

});

printTypes.forEach(function(item){

    item.addEventListener("change",function(){

        if(this.value==="bw"){

            rate=2;

            printSummary.textContent="Black & White";

        }else{

            rate=10;

            printSummary.textContent="Colour";

        }

        updatePrice();

    });

});

function detectPages(selectedFile){

    const ext =
    selectedFile.name.split(".").pop().toLowerCase();

    if(
        ext==="jpg"||
        ext==="jpeg"||
        ext==="png"||
        ext==="gif"||
        ext==="webp"
    ){

        pages=1;
        pageCount.textContent=pages;

    }

    else if (ext === "pdf" || ext === "pptx" || ext === "ppt") {

        // Real page/slide count comes from the backend after upload
        // (see payBtn click handler). Just show a placeholder here.
        pages = 0;
        pageCount.textContent = "Detecting...";

    }

    else{

        pages=1;
        pageCount.textContent=pages;

    }

    updatePrice();

}

function updatePrice(){

    const total=
    pages*
    Number(copies.value)*
    rate;

    price.textContent=total;

}

function formatSize(size){

    if(size<1024){

        return size+" Bytes";

    }

    if(size<1024*1024){

        return (size/1024).toFixed(2)+" KB";

    }

    return (size/1024/1024).toFixed(2)+" MB";

}

function random(min,max){

    return Math.floor(Math.random()*(max-min+1))+min;

}

// ---------- PART 1B ----------

// Restore previous order if available
loadOrder();

function loadOrder() {

    const saved = localStorage.getItem("serveprint_order");

    if (!saved) return;

    const order = JSON.parse(saved);

    if (order.copies) {
        copies.value = order.copies;
        copyCount.textContent = order.copies;
    }

    if (order.paperSize) {
        paperSize.value = order.paperSize;
        paperSummary.textContent = order.paperSize;
    }

    if (order.orientation) {
        orientation.value = order.orientation;
    }

    if (order.pageRange) {
        pageRange.value = order.pageRange;
    }

}

function saveOrder() {

    const order = {

        copies: copies.value,
        paperSize: paperSize.value,
        orientation: orientation.value,
        pageRange: pageRange.value,
        pages: pages,
        price: price.textContent

    };

    localStorage.setItem(
        "serveprint_order",
        JSON.stringify(order)
    );

}

copies.addEventListener("change", saveOrder);
paperSize.addEventListener("change", saveOrder);
orientation.addEventListener("change", saveOrder);
pageRange.addEventListener("input", saveOrder);

payBtn.addEventListener("click", async function () {

    payBtn.disabled = true;
    const originalLabel = payBtn.textContent;

    try {

        const result = await uploadDocument();

        if (!result) {
            payBtn.disabled = false;
            return;
        }

        // ------------------------------
        // Mock Payment Step
        // File is uploaded, but nothing is "successful" yet until
        // payment clears. This can fail (see MOCK_PAYMENT_FAIL_RATE),
        // and a failure here must go to error.html, not success.html.
        // ------------------------------

        payBtn.textContent = "Processing Payment...";

        let payment;

        try {

            payment = await simulatePayment();

        } catch (paymentError) {

            // Reflect the decline on the backend so the job record
            // isn't left saying "Pending" forever.
            try {

                await fetch(
                    API_URL + "/jobs/" + result.job_id + "/payment/Failed",
                    { method: "PUT" }
                );

            } catch (markError) {

                console.error(
                    "Could not mark payment as failed on backend:",
                    markError
                );

            }

            throw paymentError;

        }

        // Payment approved - verify it on the backend.
        await fetch(
            API_URL + "/payment/" + result.job_id +
            "?payment_id=" + encodeURIComponent(payment.payment_id),
            { method: "POST" }
        );

        result.payment_id = payment.payment_id;
        result.payment_status = "Paid";

        // Set page count AND price immediately from the /upload
        // response. This no longer waits on createPrintJob() below,
        // so a failure there can't leave the price stuck at 0.
        pages = result.total_pages;
        pageCount.textContent = result.total_pages;
        price.textContent = result.total_amount;
        queueCount.textContent = result.queue_number;
        waitingTime.textContent =
            result.estimated_wait_time + " min";

        localStorage.setItem(
            "serveprint_order",
            JSON.stringify(result)
        );

        // Print job creation (copies/orientation/paper size) is a
        // secondary step. If it fails, we still keep the user on the
        // success flow since upload + payment already succeeded.
        try {

            await createPrintJob(result.job_id);

        } catch (printJobError) {

            console.error("Print job update failed:", printJobError);

        }

        window.location.href = "success.html";

    }

    catch (error) {

        console.error(error);

        // Save the real failure reason so error.html can show it
        // instead of a generic "Unknown Error".
        localStorage.setItem(
            "serveprint_error",
            JSON.stringify({
                title: error.isPaymentError
                    ? "Payment Failed"
                    : "Upload Failed",
                message: error.message || "Network or server error.",
                code: error.isPaymentError
                    ? "ERR_PAYMENT_DECLINED"
                    : (navigator.onLine ? "ERR_REQUEST" : "ERR_OFFLINE")
            })
        );

        window.location.href = "error.html";

    }

    finally {

        payBtn.disabled = false;
        payBtn.textContent = originalLabel;

    }

});

function animateProgress(start, end) {

    let value = start;

    const timer = setInterval(function () {

        value++;

        progressBar.style.width = value + "%";

        if (value >= end) {

            clearInterval(timer);

        }

    }, 20);

}

// ================================
// PART 2
// ================================

// Auto save when file changes
printFile.addEventListener("change", saveOrder);

// Update summary when paper size changes
paperSize.addEventListener("change", function () {
    paperSummary.textContent = paperSize.value;
    saveOrder();
});

// Update copies live
copies.addEventListener("keyup", function () {

    if (copies.value === "" || Number(copies.value) < 1) {
        copies.value = 1;
    }

    copyCount.textContent = copies.value;

    updatePrice();

    saveOrder();

});

// Calculate queue every 20 seconds
setInterval(function () {

    const orders = random(0, 5);

    queueCount.textContent = orders;

    waitingTime.textContent = orders * 2 + " min";

}, 20000);


// Backend Ready Object
function getOrderData() {

    return {

        filename: file ? file.name : "",

        pages: pages,

        copies: Number(copies.value),

        paperSize: paperSize.value,

        orientation: orientation.value,

        pageRange: pageRange.value,

        printType: rate === 2 ? "bw" : "color",

        totalPrice: Number(price.textContent)

    };

}


// Future FastAPI Integration
async function sendOrderToServer() {

    const order = getOrderData();

    console.log("Order Ready");

    console.log(order);

}


// Button animation
payBtn.addEventListener("mousedown",function(){

    payBtn.style.transform="scale(.98)";

});

payBtn.addEventListener("mouseup",function(){

    payBtn.style.transform="scale(1)";

});

payBtn.addEventListener("mouseleave",function(){

    payBtn.style.transform="scale(1)";

});


// Reset order
function resetOrder(){

    pages=0;

    file=null;

    fileName.textContent="No File Selected";

    pageCount.textContent="0";

    copyCount.textContent="1";

    price.textContent="0";

    uploadIcon.textContent="📂";

    uploadTitle.textContent="Click to Upload";

    uploadText.textContent="Select your document";

    progressBar.style.width="0%";

    status.textContent="Waiting for Payment";

}


// Check browser support
window.addEventListener("load",function(){

    if(!window.FileReader){

        alert("Your browser does not support file upload.");

    }

});


// Prevent accidental refresh
window.addEventListener("beforeunload",function(e){

    if(file){

        e.preventDefault();

        e.returnValue="";

    }

});


// Developer helper
console.log("ServePrint Ready");

// ===============================
// PART 2B
// Final Utilities
// ===============================

// Format page range
function validatePageRange() {

    const value = pageRange.value.trim();

    if (value === "") {
        return true;
    }

    const regex = /^(\d+(-\d+)?)(,\d+(-\d+)?)*$/;

    if (!regex.test(value) && value.toLowerCase() !== "all") {

        alert("Invalid page range.");

        pageRange.focus();

        return false;

    }

    return true;

}

pageRange.addEventListener("blur", validatePageRange);


// Recalculate whenever copies change
copies.addEventListener("change", function () {

    updatePrice();

});


// Keyboard shortcut
document.addEventListener("keydown", function (e) {

    if (e.ctrlKey && e.key === "Enter") {

        payBtn.click();

    }

});


// Status helper
function setStatus(text) {

    status.textContent = text;

}


// Progress helper
function setProgress(value) {

    progressBar.style.width = value + "%";

}


// Simulate printer processing
function simulatePrinting() {

    setStatus("Printing...");

    setProgress(100);

    setTimeout(function () {

        setStatus("Print Completed");

    }, 3000);

}


// Clear order
function clearSavedOrder() {

    localStorage.removeItem("serveprint_order");

}


// Reset after completion
function completeOrder() {

    clearSavedOrder();

    resetOrder();

}


// Future callback
function paymentSuccess() {

    simulatePrinting();

}


// Future callback
function paymentFailed() {

    setStatus("Payment Failed");

    setProgress(0);

}


// Developer Debug
function debugOrder() {

    console.table(getOrderData());

}


// Auto Debug
window.debugOrder = debugOrder;


// Version
const APP_VERSION = "1.0.0";

console.log("ServePrint Version :", APP_VERSION);

console.log("Frontend Loaded Successfully");

// ==========================
// Upload File To Backend
// ==========================

async function uploadDocument() {

    if (!file) {

        alert("Please upload a document.");

        return null;

    }

    const formData = new FormData();

    formData.append("file", file);

    formData.append("copies", copies.value);

    formData.append(
        "print_type",
        document.querySelector(
            'input[name="printType"]:checked'
        ).value
    );

    formData.append(
        "paper_size",
        paperSize.value
    );

    formData.append(
        "page_range",
        pageRange.value || "All"
    );

    const response = await fetch(

        API_URL + "/upload",

        {

            method: "POST",

            body: formData

        }

    );

    if (!response.ok) {

        let detail = "";

        try {
            const errBody = await response.json();
            detail = errBody.detail || JSON.stringify(errBody);
        } catch (e) {
            detail = await response.text().catch(() => "");
        }

        throw new Error(
            "Upload Failed (" + response.status + "): " +
            (detail || "No details returned")
        );

    }

    return await response.json();

}

async function createPrintJob(jobId) {

    const response = await fetch(

        API_URL + "/print",

        {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify({

                job_id: jobId,

                copies: Number(copies.value),

                print_type: document.querySelector(

                    'input[name="printType"]:checked'

                ).value,

                paper_size: paperSize.value,

                // was missing before - backend requires this field
                orientation: orientation ? orientation.value : "Portrait",

                page_range: pageRange.value || "All"

            })

        }

    );

    if (!response.ok) {

        let detail = "";

        try {
            const errBody = await response.json();
            detail = errBody.detail || JSON.stringify(errBody);
        } catch (e) {
            detail = await response.text().catch(() => "");
        }

        throw new Error(
            "Print Job Failed (" + response.status + "): " +
            (detail || "No details returned")
        );

    }

    return await response.json();

}
