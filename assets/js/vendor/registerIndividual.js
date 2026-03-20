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

    // Password visibility toggles (same as company version)
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

    // Real-time password match check
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', function() {
            const password = passwordInput.value;
            const confirmPassword = this.value;
            
            if (confirmPassword.length > 0) {
                if (password === confirmPassword) {
                    this.style.borderColor = '#51cf66';
                } else {
                    this.style.borderColor = '#ff6b6b';
                }
            } else {
                this.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }
        });
    }

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
    registerForm.addEventListener('submit', function(e) {
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

        // Simulate API call
        setTimeout(() => {
            const vendors = JSON.parse(localStorage.getItem('vendors') || '[]');
            if (vendors.some(v => v.email === email)) {
                showError('Email already registered. Please use a different email.');
                resetButton(registerBtn, originalBtnText);
                return;
            }

            const vendorData = {
                id: Date.now(),
                type: 'individual',
                fullName,
                serviceName,
                email,
                phone,
                address,
                birthday,
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