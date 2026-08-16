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
let currentJob = null; // holds the /upload response once a file is uploaded

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
// ==========================
// Razorpay Checkout
// ==========================

function loadRazorpayCheckout() {

    return new Promise(function (resolve, reject) {

        if (window.Razorpay) {
            resolve();
            return;
        }

        const existing = document.querySelector(
            'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
        );

        if (existing) {

            existing.addEventListener(
                "load",
                resolve,
                { once: true }
            );

            existing.addEventListener(
                "error",
                function () {
                    reject(
                        new Error(
                            "Unable to load Razorpay Checkout."
                        )
                    );
                },
                { once: true }
            );

            return;
        }

        const script =
            document.createElement("script");

        script.src =
            "https://checkout.razorpay.com/v1/checkout.js";

        script.async = true;

        script.onload = resolve;

        script.onerror = function () {

            reject(
                new Error(
                    "Unable to load Razorpay Checkout."
                )
            );

        };

        document.head.appendChild(script);

    });

}
// ==========================================
// STEP 7 - VENDOR MAINTENANCE CHECK
// ==========================================

// ==========================================
// SERVEPRINT VENDOR SESSION
// ==========================================

const urlParams =
    new URLSearchParams(window.location.search);

const URL_VENDOR_ID =
    urlParams.get("vendor_id");

const SAVED_VENDOR_ID =
    sessionStorage.getItem("serveprint_vendor_id");

// QR scan gives us the vendor ID.
// Save it internally for this customer session.
if (URL_VENDOR_ID) {
    sessionStorage.setItem(
        "serveprint_vendor_id",
        URL_VENDOR_ID
    );
}

// Always use the QR vendor first,
// otherwise use the saved session vendor.
const CURRENT_VENDOR_ID =
    URL_VENDOR_ID ||
    SAVED_VENDOR_ID ||
    null;

// Remove vendor_id from the visible URL
// after saving it internally.
if (URL_VENDOR_ID) {
    const cleanURL =
        window.location.origin +
        window.location.pathname;

    window.history.replaceState(
        {},
        document.title,
        cleanURL
    );
}

console.log(
    "ServePrint vendor session initialized."
);

async function checkVendorMaintenance() {

    // If there is no vendor_id, keep normal homepage working
    if (!CURRENT_VENDOR_ID) {
        console.log("No vendor_id. Normal homepage mode.");
        return true;
    }

    // Save vendor ID for this customer session
    sessionStorage.setItem(
        "serveprint_vendor_id",
        CURRENT_VENDOR_ID
    );

    try {

        const response = await fetch(
            API_URL +
            "/vendor/" +
            encodeURIComponent(CURRENT_VENDOR_ID) +
            "/status",
            {
                method: "GET",
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error("Unable to check vendor status.");
        }

        const data = await response.json();

        console.log("Vendor status:", data);

        // ==========================================
        // VENDOR IS IN MAINTENANCE
        // ==========================================

        if (Boolean(data.maintenance)) {

            window.location.replace(
                "maintenance.html"
            );

            return false;
        }

        // Vendor is online
        return true;

    } catch (error) {

        console.error(
            "Vendor maintenance check failed:",
            error
        );

        // Don't incorrectly block customers
        // if status API temporarily fails.
        return true;
    }
}

// ==========================================
// CHECK VENDOR BEFORE UPLOAD
// ==========================================
// This used to be declared *inside* checkVendorMaintenance(),
// which meant it was invisible everywhere else in this file and
// every upload attempt failed with "verifyVendorBeforeUpload is
// not defined". It now lives at the top level so uploadDocument()
// can actually call it.
// ==========================================

async function verifyVendorBeforeUpload() {

    const vendorId =
        sessionStorage.getItem(
            "serveprint_vendor_id"
        );

    if (!vendorId) {
        throw new Error(
            "Print shop session expired. Please scan the QR code again."
        );
    }

    const response =
        await fetch(
            API_URL +
            "/vendor/" +
            encodeURIComponent(vendorId) +
            "/status",
            {
                method: "GET",
                cache: "no-store"
            }
        );

    if (!response.ok) {
        throw new Error(
            "Unable to verify shop status. Please try again."
        );
    }

    const data =
        await response.json();

    // Shop entered maintenance while
    // customer was already on the page.
    if (Boolean(data.maintenance)) {

        window.location.replace(
            "maintenance.html"
        );

        return false;
    }

    // Shop stopped accepting orders.
    if (data.accept_orders === false) {

        throw new Error(
            "This shop is currently not accepting new orders."
        );
    }

    return true;
}

checkVendorMaintenance().then(function(canContinue) {

    if (canContinue) {
        init();
    }

});

function init() {

    copyCount.textContent = copies.value;

    paperSummary.textContent = paperSize.value;

    printSummary.textContent = "Black & White";

    queueCount.textContent = "-";
  
  waitingTime.textContent = "-";

    updatePrice();

    // No file uploaded yet - nothing to pay for.
    payBtn.disabled = true;

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

    detectPages(file); // instant rough guess, replaced below by real data

    refreshOrder(); // uploads now and fills in real page count + price

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

        if (file) refreshOrder();

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

// ==========================
// Upload immediately + show real order details
// (page count, price, queue, wait time) BEFORE the user
// clicks "Proceed to Payment". payBtn stays disabled until
// this succeeds, so payment can only start on a real job.
// ==========================

async function refreshOrder() {

    if (!file) return;

    payBtn.disabled = true;

    pageCount.textContent = "Calculating...";
    price.textContent = "...";

    try {

        let result;

if (currentJob) {

    result = await updateExistingJob();

} else {

    result = await uploadDocument();

}

        if (!result) return;

        currentJob = result;

        pages = result.total_pages;
        pageCount.textContent = result.total_pages;
        price.textContent = result.total_amount;
        queueCount.textContent = result.queue_number;
        waitingTime.textContent =
            result.estimated_wait_time + " min";

        payBtn.disabled = false;

    } catch (error) {

        console.error("Could not calculate order:", error);

        currentJob = null;
        pageCount.textContent = "0";
        price.textContent = "0";
        payBtn.disabled = true;

        alert(
            "Could not read your file: " +
            (error.message || "Unknown error") +
            "\nPlease try selecting the file again."
        );

    }

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
copies.addEventListener("change", function () { if (file) refreshOrder(); });
paperSize.addEventListener("change", saveOrder);
paperSize.addEventListener("change", function () { if (file) refreshOrder(); });
orientation.addEventListener("change", saveOrder);
pageRange.addEventListener("input", saveOrder);

payBtn.addEventListener(
    "click",
    async function () {

        if (!currentJob) {

            alert(
                "Please upload a document and wait for the price to load first."
            );

            return;
        }

        payBtn.disabled = true;

        const originalLabel =
            payBtn.textContent;

        try {

            payBtn.textContent =
                "Opening Payment...";

            // --------------------------------------
            // Load Razorpay Checkout
            // --------------------------------------

            await loadRazorpayCheckout();

            // --------------------------------------
            // Create Razorpay Order
            // --------------------------------------

            const orderResponse =
                await fetch(
                    API_URL +
                    "/payment/create/" +
                    encodeURIComponent(
                        currentJob.job_id
                    ),
                    {
                        method: "POST"
                    }
                );

            if (!orderResponse.ok) {

                let detail =
                    "Unable to create payment order.";

                try {

                    const body =
                        await orderResponse.json();

                    detail =
                        body.detail ||
                        detail;

                } catch (e) {}

                throw new Error(
                    "Payment Setup Failed (" +
                    orderResponse.status +
                    "): " +
                    detail
                );
            }

            const order =
                await orderResponse.json();

            if (
                !order.razorpay_order_id ||
                !order.razorpay_key_id ||
                !order.amount
            ) {

                throw new Error(
                    "Invalid payment order received from server."
                );
            }

            payBtn.textContent =
                "Waiting for Payment...";

            // --------------------------------------
            // Open Razorpay Checkout
            // --------------------------------------
const paymentResult =
                await new Promise(
                    function (resolve, reject) {

                        let settled = false;

                        function failPayment(
                            message,
                            isRealPaymentFailure
                        ) {

                            if (settled) return;

                            settled = true;

                            const error =
                                new Error(
                                    message
                                );

                            error.isPaymentError =
                                Boolean(
                                    isRealPaymentFailure
                                );

                            error.isPaymentCancelled =
                                !isRealPaymentFailure;

                            reject(error);
                        }

                        const options = {

                            key:
                                order.razorpay_key_id,

                            amount:
                                order.amount,

                            currency:
                                order.currency ||
                                "INR",

                            name:
                                "ServePrint",

                            description:
                                "Document Printing",

                            order_id:
                                order.razorpay_order_id,

                            handler:
                                async function (
                                    response
                                ) {

                                    if (settled) {
                                        return;
                                    }

                                    try {

                                        payBtn.textContent =
                                            "Verifying Payment...";

                                        const verifyResponse =
                                            await fetch(
                                                API_URL +
                                                "/payment/verify/" +
                                                encodeURIComponent(
                                                    currentJob.job_id
                                                ),
                                                {
                                                    method:
                                                        "POST",

                                                    headers: {
                                                        "Content-Type":
                                                            "application/json"
                                                    },

                                                    body:
                                                        JSON.stringify({

                                                            razorpay_payment_id:
                                                                response.razorpay_payment_id,

                                                            razorpay_signature:
                                                                response.razorpay_signature

                                                        })
                                                }
                                            );

                                        if (
                                            !verifyResponse.ok
                                        ) {

                                            let detail =
                                                "Payment verification failed.";

                                            try {

                                                const body =
                                                    await verifyResponse.json();

                                                detail =
                                                    body.detail ||
                                                    detail;

                                            } catch (e) {}

                                            throw new Error(
                                                detail
                                            );
                                        }

                                        const verified =
                                            await verifyResponse.json();

                                        settled = true;

                                        resolve({

                                            ...response,

                                            verification:
                                                verified

                                        });

                                    } catch (error) {

                                        if (settled) {
                                            return;
                                        }

                                        settled = true;

                                        error.isPaymentError =
                                            true;

                                        reject(error);
                                    }

                                },

                            modal: {

                                ondismiss:
                                    function () {

                                        failPayment(
                                            "Payment window was closed.",
                                            false
                                        );

                                    }

                            },

                            retry: {

                                enabled: true

                            }

                        };

                        const razorpay =
                            new window.Razorpay(
                                options
                            );

                        razorpay.on(
                            "payment.failed",
                            function (
                                response
                            ) {

                                const message =
                                    response &&
                                    response.error &&
                                    response.error.description
                                        ? response.error.description
                                        : "Payment was declined. Please try again.";

                                failPayment(
                                    message,
                                    true
                                );

                            }
                        );

                        try {

                            razorpay.open();

                        } catch (error) {

                            failPayment(
                                error.message ||
                                "Unable to open Razorpay Checkout.",
                                false
                            );

                        }

                    }
                );

            // --------------------------------------
            // Payment Verified
            // --------------------------------------

            const verified =
                paymentResult.verification;

            currentJob.payment_id =
                paymentResult.razorpay_payment_id;

            currentJob.payment_status =
                "Paid";

            currentJob.queue_number =
                verified.queue_number;

            currentJob.estimated_wait_time =
                verified.estimated_wait_time;

            currentJob.printer_status =
                verified.printer_status;

            localStorage.setItem(
                "serveprint_order",
                JSON.stringify(
                    currentJob
                )
            );

            // --------------------------------------
            // Update final print settings
            // --------------------------------------

            try {

                await createPrintJob(
                    currentJob.job_id
                );

            } catch (
                printJobError
            ) {

                console.error(
                    "Print job update failed:",
                    printJobError
                );

            }

            // --------------------------------------
            // Success
            // --------------------------------------

            window.location.href =
                "success.html";

        }

        catch (error) {

            console.error(
                "Payment flow error:",
                error
            );

            // --------------------------------------
            // Only mark Failed when Razorpay
            // reports an actual payment failure.
            // Closing Checkout keeps it Pending.
            // --------------------------------------

            if (
                error.isPaymentError
            ) {

                try {

                    await fetch(
                        API_URL +
                        "/payment/" +
                        encodeURIComponent(
                            currentJob.job_id
                        ) +
                        "/failed",
                        {
                            method:
                                "POST"
                        }
                    );

                } catch (
                    markError
                ) {

                    console.error(
                        "Could not mark payment as failed:",
                        markError
                    );

                }

            }

            localStorage.setItem(
                "serveprint_error",
                JSON.stringify({

                    title:
                        error.isPaymentError
                            ? "Payment Failed"
                            : (
                                error.isPaymentCancelled
                                    ? "Payment Cancelled"
                                    : "Payment Error"
                            ),

                    message:
                        error.message ||
                        "Unable to complete payment.",

                    code:
                        error.isPaymentError
                            ? "ERR_PAYMENT_DECLINED"
                            : (
                                error.isPaymentCancelled
                                    ? "ERR_PAYMENT_CANCELLED"
                                    : "ERR_PAYMENT"
                            )

                })
            );

            window.location.href =
                "error.html";

        }

        finally {

            payBtn.disabled =
                false;

            payBtn.textContent =
                originalLabel;

        }

    }
);

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

    currentJob=null;

    fileName.textContent="No File Selected";

    pageCount.textContent="0";

    copyCount.textContent="1";

    price.textContent="0";

    uploadIcon.textContent="📂";

    uploadTitle.textContent="Click to Upload";

    uploadText.textContent="Select your document";

    progressBar.style.width="0%";

    status.textContent="Waiting for Payment";

    payBtn.disabled=true;

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
const APP_VERSION = "1.1.0";

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

  // Always verify the shop status immediately
// before sending the file.
const canUpload =
    await verifyVendorBeforeUpload();

if (!canUpload) {
    return null;
}

    const formData = new FormData();

  // Vendor ID from QR / URL
    // Vendor ID is stored internally in the customer session.
// It is intentionally NOT read from the visible URL.
const vendorId =
    sessionStorage.getItem(
        "serveprint_vendor_id"
    );

if (!vendorId) {
    throw new Error(
        "This print shop session has expired. Please scan the shop QR code again."
    );
}

formData.append(
    "vendor_id",
    vendorId
);

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

async function updateExistingJob() {

    if (!currentJob) return null;

    const response = await fetch(

        API_URL + "/jobs/" + currentJob.job_id,

        {

            method: "PUT",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                job_id: currentJob.job_id,

                copies: Number(copies.value),

                print_type: document.querySelector(
                    'input[name="printType"]:checked'
                ).value,

                paper_size: paperSize.value,

                orientation: orientation.value,

                page_range: pageRange.value || "All"

            })

        }

    );

    if (!response.ok) {

        throw new Error("Failed to update print job.");

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
                                       