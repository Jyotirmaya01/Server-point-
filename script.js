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
let currentJob = null;

const API_URL = "https://server-point-xiir.onrender.com";

const ALLOWED_EXTENSIONS = [
    "pdf",
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "bmp",
    "tif",
    "tiff",
    "heic",
    "heif",
    "docx",
    "pptx",
    "xlsx",
    "txt"
];

const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/tiff",
    "image/heic",
    "image/heif"
];

function getVendorId() {
    return sessionStorage.getItem("serveprint_vendor_id");
}

/*
 * Vendor ID is used internally only.
 * It must NEVER be displayed to the customer.
 */
const urlParams = new URLSearchParams(window.location.search);
const URL_VENDOR_ID = urlParams.get("vendor_id");

if (URL_VENDOR_ID) {
    sessionStorage.setItem(
        "serveprint_vendor_id",
        URL_VENDOR_ID
    );

    /*
     * Immediately remove vendor_id from visible URL.
     */
    window.history.replaceState(
        {},
        document.title,
        window.location.origin +
        window.location.pathname
    );
}

async function verifyVendorBeforeUpload() {

    const vendorId = getVendorId();

    if (!vendorId) {
        throw new Error(
            "Print shop session expired. Please scan the shop QR code again."
        );
    }

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

        let message =
            "Unable to verify the print shop.";

        try {
            const data = await response.json();

            if (data.detail) {
                message = data.detail;
            }
        } catch (e) {}

        throw new Error(message);
    }

    const data = await response.json();

    if (Boolean(data.maintenance)) {

        window.location.replace(
            "maintenance.html"
        );

        return false;
    }

    if (data.accept_orders === false) {

        throw new Error(
            "This shop is currently not accepting new orders."
        );
    }

    return true;
}


/*
 * Initial vendor status check.
 */
async function checkVendorMaintenance() {

    const vendorId = getVendorId();

    /*
     * Normal homepage without QR vendor.
     */
    if (!vendorId) {
        return true;
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
            return true;
        }

        const data = await response.json();

        if (Boolean(data.maintenance)) {

            window.location.replace(
                "maintenance.html"
            );

            return false;
        }

        if (data.accept_orders === false) {

            /*
             * Do not expose vendor ID.
             */
            alert(
                "This shop is currently not accepting new orders."
            );

            return false;
        }

        return true;

    } catch (error) {

        /*
         * Do not block the customer just because
         * the status request temporarily failed.
         */
        console.error(
            "Vendor status check failed:",
            error
        );

        return true;
    }
}


function init() {

    copyCount.textContent =
        copies.value;

    paperSummary.textContent =
        paperSize.value;

    printSummary.textContent =
        "Black & White";

    queueCount.textContent =
        "-";

    waitingTime.textContent =
        "-";

    updatePrice();

    payBtn.disabled = true;
}


/*
 * File validation
 */
printFile.addEventListener(
    "change",
    async function () {

        if (!this.files.length) {
            return;
        }

        const selected =
            this.files[0];

        const ext =
            selected.name
                .split(".")
                .pop()
                .toLowerCase();

        const mime =
            selected.type || "";


        /*
         * Reject unsupported files.
         */
        if (
            !ALLOWED_EXTENSIONS.includes(ext) &&
            !ALLOWED_IMAGE_TYPES.includes(mime)
        ) {

            alert(
                "Unsupported file type.\n\n" +
                "Allowed: PDF, images, DOCX, PPTX, XLSX and TXT."
            );

            resetSelectedFile();

            return;
        }


        /*
         * Reject videos.
         */
        if (
            mime &&
            mime.startsWith("video/")
        ) {

            alert(
                "Video files are not allowed."
            );

            resetSelectedFile();

            return;
        }


        /*
         * New file = new upload job.
         */
        currentJob = null;

        file = selected;

        uploadIcon.textContent =
            "✅";

        uploadTitle.textContent =
            file.name;

        uploadText.textContent =
            formatSize(file.size);

        fileName.textContent =
            file.name;


        /*
         * Show instant page estimate.
         */
        detectPages(file);


        /*
         * Upload and calculate real details.
         */
        await refreshOrder();
    }
);


function resetSelectedFile() {

    printFile.value = "";

    uploadIcon.textContent =
        "📂";

    uploadTitle.textContent =
        "Click to Upload";

    uploadText.textContent =
        "Select your document";

    fileName.textContent =
        "No File Selected";

    file = null;

    pages = 0;

    currentJob = null;

    pageCount.textContent =
        "0";

    price.textContent =
        "0";

    queueCount.textContent =
        "-";

    waitingTime.textContent =
        "-";

    payBtn.disabled =
        true;

    updatePrice();
}


/*
 * Local page detection.
 *
 * PDFs are intentionally NOT guessed as one page.
 */
function detectPages(selectedFile) {

    const ext =
        selectedFile.name
            .split(".")
            .pop()
            .toLowerCase();

    if (
        ext === "jpg" ||
        ext === "jpeg" ||
        ext === "png" ||
        ext === "gif" ||
        ext === "webp" ||
        ext === "bmp" ||
        ext === "tif" ||
        ext === "tiff" ||
        ext === "heic" ||
        ext === "heif"
    ) {

        pages = 1;

        pageCount.textContent =
            "1";

    } else {

        /*
         * Backend determines the real count.
         */
        pages = 0;

        pageCount.textContent =
            "Detecting...";
    }

    updatePrice();
}


function updatePrice() {

    const total =
        pages *
        Number(copies.value) *
        rate;

    price.textContent =
        total;
}


/*
 * Upload document.
 */
async function uploadDocument() {

    if (!file) {

        throw new Error(
            "Please upload a document."
        );
    }

    const vendorId =
        getVendorId();

    if (!vendorId) {

        throw new Error(
            "Print shop session expired. Please scan the shop QR code again."
        );
    }


    /*
     * Verify shop before upload.
     */
    const canUpload =
        await verifyVendorBeforeUpload();

    if (!canUpload) {
        return null;
    }


    const formData =
        new FormData();


    /*
     * Vendor ID is transmitted internally.
     * It is NEVER displayed.
     */
    formData.append(
        "vendor_id",
        vendorId
    );

    formData.append(
        "file",
        file
    );

    formData.append(
        "copies",
        copies.value
    );

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


    let response;

    try {

        response = await fetch(
            API_URL + "/upload",
            {
                method: "POST",
                body: formData
            }
        );

    } catch (networkError) {

        console.error(
            "Upload network error:",
            networkError
        );

        throw new Error(
            "Unable to connect to the print server. Please check your internet connection and try again."
        );
    }


    if (!response.ok) {

        let detail =
            "Upload failed.";

        try {

            const errBody =
                await response.json();

            detail =
                errBody.detail ||
                errBody.message ||
                detail;

        } catch (e) {

            try {

                const text =
                    await response.text();

                if (text) {
                    detail = text;
                }

            } catch (ignore) {}
        }


        throw new Error(
            detail
        );
    }


    try {

        return await response.json();

    } catch (e) {

        throw new Error(
            "The server returned an invalid upload response."
        );
    }
}


/*
 * Refresh order details.
 *
 * IMPORTANT:
 * A new file always creates a new job.
 * Existing job is only updated when changing
 * print settings.
 */
async function refreshOrder() {

    if (!file) {
        return;
    }

    payBtn.disabled =
        true;

    pageCount.textContent =
        "Calculating...";

    price.textContent =
        "...";


    try {

        /*
         * If no job exists, upload the file.
         */
        if (!currentJob) {

            const result =
                await uploadDocument();

            if (!result) {
                return;
            }

            currentJob =
                result;

        } else {

            /*
             * Existing job:
             * only update settings.
             */
            currentJob =
                await updateExistingJob();
        }


        if (!currentJob) {
            return;
        }


        pages =
            Number(
                currentJob.total_pages
            ) || 0;


        pageCount.textContent =
            pages;


        price.textContent =
            currentJob.total_amount;


        queueCount.textContent =
            currentJob.queue_number ?? 0;


        waitingTime.textContent =
            (
                currentJob.estimated_wait_time ??
                0
            ) +
            " min";


        payBtn.disabled =
            false;


    } catch (error) {

        console.error(
            "Could not calculate order:",
            error
        );

        currentJob =
            null;

        pageCount.textContent =
            "0";

        price.textContent =
            "0";

        payBtn.disabled =
            true;


        alert(
            "Could not upload your file:\n\n" +
            (
                error.message ||
                "Unknown error"
            )
        );
    }
}


/*
 * Update an existing unpaid job.
 */
async function updateExistingJob() {

    if (!currentJob) {
        return null;
    }

    let response;

    try {

        response =
            await fetch(
                API_URL +
                "/jobs/" +
                currentJob.job_id,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        JSON.stringify({
                            job_id:
                                currentJob.job_id,

                            copies:
                                Number(
                                    copies.value
                                ),

                            print_type:
                                document.querySelector(
                                    'input[name="printType"]:checked'
                                ).value,

                            paper_size:
                                paperSize.value,

                            orientation:
                                orientation
                                    ? orientation.value
                                    : "Portrait",

                            page_range:
                                pageRange.value ||
                                "All"
                        })
                }
            );

    } catch (error) {

        throw new Error(
            "Unable to connect to the print server."
        );
    }


    if (!response.ok) {

        let detail =
            "Failed to update print job.";

        try {

            const body =
                await response.json();

            detail =
                body.detail ||
                body.message ||
                detail;

        } catch (e) {}

        throw new Error(
            detail
        );
    }


    return await response.json();
}


/*
 * Copies
 */
copies.addEventListener(
    "input",
    function () {

        if (
            this.value < 1
        ) {
            this.value = 1;
        }

        copyCount.textContent =
            this.value;

        updatePrice();
    }
);


copies.addEventListener(
    "change",
    function () {

        if (file) {
            refreshOrder();
        }
    }
);


copies.addEventListener(
    "focus",
    function () {
        this.select();
    }
);


/*
 * Paper size
 */
paperSize.addEventListener(
    "change",
    function () {

        paperSummary.textContent =
            this.value;

        if (file) {
            refreshOrder();
        }
    }
);


/*
 * Print type
 */
printTypes.forEach(
    function (item) {

        item.addEventListener(
            "change",
            function () {

                if (
                    this.value === "bw"
                ) {

                    rate = 2;

                    printSummary.textContent =
                        "Black & White";

                } else {

                    rate = 10;

                    printSummary.textContent =
                        "Colour";
                }

                updatePrice();

                if (file) {
                    refreshOrder();
                }
            }
        );
    }
);


/*
 * Page range
 */
pageRange.addEventListener(
    "input",
    function () {

        saveOrder();
    }
);


/*
 * Orientation
 */
if (orientation) {

    orientation.addEventListener(
        "change",
        function () {

            saveOrder();

            if (file) {
                refreshOrder();
            }
        }
    );
}


function formatSize(size) {

    if (size < 1024) {
        return size + " Bytes";
    }

    if (
        size <
        1024 * 1024
    ) {

        return (
            size / 1024
        ).toFixed(2) +
        " KB";
    }

    return (
        size /
        1024 /
        1024
    ).toFixed(2) +
    " MB";
}


function saveOrder() {

    const order = {

        copies:
            copies.value,

        paperSize:
            paperSize.value,

        orientation:
            orientation.value,

        pageRange:
            pageRange.value,

        pages:
            pages,

        price:
            price.textContent
    };

    localStorage.setItem(
        "serveprint_order",
        JSON.stringify(order)
    );
}


function loadOrder() {

    const saved =
        localStorage.getItem(
            "serveprint_order"
        );

    if (!saved) {
        return;
    }

    try {

        const order =
            JSON.parse(saved);

        if (order.copies) {

            copies.value =
                order.copies;

            copyCount.textContent =
                order.copies;
        }

        if (order.paperSize) {

            paperSize.value =
                order.paperSize;

            paperSummary.textContent =
                order.paperSize;
        }

        if (
            order.orientation &&
            orientation
        ) {

            orientation.value =
                order.orientation;
        }

        if (order.pageRange) {

            pageRange.value =
                order.pageRange;
        }

    } catch (error) {

        console.error(
            "Saved order could not be restored:",
            error
        );
    }
}


loadOrder();


/*
 * Payment
 */
payBtn.addEventListener(
    "click",
    async function () {

        if (!currentJob) {

            alert(
                "Please upload a document and wait for the price to load first."
            );

            return;
        }

        payBtn.disabled =
            true;

        const originalLabel =
            payBtn.textContent;

        try {

            payBtn.textContent =
                "Opening Payment...";


            await loadRazorpayCheckout();


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


            const paymentResult =
                await new Promise(
                    function (
                        resolve,
                        reject
                    ) {

                        let settled =
                            false;


                        function failPayment(
                            message,
                            isRealPaymentFailure
                        ) {

                            if (settled) {
                                return;
                            }

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

                                            failPayment(
                                                detail,
                                                true
                                            );

                                            return;
                                        }


                                        const data =
                                            await verifyResponse.json();


                                        if (
                                            !data.success
                                        ) {

                                            failPayment(
                                                "Payment verification failed.",
                                                true
                                            );

                                            return;
                                        }


                                        settled =
                                            true;

                                        resolve(
                                            data
                                        );

                                    } catch (error) {

                                        failPayment(
                                            "Unable to verify payment with the server.",
                                            true
                                        );
                                    }
                                },


                            modal: {

                                ondismiss:
                                    function () {

                                        failPayment(
                                            "Payment cancelled.",
                                            false
                                        );
                                    }
                            },


                            theme: {
                                color: "#111827"
                            }
                        };


                        const razorpay =
                            new Razorpay(
                                options
                            );


                        razorpay.on(
                            "payment.failed",
                            function (
                                response
                            ) {

                                failPayment(
                                    (
                                        response &&
                                        response.error &&
                                        response.error.description
                                    ) ||
                                    "Payment failed.",
                                    true
                                );
                            }
                        );


                        razorpay.open();
                    }
                );


            if (paymentResult) {

                currentJob =
                    Object.assign(
                        {},
                        currentJob,
                        paymentResult
                    );

                setStatus(
                    "Payment Completed"
                );

                setProgress(
                    100
                );

                payBtn.textContent =
                    "Payment Completed";

                setTimeout(
                    function () {

                        simulatePrinting();

                    },
                    500
                );
            }


        } catch (error) {

            console.error(
                "Payment error:",
                error
            );


            if (
                error.isPaymentCancelled
            ) {

                setStatus(
                    "Payment Cancelled"
                );

            } else {

                setStatus(
                    "Payment Failed"
                );
            }


            setProgress(
                0
            );


            alert(
                error.message ||
                "Payment failed."
            );


            payBtn.disabled =
                false;

            payBtn.textContent =
                originalLabel;
        }
    }
);

/*
 * Razorpay loader
 */
function loadRazorpayCheckout() {

    return new Promise(
        function (
            resolve,
            reject
        ) {

            if (
                window.Razorpay
            ) {

                resolve();

                return;
            }


            const existing =
                document.querySelector(
                    'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
                );


            if (existing) {

                existing.addEventListener(
                    "load",
                    resolve,
                    {
                        once: true
                    }
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
                    {
                        once: true
                    }
                );

                return;
            }


            const script =
                document.createElement(
                    "script"
                );

            script.src =
                "https://checkout.razorpay.com/v1/checkout.js";

            script.async =
                true;

            script.onload =
                resolve;

            script.onerror =
                function () {

                    reject(
                        new Error(
                            "Unable to load Razorpay Checkout."
                        )
                    );
                };

            document.head.appendChild(
                script
            );
        }
    );
}


/*
 * Status helper
 */
function setStatus(text) {

    if (status) {
        status.textContent =
            text;
    }
}


function setProgress(value) {

    if (progressBar) {
        progressBar.style.width =
            value + "%";
    }
}


/*
 * Printing simulation
 */
function simulatePrinting() {

    setStatus(
        "Printing..."
    );

    setProgress(
        100
    );

    setTimeout(
        function () {

            setStatus(
                "Print Completed"
            );

        },
        3000
    );
}


/*
 * Clear saved order
 */
function clearSavedOrder() {

    localStorage.removeItem(
        "serveprint_order"
    );
}


/*
 * Complete order
 */
function completeOrder() {

    clearSavedOrder();

    resetOrder();
}


function resetOrder() {

    pages = 0;

    file = null;

    currentJob = null;

    printFile.value = "";

    fileName.textContent =
        "No File Selected";

    pageCount.textContent =
        "0";

    copyCount.textContent =
        "1";

    price.textContent =
        "0";

    uploadIcon.textContent =
        "📂";

    uploadTitle.textContent =
        "Click to Upload";

    uploadText.textContent =
        "Select your document";

    progressBar.style.width =
        "0%";

    status.textContent =
        "Waiting for Payment";

    payBtn.disabled =
        true;
}

/*
 * Page range validation
 */
function validatePageRange() {

    const value =
        pageRange.value.trim();

    if (value === "") {
        return true;
    }


    const regex =
        /^(\d+(-\d+)?)(,\d+(-\d+)?)*$/;


    if (
        !regex.test(value) &&
        value.toLowerCase() !==
        "all"
    ) {

        alert(
            "Invalid page range."
        );

        pageRange.focus();

        return false;
    }

    return true;
}


pageRange.addEventListener(
    "blur",
    validatePageRange
);


/*
 * Keyboard shortcut
 */
document.addEventListener(
    "keydown",
    function (e) {

        if (
            e.ctrlKey &&
            e.key === "Enter"
        ) {

            payBtn.click();
        }
    }
);


/*
 * Browser support
 */
window.addEventListener(
    "load",
    async function () {

        if (!window.FileReader) {

            alert(
                "Your browser does not support file upload."
            );

            return;
        }


        const canContinue =
            await checkVendorMaintenance();


        if (canContinue) {
            init();
        }
    }
);


/*
 * Prevent accidental refresh while
 * an upload/order is active.
 */
window.addEventListener(
    "beforeunload",
    function (e) {

        if (file) {

            e.preventDefault();

            e.returnValue =
                "";
        }
    }
);


/*
 * Developer helper.
 * Vendor ID is deliberately NOT logged.
 */
window.debugOrder =
    function () {

        console.table({
            job_id:
                currentJob
                    ? currentJob.job_id
                    : null,

            file:
                file
                    ? file.name
                    : null,

            pages:
                pages,

            price:
                price.textContent
        });
    };


const APP_VERSION =
    "1.2.0";

console.log(
    "ServePrint Version:",
    APP_VERSION
);

console.log(
    "ServePrint frontend loaded."
);