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
console.log(copies);
console.log(copies instanceof HTMLInputElement);
console.log(document.body.innerHTML);
// ==========================
// Backend API
// ==========================

const API_URL = "https://server-point-xiir.onrender.com";

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

    file = this.files[0];

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

    else if (ext === "pdf") {

        // Real page count comes from the backend's count_pages()
        // after upload (see payBtn click handler below). Just show
        // a placeholder here instead of overwriting it with 0.
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

    try {

        const result = await uploadDocument();

if (!result) return;

pages = result.total_pages;

pageCount.textContent = result.total_pages;

const printJob = await createPrintJob(result.job_id);

        price.textContent = result.total_amount;

        queueCount.textContent = result.queue_number;

        waitingTime.textContent =
            result.estimated_wait_time + " min";

        localStorage.setItem(

            "serveprint_order",

            JSON.stringify(result)

        );

        window.location.href = "success.html";

    }

    catch (error) {

        console.error(error);

        window.location.href = "error.html";

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

    /*
    await fetch("/api/print",{

        method:"POST",

        headers:{
            "Content-Type":"application/json"
        },

        body:JSON.stringify(order)

    });
    */

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

        throw new Error("Upload Failed");

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

                page_range: pageRange.value || "All"

            })

        }

    );

    if (!response.ok) {

        throw new Error("Unable to create print job");

    }

    return await response.json();

}