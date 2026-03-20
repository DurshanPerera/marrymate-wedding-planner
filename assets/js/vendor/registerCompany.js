document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('companyRegisterForm');
    const registerBtn = document.getElementById('registerBtn');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    
    // Password elements
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const togglePassword = document.getElementById('togglePassword');
    const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');

    // Password visibility toggle for Password field
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

    // Password visibility toggle for Confirm Password field
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

    // Real-time password match check
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', function() {
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
    }

    // Real-time password strength indicator
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
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
    }

    function checkPasswordStrength(password) {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;
        return strength;
    }

    // Form submission
    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();

        // Get form values
        const companyName = document.getElementById('companyName').value.trim();
        const contactPerson = document.getElementById('contactPerson').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const address = document.getElementById('address').value.trim();
        const category = document.getElementById('category').value;
        const district = document.getElementById('district').value;
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        const website = document.getElementById('website').value.trim();
        const terms = document.getElementById('terms').checked;

        // Validate all fields
        if (!validateForm(companyName, contactPerson, email, phone, address, category, district, password, confirmPassword, terms)) {
            return;
        }

        // Show loading state
        const originalBtnText = registerBtn.innerHTML;
        registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
        registerBtn.disabled = true;

        // Simulate API call
        setTimeout(() => {
            // Check if email already exists (demo)
            const vendors = JSON.parse(localStorage.getItem('vendors') || '[]');
            if (vendors.some(v => v.email === email)) {
                showError('Email already registered. Please use a different email.');
                resetButton(registerBtn, originalBtnText);
                return;
            }

            // Save vendor data
            const vendorData = {
                id: Date.now(),
                type: 'company',
                companyName,
                contactPerson,
                email,
                phone,
                address,
                category,
                district,
                website: website || '',
                password: btoa(password),
                registeredAt: new Date().toISOString(),
                status: 'pending'
            };
            
            vendors.push(vendorData);
            localStorage.setItem('vendors', JSON.stringify(vendors));

            showSuccess('Registration successful! Please wait for admin approval.');
            
            setTimeout(() => {
                window.location.href = '../../login.html';
            }, 2000);
        }, 1500);
    });

    function validateForm(companyName, contactPerson, email, phone, address, category, district, password, confirmPassword, terms) {
        if (companyName.length < 2) {
            showError('Please enter your company name');
            return false;
        }
        
        if (contactPerson.length < 2) {
            showError('Please enter contact person name');
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
            showError('Please enter your business address');
            return false;
        }
        
        if (!category) {
            showError('Please select a business category');
            return false;
        }
        
        if (!district) {
            showError('Please select your district');
            return false;
        }
        
        if (password.length < 6) {
            showError('Password must be at least 6 characters long');
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

// Google Sign-In handler
function handleGoogleSignIn(response) {
    // Decode the JWT token to get user info
    const userData = parseJwt(response.credential);
    
    // Pre-fill form with Google data
    document.getElementById('contactPerson').value = userData.name || '';
    document.getElementById('email').value = userData.email || '';
    document.getElementById('email').readOnly = true;
    
    // Show success message
    showGoogleSuccess('Google sign-in successful! Please complete the remaining fields.');
    
    // Auto-fill company name from email domain (optional)
    if (userData.email) {
        const domain = userData.email.split('@')[1];
        const companyHint = domain.split('.')[0];
        if (document.getElementById('companyName').value === '') {
            document.getElementById('companyName').placeholder = `e.g., ${companyHint} (auto-detected)`;
        }
    }
}

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