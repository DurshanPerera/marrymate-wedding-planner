import { auth, db } from "../../firebase/firebase-config.js";
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    onSnapshot,
    deleteField
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import {
    onAuthStateChanged,
    signOut,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";

/* =========================================================
   GLOBAL STATE
========================================================= */
let currentUser = null;
let currentVendorData = null;
let bookingChartInstance = null;
let servicesList = [];
let bookingsList = [];
let reviewsList = [];
let paymentsList = [];
let messagesList = [];

/* =========================================================
   ELEMENTS
========================================================= */
const sectionTitles = {
    dashboard: { title: "Dashboard", subtitle: "Welcome back. Here is your business overview." },
    profile: { title: "Business Profile", subtitle: "Manage your company information and visibility." },
    services: { title: "Services", subtitle: "Manage wedding services offered by your company." },
    gallery: { title: "Gallery", subtitle: "Showcase your work with beautiful portfolio items." },
    bookings: { title: "Bookings", subtitle: "Review new booking requests and history." },
    reviews: { title: "Reviews & Ratings", subtitle: "Track what customers say about your services." },
    payments: { title: "Payments", subtitle: "View payment status and transaction details." },
    messages: { title: "Messages", subtitle: "Read customer inquiries and direct messages." },
    website: { title: "Website Integration", subtitle: "Save your website for future smart import features." },
    settings: { title: "Settings", subtitle: "Control notifications and preferences." }
};

/* =========================================================
   UTILITIES
========================================================= */
function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.backgroundColor = isError ? '#ff6b6b' : '#51cf66';
    toast.style.color = 'white';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.zIndex = '9999';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '500';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function formatCurrency(amount) {
    return `LKR ${Number(amount || 0).toLocaleString()}`;
}

function formatDate(timestamp) {
    if (!timestamp) return "-";
    if (timestamp.toDate) {
        return timestamp.toDate().toLocaleDateString();
    }
    return new Date(timestamp).toLocaleDateString();
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function calculateProfileCompletion(data) {
    const requiredFields = [
        data.companyName,
        data.contactPerson,
        data.email,
        data.phone,
        data.address,
        data.district,
        data.category
    ];
    const filled = requiredFields.filter(field => field && field !== "").length;
    return Math.round((filled / requiredFields.length) * 100);
}

/* =========================================================
   AUTH & INIT
========================================================= */
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../../login.html";
        return;
    }

    currentUser = user;
    console.log("User logged in:", user.uid);
    
    await loadVendorData();
    await loadAllData();
    setupEventListeners();
    setupSectionNavigation();
    setupTabs();
});

async function loadVendorData() {
    try {
        const vendorDocRef = doc(db, "company_vendors", currentUser.uid);
        const vendorSnap = await getDoc(vendorDocRef);
        
        if (vendorSnap.exists()) {
            currentVendorData = vendorSnap.data();
            console.log("Vendor data loaded:", currentVendorData);
            console.log("District value from DB:", currentVendorData.district);
            console.log("Category value from DB:", currentVendorData.category);
            updateUIWithVendorData();
        } else {
            console.log("No vendor data found");
            showToast("Please complete your profile setup", false);
        }
    } catch (error) {
        console.error("Error loading vendor data:", error);
        showToast("Error loading profile data", true);
    }
}

function updateUIWithVendorData() {
    if (!currentVendorData) return;
    
    // Update vendor name in header
    const vendorNameSpan = document.querySelector("#vendorName span");
    if (vendorNameSpan) {
        vendorNameSpan.textContent = escapeHtml(currentVendorData.companyName || "Company Vendor");
    }
    
    // Update status badge
    const isActive = currentVendorData.isActive !== false;
    const statusBadge = document.getElementById("statusBadge");
    const statusText = document.getElementById("statusText");
    const toggleBtn = document.getElementById("availabilityToggle");
    
    if (isActive) {
        statusBadge.className = "status-badge approved";
        statusText.textContent = "Business Active";
        if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-toggle-on"></i><span>Enabled</span>';
    } else {
        statusBadge.className = "status-badge rejected";
        statusText.textContent = "Business Disabled";
        if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-toggle-off"></i><span>Disabled</span>';
    }
    
    // Fill profile form
    const companyNameInput = document.getElementById("companyName");
    const contactPersonInput = document.getElementById("contactPerson");
    const emailInput = document.getElementById("email");
    const phoneInput = document.getElementById("phone");
    const addressInput = document.getElementById("address");
    const districtSelect = document.getElementById("district");
    const categorySelect = document.getElementById("category");
    const websiteInput = document.getElementById("website");
    const descriptionTextarea = document.getElementById("description");
    const businessActiveCheckbox = document.getElementById("businessActive");
    const websiteUrlInput = document.getElementById("websiteUrl");

    if (companyNameInput) companyNameInput.value = currentVendorData.companyName || "";
    if (contactPersonInput) contactPersonInput.value = currentVendorData.contactPerson || "";
    if (emailInput) emailInput.value = currentVendorData.email || "";
    if (phoneInput) phoneInput.value = currentVendorData.phone || "";
    if (addressInput) addressInput.value = currentVendorData.address || "";

    // Set district value - with fallback
    if (districtSelect && currentVendorData.district) {
        const districtValue = currentVendorData.district.charAt(0).toUpperCase() + currentVendorData.district.slice(1).toLowerCase();
        districtSelect.value = districtValue;
    } else if (districtSelect) {
        districtSelect.value = "";
    }

    // Set category value - with fallback
    if (categorySelect && currentVendorData.category) {
        const categoryValue = currentVendorData.category.toLowerCase();
        categorySelect.value = categoryValue;
    } else if (categorySelect) {
        categorySelect.value = "";
    }

    if (websiteInput) websiteInput.value = currentVendorData.website || "";
    if (descriptionTextarea) descriptionTextarea.value = currentVendorData.description || "";
    if (businessActiveCheckbox) businessActiveCheckbox.checked = currentVendorData.isActive !== false;
    if (websiteUrlInput) websiteUrlInput.value = currentVendorData.website || "";
    
    // Set profile picture
    const profilePreview = document.getElementById("profilePreview");
    const profilePlaceholder = document.getElementById("profilePlaceholder");
    const removeBtn = document.getElementById("removeProfilePicture");
    if (currentVendorData.profilePicture) {
        profilePreview.src = currentVendorData.profilePicture;
        profilePreview.style.display = "block";
        profilePlaceholder.style.display = "none";
        removeBtn.style.display = "block";
    } else {
        profilePreview.style.display = "none";
        profilePlaceholder.style.display = "flex";
        removeBtn.style.display = "none";
    }
    
    // Update profile completion
    const completion = calculateProfileCompletion(currentVendorData);
    document.getElementById("profileCompletion").textContent = `${completion}%`;
    document.getElementById("profileCompletionBar").style.width = `${completion}%`;
}

/* =========================================================
   LOAD ALL DATA
========================================================= */
async function loadAllData() {
    await Promise.all([
        loadServices(),
        loadBookings(),
        loadReviews(),
        loadPayments(),
        loadMessages()
    ]);
    updateDashboardStats();
    renderRecentBookings();
    renderRecentReviews();
    renderBookingChart();
}

async function loadServices() {
    try {
        const servicesRef = collection(db, "services");
        const q = query(servicesRef, where("vendorId", "==", currentUser.uid));
        const snapshot = await getDocs(q);
        
        servicesList = [];
        snapshot.forEach(doc => {
            servicesList.push({ id: doc.id, ...doc.data() });
        });
        
        renderServices();
    } catch (error) {
        console.error("Error loading services:", error);
    }
}

function renderServices() {
    const servicesGrid = document.getElementById("servicesGrid");
    const servicesCount = document.getElementById("servicesCount");
    
    servicesCount.textContent = servicesList.length;
    
    if (servicesList.length === 0) {
        servicesGrid.innerHTML = '<p class="empty-state">No services added yet. Use the form above to create your first service.</p>';
        return;
    }
    
    servicesGrid.innerHTML = servicesList.map(service => `
        <div class="service-card glass">
            <h4>${escapeHtml(service.title || service.serviceName)}</h4>
            <p class="category">${escapeHtml(service.category)}</p>
            <p class="description">${escapeHtml(service.description || "No description")}</p>
            <p class="price">${formatCurrency(service.price)}</p>
            <div class="service-meta">
                <span>Status: ${escapeHtml(service.status || "active")}</span>
                <span>Updated: ${formatDate(service.updatedAt)}</span>
            </div>
            <div class="service-actions">
                <button class="edit-service" data-id="${service.id}"><i class="fas fa-edit"></i> Edit</button>
                <button class="delete-service" data-id="${service.id}"><i class="fas fa-trash"></i> Delete</button>
            </div>
        </div>
    `).join("");
    
    // Attach event listeners
    document.querySelectorAll('.edit-service').forEach(btn => {
        btn.addEventListener('click', () => editService(btn.dataset.id));
    });
    document.querySelectorAll('.delete-service').forEach(btn => {
        btn.addEventListener('click', () => deleteService(btn.dataset.id));
    });
}

async function loadBookings() {
    try {
        const bookingsRef = collection(db, "bookings");
        const q = query(bookingsRef, where("vendorId", "==", currentUser.uid));
        const snapshot = await getDocs(q);
        
        bookingsList = [];
        snapshot.forEach(doc => {
            bookingsList.push({ id: doc.id, ...doc.data() });
        });
        
        renderBookings();
    } catch (error) {
        console.error("Error loading bookings:", error);
    }
}

function renderBookings() {
    const requestsBody = document.getElementById("bookingsRequestsTableBody");
    const historyBody = document.getElementById("bookingsHistoryTableBody");
    
    const pendingBookings = bookingsList.filter(b => b.status === "pending");
    const historyBookings = bookingsList.filter(b => b.status !== "pending");
    
    document.getElementById("bookingsCount").textContent = pendingBookings.length;
    document.getElementById("bookingBadge").textContent = pendingBookings.length;
    
    if (pendingBookings.length === 0) {
        requestsBody.innerHTML = '发展<td colspan="6" class="empty-state">No booking requests yet.</td></tr>';
    } else {
        requestsBody.innerHTML = pendingBookings.map(booking => `
            <tr>
                <td>${escapeHtml(booking.customerName || "Customer")}</td>
                <td>${escapeHtml(booking.serviceTitle || "Service")}</td>
                <td>${formatDate(booking.eventDate)}</td>
                <td>${formatCurrency(booking.budget)}</td>
                <td><span class="status-badge-small status-pending">pending</span></td>
                <td class="action-icons">
                    <i class="fas fa-check-circle approve-booking" data-id="${booking.id}" style="color: #51cf66; cursor: pointer;"></i>
                    <i class="fas fa-times-circle reject-booking" data-id="${booking.id}" style="color: #ff6b6b; cursor: pointer;"></i>
                </td>
            </tr>
        `).join("");
        
        document.querySelectorAll('.approve-booking').forEach(btn => {
            btn.addEventListener('click', () => updateBookingStatus(btn.dataset.id, 'approved'));
        });
        document.querySelectorAll('.reject-booking').forEach(btn => {
            btn.addEventListener('click', () => updateBookingStatus(btn.dataset.id, 'rejected'));
        });
    }
    
    if (historyBookings.length === 0) {
        historyBody.innerHTML = '<tr><td colspan="5" class="empty-state">No booking history yet.</td></tr>';
    } else {
        historyBody.innerHTML = historyBookings.map(booking => `
            <tr>
                <td>${escapeHtml(booking.customerName || "Customer")}</td>
                <td>${escapeHtml(booking.serviceTitle || "Service")}</td>
                <td>${formatDate(booking.eventDate)}</td>
                <td><span class="status-badge-small ${booking.status === 'approved' ? 'status-approved' : 'status-rejected'}">${booking.status}</span></td>
                <td>${formatCurrency(booking.amount || booking.budget)}</td>
            </tr>
        `).join("");
    }
}

async function loadReviews() {
    try {
        const reviewsRef = collection(db, "reviews");
        const q = query(reviewsRef, where("vendorId", "==", currentUser.uid));
        const snapshot = await getDocs(q);
        
        reviewsList = [];
        snapshot.forEach(doc => {
            reviewsList.push({ id: doc.id, ...doc.data() });
        });
        
        renderReviews();
    } catch (error) {
        console.error("Error loading reviews:", error);
    }
}

function renderReviews() {
    const reviewsListDiv = document.getElementById("reviewsList");
    const recentReviewsDiv = document.getElementById("recentReviews");
    
    const total = reviewsList.length;
    const average = total === 0 ? 0 : reviewsList.reduce((sum, r) => sum + (r.rating || 0), 0) / total;
    const fiveStar = reviewsList.filter(r => r.rating === 5).length;
    
    document.getElementById("reviewAverage").textContent = average.toFixed(1);
    document.getElementById("reviewCount").textContent = total;
    document.getElementById("fiveStarCount").textContent = fiveStar;
    document.getElementById("averageRating").textContent = average.toFixed(1);
    
    if (total === 0) {
        reviewsListDiv.innerHTML = '<p class="empty-state">No reviews yet.</p>';
        recentReviewsDiv.innerHTML = '<p class="empty-state">No reviews available yet.</p>';
        return;
    }
    
    reviewsListDiv.innerHTML = reviewsList.map(review => `
        <div class="review-item">
            <div class="review-header">
                <span class="review-user">${escapeHtml(review.customerName || "Customer")}</span>
                <span class="review-date">${formatDate(review.createdAt)}</span>
            </div>
            <div class="review-rating">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</div>
            <p class="review-text">${escapeHtml(review.comment || "No comment")}</p>
        </div>
    `).join("");
    
    const recent = reviewsList.slice(0, 3);
    recentReviewsDiv.innerHTML = recent.map(review => `
        <div class="recent-item">
            <div class="info">
                <p class="name">${escapeHtml(review.customerName || "Customer")}</p>
                <p class="detail">${escapeHtml((review.comment || "").substring(0, 80))}${(review.comment || "").length > 80 ? "..." : ""}</p>
            </div>
            <span class="status status-approved">${review.rating}★</span>
        </div>
    `).join("");
}

async function loadPayments() {
    try {
        const paymentsRef = collection(db, "payments");
        const q = query(paymentsRef, where("vendorId", "==", currentUser.uid));
        const snapshot = await getDocs(q);
        
        paymentsList = [];
        snapshot.forEach(doc => {
            paymentsList.push({ id: doc.id, ...doc.data() });
        });
        
        renderPayments();
    } catch (error) {
        console.error("Error loading payments:", error);
    }
}

function renderPayments() {
    const statusBody = document.getElementById("paymentStatusTableBody");
    const historyBody = document.getElementById("paymentHistoryTableBody");
    const pendingPayments = paymentsList.filter(p => p.status !== "paid");
    
    document.getElementById("pendingPaymentsCount").textContent = pendingPayments.length;
    
    if (paymentsList.length === 0) {
        statusBody.innerHTML = '<tr><td colspan="5" class="empty-state">No payment records yet.</td></tr>';
        historyBody.innerHTML = '<tr><td colspan="5" class="empty-state">No transaction history yet.</td></tr>';
        return;
    }
    
    statusBody.innerHTML = paymentsList.map(payment => `
        <tr>
            <td>${escapeHtml(payment.bookingId || "-")}</td>
            <td>${escapeHtml(payment.customerName || "Customer")}</td>
            <td>${formatCurrency(payment.amount)}</td>
            <td><span class="status-badge-small ${payment.status === 'paid' ? 'status-approved' : 'status-pending'}">${payment.status || "pending"}</span></td>
            <td>${escapeHtml(payment.method || "-")}</td>
        </tr>
    `).join("");
    
    historyBody.innerHTML = paymentsList.map(payment => `
        <tr>
            <td>${formatDate(payment.createdAt)}</td>
            <td>${escapeHtml(payment.transactionId || payment.id)}</td>
            <td>${escapeHtml(payment.customerName || "Customer")}</td>
            <td>${formatCurrency(payment.amount)}</td>
            <td><span class="status-badge-small ${payment.status === 'paid' ? 'status-approved' : 'status-pending'}">${payment.status || "pending"}</span></td>
        </tr>
    `).join("");
}

async function loadMessages() {
    try {
        const messagesRef = collection(db, "messages");
        const q = query(messagesRef, where("vendorId", "==", currentUser.uid));
        const snapshot = await getDocs(q);
        
        messagesList = [];
        snapshot.forEach(doc => {
            messagesList.push({ id: doc.id, ...doc.data() });
        });
        
        renderMessages();
    } catch (error) {
        console.error("Error loading messages:", error);
    }
}

function renderMessages() {
    const messagesDiv = document.getElementById("messagesList");
    const unreadCount = messagesList.filter(m => !m.isRead).length;
    
    document.getElementById("messagesCount").textContent = unreadCount;
    document.getElementById("messageBadge").textContent = unreadCount;
    
    if (messagesList.length === 0) {
        messagesDiv.innerHTML = '<p class="empty-state">No messages yet.</p>';
        return;
    }
    
    messagesDiv.innerHTML = messagesList.map(msg => `
        <div class="message-item">
            <div class="message-header">
                <span class="message-sender">${escapeHtml(msg.senderName || "Customer")}</span>
                <span class="message-date">${formatDate(msg.createdAt)}</span>
            </div>
            <p class="message-subject">${escapeHtml(msg.subject || "Inquiry")}</p>
            <p class="message-preview">${escapeHtml((msg.message || "").substring(0, 100))}${(msg.message || "").length > 100 ? "..." : ""}</p>
        </div>
    `).join("");
}

function updateDashboardStats() {
    document.getElementById("servicesCount").textContent = servicesList.length;
    document.getElementById("bookingsCount").textContent = bookingsList.filter(b => b.status === "pending").length;
    
    const avgRating = reviewsList.length === 0 ? 0 : reviewsList.reduce((s, r) => s + (r.rating || 0), 0) / reviewsList.length;
    document.getElementById("averageRating").textContent = avgRating.toFixed(1);
    
    document.getElementById("pendingPaymentsCount").textContent = paymentsList.filter(p => p.status !== "paid").length;
    document.getElementById("messagesCount").textContent = messagesList.filter(m => !m.isRead).length;
}

function renderRecentBookings() {
    const container = document.getElementById("recentBookings");
    const recent = bookingsList.filter(b => b.status === "pending").slice(0, 4);
    
    if (recent.length === 0) {
        container.innerHTML = '<p class="empty-state">No recent booking requests yet.</p>';
        return;
    }
    
    container.innerHTML = recent.map(booking => `
        <div class="recent-item">
            <div class="info">
                <p class="name">${escapeHtml(booking.customerName || "Customer")}</p>
                <p class="detail">${escapeHtml(booking.serviceTitle || "Service")} • ${formatDate(booking.eventDate)}</p>
            </div>
            <span class="status status-pending">pending</span>
        </div>
    `).join("");
}

function renderRecentReviews() {
    const container = document.getElementById("recentReviews");
    const recent = reviewsList.slice(0, 4);
    
    if (recent.length === 0) {
        container.innerHTML = '<p class="empty-state">No reviews available yet.</p>';
        return;
    }
    
    container.innerHTML = recent.map(review => `
        <div class="recent-item">
            <div class="info">
                <p class="name">${escapeHtml(review.customerName || "Customer")}</p>
                <p class="detail">${escapeHtml((review.comment || "").substring(0, 60))}...</p>
            </div>
            <span class="status status-approved">${review.rating}★</span>
        </div>
    `).join("");
}

function renderBookingChart() {
    const canvas = document.getElementById("bookingChart");
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    const pending = bookingsList.filter(b => b.status === "pending").length;
    const approved = bookingsList.filter(b => b.status === "approved").length;
    const rejected = bookingsList.filter(b => b.status === "rejected").length;
    
    if (bookingChartInstance) bookingChartInstance.destroy();
    
    bookingChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Pending", "Approved", "Rejected"],
            datasets: [{
                label: "Bookings",
                data: [pending, approved, rejected],
                backgroundColor: ["#ffc107", "#51cf66", "#ff6b6b"],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { labels: { color: "#ffffff" } }
            },
            scales: {
                x: { ticks: { color: "#ffffff" }, grid: { color: "rgba(255,255,255,0.1)" } },
                y: { ticks: { color: "#ffffff", precision: 0 }, grid: { color: "rgba(255,255,255,0.1)" } }
            }
        }
    });
}

/* =========================================================
   FORM HANDLERS
========================================================= */
async function saveProfile(e) {
    e.preventDefault();
    
    const updatedData = {
        companyName: document.getElementById("companyName").value.trim(),
        contactPerson: document.getElementById("contactPerson").value.trim(),
        email: document.getElementById("email").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        address: document.getElementById("address").value.trim(),
        district: document.getElementById("district").value,
        category: document.getElementById("category").value,
        website: document.getElementById("website").value.trim(),
        description: document.getElementById("description").value.trim(),
        isActive: document.getElementById("businessActive").checked,
        updatedAt: new Date().toISOString()
    };
    
    try {
        await setDoc(doc(db, "company_vendors", currentUser.uid), updatedData, { merge: true });
        currentVendorData = { ...currentVendorData, ...updatedData };
        updateUIWithVendorData();
        showToast("Profile saved successfully!");
    } catch (error) {
        console.error("Error saving profile:", error);
        showToast("Error saving profile", true);
    }
}

async function saveService(e) {
    e.preventDefault();
    
    const serviceId = document.getElementById("serviceId").value;
    const serviceData = {
        vendorId: currentUser.uid,
        title: document.getElementById("serviceTitle").value.trim(),
        category: document.getElementById("serviceCategory").value,
        price: Number(document.getElementById("servicePrice").value),
        status: document.getElementById("serviceStatus").value,
        description: document.getElementById("serviceDescription").value.trim(),
        updatedAt: new Date().toISOString()
    };
    
    try {
        if (serviceId) {
            await updateDoc(doc(db, "services", serviceId), serviceData);
            showToast("Service updated successfully!");
        } else {
            await addDoc(collection(db, "services"), {
                ...serviceData,
                createdAt: new Date().toISOString()
            });
            showToast("Service added successfully!");
        }
        
        clearServiceForm();
        await loadServices();
        updateDashboardStats();
    } catch (error) {
        console.error("Error saving service:", error);
        showToast("Error saving service", true);
    }
}

function clearServiceForm() {
    document.getElementById("serviceId").value = "";
    document.getElementById("serviceTitle").value = "";
    document.getElementById("serviceCategory").value = "";
    document.getElementById("servicePrice").value = "";
    document.getElementById("serviceStatus").value = "active";
    document.getElementById("serviceDescription").value = "";
}

function editService(serviceId) {
    const service = servicesList.find(s => s.id === serviceId);
    if (!service) return;
    
    document.getElementById("serviceId").value = service.id;
    document.getElementById("serviceTitle").value = service.title || "";
    document.getElementById("serviceCategory").value = service.category || "";
    document.getElementById("servicePrice").value = service.price || "";
    document.getElementById("serviceStatus").value = service.status || "active";
    document.getElementById("serviceDescription").value = service.description || "";
    
    document.getElementById("serviceForm").scrollIntoView({ behavior: "smooth" });
}

async function deleteService(serviceId) {
    if (!confirm("Are you sure you want to delete this service?")) return;
    
    try {
        await deleteDoc(doc(db, "services", serviceId));
        showToast("Service deleted successfully!");
        await loadServices();
        updateDashboardStats();
    } catch (error) {
        console.error("Error deleting service:", error);
        showToast("Error deleting service", true);
    }
}

async function updateBookingStatus(bookingId, status) {
    try {
        await updateDoc(doc(db, "bookings", bookingId), {
            status: status,
            updatedAt: new Date().toISOString()
        });
        showToast(`Booking ${status}!`);
        await loadBookings();
        updateDashboardStats();
        renderRecentBookings();
        renderBookingChart();
    } catch (error) {
        console.error("Error updating booking:", error);
        showToast("Error updating booking", true);
    }
}

async function toggleBusinessStatus() {
    const newStatus = !document.getElementById("businessActive").checked;
    document.getElementById("businessActive").checked = newStatus;
    
    try {
        await updateDoc(doc(db, "company_vendors", currentUser.uid), {
            isActive: newStatus,
            updatedAt: new Date().toISOString()
        });
        currentVendorData.isActive = newStatus;
        updateUIWithVendorData();
        showToast(newStatus ? "Business enabled" : "Business disabled");
    } catch (error) {
        console.error("Error toggling status:", error);
        showToast("Error updating status", true);
    }
}

async function changePassword() {
    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmNewPassword").value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        showToast("Please fill all password fields", true);
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast("New passwords do not match", true);
        return;
    }
    
    if (newPassword.length < 6) {
        showToast("Password must be at least 6 characters", true);
        return;
    }
    
    try {
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPassword);
        showToast("Password changed successfully!");
        
        document.getElementById("currentPassword").value = "";
        document.getElementById("newPassword").value = "";
        document.getElementById("confirmNewPassword").value = "";
    } catch (error) {
        console.error("Error changing password:", error);
        if (error.code === "auth/wrong-password") {
            showToast("Current password is incorrect", true);
        } else {
            showToast("Error changing password", true);
        }
    }
}

async function saveSettings() {
    const settings = {
        emailNotifications: document.getElementById("emailNotifications").checked,
        messageNotifications: document.getElementById("messageNotifications").checked,
        paymentNotifications: document.getElementById("paymentNotifications").checked,
        reviewNotifications: document.getElementById("reviewNotifications").checked,
        updatedAt: new Date().toISOString()
    };
    
    try {
        await setDoc(doc(db, "vendor_settings", currentUser.uid), settings, { merge: true });
        showToast("Settings saved successfully!");
    } catch (error) {
        console.error("Error saving settings:", error);
        showToast("Error saving settings", true);
    }
}

async function handleProfilePictureChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file.', true);
        return;
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB
        showToast('File size must be less than 5MB.', true);
        return;
    }

    try {
        const storage = getStorage();
        const storageRef = ref(storage, `profile_pictures/${currentUser.uid}/${file.name}`);
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);

        // Update Firestore
        await updateDoc(doc(db, "company_vendors", currentUser.uid), {
            profilePicture: downloadURL,
            updatedAt: serverTimestamp()
        });

        // Update UI
        document.getElementById("profilePreview").src = downloadURL;
        document.getElementById("profilePreview").style.display = "block";
        document.getElementById("profilePlaceholder").style.display = "none";
        document.getElementById("removeProfilePicture").style.display = "block";
        showToast('Profile picture updated successfully!');
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        showToast('Failed to update profile picture.', true);
    }
}

async function removeProfilePicture(event) {
    event.stopPropagation(); // Prevent triggering the upload

    try {
        // Update Firestore to remove the profilePicture field
        await updateDoc(doc(db, "company_vendors", currentUser.uid), {
            profilePicture: deleteField(),
            updatedAt: serverTimestamp()
        });

        // Update UI to default
        document.getElementById("profilePreview").style.display = "none";
        document.getElementById("profilePlaceholder").style.display = "flex";
        document.getElementById("removeProfilePicture").style.display = "none";
        showToast('Profile picture removed successfully!');
    } catch (error) {
        console.error('Error removing profile picture:', error);
        showToast('Failed to remove profile picture.', true);
    }
}

async function logout() {
    try {
        await signOut(auth);
        window.location.href = "../../login.html";
    } catch (error) {
        console.error("Logout error:", error);
        showToast("Error logging out", true);
    }
}

/* =========================================================
   SECTION NAVIGATION
========================================================= */
function setupSectionNavigation() {
    const navItems = document.querySelectorAll(".nav-item[data-section]");
    const quickActions = document.querySelectorAll(".action-btn[data-section], .view-all[data-section]");
    
    navItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            switchSection(item.dataset.section);
        });
    });
    
    quickActions.forEach(btn => {
        btn.addEventListener("click", () => {
            switchSection(btn.dataset.section);
        });
    });
}

function switchSection(sectionName) {
    document.querySelectorAll(".content-section").forEach(section => {
        section.classList.remove("active");
    });
    
    document.querySelectorAll(".nav-item[data-section]").forEach(item => {
        item.classList.remove("active");
    });
    
    const targetSection = document.getElementById(`${sectionName}Section`);
    const targetNav = document.querySelector(`.nav-item[data-section="${sectionName}"]`);
    
    if (targetSection) targetSection.classList.add("active");
    if (targetNav) targetNav.classList.add("active");
    
    const config = sectionTitles[sectionName];
    if (config) {
        document.getElementById("pageTitle").textContent = config.title;
        document.getElementById("pageSubtitle").textContent = config.subtitle;
    }
    
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function setupTabs() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    
    tabButtons.forEach(button => {
        button.addEventListener("click", () => {
            const parent = button.closest(".content-section");
            if (!parent) return;
            
            parent.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
            parent.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));
            
            button.classList.add("active");
            const panel = document.getElementById(button.dataset.tab);
            if (panel) panel.classList.add("active");
        });
    });
}

function setupEventListeners() {
    document.getElementById("profileForm")?.addEventListener("submit", saveProfile);
    document.getElementById("serviceForm")?.addEventListener("submit", saveService);
    document.getElementById("resetProfileBtn")?.addEventListener("click", () => updateUIWithVendorData());
    document.getElementById("availabilityToggle")?.addEventListener("click", toggleBusinessStatus);
    document.getElementById("changePasswordBtn")?.addEventListener("click", changePassword);
    document.getElementById("saveSettingsBtn")?.addEventListener("click", saveSettings);
    document.getElementById("logoutBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        logout();
    });
    document.getElementById("addServiceBtn")?.addEventListener("click", () => clearServiceForm());
    document.getElementById("addImageBtn")?.addEventListener("click", () => showToast("Image upload coming soon!"));
    document.getElementById("testConnectionBtn")?.addEventListener("click", () => showToast("Website integration coming soon!"));
    
    // Profile picture
    document.querySelector(".profile-picture-container")?.addEventListener("click", () => {
        document.getElementById("profilePictureInput").click();
    });
    document.getElementById("profilePictureInput")?.addEventListener("change", handleProfilePictureChange);
    document.getElementById("removeProfilePicture")?.addEventListener("click", removeProfilePicture);
    
    // Clear service button
    const clearServiceBtn = document.getElementById("clearServiceBtn");
    if (clearServiceBtn) {
        clearServiceBtn.addEventListener("click", clearServiceForm);
    }
}

// Expose functions globally for inline handlers
window.editService = editService;
window.deleteService = deleteService;
window.updateBookingStatus = updateBookingStatus;