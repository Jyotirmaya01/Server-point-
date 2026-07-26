const printerStatus = document.getElementById("printerStatus");
const maintenanceReason = document.getElementById("maintenanceReason");
const availableTime = document.getElementById("availableTime");

const refreshBtn = document.getElementById("refreshBtn");
const homeBtn = document.getElementById("homeBtn");

let maintenanceData = {};

loadMaintenance();

showMaintenance();

function loadMaintenance() {

    const saved = localStorage.getItem("serveprint_maintenance");

    if (saved) {

        maintenanceData = JSON.parse(saved);

    }

}

function showMaintenance() {

    if (printerStatus) {

        printerStatus.textContent =
            maintenanceData.status || "Offline";

    }

    if (maintenanceReason) {

        maintenanceReason.textContent =
            maintenanceData.reason || "Maintenance in Progress";

    }

    if (availableTime) {

        availableTime.textContent =
            maintenanceData.time || getEstimatedTime();

    }

}

function getEstimatedTime() {

    const now = new Date();

    now.setMinutes(now.getMinutes() + 15);

    return now.toLocaleTimeString();

}

console.log(maintenanceData);

console.log("Maintenance Page Loaded");

// ===============================
// MAINTENANCE.JS - PART 1B
// ===============================

// Check Again Button
if (refreshBtn) {

    refreshBtn.addEventListener("click", function () {

        checkPrinterStatus();

    });

}

// Return Home Button
if (homeBtn) {

    homeBtn.addEventListener("click", function () {

        returnHome();

    });

}

// Check Printer Status
function checkPrinterStatus() {

    console.log("Checking printer status...");

    refreshBtn.disabled = true;
    refreshBtn.textContent = "Checking...";

    setTimeout(function () {

        refreshBtn.disabled = false;
        refreshBtn.textContent = "Check Again";

        showMaintenance();

        console.log("Printer is still unavailable.");

    }, 2000);

}

// Return to Home
function returnHome() {

    localStorage.removeItem("serveprint_maintenance");

    window.location.href = "index.html";

}

// Save Maintenance Information
function saveMaintenance(status, reason, time) {

    const maintenance = {

        status: status,

        reason: reason,

        time: time

    };

    localStorage.setItem(
        "serveprint_maintenance",
        JSON.stringify(maintenance)
    );

}

// Restore page when coming back from browser cache
window.addEventListener("pageshow", function () {

    showMaintenance();

});

// Developer Log
console.log("Maintenance page ready.");