import { auth, db } from "./firebase/firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// ==============================
// DOM ELEMENTS
// ==============================
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const errorMessage = document.getElementById("errorMessage");
const noAccountMessage = document.getElementById("noAccountMessage");
const loginBtn = document.getElementById("loginBtn");

// ==============================
// HARDCODED ADMIN
// ==============================
const ADMIN_EMAIL = "admin@gmail.com";
const ADMIN_PASSWORD = "admin123";

// ==============================
// PASSWORD TOGGLE
// ==============================
if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", (e) => {
        e.preventDefault();

        const type = passwordInput.type === "password" ? "text" : "password";
        passwordInput.type = type;

        togglePassword.innerHTML =
            type === "password"
                ? '<i class="far fa-eye"></i>'
                : '<i class="far fa-eye-slash"></i>';
    });
}

// ==============================
// INPUT EVENTS
// ==============================
if (emailInput) {
    emailInput.addEventListener("input", () => {
        clearMessages();
        resetInputStyles();
    });
}

if (passwordInput) {
    passwordInput.addEventListener("input", () => {
        clearMessages();
        resetInputStyles();
    });

    passwordInput.addEventListener("keypress", function (e) {
        if (e.key === "Enter" && loginForm) {
            loginForm.dispatchEvent(new Event("submit"));
        }
    });
}

// ==============================
// LOGIN HANDLER
// ==============================
if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        clearMessages();
        resetInputStyles();

        const email = emailInput.value.trim().toLowerCase();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            showError("Please enter both email and password");
            highlightEmptyFields(email, password);
            return;
        }

        if (!validateEmail(email)) {
            showError("Please enter a valid email address");
            emailInput.style.borderColor = "#ff6b6b";
            emailInput.style.boxShadow = "0 0 10px rgba(255, 107, 107, 0.3)";
            return;
        }

        if (password.length < 6 && !(email === ADMIN_EMAIL && password === ADMIN_PASSWORD)) {
            showError("Password must be at least 6 characters");
            passwordInput.style.borderColor = "#ff6b6b";
            passwordInput.style.boxShadow = "0 0 10px rgba(255, 107, 107, 0.3)";
            return;
        }

        setLoadingState(true);

        try {
            // ==============================
            // ADMIN LOGIN
            // ==============================
            if (email === ADMIN_EMAIL) {
                if (password !== ADMIN_PASSWORD) {
                    showError("Incorrect email or password. Please try again.");
                    passwordInput.style.borderColor = "#ff6b6b";
                    passwordInput.style.boxShadow = "0 0 10px rgba(255, 107, 107, 0.3)";
                    setLoadingState(false);
                    return;
                }

                showSuccessMessage("Welcome Admin! Redirecting to dashboard...");
                setTimeout(() => {
                    window.location.href = "../admin/dashboard.html";
                }, 1500);
                return;
            }

            // ==============================
            // STEP 1: CHECK WHETHER EMAIL EXISTS
            // ==============================
            const emailExists = await findUserByEmail(email);

            if (!emailExists.exists) {
                showNoAccountMessage(email);
                emailInput.style.borderColor = "#ffc107";
                emailInput.style.boxShadow = "0 0 10px rgba(255, 193, 7, 0.3)";
                passwordInput.value = "";
                setLoadingState(false);
                return;
            }

            // ==============================
            // STEP 2: LOGIN WITH FIREBASE AUTH
            // ==============================
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // ==============================
            // FIND USER ROLE FROM FIRESTORE
            // ==============================
            let userRole = null;
            let userData = null;

            const customerDoc = await getDoc(doc(db, "users", user.uid));
            if (customerDoc.exists()) {
                userData = customerDoc.data();
                userRole = userData.role;
            } else {
                const companyVendorDoc = await getDoc(doc(db, "company_vendors", user.uid));
                if (companyVendorDoc.exists()) {
                    userData = companyVendorDoc.data();
                    if (userData.role === "vendor" && userData.vendorType === "company") {
                        userRole = "vendor_company";
                    }
                } else {
                    const individualVendorDoc = await getDoc(doc(db, "individual_vendors", user.uid));
                    if (individualVendorDoc.exists()) {
                        userData = individualVendorDoc.data();
                        if (userData.role === "vendor" && userData.vendorType === "individual") {
                            userRole = "vendor_individual";
                        }
                    }
                }
            }

            if (!userRole) {
                showNoAccountMessage(email);
                setLoadingState(false);
                return;
            }

            if (userData && userData.isActive === false) {
                showError("Your account is currently inactive. Please contact support.");
                setLoadingState(false);
                return;
            }

            redirectBasedOnRole(userRole);

        } catch (error) {
            handleFirebaseLoginError(error);
            setLoadingState(false);
        }
    });
}

// ==============================
// CHECK EMAIL IN FIRESTORE
// ==============================
async function findUserByEmail(email) {
    const collectionsToCheck = ["users", "company_vendors", "individual_vendors"];

    for (const collectionName of collectionsToCheck) {
        const q = query(collection(db, collectionName), where("email", "==", email));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            return {
                exists: true,
                collection: collectionName,
                data: snapshot.docs[0].data()
            };
        }
    }

    return {
        exists: false,
        collection: null,
        data: null
    };
}

// ==============================
// VALIDATION HELPERS
// ==============================
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function highlightEmptyFields(email, password) {
    if (!email && emailInput) {
        emailInput.style.borderColor = "#ff6b6b";
        emailInput.style.boxShadow = "0 0 10px rgba(255, 107, 107, 0.3)";
    }

    if (!password && passwordInput) {
        passwordInput.style.borderColor = "#ff6b6b";
        passwordInput.style.boxShadow = "0 0 10px rgba(255, 107, 107, 0.3)";
    }
}

function resetInputStyles() {
    if (emailInput) {
        emailInput.style.borderColor = "rgba(255,255,255,0.1)";
        emailInput.style.boxShadow = "none";
    }

    if (passwordInput) {
        passwordInput.style.borderColor = "rgba(255,255,255,0.1)";
        passwordInput.style.boxShadow = "none";
    }
}

// ==============================
// FIREBASE ERROR HANDLING
// ==============================
function handleFirebaseLoginError(error) {
    switch (error.code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
            showError("Incorrect email or password. Please try again.");
            passwordInput.style.borderColor = "#ff6b6b";
            passwordInput.style.boxShadow = "0 0 10px rgba(255, 107, 107, 0.3)";
            break;

        case "auth/invalid-email":
            showError("Please enter a valid email address.");
            emailInput.style.borderColor = "#ff6b6b";
            emailInput.style.boxShadow = "0 0 10px rgba(255, 107, 107, 0.3)";
            break;

        case "auth/too-many-requests":
            showError("Too many login attempts. Please try again later.");
            break;

        case "auth/network-request-failed":
            showError("Network error. Please check your internet connection.");
            break;

        default:
            showError(error.message || "Login failed. Please try again.");
            break;
    }
}

// ==============================
// REDIRECT BASED ON ROLE
// ==============================
function redirectBasedOnRole(role) {
    if (role === "customer") {
        showSuccessMessage("Welcome! Redirecting to customer dashboard...");
        setTimeout(() => {
            window.location.href = "customer/dashboard.html";
        }, 1500);
        return;
    }

    if (role === "vendor_company") {
        showSuccessMessage("Welcome! Redirecting to company vendor dashboard...");
        setTimeout(() => {
            window.location.href = "vendor/company/dashboardCompany.html";
        }, 1500);
        return;
    }

    if (role === "vendor_individual") {
        showSuccessMessage("Welcome! Redirecting to individual vendor dashboard...");
        setTimeout(() => {
            window.location.href = "vendor/individual/dashboardIndividual.html";
        }, 1500);
        return;
    }

    showError("Invalid role detected.");
    setLoadingState(false);
}

// ==============================
// UI FUNCTIONS
// ==============================
function showNoAccountMessage(email) {
    if (!noAccountMessage) return;

    noAccountMessage.innerHTML = `
        <i class="fas fa-info-circle" style="margin-right: 8px;"></i>
        No account found with "${email}". Please create an account before logging in.
    `;
    noAccountMessage.style.display = "block";

    if (errorMessage) {
        errorMessage.style.display = "none";
    }
}

function showError(message) {
    if (!errorMessage) return;

    errorMessage.style.display = "block";
    errorMessage.textContent = message;
    errorMessage.style.backgroundColor = "rgba(255, 75, 75, 0.1)";
    errorMessage.style.borderLeft = "3px solid #ff6b6b";
    errorMessage.style.color = "#ff6b6b";

    if (noAccountMessage) {
        noAccountMessage.style.display = "none";
    }
}

function showSuccessMessage(message) {
    if (!errorMessage) return;

    errorMessage.style.display = "block";
    errorMessage.textContent = message;
    errorMessage.style.backgroundColor = "rgba(81, 207, 102, 0.1)";
    errorMessage.style.borderLeft = "3px solid #51cf66";
    errorMessage.style.color = "#51cf66";

    if (noAccountMessage) {
        noAccountMessage.style.display = "none";
    }
}

function clearMessages() {
    if (errorMessage) {
        errorMessage.style.display = "none";
        errorMessage.textContent = "";
    }

    if (noAccountMessage) {
        noAccountMessage.style.display = "none";
        noAccountMessage.innerHTML = "";
    }
}

function setLoadingState(isLoading) {
    if (!loginBtn) return;

    if (isLoading) {
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        loginBtn.disabled = true;
    } else {
        loginBtn.innerHTML = '<span>Login</span><i class="fas fa-arrow-right"></i>';
        loginBtn.disabled = false;
    }
}