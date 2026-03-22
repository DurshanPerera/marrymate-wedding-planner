// EmailJS configuration - REPLACE WITH YOUR ACTUAL CREDENTIALS
// Get these from your EmailJS account:
// - Public Key: From Account → API Keys
// - Service ID: From Email Services
// - Template ID: From Email Templates

// Initialize EmailJS with public key
emailjs.init("bkfuusRyZh2YhqM_o"); // public key

// Function to send vendor contact email
export async function sendVendorContactEmail(formData) {
    const templateParams = {
        from_name: formData.name,
        from_email: formData.email,
        business_name: formData.businessName,
        business_type: formData.businessType,
        message: formData.message,
        to_email: "marrymatelanka@gmail.com"
    };

    try {
        const response = await emailjs.send(
            'service_happs4o',      // Service ID
            'template_ta7bi6p',     // Template ID
            templateParams
        );
        return { success: true, response };
    } catch (error) {
        console.error('Email send error:', error);
        return { success: false, error };
    }
}