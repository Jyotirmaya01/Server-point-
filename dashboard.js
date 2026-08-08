/* =====================================================
   ServePrint Vendor Dashboard
   dashboard.js
   STEP 5 — CLEAN VERSION
===================================================== */


/* =====================================================
   1. BACKEND
===================================================== */

const API_URL = "https://server-point-xiir.onrender.com";


/* =====================================================
   2. VENDOR SESSION
===================================================== */

const vendorSessionRaw =
    localStorage.getItem("serveprint_vendor");

let vendorSession = null;

try {
    vendorSession = vendorSessionRaw
        ? JSON.parse(vendorSessionRaw)
        : null;
} catch (error) {
    console.error("Invalid vendor session:", error);
    vendorSession = null;
}


/* =====================================================
   3. PROTECT DASHBOARD
===================================================== */

if (!vendorSession || !vendorSession.vendor_id) {

    window.location.href = "vendor_login.html";

    throw new Error("Vendor session not found.");
}


/* =====================================================
   4. VENDOR ID
===================================================== */

const vendorId = vendorSession.vendor_id;


/* =====================================================
   5. DOM ELEMENTS
===================================================== */

const vendorShopName =
    document.getElementById("vendorShopName");

const vendorOwnerName =
    document.getElementById("vendorOwnerName");

const logoutBtn =
    document.getElementById("logoutBtn");

const refreshBtn =
    document.getElementById("refreshBtn");

const loadingOverlay =
    document.getElementById("loadingOverlay");


/* =====================================================
   Dashboard Cards
===================================================== */

const todayRevenue =
    document.getElementById("todayRevenue");

const todayOrders =
    document.getElementById("todayOrders");

const queueCount =
    document.getElementById("queueCount");

const printingCount =
    document.getElementById("printingCount");

const completedOrders =
    document.getElementById("completedOrders");

const averageWait =
    document.getElementById("averageWait");

const totalPages =
    document.getElementById("totalPages");

const shopRating =
    document.getElementById("shopRating");


/* =====================================================
   Queue
===================================================== */

const currentQueue =
    document.getElementById("currentQueue");

const nextQueue =
    document.getElementById("nextQueue");

const waitingJobs =
    document.getElementById("waitingJobs");

const estimatedWait =
    document.getElementById("estimatedWait");


/* =====================================================
   Orders
===================================================== */

const ordersBody =
    document.getElementById("ordersBody");


/* =====================================================
   Maintenance
===================================================== */

const maintenanceToggle =
    document.getElementById("maintenanceToggle");


/* =====================================================
   QR
===================================================== */

const vendorQR =
    document.getElementById("vendorQR");

let vendorQRLink = "";


/* =====================================================
   Settings
===================================================== */

const shopName =
    document.getElementById("shopName");

const ownerName =
    document.getElementById("ownerName");

const shopPhone =
    document.getElementById("shopPhone");

const shopAddress =
    document.getElementById("shopAddress");

const razorpayKey =
    document.getElementById("razorpayKey");

const razorpaySecret =
    document.getElementById("razorpaySecret");

const sheetId =
    document.getElementById("sheetId");

const serviceEmail =
    document.getElementById("serviceEmail");

const smtpHost =
    document.getElementById("smtpHost");

const smtpPort =
    document.getElementById("smtpPort");

const smtpEmail =
    document.getElementById("smtpEmail");

const smtpPassword =
    document.getElementById("smtpPassword");

const saveSettingsBtn =
    document.getElementById("saveSettings");


/* =====================================================
   6. INITIAL UI
===================================================== */

if (vendorShopName) {
    vendorShopName.textContent =
        vendorSession.shop_name || "ServePrint Shop";
}

if (vendorOwnerName) {
    vendorOwnerName.textContent =
        vendorSession.owner_name || "";
}


/* =====================================================
   7. LOADER
===================================================== */

function showLoader() {

    if (loadingOverlay) {
        loadingOverlay.style.display = "flex";
    }

}


function hideLoader() {

    if (loadingOverlay) {
        loadingOverlay.style.display = "none";
    }

}


/* =====================================================
   8. TOAST
===================================================== */

function showToast(message, type = "success") {

    /*
       Use existing toast system if your HTML/CSS provides one.
       Otherwise fall back to alert.
    */

    if (typeof window.showToast === "function") {

        window.showToast(message, type);
        return;

    }

    console.log(`[${type}] ${message}`);

}


/* =====================================================
   9. LOAD DASHBOARD
===================================================== */

async function loadDashboard() {

    showLoader();

    try {

        await Promise.all([
            loadDashboardStats(),
            loadOrders(),
            loadQueue(),
            loadVendorSettings(),
            loadVendorQR(),
            loadMaintenanceStatus()
        ]);

    } catch (error) {

        console.error(
            "Dashboard loading error:",
            error
        );

        showToast(
            "Unable to load dashboard.",
            "error"
        );

    } finally {

        hideLoader();

    }

}


/* =====================================================
   10. DASHBOARD STATISTICS
===================================================== */

async function loadDashboardStats() {

    const response = await fetch(
        `${API_URL}/vendor/${vendorId}/dashboard`
    );

    if (!response.ok) {

        throw new Error(
            "Unable to load dashboard statistics."
        );

    }

    const data = await response.json();


    if (todayRevenue) {
        todayRevenue.textContent =
            "₹" + (data.today_revenue ?? 0);
    }

    if (todayOrders) {
        todayOrders.textContent =
            data.today_orders ?? 0;
    }

    if (queueCount) {
        queueCount.textContent =
            data.queue_jobs ?? 0;
    }

    if (printingCount) {
        printingCount.textContent =
            data.printing_jobs ?? 0;
    }

    if (completedOrders) {
        completedOrders.textContent =
            data.completed_jobs ?? 0;
    }

    if (averageWait) {
        averageWait.textContent =
            (data.average_wait ?? 0) + " min";
    }

    if (totalPages) {
        totalPages.textContent =
            data.total_pages ?? 0;
    }

    if (shopRating) {
        shopRating.textContent =
            (data.rating ?? 0) + "★";
    }

}


/* =====================================================
   11. LOAD ORDERS
===================================================== */

async function loadOrders() {

    const response = await fetch(
        `${API_URL}/vendor/${vendorId}/orders`
    );

    if (!response.ok) {

        throw new Error(
            "Unable to load orders."
        );

    }

    const orders = await response.json();

    renderOrders(orders);

}


/* =====================================================
   12. RENDER ORDERS
===================================================== */

function renderOrders(orders) {

    if (!ordersBody) {
        return;
    }

    ordersBody.innerHTML = "";


    if (!orders || orders.length === 0) {

        ordersBody.innerHTML = `
            <tr>
                <td colspan="8"
                    style="text-align:center;">
                    No orders yet.
                </td>
            </tr>
        `;

        return;
    }


    orders.forEach(order => {

        const row = document.createElement("tr");

        row.innerHTML = `

            <td>
                ${order.queue_number || "-"}
            </td>

            <td>
                ${escapeHTML(
                    order.original_name || "-"
                )}
            </td>

            <td>
                ${order.total_pages ?? 0}
            </td>

            <td>
                ${order.copies ?? 1}
            </td>

            <td>
                ₹${order.total_amount ?? 0}
            </td>

            <td>
                ${escapeHTML(
                    order.payment_status || "-"
                )}
            </td>

            <td>
                ${escapeHTML(
                    order.printer_status || "-"
                )}
            </td>

            <td>
                ${formatTime(order.created_at)}
            </td>

        `;

        ordersBody.appendChild(row);

    });

}


/* =====================================================
   13. LOAD QUEUE
===================================================== */

async function loadQueue() {

    const response = await fetch(
        `${API_URL}/vendor/${vendorId}/queue`
    );

    if (!response.ok) {

        throw new Error(
            "Unable to load queue."
        );

    }

    const queue = await response.json();


    if (currentQueue) {
        currentQueue.textContent =
            queue.current ?? 0;
    }

    if (nextQueue) {
        nextQueue.textContent =
            queue.next ?? 0;
    }

    if (waitingJobs) {
        waitingJobs.textContent =
            queue.waiting ?? 0;
    }

    if (estimatedWait) {
        estimatedWait.textContent =
            (queue.wait_time ?? 0) + " min";
    }

}


/* =====================================================
   14. LOAD VENDOR SETTINGS
===================================================== */

async function loadVendorSettings() {

    const response = await fetch(
        `${API_URL}/vendor/${vendorId}/settings`
    );

    if (!response.ok) {

        console.warn(
            "Vendor settings could not be loaded."
        );

        return;

    }

    const settings = await response.json();


    if (shopName) {
        shopName.value =
            settings.shop_name || "";
    }

    if (ownerName) {
        ownerName.value =
            settings.owner_name || "";
    }

    if (shopPhone) {
        shopPhone.value =
            settings.phone || "";
    }

    if (shopAddress) {
        shopAddress.value =
            settings.address || "";
    }

    if (razorpayKey) {
        razorpayKey.value =
            settings.razorpay_key || "";
    }

    if (razorpaySecret) {
        razorpaySecret.value =
            settings.razorpay_secret || "";
    }

    if (sheetId) {
        sheetId.value =
            settings.google_sheet_id || "";
    }

    if (serviceEmail) {
        serviceEmail.value =
            settings.service_email || "";
    }

    if (smtpHost) {
        smtpHost.value =
            settings.smtp_host || "";
    }

    if (smtpPort) {
        smtpPort.value =
            settings.smtp_port || 587;
    }

    if (smtpEmail) {
        smtpEmail.value =
            settings.smtp_email || "";
    }

    if (smtpPassword) {
        smtpPassword.value =
            settings.smtp_password || "";
    }

}


/* =====================================================
   15. SAVE VENDOR SETTINGS
===================================================== */

if (saveSettingsBtn) {

    saveSettingsBtn.addEventListener(
        "click",
        async function () {

            const originalText =
                this.textContent;

            this.disabled = true;
            this.textContent = "Saving...";


            try {

                const payload = {

                    shop_name:
                        shopName
                            ? shopName.value.trim()
                            : "",

                    owner_name:
                        ownerName
                            ? ownerName.value.trim()
                            : "",

                    phone:
                        shopPhone
                            ? shopPhone.value.trim()
                            : "",

                    address:
                        shopAddress
                            ? shopAddress.value.trim()
                            : "",

                    maintenance:
                        maintenanceToggle
                            ? maintenanceToggle.checked
                            : false,

                    accept_orders: true,

                    razorpay_key:
                        razorpayKey
                            ? razorpayKey.value.trim()
                            : "",

                    razorpay_secret:
                        razorpaySecret
                            ? razorpaySecret.value
                            : "",

                    google_sheet_id:
                        sheetId
                            ? sheetId.value.trim()
                            : "",

                    service_email:
                        serviceEmail
                            ? serviceEmail.value.trim()
                            : "",

                    smtp_host:
                        smtpHost
                            ? smtpHost.value.trim()
                            : "",

                    smtp_port:
                        smtpPort
                            ? Number(
                                smtpPort.value || 587
                            )
                            : 587,

                    smtp_email:
                        smtpEmail
                            ? smtpEmail.value.trim()
                            : "",

                    smtp_password:
                        smtpPassword
                            ? smtpPassword.value
                            : ""

                };


                const response = await fetch(
                    `${API_URL}/vendor/${vendorId}/settings`,
                    {
                        method: "PUT",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(payload)
                    }
                );


                const data =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        data.detail ||
                        "Unable to save settings."
                    );

                }


                showToast(
                    "Settings saved successfully.",
                    "success"
                );


                /*
                   Keep dashboard header
                   synchronized with updated
                   shop information.
                */

                if (vendorShopName) {
                    vendorShopName.textContent =
                        payload.shop_name ||
                        "ServePrint Shop";
                }

                if (vendorOwnerName) {
                    vendorOwnerName.textContent =
                        payload.owner_name || "";
                }


            } catch (error) {

                console.error(
                    "Settings save error:",
                    error
                );

                showToast(
                    error.message ||
                    "Unable to save settings.",
                    "error"
                );


            } finally {

                this.disabled = false;
                this.textContent = originalText;

            }

        }
    );

}


/* =====================================================
   16. LOAD VENDOR QR
===================================================== */

async function loadVendorQR() {

    try {

        const response = await fetch(
            `${API_URL}/vendor/${vendorId}/qr`
        );

        if (!response.ok) {

            throw new Error(
                "Unable to load vendor QR."
            );

        }

        const data =
            await response.json();


        vendorQRLink =
            data.url || "";


        if (vendorShopName && data.shop_name) {

            vendorShopName.textContent =
                data.shop_name;

        }


        if (vendorQR && data.url) {

            vendorQR.src =
                "https://api.qrserver.com/v1/create-qr-code/" +
                "?size=300x300&data=" +
                encodeURIComponent(data.url);

        }

    } catch (error) {

        console.error(
            "QR loading error:",
            error
        );

    }

}


/* =====================================================
   17. COPY QR LINK
===================================================== */

const copyQRLink =
    document.getElementById("copyQRLink");

if (copyQRLink) {

    copyQRLink.addEventListener(
        "click",
        async function () {

            if (!vendorQRLink) {

                showToast(
                    "QR link is not available yet.",
                    "error"
                );

                return;

            }


            try {

                await navigator.clipboard.writeText(
                    vendorQRLink
                );

                showToast(
                    "QR link copied.",
                    "success"
                );

            } catch (error) {

                console.error(error);

                showToast(
                    "Unable to copy QR link.",
                    "error"
                );

            }

        }
    );

}


/* =====================================================
   18. DOWNLOAD QR PNG
===================================================== */

const downloadPNG =
    document.getElementById("downloadPNG");

if (downloadPNG) {

    downloadPNG.addEventListener(
        "click",
        function () {

            if (!vendorQR || !vendorQR.src) {

                showToast(
                    "QR code is not ready.",
                    "error"
                );

                return;

            }


            const link =
                document.createElement("a");

            link.href =
                vendorQR.src;

            link.download =
                "ServePrint_QR.png";

            document.body.appendChild(link);

            link.click();

            link.remove();

        }
    );

}


/* =====================================================
   19. DOWNLOAD SVG
===================================================== */

const downloadSVG =
    document.getElementById("downloadSVG");

if (downloadSVG) {

    downloadSVG.addEventListener(
        "click",
        function () {

            if (!vendorQRLink) {

                showToast(
                    "QR link is not available.",
                    "error"
                );

                return;

            }


            const svgURL =
                "https://api.qrserver.com/v1/create-qr-code/" +
                "?format=svg&size=300x300&data=" +
                encodeURIComponent(vendorQRLink);


            const link =
                document.createElement("a");

            link.href =
                svgURL;

            link.download =
                "ServePrint_QR.svg";

            document.body.appendChild(link);

            link.click();

            link.remove();

        }
    );

}


/* =====================================================
   20. PRINT QR
===================================================== */

const printQR =
    document.getElementById("printQR");

if (printQR) {

    printQR.addEventListener(
        "click",
        function () {

            if (!vendorQR || !vendorQR.src) {

                showToast(
                    "QR code is not ready.",
                    "error"
                );

                return;

            }


            const win =
                window.open("", "_blank");


            if (!win) {

                showToast(
                    "Please allow pop-ups to print the QR.",
                    "error"
                );

                return;

            }


            win.document.write(`
                <!DOCTYPE html>

                <html>

                <head>

                    <title>
                        ServePrint QR
                    </title>

                </head>

                <body
                    style="
                        margin:0;
                        display:flex;
                        justify-content:center;
                        align-items:center;
                        min-height:100vh;
                    "
                >

                    <img
                        src="${vendorQR.src}"
                        style="width:300px;height:300px;"
                    >

                </body>

                </html>
            `);


            win.document.close();


            win.onload = function () {

                win.focus();
                win.print();

            };

        }
    );

}


/* =====================================================
   21. REFRESH BUTTON
===================================================== */

if (refreshBtn) {

    refreshBtn.addEventListener(
        "click",
        async function () {

            await loadDashboard();

            showToast(
                "Dashboard updated.",
                "success"
            );

        }
    );

}


/* =====================================================
   22. LOGOUT
===================================================== */

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        function () {

            localStorage.removeItem(
                "serveprint_vendor"
            );

            localStorage.removeItem(
                "remember_vendor"
            );

            /*
               Remove these too in case an
               older dashboard version created them.
            */

            localStorage.removeItem(
                "vendor_id"
            );

            localStorage.removeItem(
                "vendor_token"
            );


            window.location.href =
                "vendor_login.html";

        }
    );

}


/* =====================================================
   23. MAINTENANCE TOGGLE
===================================================== */

if (maintenanceToggle) {

    maintenanceToggle.addEventListener(
        "change",
        async function () {

            const enabled =
                this.checked;


            /*
               Save previous state.
            */

            const previousState =
                !enabled;


            this.disabled = true;


            try {

                const response = await fetch(
                    `${API_URL}/vendor/${vendorId}/maintenance` +
                    `?enabled=${enabled}`,
                    {
                        method: "POST"
                    }
                );


                let data = {};

                try {

                    data =
                        await response.json();

                } catch (error) {

                    data = {};

                }


                if (!response.ok) {

                    throw new Error(
                        data.detail ||
                        "Unable to update maintenance mode."
                    );

                }


                /*
                   Make sure UI reflects
                   backend response.
                */

                this.checked =
                    Boolean(
                        data.maintenance
                    );


                showToast(
                    this.checked
                        ? "Maintenance mode enabled."
                        : "Maintenance mode disabled.",
                    "success"
                );


            } catch (error) {

                console.error(
                    "Maintenance update error:",
                    error
                );


                /*
                   Backend update failed.
                   Restore old switch state.
                */

                this.checked =
                    previousState;


                showToast(
                    "Unable to update maintenance mode.",
                    "error"
                );


            } finally {

                this.disabled = false;

            }

        }
    );

}


/* =====================================================
   24. LOAD MAINTENANCE STATUS
===================================================== */

async function loadMaintenanceStatus() {

    if (!maintenanceToggle) {
        return;
    }


    try {

        const response = await fetch(
            `${API_URL}/vendor/${vendorId}/status`
        );


        if (!response.ok) {

            throw new Error(
                "Unable to load maintenance status."
            );

        }


        const data =
            await response.json();


        maintenanceToggle.checked =
            Boolean(data.maintenance);


    } catch (error) {

        console.error(
            "Maintenance status error:",
            error
        );

    }

}


/* =====================================================
   25. AUTO REFRESH
===================================================== */

let refreshTimer = null;


function startAutoRefresh() {

    if (refreshTimer) {
        clearInterval(refreshTimer);
    }


    refreshTimer =
        setInterval(
            async function () {

                /*
                   Do not show the full loading
                   overlay during automatic refresh.
                */

                try {

                    await Promise.all([
                        loadDashboardStats(),
                        loadOrders(),
                        loadQueue(),
                        loadMaintenanceStatus()
                    ]);

                } catch (error) {

                    console.error(
                        "Auto refresh error:",
                        error
                    );

                }

            },
            30000
        );

}


/* =====================================================
   26. HTML ESCAPE
===================================================== */

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =====================================================
   27. FORMAT DATE
===================================================== */

function formatTime(dateString) {

    if (!dateString) {
        return "-";
    }


    const date =
        new Date(dateString);


    if (Number.isNaN(date.getTime())) {
        return "-";
    }


    return date.toLocaleString();

}


/* =====================================================
   28. START DASHBOARD
===================================================== */

window.addEventListener(
    "DOMContentLoaded",
    async function () {

        await loadDashboard();

        startAutoRefresh();

    }
);


console.log(
    "ServePrint Vendor Dashboard loaded."
);

console.log(
    "Vendor ID:",
    vendorId
);