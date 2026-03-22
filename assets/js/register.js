import { auth, db } from "./firebase/firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { setDoc, doc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

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

// Password requirements elements
const passwordRequirements = document.getElementById("passwordRequirements");
const reqLength = document.getElementById("reqLength");
const reqUppercase = document.getElementById("reqUppercase");
const reqLowercase = document.getElementById("reqLowercase");
const reqNumber = document.getElementById("reqNumber");
const reqSpecial = document.getElementById("reqSpecial");

let isPasswordValid = false;

// ==============================
// PASSWORD TOGGLE
// ==============================
if (togglePassword) {
    togglePassword.addEventListener("click", () => {
        toggleInput(passwordInput, togglePassword);
    });
}

if (toggleConfirmPassword) {
    toggleConfirmPassword.addEventListener("click", () => {
        toggleInput(confirmPasswordInput, toggleConfirmPassword);
    });
}

function toggleInput(input, button) {
    const type = input.type === "password" ? "text" : "password";
    input.type = type;

    button.innerHTML = type === "password"
        ? '<i class="far fa-eye"></i>'
        : '<i class="far fa-eye-slash"></i>';
}

// ==============================
// PASSWORD STRENGTH & VALIDATION
// ==============================
function checkPasswordRequirements(password) {
    const hasLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    updateRequirement(reqLength, hasLength);
    updateRequirement(reqUppercase, hasUppercase);
    updateRequirement(reqLowercase, hasLowercase);
    updateRequirement(reqNumber, hasNumber);
    updateRequirement(reqSpecial, hasSpecial);
    
    return hasLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;
}

function updateRequirement(element, isValid) {
    if (isValid) {
        element.classList.add("valid");
        element.classList.remove("invalid");
    } else {
        element.classList.add("invalid");
        element.classList.remove("valid");
    }
}

// Show/hide password requirements when password field is focused
passwordInput.addEventListener("focus", function() {
    if (passwordRequirements) {
        passwordRequirements.classList.add("show");
    }
});

passwordInput.addEventListener("blur", function() {
    setTimeout(() => {
        if (document.activeElement !== passwordInput && passwordRequirements) {
            passwordRequirements.classList.remove("show");
        }
    }, 200);
});

// Real-time password validation
passwordInput.addEventListener("input", function() {
    const password = this.value;
    const isValid = checkPasswordRequirements(password);
    isPasswordValid = isValid;
    
    if (password.length > 0) {
        if (isValid) {
            this.style.borderColor = '#51cf66';
            this.style.boxShadow = '0 0 10px rgba(81, 207, 102, 0.3)';
        } else {
            this.style.borderColor = '#ff6b6b';
            this.style.boxShadow = '0 0 10px rgba(255, 107, 107, 0.3)';
        }
    } else {
        this.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        this.style.boxShadow = 'none';
    }
    
    if (confirmPasswordInput.value.length > 0) {
        if (password === confirmPasswordInput.value && isValid) {
            confirmPasswordInput.style.borderColor = '#51cf66';
        } else if (confirmPasswordInput.value.length > 0) {
            confirmPasswordInput.style.borderColor = '#ff6b6b';
        }
    }
});

// Confirm password validation
confirmPasswordInput.addEventListener("input", function() {
    const password = passwordInput.value;
    const confirmPassword = this.value;
    
    if (confirmPassword.length > 0) {
        if (password === confirmPassword && isPasswordValid) {
            this.style.borderColor = '#51cf66';
            this.style.boxShadow = '0 0 10px rgba(81, 207, 102, 0.3)';
        } else {
            this.style.borderColor = '#ff6b6b';
            this.style.boxShadow = '0 0 10px rgba(255, 107, 107, 0.3)';
        }
    } else {
        this.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        this.style.boxShadow = 'none';
    }
});

// ==============================
// AGE VALIDATION
// ==============================
birthdayInput.addEventListener("change", function () {
    const birthDate = new Date(this.value);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    if (age < 18 && this.value) {
        showError("You must be at least 18 years old");
        this.value = "";
    }
});

// ==============================
// FORM SUBMIT (FIREBASE)
// ==============================
form.addEventListener("submit", async function (e) {
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
        return showError("Invalid email");
    }

    if (!validatePhone(phone)) {
        return showError("Enter valid Sri Lankan phone number");
    }

    if (!isPasswordValid) {
        return showError("Password does not meet requirements. Please check the password requirements above.");
    }

    if (password !== confirmPassword) {
        return showError("Passwords do not match");
    }

    if (!termsAccepted) {
        return showError("Accept Terms & Conditions");
    }

    // ==============================
    // FIREBASE
    // ==============================
    try {
        registerBtn.disabled = true;
        registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            fullName: name,
            email: email,
            phone: phone,
            address: address,
            birthday: birthday,
            role: "customer",
            authProvider: "password",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isActive: true
        });

        showSuccess("Account created successfully!");

        setTimeout(() => {
            window.location.href = "login.html";
        }, 1500);

    } catch (error) {
        showError(getFirebaseError(error));
        registerBtn.disabled = false;
        registerBtn.innerHTML = '<span>Create Account</span><i class="fas fa-arrow-right"></i>';
    }
});

// ==============================
// GOOGLE BUTTON (PLACEHOLDER)
// ==============================
if (googleBtn) {
    googleBtn.addEventListener("click", () => {
        showSuccess("Google login will be added soon (Firebase)");
    });
}

// ==============================
// VALIDATION HELPERS
// ==============================
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
    return /^(07[0-9]{8})$/.test(phone);
}

function getFirebaseError(error) {
    switch (error.code) {
        case "auth/email-already-in-use":
            return "Email already registered";
        case "auth/invalid-email":
            return "Invalid email";
        case "auth/weak-password":
            return "Weak password";
        default:
            return error.message;
    }
}

// ==============================
// UI FUNCTIONS
// ==============================
function showError(message) {
    errorMessage.style.display = "block";
    errorMessage.textContent = message;
    successMessage.style.display = "none";
    
    setTimeout(() => {
        errorMessage.style.display = "none";
    }, 5000);
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