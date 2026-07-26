const transactionId = document.getElementById("transactionId");
const amountPaid = document.getElementById("amountPaid");
const paymentStatus = document.getElementById("paymentStatus");
const paymentTime = document.getElementById("paymentTime");

const documentName = document.getElementById("documentName");
const pageCount = document.getElementById("pageCount");
const copies = document.getElementById("copies");
const printType = document.getElementById("printType");
const paperSize = document.getElementById("paperSize");

const ordersAhead = document.getElementById("ordersAhead");
const waitingTime = document.getElementById("waitingTime");

const printingStatus = document.getElementById("printingStatus");
const progressBar = document.getElementById("progressBar");

const printedPages = document.getElementById("printedPages");
const totalPages = document.getElementById("totalPages");

const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");
const step4 = document.getElementById("step4");
const step5 = document.getElementById("step5");

let order = {};
let redirected = false;

loadOrder();
fillDetails();
loadJob();

function loadOrder() {

    const saved = localStorage.getItem("serveprint_order");

    if(saved){

        order = JSON.parse(saved);

    }

}

function fillDetails(){

    if(transactionId)
        transactionId.textContent = createTransactionId();

    if(paymentStatus)
        paymentStatus.textContent = "Successful";

    if(paymentTime)
        paymentTime.textContent = currentTime();

    if(amountPaid)
        amountPaid.textContent =
    order.total_amount ||
    order.price ||
    "0";

    if(documentName)
        documentName.textContent =
    order.original_name ||
    order.filename ||
    "Unknown Document";

    if(pageCount)
        pageCount.textContent =
    order.total_pages ||
    order.pages ||
    "1";

    if(totalPages)
        totalPages.textContent =
    order.total_pages ||
    order.pages ||
    "1";

    if(copies)
        copies.textContent = order.copies || "1";

    if(paperSize)
        paperSize.textContent =
    order.paper_size ||
    order.paperSize ||
    "A4";

    if(printType)
        const type =
    order.print_type ||
    order.printType;

printType.textContent =
    type === "color"
        ? "Colour"
        : "Black & White";

    if(printedPages)
        printedPages.textContent = "0";

    if(ordersAhead)
        ordersAhead.textContent = random(0,3);

    if(waitingTime)
        waitingTime.textContent =
            Number(ordersAhead.textContent) * 2 + " min";

}

let currentPage = 0;
let progress = 0;

function startPrinting(){

    if(printingStatus)
        printingStatus.textContent = "Preparing Printer...";

    if(step2)
        step2.textContent = "✔ Preparing Printer";

    animateProgress(20);

    setTimeout(sendDocument,2000);

}

function sendDocument(){

    if(printingStatus)
        printingStatus.textContent = "Sending Document...";

    if(step3)
        step3.textContent = "✔ Sending Document";

    animateProgress(40);

    setTimeout(printDocument,2000);

}

function printDocument(){

    if(printingStatus)
        printingStatus.textContent = "Printing...";

    if(step4)
        step4.textContent = "🖨 Printing...";

    const total = Number(totalPages.textContent || 1);

    const timer = setInterval(function(){

        currentPage++;

        if(printedPages)
            printedPages.textContent = currentPage;

        progress = 40 + (currentPage / total) * 50;

        if(progressBar)
            progressBar.style.width = progress + "%";

        if(currentPage >= total){

            clearInterval(timer);

            finishPrinting();

        }

    },1500);

}
function finishPrinting(){

    if(printingStatus)
        printingStatus.textContent = "Print Completed";

    if(step4)
        step4.textContent = "✔ Printing Completed";

    if(step5)
        step5.textContent = "✔ Ready For Collection";

    if(progressBar)
        progressBar.style.width = "100%";

    setTimeout(function(){

        window.location.href = "complete.html";

    },4000);

}
console.log({
    printingStatus,
    progressBar,
    printedPages,
    totalPages,
    step2,
    step3,
    step4,
    step5
});

// ===============================
// SUCCESS PART 3
// ===============================

// Update waiting time every 15 seconds
setInterval(function () {

    const orders = random(0,3);

    if(ordersAhead)
        ordersAhead.textContent = orders;

    if(waitingTime)
        waitingTime.textContent = (orders * 2) + " min";

},15000);


// Estimated completion time
function getCompletionTime(){

    const now = new Date();

    const totalMinutes =
    Number(waitingTime.textContent.replace(" min","")) + 2;

    now.setMinutes(now.getMinutes() + totalMinutes);

    return now.toLocaleTimeString();

}


// Save completed job
function saveCompletedJob(){

    const completed = {

        transactionId: transactionId.textContent,

        document: documentName.textContent,

        pages: totalPages.textContent,

        copies: copies.textContent,

        amount: amountPaid.textContent,

        printType: printType.textContent,

        paperSize: paperSize.textContent,

        completedTime: getCompletionTime()

    };

    localStorage.setItem(
        "serveprint_completed",
        JSON.stringify(completed)
    );

}


// Complete order
function completeOrder(){

    saveCompletedJob();

    localStorage.removeItem("serveprint_order");

}


// Replace finishPrinting redirect
const oldFinish = finishPrinting;

finishPrinting = function(){

    oldFinish();

    completeOrder();

};


// Developer log
console.log("Success Page Loaded");

// ==========================
// Load Job From Backend
// ==========================

const API_URL = "http://YOUR_IP_ADDRESS:8000";

async function loadJob() {

    if (!order.job_id) {

        return;

    }

    try {

        const response = await fetch(

            API_URL + "/jobs/" + order.job_id

        );

        if (!response.ok) {

            throw new Error("Unable to load job");

        }

        const job = await response.json();

        order = job;

        fillDetails();

      if (printingStatus) {

    printingStatus.textContent =
        job.printer_status || "Preparing Printer";

      }

      if (progressBar) {

    switch (job.printer_status) {

        case "Preparing":

            progressBar.style.width = "20%";
            break;

        case "Printing":

            progressBar.style.width = "60%";
            break;

        case "Completed":

            progressBar.style.width = "100%";
            break;

        default:

            progressBar.style.width = "10%";

    }

      }
      
    }
      if (

    job.printer_status === "Completed"

    &&

    !redirected

) {

    redirected = true;

    localStorage.setItem(

        "serveprint_completed",

        JSON.stringify(job)

    );

    setTimeout(function () {

        window.location.href = "complete.html";

    }, 1500);

      }

        console.log(

    "Printer Status:",

    job.printer_status

);
      

    catch (error) {

        console.error(error);

    }

}

// ==========================
// Auto Refresh Job
// ==========================

setInterval(async function () {

    await loadJob();

}, 3000);
