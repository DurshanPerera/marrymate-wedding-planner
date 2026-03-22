import { auth, db } from "../firebase/firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { setDoc, doc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('individualRegisterForm');
    const registerBtn = document.getElementById('registerBtn');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    
    // Password elements
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const togglePassword = document.getElementById('togglePassword');
    const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
    
    // Password requirements elements
    const passwordRequirements = document.getElementById('passwordRequirements');
    const reqLength = document.getElementById('reqLength');
    const reqUppercase = document.getElementById('reqUppercase');
    const reqLowercase = document.getElementById('reqLowercase');
    const reqNumber = document.getElementById('reqNumber');
    const reqSpecial = document.getElementById('reqSpecial');
    
    let isPasswordValid = false;

    // Password visibility toggles
    if (togglePassword) {
        togglePassword.addEventListener('click', function(e) {
            e.preventDefault();
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            const icon = this.querySelector('i');
            if (type === 'password') {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            } else {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            }
            passwordInput.focus();
        });
    }

    if (toggleConfirmPassword) {
        toggleConfirmPassword.addEventListener('click', function(e) {
            e.preventDefault();
            const type = confirmPasswordInput.type === 'password' ? 'text' : 'password';
            confirmPasswordInput.type = type;
            const icon = this.querySelector('i');
            if (type === 'password') {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            } else {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            }
            confirmPasswordInput.focus();
        });
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
            element.classList.add('valid');
            element.classList.remove('invalid');
        } else {
            element.classList.add('invalid');
            element.classList.remove('valid');
        }
    }

    // Show/hide password requirements when password field is focused
    passwordInput.addEventListener('focus', function() {
        if (passwordRequirements) {
            passwordRequirements.classList.add('show');
        }
    });

    passwordInput.addEventListener('blur', function() {
        setTimeout(() => {
            if (document.activeElement !== passwordInput && passwordRequirements) {
                passwordRequirements.classList.remove('show');
            }
        }, 200);
    });

    // Real-time password validation
    passwordInput.addEventListener('input', function() {
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
    confirmPasswordInput.addEventListener('input', function() {
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

    // Age validation from birthday
    const birthdayInput = document.getElementById('birthday');
    if (birthdayInput) {
        birthdayInput.addEventListener('change', function() {
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
    }

    // Form submission
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Get form values
        const fullName = document.getElementById('fullName').value.trim();
        const serviceName = document.getElementById('serviceName').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const address = document.getElementById('address').value.trim();
        const birthday = document.getElementById('birthday').value;
        const category = document.getElementById('category').value;
        const district = document.getElementById('district').value;
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        const website = document.getElementById('website').value.trim();
        const terms = document.getElementById('terms').checked;

        // Validate
        if (!validateForm(fullName, serviceName, email, phone, address, birthday, category, district, password, confirmPassword, terms)) {
            return;
        }

        // Show loading
        const originalBtnText = registerBtn.innerHTML;
        registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
        registerBtn.disabled = true;

        try {
            // Create Firebase Auth account
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Save individual vendor data in Firestore
            await setDoc(doc(db, "individual_vendors", user.uid), {
                uid: user.uid,
                fullName: fullName,
                serviceName: serviceName,
                email: email,
                phone: phone,
                address: address,
                birthday: birthday,
                category: category,
                district: district,
                website: website || "",
                role: "vendor",
                vendorType: "individual",
                status: "pending",
                authProvider: "password",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isActive: true
            });

            showSuccess('Registration successful! Please wait for admin approval.');
            
            setTimeout(() => {
                window.location.href = '../login.html';
            }, 2000);

        } catch (error) {
            showError(getFirebaseErrorMessage(error));
            resetButton(registerBtn, originalBtnText);
        }
    });

    function validateForm(fullName, serviceName, email, phone, address, birthday, category, district, password, confirmPassword, terms) {
        if (fullName.length < 2) {
            showError('Please enter your full name');
            return false;
        }
        
        if (serviceName.length < 2) {
            showError('Please enter your service name');
            return false;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showError('Please enter a valid email address');
            return false;
        }
        
        const phoneRegex = /^[0-9+\-\s]{10,15}$/;
        if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
            showError('Please enter a valid phone number');
            return false;
        }
        
        if (address.length < 5) {
            showError('Please enter your address');
            return false;
        }
        
        if (!birthday) {
            showError('Please select your birthday');
            return false;
        }
        
        const birthDate = new Date(birthday);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        if (age < 18) {
            showError('You must be at least 18 years old to register');
            return false;
        }
        
        if (!category) {
            showError('Please select a service category');
            return false;
        }
        
        if (!district) {
            showError('Please select your district');
            return false;
        }
        
        if (!isPasswordValid) {
            showError('Password does not meet requirements. Please check the password requirements above.');
            return false;
        }
        
        if (password !== confirmPassword) {
            showError('Passwords do not match');
            return false;
        }
        
        if (!terms) {
            showError('Please agree to the Terms of Service');
            return false;
        }
        
        return true;
    }

    function getFirebaseErrorMessage(error) {
        switch (error.code) {
            case 'auth/email-already-in-use':
                return 'Email already registered. Please use a different email.';
            case 'auth/invalid-email':
                return 'Please enter a valid email address.';
            case 'auth/weak-password':
                return 'Password is too weak.';
            case 'auth/network-request-failed':
                return 'Network error. Please check your internet connection.';
            default:
                return error.message || 'Registration failed. Please try again.';
        }
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        successMessage.style.display = 'none';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }

    function showSuccess(message) {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        errorMessage.style.display = 'none';
    }

    function resetButton(btn, originalText) {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

// Google Sign-In handler for individual
function handleGoogleSignIn(response) {
    const userData = parseJwt(response.credential);
    
    document.getElementById('fullName').value = userData.name || '';
    document.getElementById('email').value = userData.email || '';
    document.getElementById('email').readOnly = true;
    
    showGoogleSuccess('Google sign-in successful! Please complete the remaining fields.');
    
    if (userData.email && document.getElementById('serviceName').value === '') {
        const nameHint = userData.name ? userData.name.split(' ')[0] : 'Freelancer';
        document.getElementById('serviceName').placeholder = `e.g., ${nameHint}'s Services`;
    }
}

window.handleGoogleSignIn = handleGoogleSignIn;

function parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

function showGoogleSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 5000);
}