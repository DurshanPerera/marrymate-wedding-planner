import { auth, db } from "../firebase/firebase-config.js";
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
let currentCustomerData = null;
let vendorsList = [];
let servicesList = [];
let savedVendorsList = [];
let bookingsList = [];
let messagesList = [];
let budgetPlan = null;
let currentVendorForModal = null;
let currentServiceImages = [];

// Budget allocation percentages
const BUDGET_ALLOCATION = {
    venue: 0.35,
    catering: 0.30,
    photography: 0.10,
    bridal: 0.08,
    entertainment: 0.05,
    cake: 0.04,
    invitations: 0.03,
    misc: 0.05
};

const categoryNames = {
    venue: "Wedding Venue",
    catering: "Catering",
    photography: "Photography",
    bridal: "Bridal Dressing",
    entertainment: "Entertainment",
    cake: "Wedding Cake",
    invitations: "Invitations",
    misc: "Miscellaneous"
};

/* =========================================================
   ELEMENTS
========================================================= */
const sectionTitles = {
    dashboard: { title: "Dashboard", subtitle: "Welcome back! Let's plan your dream wedding." },
    budget: { title: "Smart Budget Planner", subtitle: "Enter your wedding details and let our system plan your perfect wedding." },
    vendors: { title: "Explore Vendors", subtitle: "Discover the best wedding service providers in Sri Lanka." },
    categories: { title: "Browse by Category", subtitle: "Find the perfect vendor for every aspect of your wedding." },
    saved: { title: "Saved Vendors", subtitle: "Your favorite vendors, saved for easy access." },
    bookings: { title: "My Bookings", subtitle: "Track your booking requests and history." },
    messages: { title: "Messages", subtitle: "Communicate with your vendors." },
    profile: { title: "My Profile", subtitle: "Manage your personal information and wedding preferences." }
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
    if (!amount) return "Price on request";
    if (typeof amount === 'string' && amount.includes('LKR')) return amount;
    return `LKR ${Number(amount).toLocaleString()}`;
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
    if (!user) {
        window.location.href = "../login.html";
        return;
    }
    
    currentUser = user;
    await loadCustomerData();
    await loadAllData();
    setupEventListeners();
    setupSectionNavigation();
    setupTabs();
    setupFilters();
    setupCategories();
    setupModal();
});

async function loadCustomerData() {
    try {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userDocRef);
        
        if (userSnap.exists()) {
            currentCustomerData = userSnap.data();
            updateUIWithCustomerData();
        } else {
            currentCustomerData = {
                uid: currentUser.uid,
                fullName: currentUser.displayName || "",
                email: currentUser.email || "",
                createdAt: new Date().toISOString()
            };
            await setDoc(doc(db, "users", currentUser.uid), currentCustomerData);
        }
    } catch (error) {
        console.error("Error loading customer data:", error);
    }
}

function updateUIWithCustomerData() {
    if (!currentCustomerData) return;
    
    const customerNameSpan = document.querySelector("#customerName span");
    if (customerNameSpan) {
        customerNameSpan.textContent = escapeHtml(currentCustomerData.fullName || "Customer");
    }
    
    document.getElementById("fullName").value = currentCustomerData.fullName || "";
    document.getElementById("email").value = currentCustomerData.email || "";
    document.getElementById("phone").value = currentCustomerData.phone || "";
    document.getElementById("address").value = currentCustomerData.address || "";
    document.getElementById("birthday").value = currentCustomerData.birthday || "";
    document.getElementById("weddingDatePref").value = currentCustomerData.weddingDate || "";
    document.getElementById("guestCountPref").value = currentCustomerData.guestCount || "";
    document.getElementById("preferredDistrict").value = currentCustomerData.district || "";
    document.getElementById("weddingPreferences").value = currentCustomerData.weddingPreferences || "";
    
    if (currentCustomerData.budget) {
        document.getElementById("budgetAmount").value = currentCustomerData.budget;
    }
}

/* =========================================================
   LOAD DATA
========================================================= */
async function loadAllData() {
    await Promise.all([
        loadVendors(),
        loadServices(),
        loadSavedVendors(),
        loadBookings(),
        loadMessages()
    ]);
    updateDashboardStats();
    renderRecommendedVendors();
    renderRecentBookings();
    renderWeddingTimeline();
}

async function loadVendors() {
    try {
        const companyVendorsRef = collection(db, "company_vendors");
        const companyQuery = query(companyVendorsRef, 
            where("status", "==", "approved"),
            where("isActive", "==", true)
        );
        const companySnapshot = await getDocs(companyQuery);
        
        const individualVendorsRef = collection(db, "individual_vendors");
        const individualQuery = query(individualVendorsRef,
            where("status", "==", "approved"),
            where("isActive", "==", true)
        );
        const individualSnapshot = await getDocs(individualQuery);
        
        vendorsList = [];
        companySnapshot.forEach(doc => {
            vendorsList.push({ id: doc.id, type: "company", ...doc.data() });
        });
        individualSnapshot.forEach(doc => {
            vendorsList.push({ id: doc.id, type: "individual", ...doc.data() });
        });
        
        console.log("Vendors loaded:", vendorsList); // Debug log
        
        renderVendors();
    } catch (error) {
        console.error("Error loading vendors:", error);
    }
}

async function loadServices() {
    try {
        const servicesRef = collection(db, "services");
        const snapshot = await getDocs(servicesRef);
        servicesList = [];
        snapshot.forEach(doc => {
            servicesList.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error("Error loading services:", error);
    }
}

async function loadSavedVendors() {
    try {
        const savedRef = collection(db, "saved_vendors");
        const q = query(savedRef, where("customerId", "==", currentUser.uid));
        const snapshot = await getDocs(q);
        savedVendorsList = [];
        snapshot.forEach(doc => {
            savedVendorsList.push({ id: doc.id, ...doc.data() });
        });
        renderSavedVendors();
    } catch (error) {
        console.error("Error loading saved vendors:", error);
    }
}

async function loadBookings() {
    try {
        const bookingsRef = collection(db, "bookings");
        // Now with indexes enabled, you can use orderBy again
        const q = query(bookingsRef, 
            where("customerId", "==", currentUser.uid), 
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        bookingsList = [];
        snapshot.forEach(doc => {
            bookingsList.push({ id: doc.id, ...doc.data() });
        });
        renderBookings();
        updateDashboardStats();
        renderRecentBookings();
    } catch (error) {
        console.error("Error loading bookings:", error);
    }
}

async function loadMessages() {
    try {
        const messagesRef = collection(db, "messages");
        // Now with indexes enabled, you can use orderBy again
        const q = query(messagesRef, 
            where("customerId", "==", currentUser.uid), 
            orderBy("createdAt", "desc")
        );
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

/* =========================================================
   RENDER FUNCTIONS
========================================================= */
function renderVendorCard(vendor) {
    const isSaved = savedVendorsList.some(s => s.vendorId === vendor.id);
    const vendorName = vendor.companyName || vendor.fullName || vendor.serviceName || "Vendor";
    const district = vendor.district || "Location not specified";
    const description = vendor.description || "Professional wedding service provider";
    
    // Use the actual profile picture from Firebase or a local SVG fallback
    const profilePicture = vendor.profilePicture || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' font-size='16' text-anchor='middle' fill='%23aaa' dy='.3em'%3ENo Image%3C/text%3E%3C/svg%3E";
    
    const vendorServices = servicesList.filter(s => s.vendorId === vendor.id);
    const serviceTags = vendorServices.slice(0, 3).map(s => s.title).filter(Boolean);
    
    return `
        <div class="vendor-card" data-id="${vendor.id}" data-type="${vendor.type}">
            <div class="vendor-card-image">
                <img src="${profilePicture}" 
                     alt="${escapeHtml(vendorName)}" 
                     onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'300\' viewBox=\'0 0 400 300\'%3E%3Crect width=\'400\' height=\'300\' fill=\'%23333\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' font-size=\'16\' text-anchor=\'middle\' fill=\'%23aaa\' dy=\'.3em\'%3EImage%20Load%20Failed%3C/text%3E%3C/svg%3E'; this.onerror=null;">
                <button class="favorite-btn ${isSaved ? 'active' : ''}" data-id="${vendor.id}" data-type="${vendor.type}">
                    <i class="fas fa-heart"></i>
                </button>
            </div>
            <div class="vendor-card-content">
                <h3 class="vendor-name">${escapeHtml(vendorName)}</h3>
                <div class="vendor-location">
                    <i class="fas fa-map-marker-alt"></i> ${escapeHtml(district)}
                </div>
                <p class="vendor-description">${escapeHtml(description.substring(0, 80))}${description.length > 80 ? '...' : ''}</p>
                ${serviceTags.length > 0 ? `<div class="vendor-services">${serviceTags.map(s => `<span class="service-tag">${escapeHtml(s)}</span>`).join('')}</div>` : ''}
                <div class="vendor-category-badge">${escapeHtml(vendor.category || "General")}</div>
            </div>
        </div>
    `;
}

function renderVendors() {
    const vendorGrid = document.getElementById("vendorGrid");
    const searchTerm = document.getElementById("searchVendor")?.value.toLowerCase() || "";
    const categoryFilter = document.getElementById("categoryFilter")?.value || "";
    const districtFilter = document.getElementById("districtFilter")?.value || "";
    
    let filtered = [...vendorsList];
    
    if (searchTerm) {
        filtered = filtered.filter(v => 
            (v.companyName?.toLowerCase().includes(searchTerm)) ||
            (v.fullName?.toLowerCase().includes(searchTerm)) ||
            (v.serviceName?.toLowerCase().includes(searchTerm)) ||
            (v.category?.toLowerCase().includes(searchTerm)) ||
            (v.description?.toLowerCase().includes(searchTerm))
        );
    }
    if (categoryFilter) {
        filtered = filtered.filter(v => v.category === categoryFilter);
    }
    if (districtFilter) {
        filtered = filtered.filter(v => v.district === districtFilter);
    }
    
    if (filtered.length === 0) {
        vendorGrid.innerHTML = '<p class="empty-state">No vendors found. Try adjusting your filters.</p>';
        return;
    }
    
    vendorGrid.innerHTML = filtered.map(vendor => renderVendorCard(vendor)).join("");
    
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSaveVendor(btn.dataset.id, btn.dataset.type);
        });
    });
    document.querySelectorAll('.vendor-card').forEach(card => {
        card.addEventListener('click', () => {
            openVendorDetails(card.dataset.id, card.dataset.type);
        });
    });
}

function renderSavedVendors() {
    const savedGrid = document.getElementById("savedVendorsGrid");
    const savedVendorsData = vendorsList.filter(v => savedVendorsList.some(s => s.vendorId === v.id));
    
    document.getElementById("savedBadge").textContent = savedVendorsData.length;
    
    if (savedVendorsData.length === 0) {
        savedGrid.innerHTML = '<p class="empty-state">No saved vendors yet. Click the heart icon on vendors to save them.</p>';
        return;
    }
    
    savedGrid.innerHTML = savedVendorsData.map(vendor => renderVendorCard(vendor)).join("");
    
    document.querySelectorAll('#savedVendorsGrid .favorite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSaveVendor(btn.dataset.id, btn.dataset.type);
        });
    });
    document.querySelectorAll('#savedVendorsGrid .vendor-card').forEach(card => {
        card.addEventListener('click', () => {
            openVendorDetails(card.dataset.id, card.dataset.type);
        });
    });
}

function renderBookings() {
    const pendingBody = document.getElementById("pendingBookingsTableBody");
    const historyBody = document.getElementById("bookingsHistoryTableBody");
    
    const pending = bookingsList.filter(b => b.status === "pending");
    const history = bookingsList.filter(b => b.status !== "pending");
    
    document.getElementById("bookingBadge").textContent = pending.length;
    
    if (pending.length === 0) {
        pendingBody.innerHTML = '<td colspan="6" class="empty-state">No pending bookings</td>';
    } else {
        pendingBody.innerHTML = pending.map(booking => `
            <tr>
                <td>${escapeHtml(booking.vendorName || "Vendor")}</td>
                <td>${escapeHtml(booking.serviceTitle || "Service")}</td>
                <td>${formatDate(booking.eventDate)}</td>
                <td>${formatCurrency(booking.budget)}</td>
                <td><span class="status-badge-small status-pending">pending</span></td>
                <td class="action-icons">
                    <i class="fas fa-times-circle" onclick="cancelBooking('${booking.id}')" style="color: #ff6b6b; cursor: pointer;"></i>
                </td>
            </tr>
        `).join("");
    }
    
    if (history.length === 0) {
        historyBody.innerHTML = '<tr><td colspan="5" class="empty-state">No booking history</td></tr>';
    } else {
        historyBody.innerHTML = history.map(booking => `
            <tr>
                <td>${escapeHtml(booking.vendorName || "Vendor")}</td>
                <td>${escapeHtml(booking.serviceTitle || "Service")}</td>
                <td>${formatDate(booking.eventDate)}</td>
                <td>${formatCurrency(booking.budget)}</td>
                <td><span class="status-badge-small ${booking.status === 'approved' ? 'status-approved' : 'status-rejected'}">${booking.status}</span></td>
            </tr>
        `).join("");
    }
}

function renderMessages() {
    const messagesDiv = document.getElementById("messagesList");
    const unreadCount = messagesList.filter(m => !m.isRead).length;
    
    document.getElementById("messageBadge").textContent = unreadCount;
    
    if (messagesList.length === 0) {
        messagesDiv.innerHTML = '<p class="empty-state">No messages yet</p>';
        return;
    }
    
    messagesDiv.innerHTML = messagesList.map(msg => `
        <div class="message-item" onclick="viewMessage('${msg.id}')">
            <div class="message-header">
                <span class="message-sender">${escapeHtml(msg.vendorName || "Vendor")}</span>
                <span class="message-date">${formatDate(msg.createdAt)}</span>
            </div>
            <p class="message-subject">${escapeHtml(msg.subject || "Inquiry")}</p>
            <p class="message-preview">${escapeHtml((msg.message || "").substring(0, 100))}${(msg.message || "").length > 100 ? "..." : ""}</p>
        </div>
    `).join("");
}

function renderRecentBookings() {
    const container = document.getElementById("recentBookings");
    const recent = bookingsList.slice(0, 4);
    
    if (recent.length === 0) {
        container.innerHTML = '<p class="empty-state">No recent bookings</p>';
        return;
    }
    
    container.innerHTML = recent.map(booking => `
        <div class="recent-item">
            <div class="info">
                <p class="name">${escapeHtml(booking.vendorName || "Vendor")}</p>
                <p class="detail">${escapeHtml(booking.serviceTitle || "Service")} • ${formatDate(booking.eventDate)}</p>
            </div>
            <span class="status status-${booking.status}">${booking.status}</span>
        </div>
    `).join("");
}

function renderRecommendedVendors() {
    const container = document.getElementById("recommendedVendors");
    if (!budgetPlan || !budgetPlan.recommendations) {
        container.innerHTML = '<p class="empty-state">Set your budget to see recommendations</p>';
        return;
    }
    
    const recommendations = budgetPlan.recommendations.slice(0, 3);
    if (recommendations.length === 0) {
        container.innerHTML = '<p class="empty-state">No matching vendors found for your budget</p>';
        return;
    }
    
    container.innerHTML = recommendations.map(vendor => `
        <div class="recent-item" onclick="openVendorDetails('${vendor.id}', '${vendor.type}')">
            <div class="info">
                <p class="name">${escapeHtml(vendor.companyName || vendor.fullName || vendor.serviceName)}</p>
                <p class="detail">${escapeHtml(vendor.category)} • ${escapeHtml(vendor.district)}</p>
            </div>
            <button class="btn-icon" onclick="event.stopPropagation(); openBookingFormDirect('${vendor.id}', '${escapeHtml(vendor.companyName || vendor.fullName)}')" style="background: rgba(255,215,0,0.2); padding: 5px 10px; border-radius: 20px;">Book</button>
        </div>
    `).join("");
}

function renderWeddingTimeline() {
    const container = document.getElementById("weddingTimeline");
    if (!currentCustomerData?.weddingDate) {
        container.innerHTML = '<p class="empty-state">Set your wedding date in profile to see timeline</p>';
        return;
    }
    
    const weddingDate = new Date(currentCustomerData.weddingDate);
    const today = new Date();
    const daysLeft = Math.ceil((weddingDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) {
        container.innerHTML = '<p class="empty-state">Your wedding day has passed. Congratulations! 🎉</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="timeline-item">
            <p><strong>${daysLeft}</strong> days until your wedding</p>
            <div class="progress-bar" style="margin-top: 10px;">
                <div class="progress-fill" style="width: ${Math.min(100, Math.max(0, 100 - (daysLeft / 365 * 100)))}%"></div>
            </div>
        </div>
    `;
}

function updateDashboardStats() {
    document.getElementById("savedCount").textContent = savedVendorsList.length;
    document.getElementById("bookingRequestsCount").textContent = bookingsList.filter(b => b.status === "pending").length;
    document.getElementById("approvedBookingsCount").textContent = bookingsList.filter(b => b.status === "approved").length;
    
    const budget = currentCustomerData?.budget || 0;
    document.getElementById("totalBudget").textContent = formatCurrency(budget);
    
    if (budgetPlan) {
        document.getElementById("estimatedCost").textContent = formatCurrency(budgetPlan.totalEstimated || 0);
        const progress = budgetPlan.totalEstimated ? Math.round((budgetPlan.totalEstimated / budget) * 100) : 0;
        document.getElementById("weddingProgressValue").textContent = `${Math.min(100, progress)}%`;
        document.getElementById("weddingProgress").textContent = `Wedding Progress: ${Math.min(100, progress)}%`;
    }
}

/* =========================================================
   BUDGET PLANNER
========================================================= */
function calculateBudgetPlan() {
    const totalBudget = Number(document.getElementById("budgetAmount").value);
    const district = document.getElementById("weddingDistrict").value;
    const guestCount = Number(document.getElementById("guestCount").value);
    
    if (!totalBudget || totalBudget <= 0) {
        showToast("Please enter a valid budget amount", true);
        return;
    }
    
    if (!district) {
        showToast("Please select your preferred district", true);
        return;
    }
    
    const categoryBudgets = {};
    let totalAllocated = 0;
    
    for (const [category, percentage] of Object.entries(BUDGET_ALLOCATION)) {
        const amount = Math.floor(totalBudget * percentage);
        categoryBudgets[category] = amount;
        totalAllocated += amount;
    }
    
    const recommendations = [];
    for (const [category, budgetAmount] of Object.entries(categoryBudgets)) {
        const matchingVendors = vendorsList.filter(v => 
            v.category === category && 
            v.district === district &&
            v.isActive !== false &&
            v.status === "approved"
        );
        
        if (matchingVendors.length > 0) {
            recommendations.push(matchingVendors[0]);
        }
    }
    
    budgetPlan = {
        totalBudget,
        district,
        guestCount,
        categoryBudgets,
        totalAllocated,
        totalEstimated: totalAllocated,
        remaining: totalBudget - totalAllocated,
        recommendations: recommendations.slice(0, 5)
    };
    
    updateDoc(doc(db, "users", currentUser.uid), {
        budget: totalBudget,
        district: district,
        guestCount: guestCount,
        weddingDate: document.getElementById("weddingDate").value,
        updatedAt: new Date().toISOString()
    }).catch(console.error);
    
    displayBudgetResults();
    updateDashboardStats();
    renderRecommendedVendors();
}

function displayBudgetResults() {
    const resultsDiv = document.getElementById("budgetResults");
    const breakdownDiv = document.getElementById("budgetBreakdown");
    const recommendationsDiv = document.getElementById("budgetRecommendedVendors");
    
    let breakdownHtml = '<h4>Budget Breakdown</h4>';
    for (const [category, amount] of Object.entries(budgetPlan.categoryBudgets)) {
        breakdownHtml += `
            <div class="budget-category">
                <span class="category-name">${categoryNames[category] || category}</span>
                <span class="category-amount">${formatCurrency(amount)}</span>
            </div>
        `;
    }
    breakdownHtml += `
        <div class="budget-total">
            <span>Total Estimated</span>
            <span>${formatCurrency(budgetPlan.totalEstimated)}</span>
        </div>
        <div class="budget-total" style="border-top-color: ${budgetPlan.remaining >= 0 ? '#51cf66' : '#ff6b6b'}">
            <span>Remaining</span>
            <span>${formatCurrency(budgetPlan.remaining)}</span>
        </div>
    `;
    breakdownDiv.innerHTML = breakdownHtml;
    
    if (budgetPlan.recommendations.length === 0) {
        recommendationsDiv.innerHTML = '<p class="empty-state">No matching vendors found for your criteria. Try adjusting your district or budget.</p>';
    } else {
        recommendationsDiv.innerHTML = budgetPlan.recommendations.map(vendor => renderVendorCard(vendor)).join("");
        
        recommendationsDiv.querySelectorAll('.favorite-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSaveVendor(btn.dataset.id, btn.dataset.type);
            });
        });
        recommendationsDiv.querySelectorAll('.vendor-card').forEach(card => {
            card.addEventListener('click', () => {
                openVendorDetails(card.dataset.id, card.dataset.type);
            });
        });
    }
    
    resultsDiv.style.display = "block";
    resultsDiv.scrollIntoView({ behavior: "smooth" });
}

/* =========================================================
   VENDOR DETAILS & MODAL FUNCTIONS
========================================================= */
function openVendorDetails(vendorId, vendorType) {
    const vendor = vendorsList.find(v => v.id === vendorId && v.type === vendorType);
    if (!vendor) return;
    
    currentVendorForModal = vendor;
    
    const vendorServices = servicesList.filter(s => s.vendorId === vendorId);
    
    // Create array of images for gallery - THIS IS FOR WEB SCRAPING IMAGES
    // For now, we'll use placeholders, but later these will come from the vendor's website
    currentServiceImages = [];
    
    // ADD GALLERY IMAGES HERE LATER (from web scraping)
    // For now, show a placeholder message that images will be added
    currentServiceImages = ["https://via.placeholder.com/600x400?text=Gallery+Images+Coming+Soon"];
    
    let currentImageIndex = 0;
    
    const modalContent = document.getElementById("modalContent");
    
    modalContent.innerHTML = `
        <div class="vendor-detail-container">
            <button class="back-button" onclick="closeModal()">
                <i class="fas fa-arrow-left"></i> Back
            </button>
            
            <div class="vendor-gallery">
                <button class="gallery-nav prev" onclick="changeImage(-1)"><i class="fas fa-chevron-left"></i></button>
                <img id="galleryImage" src="${escapeHtml(currentServiceImages[0])}" alt="Vendor Gallery" onerror="this.src='https://via.placeholder.com/600x400?text=Gallery+Images+Coming+Soon'">
                <button class="gallery-nav next" onclick="changeImage(1)"><i class="fas fa-chevron-right"></i></button>
                <div class="image-counter" id="imageCounter">1 / ${currentServiceImages.length}</div>
                <div class="gallery-note">✨ Images will be added from vendor's website soon</div>
            </div>
            
            <div class="vendor-info-detail">
                <h2>${escapeHtml(vendor.companyName || vendor.fullName || vendor.serviceName)}</h2>
                <div class="vendor-meta">
                    <span class="category-badge">${escapeHtml(vendor.category || "General")}</span>
                    <span class="location-badge"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(vendor.district || "Location not specified")}</span>
                    <span class="type-badge"><i class="fas ${vendor.type === 'company' ? 'fa-building' : 'fa-user'}"></i> ${vendor.type === 'company' ? 'Company Vendor' : 'Individual Vendor'}</span>
                </div>
                
                <div class="vendor-contact-info">
                    <h3>Contact Information</h3>
                    <p><i class="fas fa-envelope"></i> ${escapeHtml(vendor.email || "Email not available")}</p>
                    <p><i class="fas fa-phone"></i> ${escapeHtml(vendor.phone || "Phone not available")}</p>
                    <p><i class="fas fa-map-marker-alt"></i> ${escapeHtml(vendor.address || "Address not specified")}</p>
                    ${vendor.website ? `<p><i class="fas fa-globe"></i> <a href="${escapeHtml(vendor.website)}" target="_blank" style="color: #FFD700;">${escapeHtml(vendor.website)}</a></p>` : ''}
                </div>
                
                <div class="vendor-description-full">
                    <h3>About</h3>
                    <p>${escapeHtml(vendor.description || "No description available")}</p>
                </div>
                
                ${vendorServices.length > 0 ? `
                    <div class="vendor-services-list">
                        <h3>Services Offered</h3>
                        ${vendorServices.map(service => `
                            <div class="service-item">
                                <h4>${escapeHtml(service.title)}</h4>
                                <p>${escapeHtml(service.description || "No description")}</p>
                                <p class="service-price"><strong>Price:</strong> ${formatCurrency(service.price)}</p>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p>No services listed yet.</p>'}
                
                <div class="vendor-action-buttons">
                    <button class="btn-contact-detail" onclick="openContactForm()"><i class="fas fa-envelope"></i> Contact Vendor</button>
                    <button class="btn-book-detail" onclick="openBookingForm()"><i class="fas fa-calendar-plus"></i> Request Booking</button>
                </div>
            </div>
        </div>
    `;
    
    window.changeImage = function(direction) {
        currentImageIndex = (currentImageIndex + direction + currentServiceImages.length) % currentServiceImages.length;
        const galleryImage = document.getElementById("galleryImage");
        const imageCounter = document.getElementById("imageCounter");
        if (galleryImage && imageCounter) {
            galleryImage.src = currentServiceImages[currentImageIndex];
            imageCounter.textContent = `${currentImageIndex + 1} / ${currentServiceImages.length}`;
        }
    };
    
    document.getElementById("vendorModal").style.display = "block";
}

function openContactForm() {
    if (!currentVendorForModal) return;
    
    const modalContent = document.getElementById("modalContent");
    
    modalContent.innerHTML = `
        <div class="form-modal-container">
            <button class="back-button" onclick="openVendorDetails('${currentVendorForModal.id}', '${currentVendorForModal.type}')">
                <i class="fas fa-arrow-left"></i> Back to Vendor
            </button>
            
            <h2>Contact ${escapeHtml(currentVendorForModal.companyName || currentVendorForModal.fullName)}</h2>
            
            <div class="vendor-contact-summary">
                <p><i class="fas fa-envelope"></i> ${escapeHtml(currentVendorForModal.email || "Email not available")}</p>
                <p><i class="fas fa-phone"></i> ${escapeHtml(currentVendorForModal.phone || "Phone not available")}</p>
                <p><i class="fas fa-map-marker-alt"></i> ${escapeHtml(currentVendorForModal.district || "Location not specified")}</p>
            </div>
            
            <form id="contactForm" class="contact-form">
                <div class="form-group">
                    <label for="contactSubject">Subject *</label>
                    <input type="text" id="contactSubject" placeholder="e.g., Inquiry about wedding services" required>
                </div>
                
                <div class="form-group">
                    <label for="contactMessage">Message *</label>
                    <textarea id="contactMessage" rows="5" placeholder="Write your message here..." required></textarea>
                </div>
                
                <div class="form-group">
                    <label for="contactPhone">Your Phone Number (Optional)</label>
                    <input type="tel" id="contactPhone" placeholder="+94 XX XXX XXXX">
                </div>
                
                <button type="submit" class="btn-primary">Send Message</button>
            </form>
        </div>
    `;
    
    document.getElementById("contactForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const subject = document.getElementById("contactSubject").value.trim();
        const message = document.getElementById("contactMessage").value.trim();
        const phone = document.getElementById("contactPhone").value.trim();
        
        if (!subject || !message) {
            showToast("Please fill all required fields", true);
            return;
        }
        
        const messageData = {
            vendorId: currentVendorForModal.id,
            vendorName: currentVendorForModal.companyName || currentVendorForModal.fullName,
            subject: subject,
            message: message + (phone ? `\n\nContact Phone: ${phone}` : ""),
            customerPhone: phone
        };
        
        await sendMessage(messageData);
        closeModal();
    });
}

function openBookingForm() {
    if (!currentVendorForModal) return;
    
    const modalContent = document.getElementById("modalContent");
    
    modalContent.innerHTML = `
        <div class="form-modal-container">
            <button class="back-button" onclick="openVendorDetails('${currentVendorForModal.id}', '${currentVendorForModal.type}')">
                <i class="fas fa-arrow-left"></i> Back to Vendor
            </button>
            
            <h2>Request Booking with ${escapeHtml(currentVendorForModal.companyName || currentVendorForModal.fullName)}</h2>
            
            <form id="bookingForm" class="booking-form">
                <div class="form-group">
                    <label for="bookingService">Service Required *</label>
                    <input type="text" id="bookingService" placeholder="e.g., Wedding Photography Package" required>
                </div>
                
                <div class="form-group">
                    <label for="bookingDate">Event Date *</label>
                    <input type="date" id="bookingDate" required>
                </div>
                
                <div class="form-group">
                    <label for="bookingBudget">Estimated Budget (LKR) *</label>
                    <input type="number" id="bookingBudget" placeholder="Enter your budget" min="0" required>
                </div>
                
                <div class="form-group">
                    <label for="bookingGuestCount">Expected Guest Count</label>
                    <input type="number" id="bookingGuestCount" placeholder="Number of guests">
                </div>
                
                <div class="form-group">
                    <label for="bookingMessage">Additional Notes</label>
                    <textarea id="bookingMessage" rows="3" placeholder="Any special requests or details..."></textarea>
                </div>
                
                <button type="submit" class="btn-primary" id="proceedToPaymentBtn">Proceed to Payment</button>
            </form>
        </div>
    `;
    
    document.getElementById("bookingForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const serviceTitle = document.getElementById("bookingService").value.trim();
        const eventDate = document.getElementById("bookingDate").value;
        const budget = Number(document.getElementById("bookingBudget").value);
        const guestCount = document.getElementById("bookingGuestCount").value;
        const message = document.getElementById("bookingMessage").value.trim();
        
        if (!serviceTitle || !eventDate || !budget) {
            showToast("Please fill all required fields", true);
            return;
        }
        
        window.tempBookingData = {
            serviceTitle,
            eventDate,
            budget,
            guestCount,
            message
        };
        
        openPaymentForm();
    });
}

function openBookingFormDirect(vendorId, vendorName) {
    const vendor = vendorsList.find(v => v.id === vendorId);
    if (vendor) {
        currentVendorForModal = vendor;
        openBookingForm();
    }
}

function openPaymentForm() {
    if (!currentVendorForModal || !window.tempBookingData) return;
    
    const modalContent = document.getElementById("modalContent");
    
    modalContent.innerHTML = `
        <div class="form-modal-container">
            <button class="back-button" onclick="openBookingForm()">
                <i class="fas fa-arrow-left"></i> Back to Booking
            </button>
            
            <h2>Payment Details</h2>
            <p class="payment-summary">Booking with ${escapeHtml(currentVendorForModal.companyName || currentVendorForModal.fullName)}</p>
            <p class="payment-amount">Amount: ${formatCurrency(window.tempBookingData.budget)}</p>
            
            <form id="paymentForm" class="payment-form">
                <div class="form-group">
                    <label for="cardNumber">Card Number *</label>
                    <input type="text" id="cardNumber" placeholder="1234 5678 9012 3456" maxlength="19" required>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="expiryDate">Expiry Date *</label>
                        <input type="text" id="expiryDate" placeholder="MM/YY" maxlength="5" required>
                    </div>
                    <div class="form-group">
                        <label for="cvv">CVV *</label>
                        <input type="password" id="cvv" placeholder="123" maxlength="3" required>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="cardName">Cardholder Name *</label>
                    <input type="text" id="cardName" placeholder="Name on card" required>
                </div>
                
                <button type="submit" class="btn-primary pay-now-btn">Pay Now</button>
            </form>
        </div>
    `;
    
    const cardNumberInput = document.getElementById("cardNumber");
    if (cardNumberInput) {
        cardNumberInput.addEventListener("input", (e) => {
            let value = e.target.value.replace(/\s/g, '');
            if (value.length > 16) value = value.slice(0, 16);
            e.target.value = value.replace(/(\d{4})/g, '$1 ').trim();
        });
    }
    
    const expiryInput = document.getElementById("expiryDate");
    if (expiryInput) {
        expiryInput.addEventListener("input", (e) => {
            let value = e.target.value.replace(/\//g, '');
            if (value.length >= 2) {
                value = value.slice(0, 2) + '/' + value.slice(2, 4);
            }
            e.target.value = value;
        });
    }
    
    document.getElementById("paymentForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const cardNumber = document.getElementById("cardNumber").value.replace(/\s/g, '');
        const expiryDate = document.getElementById("expiryDate").value;
        const cvv = document.getElementById("cvv").value;
        const cardName = document.getElementById("cardName").value.trim();
        
        if (!cardNumber || !expiryDate || !cvv || !cardName) {
            showToast("Please fill all payment details", true);
            return;
        }
        
        if (cardNumber.length !== 16) {
            showToast("Please enter a valid 16-digit card number", true);
            return;
        }
        
        if (cvv.length !== 3) {
            showToast("Please enter a valid 3-digit CVV", true);
            return;
        }
        
        const payBtn = document.querySelector(".pay-now-btn");
        const originalText = payBtn.innerHTML;
        payBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        payBtn.disabled = true;
        
        setTimeout(async () => {
            const bookingData = {
                vendorId: currentVendorForModal.id,
                vendorName: currentVendorForModal.companyName || currentVendorForModal.fullName,
                serviceTitle: window.tempBookingData.serviceTitle,
                eventDate: window.tempBookingData.eventDate,
                budget: window.tempBookingData.budget,
                message: window.tempBookingData.message + `\n\nPayment Status: Paid via card ending in ${cardNumber.slice(-4)}`
            };
            
            await sendBookingRequest(bookingData);
            
            modalContent.innerHTML = `
                <div class="success-container">
                    <i class="fas fa-check-circle" style="font-size: 64px; color: #51cf66;"></i>
                    <h2>Payment Successful!</h2>
                    <p>Your booking request has been sent to ${escapeHtml(bookingData.vendorName)}.</p>
                    <p>We'll notify you once the vendor responds.</p>
                    <button class="btn-primary" onclick="closeModal()">Close</button>
                </div>
            `;
            
            delete window.tempBookingData;
        }, 2000);
    });
}

function closeModal() {
    document.getElementById("vendorModal").style.display = "none";
    currentVendorForModal = null;
    delete window.tempBookingData;
}

/* =========================================================
   ACTIONS
========================================================= */
async function toggleSaveVendor(vendorId, vendorType) {
    const existing = savedVendorsList.find(s => s.vendorId === vendorId);
    
    try {
        if (existing) {
            await deleteDoc(doc(db, "saved_vendors", existing.id));
            showToast("Vendor removed from saved");
        } else {
            await addDoc(collection(db, "saved_vendors"), {
                customerId: currentUser.uid,
                vendorId: vendorId,
                vendorType: vendorType,
                createdAt: new Date().toISOString()
            });
            showToast("Vendor saved successfully");
        }
        await loadSavedVendors();
        renderVendors();
    } catch (error) {
        console.error("Error toggling saved vendor:", error);
        showToast("Error saving vendor", true);
    }
}

async function sendBookingRequest(bookingData) {
    try {
        await addDoc(collection(db, "bookings"), {
            customerId: currentUser.uid,
            customerName: currentCustomerData.fullName || "Customer",
            vendorId: bookingData.vendorId,
            vendorName: bookingData.vendorName,
            serviceTitle: bookingData.serviceTitle,
            eventDate: bookingData.eventDate,
            budget: Number(bookingData.budget),
            message: bookingData.message || "",
            paymentStatus: "paid",
            status: "pending",
            createdAt: new Date().toISOString()
        });
        showToast("Booking request sent successfully!");
        await loadBookings();
        updateDashboardStats();
    } catch (error) {
        console.error("Error sending booking:", error);
        showToast("Error sending booking request", true);
    }
}

async function sendMessage(messageData) {
    try {
        await addDoc(collection(db, "messages"), {
            customerId: currentUser.uid,
            customerName: currentCustomerData.fullName || "Customer",
            vendorId: messageData.vendorId,
            vendorName: messageData.vendorName,
            subject: messageData.subject,
            message: messageData.message,
            customerPhone: messageData.customerPhone || "",
            senderType: "customer",
            isRead: false,
            createdAt: new Date().toISOString()
        });
        showToast("Message sent successfully!");
        await loadMessages();
        closeModal();
    } catch (error) {
        console.error("Error sending message:", error);
        showToast("Error sending message", true);
    }
}

async function cancelBooking(bookingId) {
    if (!confirm("Are you sure you want to cancel this booking request?")) return;
    
    try {
        await deleteDoc(doc(db, "bookings", bookingId));
        showToast("Booking cancelled");
        await loadBookings();
        updateDashboardStats();
    } catch (error) {
        console.error("Error cancelling booking:", error);
        showToast("Error cancelling booking", true);
    }
}

window.cancelBooking = cancelBooking;

async function updateProfile(e) {
    e.preventDefault();
    
    const updatedData = {
        fullName: document.getElementById("fullName").value.trim(),
        email: document.getElementById("email").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        address: document.getElementById("address").value.trim(),
        birthday: document.getElementById("birthday").value,
        weddingDate: document.getElementById("weddingDatePref").value,
        guestCount: Number(document.getElementById("guestCountPref").value),
        district: document.getElementById("preferredDistrict").value,
        weddingPreferences: document.getElementById("weddingPreferences").value.trim(),
        updatedAt: new Date().toISOString()
    };
    
    try {
        await updateDoc(doc(db, "users", currentUser.uid), updatedData);
        currentCustomerData = { ...currentCustomerData, ...updatedData };
        updateUIWithCustomerData();
        renderWeddingTimeline();
        showToast("Profile updated successfully!");
    } catch (error) {
        console.error("Error updating profile:", error);
        showToast("Error updating profile", true);
    }
}

/* =========================================================
   NAVIGATION & SETUP
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

function setupFilters() {
    const searchInput = document.getElementById("searchVendor");
    const categoryFilter = document.getElementById("categoryFilter");
    const districtFilter = document.getElementById("districtFilter");
    
    const applyFilters = () => renderVendors();
    
    searchInput?.addEventListener("input", applyFilters);
    categoryFilter?.addEventListener("change", applyFilters);
    districtFilter?.addEventListener("change", applyFilters);
}

function setupCategories() {
    const categoryCards = document.querySelectorAll(".category-card");
    const categoryCardsView = document.getElementById("categoriesGrid");
    const categoryVendorsView = document.getElementById("categoryVendorsView");
    const backBtn = document.getElementById("backToCategoriesBtn");
    const categoryTitle = document.getElementById("categoryTitle");
    const categoryVendorsGrid = document.getElementById("categoryVendorsGrid");
    
    const categoryDisplayNames = {
        venue: "Wedding Venues",
        photography: "Photography",
        catering: "Catering",
        bridal: "Bridal Dressing",
        entertainment: "Entertainment",
        cake: "Wedding Cakes",
        invitations: "Invitations",
        honeymoon: "Honeymoon Packages"
    };
    
    categoryCards.forEach(card => {
        card.addEventListener("click", () => {
            const category = card.dataset.category;
            const filtered = vendorsList.filter(v => v.category === category);
            
            categoryTitle.textContent = categoryDisplayNames[category] || category;
            
            categoryVendorsGrid.innerHTML = filtered.map(vendor => renderVendorCard(vendor)).join("");
            
            categoryVendorsGrid.querySelectorAll('.favorite-btn').forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    toggleSaveVendor(btn.dataset.id, btn.dataset.type);
                });
            });
            categoryVendorsGrid.querySelectorAll('.vendor-card').forEach(card => {
                card.addEventListener("click", () => {
                    openVendorDetails(card.dataset.id, card.dataset.type);
                });
            });
            
            categoryCardsView.style.display = "none";
            categoryVendorsView.style.display = "block";
        });
    });
    
    backBtn.addEventListener("click", () => {
        categoryCardsView.style.display = "grid";
        categoryVendorsView.style.display = "none";
    });
}

function setupModal() {
    const modal = document.getElementById("vendorModal");
    const closeBtn = document.querySelector(".close-modal");
    
    closeBtn.onclick = () => modal.style.display = "none";
    window.onclick = (event) => {
        if (event.target === modal) modal.style.display = "none";
    };
}

function setupEventListeners() {
    document.getElementById("profileForm")?.addEventListener("submit", updateProfile);
    document.getElementById("calculateBudgetBtn")?.addEventListener("click", calculateBudgetPlan);
    document.getElementById("logoutBtn")?.addEventListener("click", async () => {
        await signOut(auth);
        window.location.replace("../login.html");
    });
    
    document.querySelector(".profile-picture-container")?.addEventListener("click", () => {
        document.getElementById("profilePictureInput").click();
    });
    
    document.getElementById("profilePictureInput")?.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            showToast("File size must be less than 2MB", true);
            return;
        }
        
        try {
            const storage = getStorage();
            const storageRef = ref(storage, `profile_pictures/${currentUser.uid}/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            
            await updateDoc(doc(db, "users", currentUser.uid), { profilePicture: downloadURL });
            document.getElementById("profilePreview").src = downloadURL;
            document.getElementById("profilePreview").style.display = "block";
            document.getElementById("profilePlaceholder").style.display = "none";
            showToast("Profile picture updated!");
        } catch (error) {
            console.error("Error uploading profile picture:", error);
            showToast("Error uploading profile picture", true);
        }
    });
}

window.viewMessage = (messageId) => {
    const message = messagesList.find(m => m.id === messageId);
    if (message) {
        alert(`From: ${message.vendorName}\nSubject: ${message.subject}\n\nMessage:\n${message.message}`);
        
        if (!message.isRead) {
            updateDoc(doc(db, "messages", messageId), { isRead: true, readAt: new Date().toISOString() })
                .catch(console.error);
        }
    }
};

window.openVendorDetails = openVendorDetails;
window.openContactForm = openContactForm;
window.openBookingForm = openBookingForm;
window.openBookingFormDirect = openBookingFormDirect;
window.openPaymentForm = openPaymentForm;
window.closeModal = closeModal;
window.switchSection = switchSection;
window.cancelBooking = cancelBooking;
window.changeImage = function(direction) {};