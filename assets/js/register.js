// ==============================
// ELEMENTS
// ==============================
const form = document.getElementById("registerForm");

const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const phoneInput = document.getElementById("phone");
const addressInput = document.getElementById("address");
const birthdayInput = document.getElementById("birthday");

const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");

const togglePassword = document.getElementById("togglePassword");
const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");

const termsCheckbox = document.getElementById("terms");

const errorMessage = document.getElementById("errorMessage");
const successMessage = document.getElementById("successMessage");

const registerBtn = document.getElementById("registerBtn");
const googleBtn = document.getElementById("googleBtn");


// ==============================
// PASSWORD TOGGLE (BOTH FIELDS)
// ==============================
togglePassword.addEventListener("click", () => {
    toggleInput(passwordInput, togglePassword);
});

toggleConfirmPassword.addEventListener("click", () => {
    toggleInput(confirmPasswordInput, toggleConfirmPassword);
});

function toggleInput(input, button) {
    const type = input.type === "password" ? "text" : "password";
    input.type = type;

    button.innerHTML = type === "password"
        ? '<i class="far fa-eye"></i>'
        : '<i class="far fa-eye-slash"></i>';
}


// ==============================
// FORM SUBMIT
// ==============================
form.addEventListener("submit", function (e) {
    e.preventDefault();

    clearMessages();

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();
    const address = addressInput.value.trim();
    const birthday = birthdayInput.value;
    const password = passwordInput.value.trim();
    const confirmPassword = confirmPasswordInput.value.trim();
    const termsAccepted = termsCheckbox.checked;

    // ==============================
    // VALIDATION
    // ==============================

    if (!name || !email || !phone || !address || !birthday || !password || !confirmPassword) {
        return showError("Please fill all fields");
    }

    if (!validateEmail(email)) {
        return showError("Please enter a valid email address");
    }

    if (!validatePhone(phone)) {
        return showError("Enter valid Sri Lankan phone number (07XXXXXXXX)");
    }

    if (password.length < 6) {
        return showError("Password must be at least 6 characters");
    }

    if (password !== confirmPassword) {
        return showError("Passwords do not match");
    }

    if (!termsAccepted) {
        return showError("You must agree to Terms & Conditions");
    }

    // ==============================
    // SUCCESS (TEMP)
    // ==============================

    showSuccess("Account created successfully!");

    // disable button + loading effect
    registerBtn.disabled = true;
    registerBtn.innerHTML = "Creating...";

    setTimeout(() => {
        window.location.href = "login.html";
    }, 1500);
});


// ==============================
// GOOGLE BUTTON (PLACEHOLDER)
// ==============================
googleBtn.addEventListener("click", () => {
    showSuccess("Google login will be added soon (Firebase)");
});


// ==============================
// VALIDATION HELPERS
// ==============================
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
    return /^(07[0-9]{8})$/.test(phone);
}


// ==============================
// UI FUNCTIONS
// ==============================
function showError(message) {
    errorMessage.style.display = "block";
    errorMessage.textContent = message;

    successMessage.style.display = "none";
}

function showSuccess(message) {
    successMessage.style.display = "block";
    successMessage.textContent = message;

    errorMessage.style.display = "none";
}

function clearMessages() {
    errorMessage.style.display = "none";
    successMessage.style.display = "none";

    errorMessage.textContent = "";
    successMessage.textContent = "";
}