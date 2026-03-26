import { auth, db } from "../firebase/firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { setDoc, doc, collection, addDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

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
    
    // Password requirements elements
    const passwordRequirements = document.getElementById('passwordRequirements');
    const reqLength = document.getElementById('reqLength');
    const reqUppercase = document.getElementById('reqUppercase');
    const reqLowercase = document.getElementById('reqLowercase');
    const reqNumber = document.getElementById('reqNumber');
    const reqSpecial = document.getElementById('reqSpecial');
    
    let isPasswordValid = false;

    // ==============================
    // AI AUTO-FILL LOGIC
    // ==============================
    const autoFillBtn = document.getElementById('autoFillBtn');
    const aiStatusMessage = document.getElementById('aiStatusMessage');
    let aiExtractedDescription = "";
    let aiExtractedImage = "";

    if (autoFillBtn) {
        autoFillBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            const websiteUrl = document.getElementById('website').value.trim();

            if (!websiteUrl) {
                alert("Please enter a website URL first!");
                return;
            }

            const originalText = autoFillBtn.innerHTML;
            autoFillBtn.innerHTML = '⏳ AI is reading website... please wait...';
            autoFillBtn.disabled = true;
            aiStatusMessage.style.display = 'none';

            try {
                const response = await fetch('http://localhost:3000/api/extract-vendor', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: websiteUrl })
                });

                const result = await response.json();

                if (result.success) {
                    const aiData = result.data;
                    
                    if(aiData.companyName) document.getElementById('companyName').value = aiData.companyName;
                    if(aiData.contactPerson) document.getElementById('contactPerson').value = aiData.contactPerson;
                    if(aiData.phone) document.getElementById('phone').value = aiData.phone;
                    if(aiData.email) document.getElementById('email').value = aiData.email;
                    if(aiData.address) document.getElementById('address').value = aiData.address;
                    
                    if(aiData.category) {
                        const categorySelect = document.getElementById('category');
                        for (let i = 0; i < categorySelect.options.length; i++) {
                            if (categorySelect.options[i].text.toLowerCase().includes(aiData.category.toLowerCase())) {
                                categorySelect.selectedIndex = i;
                                break;
                            }
                        }
                    }

                    if(result.imageUrl) {
                        aiExtractedImage = result.imageUrl;
                        console.log("🖼️ AI captured profile picture:", aiExtractedImage);
                    }

                    if(aiData.description) {
                        aiExtractedDescription = aiData.description;
                    }

                    aiStatusMessage.textContent = "✨ AI successfully filled your details!";
                    aiStatusMessage.style.display = 'block';

                } else {
                    alert("AI could not read the website. Some sites block automated tools.");
                }
            } catch (error) {
                console.error("AI Error:", error);
                alert("Backend server is not running! Make sure you typed 'node server.js' in the terminal.");
            } finally {
                autoFillBtn.innerHTML = originalText;
                autoFillBtn.disabled = false;
            }
        });
    }

    // ==============================
    // PRODUCT SCRAPING FUNCTION - SEPARATE COLLECTION
    // ==============================
    async function triggerProductScraping(vendorId, websiteUrl, vendorType, companyName) {
        if (!websiteUrl) {
            console.log("No website URL provided, skipping product scraping");
            return;
        }
        
        console.log(`🔄 Starting product scraping for ${vendorId} (${companyName}) at ${websiteUrl}`);
        
        try {
            // Call the scraping server
            const response = await fetch('http://localhost:3000/api/scrape-products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    url: websiteUrl, 
                    vendorId: vendorId, 
                    vendorType: vendorType 
                })
            });
            
            const result = await response.json();
            console.log("Scraping API response:", result);
            
            if (result.success && result.products && result.products.length > 0) {
                console.log(`✅ Found ${result.products.length} products for vendor ${vendorId}`);
                
                // Use a separate products collection (not subcollection)
                const productsCollection = collection(db, "products");
                
                let savedCount = 0;
                for (const product of result.products) {
                    try {
                        const productData = {
                            vendorId: vendorId,
                            vendorType: vendorType,
                            vendorName: companyName,
                            title: product.title || "Untitled Product",
                            description: product.description || "",
                            price: product.price || "Price on request",
                            priceNumber: product.priceNumber || null,
                            images: product.images || [],
                            scrapedAt: new Date().toISOString(),
                            status: "active",
                            isActive: true,
                            source: "web_scraping"
                        };
                        
                        await addDoc(productsCollection, productData);
                        savedCount++;
                        console.log(`   ✅ Saved product: ${productData.title.substring(0, 50)}...`);
                    } catch (productError) {
                        console.error(`   ❌ Error saving product: ${product.title}`, productError);
                    }
                }
                
                console.log(`✅ Successfully stored ${savedCount}/${result.products.length} products in 'products' collection for vendor ${vendorId}`);
                
                // Update vendor document with scraping info
                const vendorRef = doc(db, `${vendorType}_vendors`, vendorId);
                await setDoc(vendorRef, {
                    productsScrapedAt: new Date().toISOString(),
                    productsCount: savedCount,
                    productScrapingStatus: "completed",
                    lastProductUpdate: new Date().toISOString()
                }, { merge: true });
                
                console.log(`✅ Updated vendor document with product count: ${savedCount}`);
                
            } else if (result.success && (!result.products || result.products.length === 0)) {
                console.log(`⚠️ No products found for vendor ${vendorId}`);
                const vendorRef = doc(db, `${vendorType}_vendors`, vendorId);
                await setDoc(vendorRef, {
                    productScrapingStatus: "no_products_found",
                    productsCount: 0,
                    lastProductUpdate: new Date().toISOString()
                }, { merge: true });
            } else {
                console.log(`❌ Scraping failed for vendor ${vendorId}:`, result.error);
                const vendorRef = doc(db, `${vendorType}_vendors`, vendorId);
                await setDoc(vendorRef, {
                    productScrapingStatus: "failed",
                    scrapingError: result.error || "Unknown error",
                    lastProductUpdate: new Date().toISOString()
                }, { merge: true });
            }
            
        } catch (error) {
            console.error("❌ Error in product scraping:", error);
            // Update vendor with error status
            try {
                const vendorRef = doc(db, `${vendorType}_vendors`, vendorId);
                await setDoc(vendorRef, {
                    productScrapingStatus: "failed",
                    scrapingError: error.message,
                    lastProductUpdate: new Date().toISOString()
                }, { merge: true });
            } catch (dbError) {
                console.error("Failed to update vendor status:", dbError);
            }
        }
    }

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

    // Form submission
    registerForm.addEventListener('submit', async function(e) {
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

        try {
            // Create Firebase Auth account
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Save company vendor data in Firestore
            await setDoc(doc(db, "company_vendors", user.uid), {
                uid: user.uid,
                companyName: companyName,
                contactPerson: contactPerson,
                email: email,
                phone: phone,
                address: address,
                category: category,
                district: district,
                website: website || "",
                description: aiExtractedDescription || "",
                profilePicture: aiExtractedImage || "",
                role: "vendor",
                vendorType: "company",
                status: "pending",
                authProvider: "password",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isActive: true,
                productScrapingStatus: "pending"
            });

            showSuccess('Registration successful! Please wait for admin approval.');
            
            // Trigger product scraping in the background
            if (website) {
                triggerProductScraping(user.uid, website, "company", companyName);
            }
            
            setTimeout(() => {
                window.location.href = '../login.html';
            }, 2000);

        } catch (error) {
            showError(getFirebaseErrorMessage(error));
            resetButton(registerBtn, originalBtnText);
        }
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

// Google Sign-In handler
function handleGoogleSignIn(response) {
    const userData = parseJwt(response.credential);
    
    document.getElementById('contactPerson').value = userData.name || '';
    document.getElementById('email').value = userData.email || '';
    document.getElementById('email').readOnly = true;
    
    showGoogleSuccess('Google sign-in successful! Please complete the remaining fields.');
    
    if (userData.email) {
        const domain = userData.email.split('@')[1];
        const companyHint = domain.split('.')[0];
        if (document.getElementById('companyName').value === '') {
            document.getElementById('companyName').placeholder = `e.g., ${companyHint} (auto-detected)`;
        }
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
    setTimeout(() => {s
        successDiv.style.display = 'none';
    }, 5000);
}