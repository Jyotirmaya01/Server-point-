// =====================================================
// ServePrint Maintenance Page
// STEP 8 — Vendor-Aware Maintenance
// =====================================================

const API_URL =
    "https://server-point-xiir.onrender.com";


// =====================================================
// DOM ELEMENTS
// =====================================================

const printerStatus =
    document.getElementById("printerStatus");

const maintenanceReason =
    document.getElementById("maintenanceReason");

const availableTime =
    document.getElementById("availableTime");

const refreshBtn =
    document.getElementById("refreshBtn");

const homeBtn =
    document.getElementById("homeBtn");


// =====================================================
// GET VENDOR ID
// =====================================================

const vendorId =
    new URLSearchParams(
        window.location.search
    ).get("vendor_id");


// =====================================================
// INITIAL CHECK
// =====================================================

checkVendorStatus();


// =====================================================
// CHECK VENDOR STATUS
// =====================================================

async function checkVendorStatus() {

    if (!vendorId) {

        console.error(
            "Vendor ID missing from maintenance URL."
        );

        if (printerStatus) {
            printerStatus.textContent =
                "Unavailable";
        }

        if (maintenanceReason) {
            maintenanceReason.textContent =
                "Vendor information is missing.";
        }

        return;
    }


    if (refreshBtn) {

        refreshBtn.disabled = true;

        refreshBtn.textContent =
            "Checking...";

    }


    try {

        const response = await fetch(

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
                "Unable to check vendor status."
            );

        }


        const data =
            await response.json();


        console.log(
            "Vendor status:",
            data
        );


        // =================================================
        // VENDOR IS ONLINE
        // =================================================

        if (!Boolean(data.maintenance)) {

            console.log(
                "Vendor is back online."
            );


            /*
             * Send customer back to the
             * vendor-specific customer page.
             */

            window.location.replace(

                "index.html?vendor_id=" +
                encodeURIComponent(vendorId)

            );

            return;
        }


        // =================================================
        // VENDOR IS STILL IN MAINTENANCE
        // =================================================

        if (printerStatus) {

            printerStatus.textContent =
                "Offline";

        }


        if (maintenanceReason) {

            maintenanceReason.textContent =
                "Maintenance in Progress";

        }


        if (availableTime) {

            availableTime.textContent =
                getEstimatedTime();

        }


    } catch (error) {

        console.error(
            "Maintenance status error:",
            error
        );


        if (printerStatus) {

            printerStatus.textContent =
                "Offline";

        }


        if (maintenanceReason) {

            maintenanceReason.textContent =
                "Unable to verify current status.";

        }

    } finally {

        if (refreshBtn) {

            refreshBtn.disabled = false;

            refreshBtn.textContent =
                "Check Again";

        }

    }

}


// =====================================================
// ESTIMATED TIME
// =====================================================

function getEstimatedTime() {

    const now =
        new Date();

    now.setMinutes(
        now.getMinutes() + 15
    );

    return now.toLocaleTimeString();

}


// =====================================================
// CHECK AGAIN BUTTON
// =====================================================

if (refreshBtn) {

    refreshBtn.addEventListener(
        "click",
        function () {

            checkVendorStatus();

        }
    );

}


// =====================================================
// RETURN HOME
// =====================================================

if (homeBtn) {

    homeBtn.addEventListener(
        "click",
        function () {

            if (vendorId) {

                window.location.href =
                    "index.html?vendor_id=" +
                    encodeURIComponent(vendorId);

            } else {

                window.location.href =
                    "index.html";

            }

        }
    );

}


// =====================================================
// BROWSER BACK/FORWARD CACHE
// =====================================================

window.addEventListener(
    "pageshow",
    function () {

        checkVendorStatus();

    }
);


console.log(
    "ServePrint Maintenance Page Ready."
);