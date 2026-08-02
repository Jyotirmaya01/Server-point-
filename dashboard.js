/* =====================================================
   ServePrint Vendor Dashboard
   dashboard.js
   Part 1
===================================================== */

// =====================================================
// Backend
// =====================================================

const API_URL = "https://server-point-xiir.onrender.com";

// =====================================================
// Session
// =====================================================

const vendorSession = JSON.parse(

    localStorage.getItem("serveprint_vendor")

);

// =====================================================
// Protect Dashboard
// =====================================================

if(!vendorSession){

    window.location.href="vendor_login.html";

}

// =====================================================
// Vendor
// =====================================================

const vendorId = vendorSession.vendor_id;

// =====================================================
// Elements
// =====================================================

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

// Dashboard Cards

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

// Queue

const currentQueue =
document.getElementById("currentQueue");

const nextQueue =
document.getElementById("nextQueue");

const waitingJobs =
document.getElementById("waitingJobs");

const estimatedWait =
document.getElementById("estimatedWait");

// Orders

const ordersBody =
document.getElementById("ordersBody");

// Maintenance

const maintenanceToggle =
document.getElementById("maintenanceToggle");

// QR

const vendorQR =
document.getElementById("vendorQR");

// =====================================================
// Initial UI
// =====================================================

vendorShopName.textContent =

vendorSession.shop_name;

vendorOwnerName.textContent =

vendorSession.owner_name;

// =====================================================
// Loading
// =====================================================

function showLoader(){

    loadingOverlay.style.display="flex";

}

function hideLoader(){

    loadingOverlay.style.display="none";

}

// =====================================================
// Logout
// =====================================================

logoutBtn.addEventListener(

    "click",

    function(){

        localStorage.removeItem(

            "serveprint_vendor"

        );

        localStorage.removeItem(

            "remember_vendor"

        );

        window.location.href=

        "vendor_login.html";

    }

);

// =====================================================
// Refresh
// =====================================================

refreshBtn.addEventListener(

    "click",

    function(){

        loadDashboard();

    }

);

/* =====================================================
   Dashboard Data
   Part 2
===================================================== */

// =====================================================
// Dashboard Loader
// =====================================================

async function loadDashboard(){

    showLoader();

    try{

        await Promise.all([

            loadDashboardStats(),

            loadOrders(),

            loadQueue(),

            loadVendorSettings(),

            loadQRCode()

        ]);

    }

    catch(error){

        console.error(error);

    }

    finally{

        hideLoader();

    }

}

// =====================================================
// Dashboard Statistics
// =====================================================

async function loadDashboardStats(){

    const response = await fetch(

        `${API_URL}/vendor/${vendorId}/dashboard`

    );

    if(!response.ok){

        throw new Error("Unable to load dashboard.");

    }

    const data = await response.json();

    todayRevenue.textContent =
        "₹" + data.today_revenue;

    todayOrders.textContent =
        data.today_orders;

    queueCount.textContent =
        data.queue_jobs;

    printingCount.textContent =
        data.printing_jobs;

    completedOrders.textContent =
        data.completed_jobs;

    averageWait.textContent =
        data.average_wait + " min";

    totalPages.textContent =
        data.total_pages;

    shopRating.textContent =
        data.rating + "★";

}

// =====================================================
// Orders
// =====================================================

async function loadOrders(){

    const response = await fetch(

        `${API_URL}/vendor/${vendorId}/orders`

    );

    if(!response.ok){

        throw new Error("Unable to load orders.");

    }

    const orders = await response.json();

    renderOrders(

        orders

    );

}

// =====================================================
// Queue
// =====================================================

async function loadQueue(){

    const response = await fetch(

        `${API_URL}/vendor/${vendorId}/queue`

    );

    if(!response.ok){

        throw new Error("Unable to load queue.");

    }

    const queue = await response.json();

    currentQueue.textContent =
        queue.current;

    nextQueue.textContent =
        queue.next;

    waitingJobs.textContent =
        queue.waiting;

    estimatedWait.textContent =
        queue.wait_time + " min";

}

// =====================================================
// Vendor Settings
// =====================================================

async function loadVendorSettings(){

    const response = await fetch(

        `${API_URL}/vendor/${vendorId}/settings`

    );

    if(!response.ok){

        return;

    }

    const settings = await response.json();

    maintenanceToggle.checked =
        settings.maintenance_mode;

}

// =====================================================
// Vendor QR
// =====================================================

async function loadQRCode(){

    vendorQR.src =

    `${API_URL}/vendor/${vendorId}/qr`;

}