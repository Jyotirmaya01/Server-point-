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


/* ---------- Maintenance ---------- */

const maintenanceToggle =
    document.getElementById(
        "maintenanceToggle"
    );


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

function showToast(
    message,
    type = "success"
) {

    if (
        typeof window.showToast ===
        "function"
    ) {

        window.showToast(
            message,
            type
        );

        return;
    }

    console.log(
        `[${type}] ${message}`
    );
}


/* =========================================================
   9. API HELPER
   ========================================================= */

async function apiRequest(
    endpoint,
    options = {}
) {

    const response =
        await fetch(
            `${API_URL}${endpoint}`,
            {
                ...options,
                headers: {
                    "Content-Type":
                        "application/json",

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


        if (
            !Array.isArray(orders) ||
            orders.length === 0
        ) {

            ordersBody.innerHTML = `
                <tr>
                    <td
                        colspan="8"
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
                        ${escapeHTML(
                            order.payment_status ??
                            "-"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            order.printer_status ??
                            "-"
                        )}
                    </td>

                    <td>
                        ${formatTime(
                            order.created_at
                        )}
                    </td>

                `;

                ordersBody.appendChild(
                    row
                );
            }
        );

    } catch (error) {

        console.error(
            "Orders loading error:",
            error
        );

        if (ordersBody) {

            ordersBody.innerHTML = `
                <tr>
                    <td
                        colspan="8"
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

        if (maintenanceToggle) {

            maintenanceToggle.checked =
                Boolean(
                    settings.maintenance
                );
        }


        /* ---------- Accept Orders ---------- */

        if (ordersToggle) {

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


                /*
                 Revert switch if
                 backend update fails.
                */

                this.checked =
                    !enabled;


                showToast(
                    error.message ||
                    "Unable to update maintenance mode.",
                    "error"
                );
            }
        }
    );
}


/* =========================================================
   22. ACCEPT NEW ORDERS
   ========================================================= */

if (ordersToggle) {

    ordersToggle.addEventListener(
        "change",
        async function () {

            const enabled =
                this.checked;


            try {

                /*
                 The existing backend settings
                 endpoint expects the complete
                 VendorSettingsUpdate object.

                 Therefore we first load the
                 current settings and then update
                 only accept_orders.
                */

                const response =
                    await apiRequest(
                        `/vendor/${vendorId}/settings`
                    );

                const current =
                    await response.json();


                const payload = {

                    shop_name:
                        current.shop_name ||
                        vendorSession.shop_name ||
                        "",

                    owner_name:
                        current.owner_name ||
                        vendorSession.owner_name ||
                        "",

                    phone:
                        current.phone ||
                        "",

                    address:
                        current.address ||
                        "",

                    maintenance:
                        Boolean(
                            current.maintenance
                        ),

                    accept_orders:
                        enabled,

                    razorpay_key:
                        current.razorpay_key ||
                        "",

                    razorpay_secret:
                        current.razorpay_secret ||
                        "",

                    google_sheet_id:
                        current.google_sheet_id ||
                        "",

                    service_email:
                        current.service_email ||
                        "",

                    smtp_host:
                        current.smtp_host ||
                        "",

                    smtp_port:
                        Number(
                            current.smtp_port ||
                            587
                        ),

                    smtp_email:
                        current.smtp_email ||
                        "",

                    smtp_password:
                        current.smtp_password ||
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

async function refreshDashboard() {

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
            "Dashboard refresh error:",
            error
        );


        showToast(
            "Unable to refresh dashboard.",
            "error"
        );


    } finally {

        hideLoader();
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

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        () => {

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
    );
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
    refreshDashboard,
    30000
);
