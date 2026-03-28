import { auth, db } from "../firebase/firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { setDoc, doc, collection, addDoc, writeBatch } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

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
    // IMPROVED PRODUCT SCRAPING FUNCTION - WITH BETTER ERROR HANDLING
    // ==============================
    async function triggerProductScraping(vendorId, websiteUrl, vendorType, companyName) {
        if (!websiteUrl) {
            console.log("❌ No website URL provided, skipping product scraping");
            return;
        }
        
        console.log(`\n========== PRODUCT SCRAPING STARTED ==========`);
        console.log(`📋 Vendor ID: ${vendorId}`);
        console.log(`🏢 Company: ${companyName}`);
        console.log(`🔗 URL: ${websiteUrl}`);
        console.log(`📁 Type: ${vendorType}`);
        
        try {
            // Call the scraping server
            console.log(`📡 Sending request to scraping API...`);
            const response = await fetch('http://localhost:3000/api/scrape-products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    url: websiteUrl, 
                    vendorId: vendorId, 
                    vendorType: vendorType 
                })
            });
            
            console.log(`📡 Response status: ${response.status}`);
            
            const result = await response.json();
            console.log(`📦 API Response:`, JSON.stringify(result, null, 2));
            
            if (result.success && result.products && result.products.length > 0) {
                console.log(`\n✅ Found ${result.products.length} products/services for vendor ${vendorId}`);
                
                // Log sample product
                if (result.products[0]) {
                    console.log(`\n🔍 Sample product/service:`);
                    console.log(`   Title: ${result.products[0].title}`);
                    console.log(`   Price: ${result.products[0].price}`);
                    console.log(`   Price Number: ${result.products[0].priceNumber}`);
                    console.log(`   Images: ${result.products[0].images?.length || 0}`);
                }
                
                // Use a separate products collection
                const productsCollection = collection(db, "products");
                
                let savedCount = 0;
                let failedProducts = [];
                
                for (let i = 0; i < result.products.length; i++) {
                    const product = result.products[i];
                    try {
                        // Validate product data
                        if (!product.title || product.title.trim() === "") {
                            console.log(`   ⚠️ Product ${i+1} skipped: No title`);
                            failedProducts.push({ index: i, reason: "No title" });
                            continue;
                        }
                        
                        if (!product.priceNumber || product.priceNumber <= 0) {
                            console.log(`   ⚠️ Product ${i+1} skipped: Invalid price (${product.priceNumber})`);
                            failedProducts.push({ index: i, reason: "Invalid price" });
                            continue;
                        }
                        
                        if (!product.images || product.images.length === 0) {
                            console.log(`   ⚠️ Product ${i+1} skipped: No images`);
                            failedProducts.push({ index: i, reason: "No images" });
                            continue;
                        }
                        
                        const productData = {
                            vendorId: vendorId,
                            vendorType: vendorType,
                            vendorName: companyName,
                            title: product.title.substring(0, 200),
                            description: product.description ? product.description.substring(0, 500) : `${product.title} - Available for your special day.`,
                            price: product.price || `LKR ${product.priceNumber.toLocaleString()}`,
                            priceNumber: product.priceNumber,
                            images: Array.isArray(product.images) ? product.images.filter(img => img && img.startsWith('http')).slice(0, 5) : [],
                            scrapedAt: new Date().toISOString(),
                            status: "active",
                            isActive: true,
                            source: "web_scraping",
                            createdAt: new Date().toISOString()
                        };
                        
                        console.log(`   💾 Saving product ${i+1}/${result.products.length}: ${productData.title.substring(0, 50)}...`);
                        const docRef = await addDoc(productsCollection, productData);
                        console.log(`   ✅ Saved with ID: ${docRef.id}`);
                        savedCount++;
                        
                    } catch (productError) {
                        console.error(`   ❌ Error saving product ${i+1}: ${product.title}`, productError);
                        failedProducts.push({ index: i, reason: productError.message });
                    }
                }
                
                console.log(`\n📊 Summary: ${savedCount}/${result.products.length} products saved successfully`);
                if (failedProducts.length > 0) {
                    console.log(`⚠️ Failed products: ${failedProducts.length}`);
                }
                
                // Update vendor document with scraping info
                const vendorRef = doc(db, `${vendorType}_vendors`, vendorId);
                await setDoc(vendorRef, {
                    productsScrapedAt: new Date().toISOString(),
                    productsCount: savedCount,
                    productScrapingStatus: savedCount > 0 ? "completed" : "no_valid_products",
                    lastProductUpdate: new Date().toISOString(),
                    productsFound: result.products.length,
                    productsSaved: savedCount,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
                
                console.log(`✅ Updated vendor document with product count: ${savedCount}`);
                
            } else if (result.success && (!result.products || result.products.length === 0)) {
                console.log(`⚠️ No products found for vendor ${vendorId}`);
                console.log(`   Response message: ${result.message || 'No products with prices found'}`);
                
                const vendorRef = doc(db, `${vendorType}_vendors`, vendorId);
                await setDoc(vendorRef, {
                    productScrapingStatus: "no_products_found",
                    productsCount: 0,
                    scrapingMessage: result.message || "No products with valid prices found",
                    lastProductUpdate: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }, { merge: true });
                
            } else {
                console.log(`❌ Scraping failed for vendor ${vendorId}:`, result.error);
                const vendorRef = doc(db, `${vendorType}_vendors`, vendorId);
                await setDoc(vendorRef, {
                    productScrapingStatus: "failed",
                    scrapingError: result.error || "Unknown error",
                    lastProductUpdate: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            }
            
            console.log(`========== PRODUCT SCRAPING END ==========\n`);
            
        } catch (error) {
            console.error("❌ CRITICAL ERROR in product scraping:", error);
            console.error("Error details:", error.message);
            
            try {
                const vendorRef = doc(db, `${vendorType}_vendors`, vendorId);
                await setDoc(vendorRef, {
                    productScrapingStatus: "failed",
                    scrapingError: error.message,
                    lastProductUpdate: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
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

    // ==============================
    // FORM SUBMISSION - WITH AWAIT
    // ==============================
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

            console.log(`✅ User created: ${user.uid}`);

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

            console.log(`✅ Vendor data saved to Firestore`);

            showSuccess('Registration successful! Please wait for admin approval.');
            
            // Trigger product scraping in the background - IMPORTANT: ADDED AWAIT
            if (website) {
                console.log(`📡 Triggering product scraping for vendor: ${companyName}`);
                await triggerProductScraping(user.uid, website, "company", companyName);
                console.log(`✅ Product scraping completed for vendor: ${companyName}`);
            } else {
                console.log(`⚠️ No website provided, skipping product scraping`);
            }
            
            // Redirect after 3 seconds to allow scraping to complete
            setTimeout(() => {
                window.location.href = '../login.html';
            }, 3000);

        } catch (error) {
            console.error("Registration error:", error);
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
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 5000);
}