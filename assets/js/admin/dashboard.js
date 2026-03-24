import { auth, db } from "../firebase/firebase-config.js";
import {
    doc,
    getDoc,
    getDocs,
    updateDoc,
    collection,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    deleteField
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import {
    onAuthStateChanged,
    signOut,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

/* =========================================================
   GLOBAL STATE
========================================================= */
let currentAdmin = null;
let activityChartInstance = null;

// Data stores
let companyVendorsList = [];
let individualVendorsList = [];
let customersList = [];
let reviewsList = [];
let messagesList = [];

/* =========================================================
   ELEMENTS
========================================================= */
const sectionTitles = {
    dashboard: { title: "Dashboard", subtitle: "Welcome back, Admin. Here's your platform overview." },
    approvals: { title: "Vendor Approvals", subtitle: "Review and approve pending vendor registrations." },
    companyVendors: { title: "Company Vendors", subtitle: "Manage all company vendor accounts." },
    individualVendors: { title: "Individual Vendors", subtitle: "Manage all individual vendor accounts." },
    customers: { title: "Customers", subtitle: "Manage customer accounts." },
    reviews: { title: "Reviews & Reports", subtitle: "Monitor customer feedback and vendor ratings." },
    messages: { title: "Messages & Contact Requests", subtitle: "View inquiries from vendors and customers." }
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
    setTimeout(() => toast.remove(), 3000);
}

function formatCurrency(amount) {
    return `LKR ${Number(amount || 0).toLocaleString()}`;
}

function formatDate(timestamp) {
    if (!timestamp) return "-";
    if (timestamp.toDate) return timestamp.toDate().toLocaleDateString();
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

/* =========================================================
   AUTH & INIT
========================================================= */
onAuthStateChanged(auth, async (user) => {
    // Check for admin session first
    const adminSession = localStorage.getItem("adminSession");
    if (adminSession) {
        try {
            const admin = JSON.parse(adminSession);
            if (admin.email === "admin@gmail.com") {
                currentAdmin = { email: admin.email };
                document.querySelector("#adminName span").textContent = "Administrator";
                await loadAllData();
                setupEventListeners();
                setupSectionNavigation();
                setupTabs();
                setupFilters();
                return;
            }
        } catch (e) {
            console.error("Invalid admin session", e);
            localStorage.removeItem("adminSession");
        }
    }
    
    if (!user) {
        window.location.href = "../login.html";
        return;
    }
    
    // Verify admin role (hardcoded admin email)
    if (user.email !== "admin@gmail.com") {
        showToast("Unauthorized access. Redirecting to login...", true);
        setTimeout(() => {
            signOut(auth);
            window.location.href = "../login.html";
        }, 2000);
        return;
    }
    
    currentAdmin = user;
    document.querySelector("#adminName span").textContent = "Administrator";
    
    await loadAllData();
    setupEventListeners();
    setupSectionNavigation();
    setupTabs();
    setupFilters();
});

async function loadAllData() {
    await Promise.all([
        loadCompanyVendors(),
        loadIndividualVendors(),
        loadCustomers(),
        loadReviews(),
        loadMessages()
    ]);
    updateDashboardStats();
    renderRecentApprovals();
    renderRecentReviews();
    renderActivityChart();
}

/* =========================================================
   LOAD DATA FUNCTIONS
========================================================= */
async function loadCompanyVendors() {
    try {
        const vendorsRef = collection(db, "company_vendors");
        const snapshot = await getDocs(vendorsRef);
        companyVendorsList = [];
        snapshot.forEach(doc => {
            companyVendorsList.push({ id: doc.id, ...doc.data() });
        });
        renderCompanyVendors();
        renderPendingCompanyVendors();
    } catch (error) {
        console.error("Error loading company vendors:", error);
    }
}

async function loadIndividualVendors() {
    try {
        const vendorsRef = collection(db, "individual_vendors");
        const snapshot = await getDocs(vendorsRef);
        individualVendorsList = [];
        snapshot.forEach(doc => {
            individualVendorsList.push({ id: doc.id, ...doc.data() });
        });
        renderIndividualVendors();
        renderPendingIndividualVendors();
    } catch (error) {
        console.error("Error loading individual vendors:", error);
    }
}

async function loadCustomers() {
    try {
        const usersRef = collection(db, "users");
        const snapshot = await getDocs(usersRef);
        customersList = [];
        snapshot.forEach(doc => {
            customersList.push({ id: doc.id, ...doc.data() });
        });
        renderCustomers();
    } catch (error) {
        console.error("Error loading customers:", error);
    }
}



async function loadReviews() {
    try {
        const reviewsRef = collection(db, "reviews");
        const snapshot = await getDocs(reviewsRef);
        reviewsList = [];
        snapshot.forEach(doc => {
            reviewsList.push({ id: doc.id, ...doc.data() });
        });
        renderReviews();
    } catch (error) {
        console.error("Error loading reviews:", error);
    }
}

async function loadMessages() {
    try {
        const messagesRef = collection(db, "messages");
        const snapshot = await getDocs(messagesRef);
        messagesList = [];
        snapshot.forEach(doc => {
            messagesList.push({ id: doc.id, ...doc.data() });
        });
        renderMessages();
    } catch (error) {
        console.error("Error loading messages:", error);
    }
}

/* =========================================================
   RENDER FUNCTIONS
========================================================= */
function renderCompanyVendors() {
    const tbody = document.getElementById("companyVendorsTableBody");
    const searchTerm = document.getElementById("searchCompany")?.value.toLowerCase() || "";
    
    const filtered = companyVendorsList.filter(v => 
        v.companyName?.toLowerCase().includes(searchTerm) ||
        v.email?.toLowerCase().includes(searchTerm) ||
        v.contactPerson?.toLowerCase().includes(searchTerm)
    );
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No company vendors found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(vendor => `
        <tr>
            <td>${escapeHtml(vendor.companyName || "-")}</td>
            <td>${escapeHtml(vendor.contactPerson || "-")}</td>
            <td>${escapeHtml(vendor.email || "-")}</td>
            <td>${escapeHtml(vendor.phone || "-")}</td>
            <td>${escapeHtml(vendor.category || "-")}</td>
            <td>${escapeHtml(vendor.district || "-")}</td>
            <td><span class="status-badge-small ${vendor.status === 'approved' ? 'status-approved' : vendor.status === 'rejected' ? 'status-rejected' : 'status-pending'}">${vendor.status || "pending"}</span></td>
            <td><span class="status-badge-small ${vendor.isActive !== false ? 'status-approved' : 'status-rejected'}">${vendor.isActive !== false ? "Active" : "Disabled"}</span></td>
            <td class="action-icons">
                <i class="fas fa-eye" onclick="viewVendorDetails('company', '${vendor.id}')" title="View Details"></i>
                <i class="fas fa-toggle-${vendor.isActive !== false ? 'off' : 'on'}" onclick="toggleVendorStatus('company', '${vendor.id}', ${vendor.isActive !== false})" title="${vendor.isActive !== false ? 'Disable' : 'Enable'}"></i>
            </td>
        </tr>
    `).join("");
}

function renderIndividualVendors() {
    const tbody = document.getElementById("individualVendorsTableBody");
    const searchTerm = document.getElementById("searchIndividual")?.value.toLowerCase() || "";
    
    const filtered = individualVendorsList.filter(v => 
        v.fullName?.toLowerCase().includes(searchTerm) ||
        v.serviceName?.toLowerCase().includes(searchTerm) ||
        v.email?.toLowerCase().includes(searchTerm)
    );
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No individual vendors found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(vendor => `
        <tr>
            <td>${escapeHtml(vendor.fullName || "-")}</td>
            <td>${escapeHtml(vendor.serviceName || "-")}</td>
            <td>${escapeHtml(vendor.email || "-")}</td>
            <td>${escapeHtml(vendor.phone || "-")}</td>
            <td>${escapeHtml(vendor.category || "-")}</td>
            <td>${escapeHtml(vendor.district || "-")}</td>
            <td><span class="status-badge-small ${vendor.status === 'approved' ? 'status-approved' : vendor.status === 'rejected' ? 'status-rejected' : 'status-pending'}">${vendor.status || "pending"}</span></td>
            <td><span class="status-badge-small ${vendor.isActive !== false ? 'status-approved' : 'status-rejected'}">${vendor.isActive !== false ? "Active" : "Disabled"}</span></td>
            <td class="action-icons">
                <i class="fas fa-eye" onclick="viewVendorDetails('individual', '${vendor.id}')" title="View Details"></i>
                <i class="fas fa-toggle-${vendor.isActive !== false ? 'off' : 'on'}" onclick="toggleVendorStatus('individual', '${vendor.id}', ${vendor.isActive !== false})" title="${vendor.isActive !== false ? 'Disable' : 'Enable'}"></i>
            </td>
        </tr>
    `).join("");
}

function renderCustomers() {
    const tbody = document.getElementById("customersTableBody");
    const searchTerm = document.getElementById("searchCustomer")?.value.toLowerCase() || "";
    
    const filtered = customersList.filter(c => 
        c.fullName?.toLowerCase().includes(searchTerm) ||
        c.email?.toLowerCase().includes(searchTerm) ||
        c.phone?.toLowerCase().includes(searchTerm)
    );
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No customers found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(customer => `
        <tr>
            <td>${escapeHtml(customer.fullName || "-")}</td>
            <td>${escapeHtml(customer.email || "-")}</td>
            <td>${escapeHtml(customer.phone || "-")}</td>
            <td>${escapeHtml(customer.address || "-")}</td>
            <td>${formatDate(customer.createdAt)}</td>
            <td><span class="status-badge-small ${customer.isActive !== false ? 'status-approved' : 'status-rejected'}">${customer.isActive !== false ? "Active" : "Disabled"}</span></td>
            <td class="action-icons">
                <i class="fas fa-eye" onclick="viewCustomerDetails('${customer.id}')" title="View Details"></i>
                <i class="fas fa-toggle-${customer.isActive !== false ? 'off' : 'on'}" onclick="toggleCustomerStatus('${customer.id}', ${customer.isActive !== false})" title="${customer.isActive !== false ? 'Disable' : 'Enable'}"></i>
            </td>
        </tr>
    `).join("");
}

function renderPendingCompanyVendors() {
    const tbody = document.getElementById("pendingCompanyTableBody");
    const pending = companyVendorsList.filter(v => v.status === "pending");
    
    if (pending.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No pending company vendors</td></tr>';
        return;
    }
    
    tbody.innerHTML = pending.map(vendor => `
        <tr>
            <td>${escapeHtml(vendor.companyName || "-")}</td>
            <td>${escapeHtml(vendor.contactPerson || "-")}</td>
            <td>${escapeHtml(vendor.email || "-")}</td>
            <td>${escapeHtml(vendor.phone || "-")}</td>
            <td>${escapeHtml(vendor.category || "-")}</td>
            <td>${escapeHtml(vendor.district || "-")}</td>
            <td>${formatDate(vendor.createdAt)}</td>
            <td class="action-icons">
                <i class="fas fa-check-circle" onclick="approveVendor('company', '${vendor.id}')" style="color: #51cf66;" title="Approve"></i>
                <i class="fas fa-times-circle" onclick="rejectVendor('company', '${vendor.id}')" style="color: #ff6b6b;" title="Reject"></i>
                <i class="fas fa-eye" onclick="viewVendorDetails('company', '${vendor.id}')" title="View Details"></i>
            </td>
        </tr>
    `).join("");
}

function renderPendingIndividualVendors() {
    const tbody = document.getElementById("pendingIndividualTableBody");
    const pending = individualVendorsList.filter(v => v.status === "pending");
    
    if (pending.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No pending individual vendors</td></tr>';
        return;
    }
    
    tbody.innerHTML = pending.map(vendor => `
        <tr>
            <td>${escapeHtml(vendor.fullName || "-")}</td>
            <td>${escapeHtml(vendor.serviceName || "-")}</td>
            <td>${escapeHtml(vendor.email || "-")}</td>
            <td>${escapeHtml(vendor.phone || "-")}</td>
            <td>${escapeHtml(vendor.category || "-")}</td>
            <td>${escapeHtml(vendor.district || "-")}</td>
            <td>${formatDate(vendor.createdAt)}</td>
            <td class="action-icons">
                <i class="fas fa-check-circle" onclick="approveVendor('individual', '${vendor.id}')" style="color: #51cf66;" title="Approve"></i>
                <i class="fas fa-times-circle" onclick="rejectVendor('individual', '${vendor.id}')" style="color: #ff6b6b;" title="Reject"></i>
                <i class="fas fa-eye" onclick="viewVendorDetails('individual', '${vendor.id}')" title="View Details"></i>
            </td>
        </tr>
    `).join("");
}



function renderReviews() {
    const reviewsListDiv = document.getElementById("reviewsList");
    const total = reviewsList.length;
    const average = total === 0 ? 0 : reviewsList.reduce((sum, r) => sum + (r.rating || 0), 0) / total;
    const fiveStar = reviewsList.filter(r => r.rating === 5).length;
    
    document.getElementById("avgPlatformRating").textContent = average.toFixed(1);
    document.getElementById("totalReviewsCount").textContent = total;
    document.getElementById("fiveStarTotal").textContent = fiveStar;
    
    if (total === 0) {
        reviewsListDiv.innerHTML = '<p class="empty-state">No reviews yet.</p>';
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
            <p class="review-text" style="font-size: 12px; margin-top: 5px;"><strong>Vendor:</strong> ${escapeHtml(review.vendorName || "Unknown")}</p>
        </div>
    `).join("");
}

function renderMessages() {
    const messagesDiv = document.getElementById("adminMessagesList");
    if (messagesList.length === 0) {
        messagesDiv.innerHTML = '<p class="empty-state">No messages yet.</p>';
        return;
    }
    
    messagesDiv.innerHTML = messagesList.map(msg => `
        <div class="message-item">
            <div class="message-header">
                <span class="message-sender">${escapeHtml(msg.senderName || "Unknown")} (${escapeHtml(msg.senderType || "User")})</span>
                <span class="message-date">${formatDate(msg.createdAt)}</span>
            </div>
            <p class="message-subject">${escapeHtml(msg.subject || "Inquiry")}</p>
            <p class="message-preview">${escapeHtml((msg.message || "").substring(0, 150))}${(msg.message || "").length > 150 ? "..." : ""}</p>
            <p><strong>Email:</strong> ${escapeHtml(msg.email || "-")}</p>
        </div>
    `).join("");
}

/* =========================================================
   DASHBOARD FUNCTIONS
========================================================= */
function updateDashboardStats() {
    const pendingCompany = companyVendorsList.filter(v => v.status === "pending").length;
    const pendingIndividual = individualVendorsList.filter(v => v.status === "pending").length;
    const totalPending = pendingCompany + pendingIndividual;
    
    document.getElementById("totalCustomers").textContent = customersList.length;
    document.getElementById("totalCompanyVendors").textContent = companyVendorsList.length;
    document.getElementById("totalIndividualVendors").textContent = individualVendorsList.length;
    document.getElementById("pendingApprovals").textContent = totalPending;
    document.getElementById("pendingApprovalsBadge").textContent = totalPending;
    document.getElementById("totalReviews").textContent = reviewsList.length;
    document.getElementById("unreadMessages").textContent = messagesList.filter(m => !m.isRead).length;
}

function renderRecentApprovals() {
    const container = document.getElementById("recentApprovals");
    const pending = [
        ...companyVendorsList.filter(v => v.status === "pending").map(v => ({ ...v, type: "company" })),
        ...individualVendorsList.filter(v => v.status === "pending").map(v => ({ ...v, type: "individual" }))
    ].slice(0, 5);
    
    if (pending.length === 0) {
        container.innerHTML = '<p class="empty-state">No pending approvals</p>';
        return;
    }
    
    container.innerHTML = pending.map(vendor => `
        <div class="recent-item">
            <div class="info">
                <p class="name">${escapeHtml(vendor.companyName || vendor.fullName || vendor.serviceName)}</p>
                <p class="detail">${escapeHtml(vendor.type === "company" ? "Company Vendor" : "Individual Vendor")} • ${escapeHtml(vendor.email)}</p>
            </div>
            <button class="btn-icon" onclick="switchToApprovalsAndSelect('${vendor.type}', '${vendor.id}')" style="background: rgba(255,215,0,0.2); padding: 5px 10px; border-radius: 20px; cursor: pointer;">Review</button>
        </div>
    `).join("");
}



function renderRecentReviews() {
    const container = document.getElementById("recentReviews");
    const recent = reviewsList.slice(0, 5);
    
    if (recent.length === 0) {
        container.innerHTML = '<p class="empty-state">No recent reviews</p>';
        return;
    }
    
    container.innerHTML = recent.map(review => `
        <div class="recent-item">
            <div class="info">
                <p class="name">${escapeHtml(review.customerName || "Customer")}</p>
                <p class="detail">"${escapeHtml((review.comment || "").substring(0, 60))}..."</p>
            </div>
            <span class="status status-approved">${review.rating}★</span>
        </div>
    `).join("");
}

function renderActivityChart() {
    const canvas = document.getElementById("activityChart");
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    const labels = [];
    const data = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toLocaleDateString();
        labels.push(dateStr.slice(0, 5));
        data.push(0);
    }
    
    const last7Days = { labels, data };
    
    if (activityChartInstance) activityChartInstance.destroy();
    
    activityChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: last7Days.labels,
            datasets: [{
                label: "Activity",
                data: last7Days.data,
                borderColor: "#FFD700",
                backgroundColor: "rgba(255, 215, 0, 0.1)",
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { labels: { color: "#ffffff" } } },
            scales: {
                x: { ticks: { color: "#ffffff" }, grid: { color: "rgba(255,255,255,0.1)" } },
                y: { ticks: { color: "#ffffff", precision: 0 }, grid: { color: "rgba(255,255,255,0.1)" } }
            }
        }
    });
}



/* =========================================================
   ADMIN ACTIONS
========================================================= */
window.approveVendor = async function(type, vendorId) {
    if (!confirm("Approve this vendor?")) return;
    try {
        const collectionName = type === "company" ? "company_vendors" : "individual_vendors";
        await updateDoc(doc(db, collectionName, vendorId), {
            status: "approved",
            reviewedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        showToast("Vendor approved successfully!");
        await loadAllData();
    } catch (error) {
        console.error("Error approving vendor:", error);
        showToast("Error approving vendor", true);
    }
};

window.rejectVendor = async function(type, vendorId) {
    const reason = prompt("Enter rejection reason (optional):");
    if (!confirm("Reject this vendor?")) return;
    try {
        const collectionName = type === "company" ? "company_vendors" : "individual_vendors";
        await updateDoc(doc(db, collectionName, vendorId), {
            status: "rejected",
            rejectionReason: reason || "",
            reviewedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        showToast("Vendor rejected");
        await loadAllData();
    } catch (error) {
        console.error("Error rejecting vendor:", error);
        showToast("Error rejecting vendor", true);
    }
};

window.toggleVendorStatus = async function(type, vendorId, currentStatus) {
    const newStatus = !currentStatus;
    if (!confirm(`${newStatus ? "Enable" : "Disable"} this vendor?`)) return;
    try {
        const collectionName = type === "company" ? "company_vendors" : "individual_vendors";
        await updateDoc(doc(db, collectionName, vendorId), {
            isActive: newStatus,
            updatedAt: new Date().toISOString()
        });
        showToast(`Vendor ${newStatus ? "enabled" : "disabled"}`);
        await loadAllData();
    } catch (error) {
        console.error("Error toggling vendor status:", error);
        showToast("Error updating vendor status", true);
    }
};

window.toggleCustomerStatus = async function(customerId, currentStatus) {
    const newStatus = !currentStatus;
    if (!confirm(`${newStatus ? "Enable" : "Disable"} this customer?`)) return;
    try {
        await updateDoc(doc(db, "users", customerId), {
            isActive: newStatus,
            updatedAt: new Date().toISOString()
        });
        showToast(`Customer ${newStatus ? "enabled" : "disabled"}`);
        await loadAllData();
    } catch (error) {
        console.error("Error toggling customer status:", error);
        showToast("Error updating customer status", true);
    }
};

window.viewVendorDetails = function(type, vendorId) {
    const vendor = type === "company" 
        ? companyVendorsList.find(v => v.id === vendorId)
        : individualVendorsList.find(v => v.id === vendorId);
    if (vendor) {
        showDetailsModal(vendor, type === "company" ? "Company Vendor" : "Individual Vendor");
    }
};

window.viewCustomerDetails = function(customerId) {
    const customer = customersList.find(c => c.id === customerId);
    if (customer) {
        showDetailsModal(customer, "Customer");
    }
};



function showDetailsModal(data, title) {
    // Remove existing modal if any
    const existing = document.getElementById("detailsModal");
    if (existing) existing.remove();
    
    const modal = document.createElement("div");
    modal.id = "detailsModal";
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(5px);
    `;
    
    let content = `
        <div style="
            background: var(--glass-bg);
            border: 1px solid var(--glass-border);
            border-radius: 20px;
            padding: 30px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            color: var(--white);
            box-shadow: var(--shadow);
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px;">
                <h2 style="font-size: 22px; font-weight: 700; margin: 0;">${escapeHtml(title)}</h2>
                <button onclick="document.getElementById('detailsModal').remove()" style="
                    background: rgba(255,255,255,0.1);
                    border: none;
                    color: white;
                    font-size: 24px;
                    cursor: pointer;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">×</button>
            </div>
            <div style="display: grid; gap: 15px;">
    `;
    
    for (const [key, val] of Object.entries(data)) {
        if (key === "id" || key.toLowerCase().includes("id") || key.toLowerCase() === "uid") continue; // Skip ID and ID-related fields
        const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        const displayVal = val === null || val === undefined ? "—" : escapeHtml(String(val));
        content += `
            <div style="
                background: rgba(255,255,255,0.08);
                padding: 12px 15px;
                border-radius: 10px;
                border-left: 3px solid var(--gold);
            ">
                <div style="font-size: 12px; color: var(--white-dim); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">${escapeHtml(displayKey)}</div>
                <div style="font-size: 14px; color: var(--white-soft); word-break: break-word;">${displayVal}</div>
            </div>
        `;
    }
    
    content += `
            </div>
        </div>
    `;
    
    modal.innerHTML = content;
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    document.body.appendChild(modal);
}

window.switchToApprovalsAndSelect = function(type, vendorId) {
    switchSection("approvals");
    setTimeout(() => {
        const tabBtn = document.querySelector(`.tab-btn[data-tab="pending${type === "company" ? "Company" : "Individual"}Tab"]`);
        if (tabBtn) tabBtn.click();
    }, 100);
};


async function logout() {
    try {
        localStorage.removeItem("adminSession");
        sessionStorage.clear();
        await signOut(auth);
    } catch (error) {
        console.error("Logout error:", error);
    } finally {
        window.location.href = "../login.html";
    }
}

/* =========================================================
   NAVIGATION & SETUP
========================================================= */
function setupSectionNavigation() {
    const navItems = document.querySelectorAll(".nav-item[data-section]");
    const quickActions = document.querySelectorAll(".action-btn[data-section], .view-all[data-section]");
    navItems.forEach(item => item.addEventListener("click", (e) => { e.preventDefault(); switchSection(item.dataset.section); }));
    quickActions.forEach(btn => btn.addEventListener("click", () => switchSection(btn.dataset.section)));
}

function switchSection(sectionName) {
    document.querySelectorAll(".content-section").forEach(section => section.classList.remove("active"));
    document.querySelectorAll(".nav-item[data-section]").forEach(item => item.classList.remove("active"));
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
    tabButtons.forEach(button => button.addEventListener("click", () => {
        const parent = button.closest(".content-section");
        if (!parent) return;
        parent.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
        parent.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));
        button.classList.add("active");
        const panel = document.getElementById(button.dataset.tab);
        if (panel) panel.classList.add("active");
    }));
}

function setupFilters() {
    const searchCompany = document.getElementById("searchCompany");
    const searchIndividual = document.getElementById("searchIndividual");
    const searchCustomer = document.getElementById("searchCustomer");
    
    if (searchCompany) searchCompany.addEventListener("input", () => renderCompanyVendors());
    if (searchIndividual) searchIndividual.addEventListener("input", () => renderIndividualVendors());
    if (searchCustomer) searchCustomer.addEventListener("input", () => renderCustomers());
}

function setupEventListeners() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            logout();
        });
    }
}

// Expose functions globally
window.approveVendor = approveVendor;
window.rejectVendor = rejectVendor;
window.toggleVendorStatus = toggleVendorStatus;
window.toggleCustomerStatus = toggleCustomerStatus;
window.viewVendorDetails = viewVendorDetails;
window.viewCustomerDetails = viewCustomerDetails;
window.switchToApprovalsAndSelect = switchToApprovalsAndSelect;
window.switchSection = switchSection;