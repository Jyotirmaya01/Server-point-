const documentName = document.getElementById("documentName");
const pageCount = document.getElementById("pageCount");
const copies = document.getElementById("copies");
const printType = document.getElementById("printType");
const paperSize = document.getElementById("paperSize");

const amountPaid = document.getElementById("amountPaid");
const transactionId = document.getElementById("transactionId");
const paymentStatus = document.getElementById("paymentStatus");

const newPrintBtn = document.getElementById("newPrintBtn");

let completedOrder = {};

loadCompletedOrder();
fillSummary();

function loadCompletedOrder() {

    const saved = localStorage.getItem("serveprint_completed");

    if (saved) {

        completedOrder = JSON.parse(saved);

    }

}

function fillSummary() {

    if (documentName) {

        documentName.textContent =
            completedOrder.document || "Unknown Document";

    }

    if (pageCount) {

        pageCount.textContent =
            completedOrder.pages || "1";

    }

    if (copies) {

        copies.textContent =
            completedOrder.copies || "1";

    }

    if (printType) {

        printType.textContent =
            completedOrder.printType || "Black & White";

    }

    if (paperSize) {

        paperSize.textContent =
            completedOrder.paperSize || "A4";

    }

    if (amountPaid) {

        amountPaid.textContent =
            completedOrder.amount || "0";

    }

    if (transactionId) {

        transactionId.textContent =
            completedOrder.transactionId || "Not Available";

    }

    if (paymentStatus) {

        paymentStatus.textContent = "Successful";

    }

}

console.log(completedOrder);
console.log("Complete Page Loaded");

let countdown = 15;

startCountdown();

function startCountdown() {

    const timer = setInterval(function () {

        countdown--;

        if (newPrintBtn) {

            newPrintBtn.textContent =
                "Print Another Document (" + countdown + "s)";

        }

        if (countdown <= 0) {

            clearInterval(timer);

            goHome();

        }

    }, 1000);

}

if (newPrintBtn) {

    newPrintBtn.addEventListener("click", function () {

        goHome();

    });

}

function goHome() {

    clearStorage();

    window.location.href = "index.html";

}

function clearStorage() {

    localStorage.removeItem("serveprint_order");

    localStorage.removeItem("serveprint_completed");

}

window.addEventListener("pageshow", function () {

    if (paymentStatus) {

        paymentStatus.textContent = "Successful";

    }

});

window.addEventListener("load", function () {

    console.log("Thank you for using ServePrint");

});

function formatDate() {

    const now = new Date();

    return now.toLocaleString();

}

console.log("Completed at :", formatDate());