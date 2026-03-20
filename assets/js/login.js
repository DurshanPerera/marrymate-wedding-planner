// DOM Elements
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const errorMessage = document.getElementById("errorMessage");
const noAccountMessage = document.getElementById("noAccountMessage");

// Mock database of registered users (for demo purposes)
// In a real app, this would be fetched from a backend API
const registeredUsers = {
    // Customer accounts
    "customer@gmail.com": { password: "1234", role: "customer", name: "John Doe" },
    
    // Admin accounts
    "admin@gmail.com": { password: "admin123", role: "admin", name: "Administrator" },
    
    // Vendor accounts
    "vendor@gmail.com": { password: "1234", role: "vendor", name: "Vendor Business" },
    
};

// ==============================
//  PASSWORD TOGGLE
// ==============================
togglePassword.addEventListener("click", () => {
    const type = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = type;

    togglePassword.innerHTML = type === "password"
        ? '<i class="far fa-eye"></i>'
        : '<i class="far fa-eye-slash"></i>';
});

// Clear error when user starts typing
emailInput.addEventListener("input", () => {
    clearMessages();
    emailInput.style.borderColor = "rgba(255,255,255,0.1)";
});

passwordInput.addEventListener("input", () => {
    clearMessages();
    passwordInput.style.borderColor = "rgba(255,255,255,0.1)";
});

// ==============================
// LOGIN HANDLER
// ==============================
loginForm.addEventListener("submit", function (e) {
    e.preventDefault();

    clearMessages();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        showError("Please enter both email and password");
        return;
    }

    handleLogin(email, password);
});

// ==============================
// ROLE LOGIC WITH ACCOUNT CHECK
// ==============================
function handleLogin(email, password) {
    
    // Check if email exists in our registered users
    const user = registeredUsers[email.toLowerCase()];
    
    if (!user) {
        // Email not registered - show "no account" message (without link)
        showNoAccountMessage(email);
        return;
    }
    
    // Check password
    if (user.password !== password) {
        showError("Incorrect password. Please try again.");
        passwordInput.style.borderColor = "#ff6b6b";
        return;
    }
    
    // Login successful - redirect based on role
    redirectBasedOnRole(user.role);
}

// ==============================
// SHOW NO ACCOUNT MESSAGE (NO LINK)
// ==============================
function showNoAccountMessage(email) {
    noAccountMessage.innerHTML = `
        <i class="fas fa-info-circle" style="margin-right: 8px;"></i>
        No account found with "${email}". Please create an account before logging in.
    `;
    noAccountMessage.style.display = "block";
    
    // Highlight email field
    emailInput.style.borderColor = "#ffc107";
    emailInput.style.boxShadow = "0 0 10px rgba(255, 193, 7, 0.3)";
    
    // Clear password field
    passwordInput.value = "";
    passwordInput.style.borderColor = "rgba(255,255,255,0.1)";
}

// ==============================
// SHOW ERROR MESSAGE
// ==============================
function showError(message) {
    errorMessage.style.display = "block";
    errorMessage.textContent = message;
    
    // Clear no account message if showing
    noAccountMessage.style.display = "none";
}

// ==============================
// CLEAR ALL MESSAGES
// ==============================
function clearMessages() {
    errorMessage.style.display = "none";
    errorMessage.textContent = "";
    
    noAccountMessage.style.display = "none";
    noAccountMessage.innerHTML = "";
    
    // Reset input borders
    emailInput.style.borderColor = "rgba(255,255,255,0.1)";
    passwordInput.style.borderColor = "rgba(255,255,255,0.1)";
    emailInput.style.boxShadow = "none";
    passwordInput.style.boxShadow = "none";
}

// ==============================
// REDIRECT BASED ON ROLE
// ==============================
function redirectBasedOnRole(role) {
    const loginBtn = document.getElementById("loginBtn");
    const originalBtnText = loginBtn.innerHTML;
    
    // Show loading state
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
    loginBtn.disabled = true;
    
    // Show success message
    showSuccessMessage(`Welcome! Redirecting to dashboard...`);
    
    setTimeout(() => {
        switch(role) {
            case "admin":
                window.location.href = "pages/admin/dashboard.html";
                break;
            case "vendor":
                window.location.href = "pages/vendor/dashboard.html";
                break;
            case "customer":
            default:
                window.location.href = "pages/customer/dashboard.html";
                break;
        }
    }, 1500);
}

// ==============================
// SHOW SUCCESS MESSAGE
// ==============================
function showSuccessMessage(message) {
    errorMessage.style.backgroundColor = "rgba(81, 207, 102, 0.1)";
    errorMessage.style.borderLeftColor = "#51cf66";
    errorMessage.style.color = "#51cf66";
    errorMessage.style.display = "block";
    errorMessage.textContent = message;
    
    // Clear no account message if showing
    noAccountMessage.style.display = "none";
}

// ==============================
// ADD KEYBOARD SUPPORT
// ==============================
passwordInput.addEventListener("keypress", function(e) {
    if (e.key === "Enter") {
        loginForm.dispatchEvent(new Event("submit"));
    }
});