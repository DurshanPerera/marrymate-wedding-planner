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

// Google Sign-In configuration
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"; // Replace with your actual client ID

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
// REAL-TIME PASSWORD VALIDATION
// ==============================
// Password strength indicator
passwordInput.addEventListener("input", function() {
    const password = this.value;
    const strength = checkPasswordStrength(password);
    
    if (password.length > 0) {
        if (strength >= 4) {
            this.style.borderColor = '#51cf66';
            this.style.boxShadow = '0 0 10px rgba(81, 207, 102, 0.3)';
        } else if (strength >= 2) {
            this.style.borderColor = '#FFD700';
            this.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.3)';
        } else {
            this.style.borderColor = '#ff6b6b';
            this.style.boxShadow = '0 0 10px rgba(255, 107, 107, 0.3)';
        }
    } else {
        this.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        this.style.boxShadow = 'none';
    }
});

// Real-time password match check
confirmPasswordInput.addEventListener("input", function() {
    const password = passwordInput.value;
    const confirmPassword = this.value;
    
    if (confirmPassword.length > 0) {
        if (password === confirmPassword) {
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

// Birthday age validation
birthdayInput.addEventListener("change", function() {
    const birthDate = new Date(this.value);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    if (age < 18 && this.value) {
        showError('You must be at least 18 years old to register');
        this.value = '';
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
    
    // Password strength check
    const strength = checkPasswordStrength(password);
    if (strength < 2) {
        return showError("Password is too weak. Use at least 6 characters with uppercase, lowercase, and numbers");
    }

    if (!termsAccepted) {
        return showError("You must agree to Terms & Conditions");
    }

    // Age validation (double-check)
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    if (age < 18) {
        return showError("You must be at least 18 years old to register");
    }

    // Check if email already exists
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    if (users.some(u => u.email === email)) {
        return showError("Email already registered. Please use a different email or login.");
    }

    // ==============================
    // SUCCESS - SAVE TO LOCALSTORAGE
    // ==============================

    showSuccess("Account created successfully! Redirecting to login...");

    // Save user data
    const userData = {
        id: Date.now(),
        name: name,
        email: email,
        phone: phone,
        address: address,
        birthday: birthday,
        password: btoa(password), // Simple encoding (don't use in production)
        registeredAt: new Date().toISOString(),
        role: 'customer'
    };
    
    users.push(userData);
    localStorage.setItem('users', JSON.stringify(users));

    // disable button + loading effect
    registerBtn.disabled = true;
    registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';

    setTimeout(() => {
        window.location.href = "login.html";
    }, 2000);
});

// ==============================
// GOOGLE SIGN-IN FUNCTIONALITY
// ==============================
async function handleGoogleSignIn(response) {
    try {
        // Decode the JWT token to get user info
        const userData = parseJwt(response.credential);
        
        // Pre-fill the form with Google data
        nameInput.value = userData.name || '';
        emailInput.value = userData.email || '';
        emailInput.readOnly = true; // Make email read-only since it's from Google
        
        // Auto-generate a random password for Google sign-in users
        const randomPassword = generateRandomPassword();
        passwordInput.value = randomPassword;
        confirmPasswordInput.value = randomPassword;
        
        // Add visual feedback for auto-filled fields
        nameInput.style.borderColor = '#51cf66';
        emailInput.style.borderColor = '#51cf66';
        passwordInput.style.borderColor = '#51cf66';
        confirmPasswordInput.style.borderColor = '#51cf66';
        
        // Show success message
        showSuccess('Google sign-in successful! Please complete your registration.');
        
        // Auto-fill birthday hint (if available)
        if (userData.birthday) {
            birthdayInput.value = userData.birthday;
        }
        
        // Scroll to the form to show user what was filled
        nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
    } catch (error) {
        console.error('Google sign-in error:', error);
        showError('Google sign-in failed. Please try again or register manually.');
    }
}

// Parse JWT token from Google
function parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

// Generate a random password for Google sign-in users
function generateRandomPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// Initialize Google Sign-In button
function initGoogleSignIn() {
    googleBtn.addEventListener("click", () => {
        // Show loading state
        const originalBtnText = googleBtn.innerHTML;
        googleBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting to Google...';
        googleBtn.disabled = true;
        
        // Initialize Google One Tap or redirect
        // Note: For full functionality, you need to set up Google Identity Services
        // with your actual client ID. This is a placeholder that opens Google Sign-In.
        
        // For demo purposes, show a message about setting up Google Sign-In
        setTimeout(() => {
            showInfo('Google Sign-In requires a Google Cloud Console project. Please register manually for now, or contact the developer to set up Google Sign-In.');
            googleBtn.innerHTML = originalBtnText;
            googleBtn.disabled = false;
        }, 1000);
    });
}

// Alternative: If you have a Google Client ID configured, use this:
// Initialize Google Sign-In with the official library
function initGoogleSignInWithLibrary() {
    // This would be used if you have a valid Google Client ID
    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleSignIn,
        auto_select: false,
        cancel_on_tap_outside: true
    });
    
    google.accounts.id.renderButton(
        googleBtn,
        { 
            theme: 'outline', 
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left'
        }
    );
    
    // Override the click event since the button is now managed by Google
    googleBtn.onclick = null;
}

// Show info message
function showInfo(message) {
    errorMessage.style.backgroundColor = 'rgba(255, 215, 0, 0.2)';
    errorMessage.style.borderColor = '#FFD700';
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    setTimeout(() => {
        errorMessage.style.display = 'none';
        errorMessage.style.backgroundColor = '';
        errorMessage.style.borderColor = '';
    }, 5000);
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

// ==============================
// UI FUNCTIONS
// ==============================
function showError(message) {
    errorMessage.style.display = "block";
    errorMessage.textContent = message;
    errorMessage.style.backgroundColor = 'rgba(255, 75, 75, 0.1)';
    errorMessage.style.borderLeft = '3px solid #ff6b6b';
    successMessage.style.display = "none";
    
    // Auto-hide after 5 seconds
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

// ==============================
// INITIALIZATION
// ==============================
// Initialize Google Sign-In button (choose one method)
// Method 1: Simple placeholder button (current)
initGoogleSignIn();

// Method 2: If you have a Google Client ID, uncomment this and comment the above
// initGoogleSignInWithLibrary();

// Check if user already has any saved data (optional)
document.addEventListener('DOMContentLoaded', function() {
    // Add any initial setup here
    console.log('Registration page loaded');
});