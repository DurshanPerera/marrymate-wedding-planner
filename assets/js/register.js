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
// PASSWORD STRENGTH
// ==============================
passwordInput.addEventListener("input", function () {
    const password = this.value;
    const strength = checkPasswordStrength(password);

    if (password.length > 0) {
        if (strength >= 4) {
            this.style.borderColor = '#51cf66';
        } else if (strength >= 2) {
            this.style.borderColor = '#FFD700';
        } else {
            this.style.borderColor = '#ff6b6b';
        }
    }
});

confirmPasswordInput.addEventListener("input", function () {
    const password = passwordInput.value;

    if (this.value.length > 0) {
        if (password === this.value) {
            this.style.borderColor = '#51cf66';
        } else {
            this.style.borderColor = '#ff6b6b';
        }
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

function checkPasswordStrength(password) {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
}

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

    if (password.length < 6) {
        return showError("Password must be at least 6 characters");
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
        registerBtn.innerHTML = "Creating...";

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            name,
            email,
            phone,
            address,
            birthday,
            role: "customer",
            createdAt: new Date().toISOString()
        });

        showSuccess("Account created successfully!");

        setTimeout(() => {
            window.location.href = "login.html";
        }, 1500);

    } catch (error) {
        showError(getFirebaseError(error));
        registerBtn.disabled = false;
        registerBtn.innerHTML = "Register";
    }
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
// UI
// ==============================
function showError(message) {
    errorMessage.style.display = "block";
    errorMessage.textContent = message;
}

function showSuccess(message) {
    successMessage.style.display = "block";
    successMessage.textContent = message;
}

function clearMessages() {
    errorMessage.style.display = "none";
    successMessage.style.display = "none";
}