// Vendor page specific JavaScript
import { sendVendorContactEmail } from './emailService.js';

// Smooth scroll to register section
function scrollToRegister() {
    const registerSection = document.querySelector('.register-options');
    if (registerSection) {
        registerSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Smooth scroll to contact section
function scrollToContact() {
    const contactSection = document.getElementById('contact');
    if (contactSection) {
        contactSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Handle contact form submission with EmailJS
function handleContactForm() {
    const contactForm = document.getElementById('vendorContactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Get form data
            const nameInput = this.querySelector('input[placeholder*="Name"]');
            const emailInput = this.querySelector('input[placeholder*="Email"]');
            const businessInput = this.querySelector('input[placeholder*="Business"]');
            const businessTypeSelect = this.querySelector('select');
            const messageTextarea = this.querySelector('textarea');
            const submitButton = this.querySelector('.btn-primary');
            
            const formData = {
                name: nameInput?.value,
                email: emailInput?.value,
                businessName: businessInput?.value,
                businessType: businessTypeSelect?.value,
                message: messageTextarea?.value
            };
            
            // Validate form
            if (!formData.name || !formData.email || !formData.businessName || !formData.businessType || !formData.message) {
                alert('Please fill in all fields');
                return;
            }
            
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email)) {
                alert('Please enter a valid email address');
                return;
            }
            
            // Show loading state
            const originalText = submitButton.innerHTML;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            submitButton.disabled = true;
            
            try {
                // Send email using EmailJS
                const result = await sendVendorContactEmail(formData);
                
                if (result.success) {
                    alert('Thank you for contacting MarryMate! We will review your message and get back to you soon.');
                    this.reset();
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Failed to send message. Please try again later or contact us directly at marrymatelanka@gmail.com');
            } finally {
                // Reset button state
                submitButton.innerHTML = originalText;
                submitButton.disabled = false;
            }
        });
    }
}

// Add active class to current nav link
function setActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop();
    const navLinks = document.querySelectorAll('.nav-links a');
    
    navLinks.forEach(link => {
        const linkPage = link.getAttribute('href').split('/').pop();
        if (linkPage === currentPage) {
            link.classList.add('active');
        }
    });
}

// Add animation on scroll
function addScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe all sections
    document.querySelectorAll('section').forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(30px)';
        section.style.transition = 'all 0.6s ease';
        observer.observe(section);
    });
}

// Make functions available globally for onclick handlers
window.scrollToRegister = scrollToRegister;
window.scrollToContact = scrollToContact;

// Initialize all functions when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Load footer component
    if (typeof loadComponent !== 'undefined') {
        loadComponent("footer", "../../components/footer.html");
    }
    
    // Set active nav link
    setActiveNavLink();
    
    // Handle contact form
    handleContactForm();
    
    // Add scroll animations
    addScrollAnimations();
});