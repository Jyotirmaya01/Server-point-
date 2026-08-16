/* =========================================================
   SERVEPRINT VENDOR DASHBOARD
   dashboard.js
   CLEAN VERSION
   ========================================================= */


/* =========================================================
   1. BACKEND
   ========================================================= */

const API_URL =
    "https://server-point-xiir.onrender.com";


/* =========================================================
   2. VENDOR SESSION
   ========================================================= */

const vendorSessionRaw =
    localStorage.getItem("serveprint_vendor");

let vendorSession = null;

try {

    vendorSession =
        vendorSessionRaw
            ? JSON.parse(vendorSessionRaw)
            : null;

} catch (error) {

    console.error(
        "Invalid vendor session:",
        error
    );

    vendorSession = null;
}


/* =========================================================
   3. PROTECT DASHBOARD
   ========================================================= */

if (
    !vendorSession ||
    !vendorSession.vendor_id
) {

    window.location.href =
        "vendor_login.html";

    throw new Error(
        "Vendor session not found."
    );
}


/* =========================================================
   4. VENDOR ID
   ========================================================= */

const vendorId =
    vendorSession.vendor_id;


/* =========================================================
   5. DOM ELEMENTS
   ========================================================= */


/* ---------- Header ---------- */

const vendorShopName =
    document.getElementById(
        "vendorShopName"
    );

const vendorOwnerName =
    document.getElementById(
        "vendorOwnerName"
    );

const logoutBtn =
    document.getElementById(
        "logoutBtn"
    );

const refreshBtn =
    document.getElementById(
        "refreshBtn"
    );

const loadingOverlay =
    document.getElementById(
        "loadingOverlay"
    );


/* ---------- Dashboard Cards ---------- */

const todayRevenue =
    document.getElementById(
        "todayRevenue"
    );

const todayOrders =
    document.getElementById(
        "todayOrders"
    );

const queueCount =
    document.getElementById(
        "queueCount"
    );

const printingCount =
    document.getElementById(
        "printingCount"
    );

const completedOrders =
    document.getElementById(
        "completedOrders"
    );

const averageWait =
    document.getElementById(
        "averageWait"
    );

const totalPages =
    document.getElementById(
        "totalPages"
    );

const shopRating =
    document.getElementById(
        "shopRating"
    );


/* ---------- Queue ---------- */

const currentQueue =
    document.getElementById(
        "currentQueue"
    );

const nextQueue =
    document.getElementById(
        "nextQueue"
    );

const waitingJobs =
    document.getElementById(
        "waitingJobs"
    );

const estimatedWait =
    document.getElementById(
        "estimatedWait"
    );


/* ---------- Orders ---------- */

const ordersBody =
    document.getElementById(
        "ordersBody"
    );

let latestOrders = [];


/* ---------- Maintenance ---------- */

const maintenanceToggle =
    document.getElementById(
        "maintenanceToggle"
    );
let maintenanceUpdating = false;

/* ---------- Accept Orders ---------- */

const ordersToggle =
    document.getElementById(
        "ordersToggle"
    );


/* ---------- Printer ---------- */

const printerStatus =
    document.getElementById(
        "printerStatus"
    );


/* ---------- QR ---------- */

const vendorQR =
    document.getElementById(
        "vendorQR"
    );

const copyQRLink =
    document.getElementById(
        "copyQRLink"
    );

const downloadPNG =
    document.getElementById(
        "downloadPNG"
    );

const downloadSVG =
    document.getElementById(
        "downloadSVG"
    );

const printQR =
    document.getElementById(
        "printQR"
    );


/* ---------- Settings ---------- */

const shopName =
    document.getElementById(
        "shopName"
    );

const ownerName =
    document.getElementById(
        "ownerName"
    );

const shopPhone =
    document.getElementById(
        "shopPhone"
    );

const shopAddress =
    document.getElementById(
        "shopAddress"
    );

const razorpayKey =
    document.getElementById(
        "razorpayKey"
    );

const razorpaySecret =
    document.getElementById(
        "razorpaySecret"
    );

const sheetId =
    document.getElementById(
        "sheetId"
    );

const serviceEmail =
    document.getElementById(
        "serviceEmail"
    );

const smtpHost =
    document.getElementById(
        "smtpHost"
    );

const smtpPort =
    document.getElementById(
        "smtpPort"
    );

const smtpEmail =
    document.getElementById(
        "smtpEmail"
    );

const smtpPassword =
    document.getElementById(
        "smtpPassword"
    );

const saveSettingsBtn =
    document.getElementById(
        "saveSettings"
    );


/* =========================================================
   6. INITIAL UI
   ========================================================= */

if (vendorShopName) {

    vendorShopName.textContent =
        vendorSession.shop_name ||
        "ServePrint Shop";
}


if (vendorOwnerName) {

    vendorOwnerName.textContent =
        vendorSession.owner_name ||
        "";
}


/* =========================================================
   7. LOADER
   ========================================================= */

function showLoader() {

    if (loadingOverlay) {

        loadingOverlay.style.display =
            "flex";
    }
}


function hideLoader() {

    if (loadingOverlay) {

        loadingOverlay.style.display =
            "none";
    }
}


/* =========================================================
   8. TOAST
   ========================================================= */

const toastContainer =
    document.getElementById("toastContainer");

function showToast(
    message,
    type = "success"
) {

    console.log(`[${type}] ${message}`);

    if (!toastContainer) {
        return;
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(function () {

        toast.classList.add("fade-out");

        setTimeout(function () {
            toast.remove();
        }, 200);

    }, 3500);
}


/* =========================================================
   9. API HELPER
   ========================================================= */

async function apiRequest(
    endpoint,
    options = {}
) {

    const authHeaders = {};

    if (vendorSession && vendorSession.token) {
        authHeaders.Authorization =
            `Bearer ${vendorSession.token}`;
    }

    const response =
        await fetch(
            `${API_URL}${endpoint}`,
            {
                ...options,
                headers: {
                    "Content-Type":
                        "application/json",

                    ...authHeaders,
                    ...(options.headers || {})
                }
            }
        );

    if (!response.ok) {

        let message =
            `Request failed (${response.status})`;

        try {

            const errorData =
                await response.json();

            if (errorData.detail) {

                message =
                    errorData.detail;
            }

            if (errorData.message) {

                message =
                    errorData.message;
            }

        } catch {

            /* Ignore JSON parsing error */
        }

        throw new Error(message);
    }

    return response;
}


/* =========================================================
   10. DASHBOARD STATISTICS
   ========================================================= */

async function loadDashboardStats() {

    const response =
        await apiRequest(
            `/vendor/${vendorId}/dashboard`
        );

    const data =
        await response.json();


    if (todayRevenue) {

        todayRevenue.textContent =
            "₹" +
            Number(
                data.today_revenue ?? 0
            ).toLocaleString("en-IN");
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
            `${data.average_wait ?? 0} min`;
    }


    if (totalPages) {

        totalPages.textContent =
            data.total_pages ?? 0;
    }


    if (shopRating) {

        const rating =
            data.rating ?? 0;

        shopRating.textContent =
            `${rating}★`;
    }
}


/* =========================================================
   11. LOAD ORDERS
   ========================================================= */

async function loadOrders() {

    if (!ordersBody) {
        return;
    }

    try {

        const response =
            await apiRequest(
                `/vendor/${vendorId}/orders`
            );

        const orders =
            await response.json();


        ordersBody.innerHTML = "";

        latestOrders =
            Array.isArray(orders) ? orders : [];

        renderActivity(latestOrders);

        if (
            !Array.isArray(orders) ||
            orders.length === 0
        ) {

            ordersBody.innerHTML = `
                <tr>
                    <td
                        colspan="9"
                        style="text-align:center;"
                    >
                        No orders yet.
                    </td>
                </tr>
            `;

            return;
        }


        orders.forEach(
            order => {

                /*
                 IMPORTANT:
                 Customer name and phone are
                 intentionally NOT displayed.
                */

                const row =
                    document.createElement(
                        "tr"
                    );

                row.dataset.jobId =
                    order.job_id || "";

                row.dataset.printerStatus =
                    (order.printer_status || "").toLowerCase();

                row.dataset.searchText = (
                    (order.original_name || "") +
                    " " +
                    (order.queue_number ?? "")
                ).toLowerCase();

                const printerStatus =
                    order.printer_status || "Pending";

                const isCompleted =
                    printerStatus.toLowerCase() === "completed";

                row.innerHTML = `

                    <td>
                        ${escapeHTML(
                            order.queue_number ??
                            "-"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            order.original_name ??
                            "-"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            order.total_pages ??
                            0
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            order.copies ??
                            0
                        )}
                    </td>

                    <td>
                        ₹${escapeHTML(
                            order.total_amount ??
                            0
                        )}
                    </td>

                    <td>
                        ${paymentBadge(order.payment_status)}
                    </td>

                    <td>
                        ${statusBadge(printerStatus)}
                    </td>

                    <td>
                        ${formatTime(
                            order.created_at
                        )}
                    </td>

                    <td>
                        <button
                            class="row-action-btn markPrintedBtn"
                            ${isCompleted ? "disabled" : ""}
                        >
                            ${isCompleted ? "Done" : "Mark Printed"}
                        </button>
                    </td>

                `;

                ordersBody.appendChild(
                    row
                );
            }
        );

        applyOrdersFilter();

    } catch (error) {

        console.error(
            "Orders loading error:",
            error
        );

        if (ordersBody) {

            ordersBody.innerHTML = `
                <tr>
                    <td
                        colspan="9"
                        style="text-align:center;"
                    >
                        Unable to load orders.
                    </td>
                </tr>
            `;
        }
    }
}

/* =========================================================
   11B. STATUS BADGES
   ========================================================= */

function statusBadge(status) {

    const value = (status || "Pending").toString();
    const key = value.toLowerCase();

    return `<span class="badge badge-${escapeHTML(key)}">${escapeHTML(value)}</span>`;
}

function paymentBadge(status) {

    const value = (status || "Pending").toString();
    const key = value.toLowerCase();

    return `<span class="badge badge-${escapeHTML(key)}">${escapeHTML(value)}</span>`;
}

/* =========================================================
   11C. MARK ORDER AS PRINTED
   ========================================================= */

if (ordersBody) {

    ordersBody.addEventListener("click", async function (e) {

        const btn = e.target.closest(".markPrintedBtn");

        if (!btn) {
            return;
        }

        const row = btn.closest("tr");
        const jobId = row ? row.dataset.jobId : null;

        if (!jobId) {
            return;
        }

        btn.disabled = true;
        btn.textContent = "Updating...";

        try {

            await apiRequest(
                `/jobs/${jobId}/printer/Completed`,
                { method: "PUT" }
            );

            showToast("Order marked as printed.", "success");

            await loadOrders();

        } catch (error) {

            console.error("Mark printed error:", error);

            showToast(
                error.message || "Unable to update order.",
                "error"
            );

            btn.disabled = false;
            btn.textContent = "Mark Printed";
        }

    });
}

/* =========================================================
   11D. ORDERS SEARCH / FILTER
   ========================================================= */

const searchOrderInput =
    document.getElementById("searchOrder");

const statusFilterSelect =
    document.getElementById("statusFilter");

function applyOrdersFilter() {

    if (!ordersBody) {
        return;
    }

    const query =
        searchOrderInput ?
            searchOrderInput.value.trim().toLowerCase() :
            "";

    const status =
        statusFilterSelect ?
            statusFilterSelect.value :
            "all";

    const rows =
        ordersBody.querySelectorAll("tr");

    let visibleCount = 0;

    rows.forEach(function (row) {

        if (!row.dataset || row.dataset.jobId === undefined) {
            return;
        }

        const matchesQuery =
            !query || row.dataset.searchText.includes(query);

        const matchesStatus =
            status === "all" ||
            row.dataset.printerStatus === status;

        const visible = matchesQuery && matchesStatus;

        row.style.display = visible ? "" : "none";

        if (visible) {
            visibleCount++;
        }

    });

    return visibleCount;
}

if (searchOrderInput) {
    searchOrderInput.addEventListener("input", applyOrdersFilter);
}

if (statusFilterSelect) {
    statusFilterSelect.addEventListener("change", applyOrdersFilter);
}

/* =========================================================
   11E. RECENT ACTIVITY FEED
   ========================================================= */

const activityList =
    document.getElementById("activityList");

const notificationList =
    document.getElementById("notificationList");

const notificationDot =
    document.getElementById("notificationDot");

function activityIconFor(status) {

    const key = (status || "").toLowerCase();

    if (key === "completed") return "fa-solid fa-circle-check";
    if (key === "printing") return "fa-solid fa-print";
    return "fa-solid fa-clock";
}

function renderActivity(orders) {

    const recent =
        [...orders]
            .sort(function (a, b) {
                return new Date(b.created_at) - new Date(a.created_at);
            })
            .slice(0, 8);

    const itemsHTML =
        recent.length === 0 ?
            `<div class="activity-empty">No recent activity yet.</div>` :
            recent.map(function (order) {

                return `
                    <div class="activity-item">
                        <i class="${activityIconFor(order.printer_status)}"></i>
                        <span class="activity-text">
                            Order #${escapeHTML(order.queue_number ?? "-")}
                            (${escapeHTML(order.original_name ?? "file")})
                            - ${escapeHTML(order.printer_status || "Pending")}
                        </span>
                        <span class="activity-time">
                            ${formatTime(order.created_at)}
                        </span>
                    </div>
                `;

            }).join("");

    if (activityList) {
        activityList.innerHTML = itemsHTML;
    }

    if (notificationList) {
        notificationList.innerHTML = itemsHTML;
    }

    if (notificationDot) {
        notificationDot.classList.toggle(
            "active",
            recent.some(function (order) {
                return (order.printer_status || "").toLowerCase() === "pending";
            })
        );
    }
}


/* =========================================================
   12. HTML ESCAPE
   ========================================================= */

function escapeHTML(value) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        String(value ?? "");

    return div.innerHTML;
}


/* =========================================================
   13. FORMAT TIME
   ========================================================= */

function formatTime(
    dateString
) {

    if (!dateString) {

        return "-";
    }

    const date =
        new Date(dateString);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "-";
    }

    return date.toLocaleString(
        "en-IN",
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    );
}


/* =========================================================
   14. LOAD QUEUE
   ========================================================= */

async function loadQueue() {

    try {

        const response =
            await apiRequest(
                `/vendor/${vendorId}/queue`
            );

        const queue =
            await response.json();


        if (currentQueue) {

            currentQueue.textContent =
                queue.current ?? "-";
        }


        if (nextQueue) {

            nextQueue.textContent =
                queue.next ?? "-";
        }


        if (waitingJobs) {

            waitingJobs.textContent =
                queue.waiting ?? 0;
        }


        if (estimatedWait) {

            estimatedWait.textContent =
                `${queue.wait_time ?? 0} min`;
        }

    } catch (error) {

        console.error(
            "Queue loading error:",
            error
        );
    }
}


/* =========================================================
   15. LOAD VENDOR SETTINGS
   ========================================================= */

async function loadVendorSettings() {

    try {

        const response =
            await apiRequest(
                `/vendor/${vendorId}/settings`
            );

        const settings =
            await response.json();


        /* ---------- Maintenance ---------- */

        if (
    maintenanceToggle &&
    !maintenanceUpdating
) {

    maintenanceToggle.checked =
        Boolean(
            settings.maintenance
        );
        }


        /* ---------- Accept Orders ---------- */

        if (
    ordersToggle &&
    !ordersUpdating
) {

    ordersToggle.checked =
        settings.accept_orders !==
        false;
        }

        /* ---------- Printer ---------- */

        if (printerStatus) {

            printerStatus.textContent =
                settings.printer_status ||
                "Online";
        }


        /* ---------- Shop Information ---------- */

        if (shopName) {

            shopName.value =
                settings.shop_name ||
                vendorSession.shop_name ||
                "";
        }


        if (ownerName) {

            ownerName.value =
                settings.owner_name ||
                vendorSession.owner_name ||
                "";
        }


        if (shopPhone) {

            shopPhone.value =
                settings.phone ||
                "";
        }


        if (shopAddress) {

            shopAddress.value =
                settings.address ||
                "";
        }


        /* ---------- Razorpay ---------- */

        if (razorpayKey) {

            razorpayKey.value =
                settings.razorpay_key ||
                "";
        }


        if (razorpaySecret) {

            razorpaySecret.value =
                settings.razorpay_secret ||
                "";
        }


        /* ---------- Google Sheets ---------- */

        if (sheetId) {

            sheetId.value =
                settings.google_sheet_id ||
                "";
        }


        if (serviceEmail) {

            serviceEmail.value =
                settings.service_email ||
                "";
        }


        /* ---------- SMTP ---------- */

        if (smtpHost) {

            smtpHost.value =
                settings.smtp_host ||
                "";
        }


        if (smtpPort) {

            smtpPort.value =
                settings.smtp_port ??
                587;
        }


        if (smtpEmail) {

            smtpEmail.value =
                settings.smtp_email ||
                "";
        }


        if (smtpPassword) {

            smtpPassword.value =
                settings.smtp_password ||
                "";
        }

    } catch (error) {

        console.error(
            "Settings loading error:",
            error
        );
    }
}


/* =========================================================
   16. LOAD VENDOR QR
   ========================================================= */

let vendorQRLink = "";


async function loadVendorQR() {

    if (!vendorQR) {
        return;
    }

    try {

        const response =
            await apiRequest(
                `/vendor/${vendorId}/qr`
            );

        const data =
            await response.json();


        vendorQRLink =
            data.url || "";


        if (vendorShopName) {

            vendorShopName.textContent =
                data.shop_name ||
                vendorSession.shop_name ||
                "ServePrint Shop";
        }


        /*
         The backend QR endpoint may return
         an image directly.

         If it returns a URL object,
         use QR Server to render it.
        */

        if (data.url) {

            vendorQR.src =
                "https://api.qrserver.com/v1/create-qr-code/" +
                "?size=300x300&data=" +
                encodeURIComponent(
                    data.url
                );

        } else {

            vendorQR.src =
                `${API_URL}/vendor/${vendorId}/qr`;
        }


    } catch (error) {

        console.error(
            "QR loading error:",
            error
        );
    }
}


/* =========================================================
   17. COPY QR LINK
   ========================================================= */

if (copyQRLink) {

    copyQRLink.addEventListener(
        "click",
        async () => {

            if (!vendorQRLink) {

                showToast(
                    "QR link is not available.",
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


/* =========================================================
   18. DOWNLOAD PNG
   ========================================================= */

if (downloadPNG) {

    downloadPNG.addEventListener(
        "click",
        () => {

            if (!vendorQRLink) {

                showToast(
                    "QR is not ready.",
                    "error"
                );

                return;
            }


            const qrURL =
                "https://api.qrserver.com/v1/create-qr-code/" +
                "?size=1000x1000&format=png&data=" +
                encodeURIComponent(
                    vendorQRLink
                );


            const link =
                document.createElement(
                    "a"
                );

            link.href =
                qrURL;

            link.download =
                "ServePrint_QR.png";

            link.target =
                "_blank";

            link.click();
        }
    );
}


/* =========================================================
   19. DOWNLOAD SVG
   =============== */

if (downloadSVG) {

    downloadSVG.addEventListener(
        "click",
        () => {

            if (!vendorQRLink) {

                showToast(
                    "QR is not ready.",
                    "error"
                );

                return;
            }


            const svgURL =
                "https://api.qrserver.com/v1/create-qr-code/" +
                "?size=1000x1000&format=svg&data=" +
                encodeURIComponent(
                    vendorQRLink
                );


            const link =
                document.createElement(
                    "a"
                );

            link.href =
                svgURL;

            link.download =
                "ServePrint_QR.svg";

            link.target =
                "_blank";

            link.click();
        }
    );
}


/* =========================================================
   20. PRINT QR
   ========================================================= */

if (printQR) {

    printQR.addEventListener(
        "click",
        () => {

            if (!vendorQRLink) {

                showToast(
                    "QR is not ready.",
                    "error"
                );

                return;
            }


            const qrURL =
                "https://api.qrserver.com/v1/create-qr-code/" +
                "?size=500x500&data=" +
                encodeURIComponent(
                    vendorQRLink
                );


            const printWindow =
                window.open(
                    "",
                    "_blank"
                );


            if (!printWindow) {

                showToast(
                    "Please allow pop-ups to print the QR.",
                    "error"
                );

                return;
            }


            printWindow.document.write(`
                <!DOCTYPE html>

                <html>

                <head>

                    <title>
                        ServePrint QR
                    </title>

                    <style>

                        body {
                            margin: 0;
                            padding: 40px;
                            text-align: center;
                            font-family: Arial, sans-serif;
                        }

                        img {
                            width: 300px;
                            height: 300px;
                        }

                        h2 {
                            margin-bottom: 20px;
                        }

                    </style>

                </head>

                <body>

                    <h2>
                        ${escapeHTML(
                            vendorSession.shop_name ||
                            "ServePrint Shop"
                        )}
                    </h2>

                    <img
                        src="${qrURL}"
                        alt="ServePrint QR"
                    >

                    <script>

                        window.onload =
                            function () {

                                window.print();

                            };

                    <\/script>

                </body>

                </html>
            `);


            printWindow.document.close();
        }
    );
}

/* =========================================================
   21. MAINTENANCE MODE
   ========================================================= */

if (maintenanceToggle) {

    maintenanceToggle.addEventListener(
        "change",
        async function () {

            const enabled =
                this.checked;

          maintenanceUpdating = true;
this.disabled = true;
            


            try {

                const response =
                    await apiRequest(
                        `/vendor/${vendorId}/maintenance` +
                        `?enabled=${enabled}`,
                        {
                            method: "POST"
                        }
                    );


                const data =
                    await response.json();


                if (
                    data.success !== true
                ) {

                    throw new Error(
                        "Maintenance update failed."
                    );
                }


                showToast(
                    enabled
                        ? "Maintenance mode enabled."
                        : "Maintenance mode disabled.",
                    "success"
                );


                    } catch (error) {

            console.error(
                "Maintenance error:",
                error
            );

            this.checked =
                !enabled;

            showToast(
                error.message ||
                "Unable to update maintenance mode.",
                "error"
            );

        } finally {

            maintenanceUpdating = false;
            this.disabled = false;
            }
        }
    );
}

/* =========================================================
   22. ACCEPT NEW ORDERS
   ========================================================= */

let ordersUpdating = false;

if (ordersToggle) {

    ordersToggle.addEventListener(
        "change",
        async function () {

            if (ordersUpdating) {
                return;
            }

            const enabled =
                this.checked;

            ordersUpdating = true;
            this.disabled = true;

            try {

                const response =
                    await apiRequest(
                        `/vendor/${vendorId}/accept-orders` +
                        `?enabled=${enabled}`,
                        {
                            method: "POST"
                        }
                    );

                if (!response.ok) {

                    let message =
                        "Unable to update order status.";

                    try {
                        const errorData =
                            await response.json();

                        message =
                            errorData.detail ||
                            errorData.message ||
                            message;

                    } catch (e) {}

                    throw new Error(message);
                }

                const data =
                    await response.json();

                if (
                    data.success !== true
                ) {
                    throw new Error(
                        data.message ||
                        "Unable to update order status."
                    );
                }

                showToast(
                    enabled
                        ? "New orders enabled."
                        : "New orders stopped.",
                    "success"
                );

            } catch (error) {

                console.error(
                    "Accept orders error:",
                    error
                );

                this.checked =
                    !enabled;

                showToast(
                    error.message ||
                    "Unable to update order settings.",
                    "error"
                );

            } finally {

                ordersUpdating = false;
                this.disabled = false;
            }
        }
    );
}
                  
/* =========================================================
   23. SAVE VENDOR SETTINGS
   ========================================================= */

if (saveSettingsBtn) {

    saveSettingsBtn.addEventListener(
        "click",
        async () => {

            try {

                const payload = {

                    shop_name:
                        shopName?.value.trim() ||
                        "",

                    owner_name:
                        ownerName?.value.trim() ||
                        "",

                    phone:
                        shopPhone?.value.trim() ||
                        "",

                    address:
                        shopAddress?.value.trim() ||
                        "",

                    maintenance:
                        Boolean(
                            maintenanceToggle?.checked
                        ),

                    accept_orders:
                        ordersToggle
                            ? Boolean(
                                ordersToggle.checked
                            )
                            : true,

                    razorpay_key:
                        razorpayKey?.value.trim() ||
                        "",

                    razorpay_secret:
                        razorpaySecret?.value.trim() ||
                        "",

                    google_sheet_id:
                        sheetId?.value.trim() ||
                        "",

                    service_email:
                        serviceEmail?.value.trim() ||
                        "",

                    smtp_host:
                        smtpHost?.value.trim() ||
                        "",

                    smtp_port:
                        Number(
                            smtpPort?.value ||
                            587
                        ),

                    smtp_email:
                        smtpEmail?.value.trim() ||
                        "",

                    smtp_password:
                        smtpPassword?.value ||
                        ""
                };


                await apiRequest(
                    `/vendor/${vendorId}/settings`,
                    {
                        method: "PUT",

                        body:
                            JSON.stringify(
                                payload
                            )
                    }
                );


                /*
                 Update local session
                 with changed shop details.
                */

                vendorSession.shop_name =
                    payload.shop_name;

                vendorSession.owner_name =
                    payload.owner_name;


                localStorage.setItem(
                    "serveprint_vendor",
                    JSON.stringify(
                        vendorSession
                    )
                );


                if (vendorShopName) {

                    vendorShopName.textContent =
                        payload.shop_name;
                }


                if (vendorOwnerName) {

                    vendorOwnerName.textContent =
                        payload.owner_name;
                }


                showToast(
                    "Settings saved successfully.",
                    "success"
                );


                await loadVendorSettings();


            } catch (error) {

                console.error(
                    "Save settings error:",
                    error
                );


                showToast(
                    error.message ||
                    "Unable to save settings.",
                    "error"
                );
            }
        }
    );
}


/* =========================================================
   24. REFRESH DASHBOARD
   ========================================================= */

async function refreshDashboard(
    showLoading = true
) {

    if (showLoading) {
        showLoader();
    }


    try {

        await Promise.all([
            loadDashboardStats(),
            loadOrders(),
            loadQueue(),
            loadVendorSettings(),
            loadVendorQR()
        ]);


    } catch (error) {

        console.error(
            "Dashboard refresh error:",
            error
        );


        showToast(
            "Unable to refresh dashboard.",
            "error"
        );


    } finally {

    if (showLoading) {
        hideLoader();
    }
    }

}

/* =========================================================
   25. REFRESH BUTTON
   ========================================================= */

if (refreshBtn) {

    refreshBtn.addEventListener(
        "click",
        async () => {

            await refreshDashboard();

            showToast(
                "Dashboard updated.",
                "success"
            );
        }
    );
}


/* =========================================================
   26. LOGOUT
   ========================================================= */

function doLogout() {

    localStorage.removeItem(
        "serveprint_vendor"
    );

    localStorage.removeItem(
        "remember_vendor"
    );

    localStorage.removeItem(
        "vendor_id"
    );

    localStorage.removeItem(
        "vendor_token"
    );


    window.location.href =
        "vendor_login.html";
}

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        () => {

            confirmAction(
                "Log Out",
                "Are you sure you want to log out of your vendor dashboard?",
                doLogout
            );
        }
    );
}

/* =========================================================
   26D. MOBILE SIDEBAR TOGGLE
   ========================================================= */

const navToggle =
    document.getElementById("navToggle");

const sidebarEl =
    document.getElementById("sidebar");

const sidebarOverlay =
    document.getElementById("sidebarOverlay");

function openSidebar() {

    if (sidebarEl) sidebarEl.classList.add("open");
    if (sidebarOverlay) sidebarOverlay.classList.add("active");
}

function closeSidebar() {

    if (sidebarEl) sidebarEl.classList.remove("open");
    if (sidebarOverlay) sidebarOverlay.classList.remove("active");
}

if (navToggle) {
    navToggle.addEventListener("click", openSidebar);
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", closeSidebar);
}

/* =========================================================
   26E. QUICK ACTION BUTTONS
   ========================================================= */

function goToSection(sectionName) {

    sidebarItems.forEach(function (navItem) {

        navItem.classList.toggle(
            "active",
            navItem.textContent.trim() === sectionName
        );

    });

    showDashboardSection(sectionName);
    closeSidebar();
}

const newOrderBtn =
    document.getElementById("newOrderBtn");

const queueBtn =
    document.getElementById("queueBtn");

const downloadQRBtn =
    document.getElementById("downloadQRBtn");

const analyticsBtn =
    document.getElementById("analyticsBtn");

const maintenanceBtn =
    document.getElementById("maintenanceBtn");

if (newOrderBtn) {
    newOrderBtn.addEventListener("click", function () {
        goToSection("Orders");
    });
}

if (queueBtn) {
    queueBtn.addEventListener("click", function () {
        goToSection("Queue");
    });
}

if (analyticsBtn) {
    analyticsBtn.addEventListener("click", function () {
        goToSection("Analytics");
    });
}

if (maintenanceBtn) {
    maintenanceBtn.addEventListener("click", function () {
        goToSection("Maintenance");
    });
}

if (downloadQRBtn) {
    downloadQRBtn.addEventListener("click", function () {

        if (downloadPNG) {
            downloadPNG.click();
        } else {
            goToSection("QR Code");
        }

    });
}


/* =========================================================
   27. INITIAL DASHBOARD LOAD
   ========================================================= */

async function initializeDashboard() {

    showLoader();


    try {

        await Promise.all([
            loadDashboardStats(),
            loadOrders(),
            loadQueue(),
            loadVendorSettings(),
            loadVendorQR()
        ]);


    } catch (error) {

        console.error(
            "Dashboard initialization error:",
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


/* =========================================================
   28. START
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeDashboard
    );

} else {

    initializeDashboard();
}


/* =========================================================
   29. AUTO REFRESH
   ========================================================= */

setInterval(
    function () {
        refreshDashboard(false);
    },
    30000
);

/* =========================================================
   23. SIDEBAR NAVIGATION
   ========================================================= */

const sidebarItems =
    document.querySelectorAll(
        ".sidebar nav li"
    );

const dashboardSections = {

    "Dashboard": [
        ".dashboard-cards",
        ".quick-actions",
        ".table-section",
        ".queue-section",
        ".analytics-section",
        ".shop-status",
        ".qr-section",
        ".settings-section",
        ".activity-section"
    ],

    "Orders": [
        ".table-section"
    ],

    "Queue": [
        ".queue-section"
    ],

    "QR Code": [
        ".qr-section"
    ],

    "Analytics": [
        ".analytics-section"
    ],

    "Settings": [
        ".settings-section"
    ],

    "Maintenance": [
        ".shop-status"
    ],

    "Customers": [],
    "Payments": []
};


function showDashboardSection(
    sectionName
) {

    const selectors =
        dashboardSections[
            sectionName
        ];

    if (!selectors) {
        return;
    }

    // Hide individual sections
    // except the Dashboard overview.
    const allSections =
        document.querySelectorAll(
            ".main-content > section"
        );

    allSections.forEach(
        function (section) {

            section.classList.add(
                "dashboard-hidden"
            );

        }
    );

    // Dashboard = show everything
    if (
        sectionName ===
        "Dashboard"
    ) {

        allSections.forEach(
            function (section) {

                section.classList.remove(
                    "dashboard-hidden"
                );

            }
        );

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

        return;
    }

    selectors.forEach(
        function (selector) {

            document
                .querySelectorAll(
                    selector
                )
                .forEach(
                    function (section) {

                        section.classList.remove(
                            "dashboard-hidden"
                        );

                    }
                );

        }
    );

    const firstSection =
        document.querySelector(
            selectors[0]
        );

    if (firstSection) {

        firstSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }
}


sidebarItems.forEach(
    function (item) {

        item.addEventListener(
            "click",
            function () {

                const label =
                    this.textContent
                        .trim();

                sidebarItems.forEach(
                    function (navItem) {

                        navItem.classList.remove(
                            "active"
                        );

                    }
                );

                this.classList.add(
                    "active"
                );

                if (
                    label ===
                    "Customers" ||
                    label ===
                    "Payments"
                ) {

                    showToast(
                        label +
                        " section is coming soon.",
                        "info"
                    );

                    return;
                }

                showDashboardSection(
                    label
                );

            }
        );

    }
);