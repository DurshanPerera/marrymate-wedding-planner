// DOM Elements
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const errorMessage = document.getElementById("errorMessage");


// ==============================
// 🔐 PASSWORD TOGGLE
// ==============================
togglePassword.addEventListener("click", () => {
    const type = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = type;

    togglePassword.innerHTML = type === "password"
        ? '<i class="far fa-eye"></i>'
        : '<i class="far fa-eye-slash"></i>';
});


// ==============================
// LOGIN HANDLER
// ==============================
loginForm.addEventListener("submit", function (e) {
    e.preventDefault();

    clearError();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        showError("Please enter email and password");
        return;
    }

    handleLogin(email, password);
});


// ==============================
// ROLE LOGIC
// ==============================
function handleLogin(email, password) {

    // ADMIN
    if (email === "admin@gmail.com" && password === "admin123") {
        redirect("pages/admin/dashboard.html");
        return;
    }

    // CUSTOMER
    if (email === "customer@gmail.com" && password === "1234") {
        redirect("pages/customer/dashboard.html");
        return;
    }

    // VENDOR
    if (email === "vendor@gmail.com" && password === "1234") {
        redirect("pages/vendor/dashboard.html");
        return;
    }

    // ERROR
    showError("Invalid email or password");
}


// ==============================
// UI FUNCTIONS
// ==============================
function showError(message) {
    errorMessage.style.display = "block";
    errorMessage.textContent = message;

    passwordInput.style.border = "2px solid #ff4d4d";
}

function clearError() {
    errorMessage.style.display = "none";
    errorMessage.textContent = "";

    passwordInput.style.border = "2px solid rgba(255,255,255,0.1)";
}

function redirect(path) {
    window.location.href = path;
}