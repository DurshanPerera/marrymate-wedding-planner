require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/api/extract-vendor', async (req, res) => {
    const targetUrl = req.body.url;
    if (!targetUrl) return res.status(400).json({ error: "URL is required" });

    try {
        console.log(`\n--- New AI Scrape Request ---`);
        console.log(`1. Fetching Home Page: ${targetUrl}`);
        
        // 1. Fetch the Home Page
        const response1 = await axios.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $1 = cheerio.load(response1.data);
        
        // 2. SEARCH FOR A CONTACT PAGE LINK!
        let contactPageUrl = null;
        $1('a').each((i, link) => {
            const href = $1(link).attr('href');
            const text = $1(link).text().toLowerCase();
            // If the link text or URL contains the word 'contact'
            if (href && (text.includes('contact') || href.toLowerCase().includes('contact'))) {
                try {
                    // Convert relative links (like "/contact-me") to full links
                    contactPageUrl = new URL(href, targetUrl).href;
                } catch(e) {}
            }
        });

        // Clean home page text
        $1('script, style, noscript, img, nav').remove();
        let combinedText = "--- HOME PAGE TEXT ---\n" + $1('body').text().replace(/\s+/g, ' ').trim();

        // 3. IF WE FOUND A CONTACT PAGE, FETCH THAT TOO!
        if (contactPageUrl && contactPageUrl !== targetUrl) {
            try {
                console.log(`2. Found Contact Page! Fetching: ${contactPageUrl}`);
                const response2 = await axios.get(contactPageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const $2 = cheerio.load(response2.data);
                $2('script, style, noscript, img, nav').remove();
                
                // Add the contact page text to our existing text
                combinedText += "\n\n--- CONTACT PAGE TEXT ---\n" + $2('body').text().replace(/\s+/g, ' ').trim();
            } catch (err) {
                console.log("Could not load contact page, proceeding with just home page.");
            }
        }

        // Limit text so we don't crash the AI
        combinedText = combinedText.substring(0, 15000); 

        console.log("3. Sending combined text to Gemini AI...");

        const prompt = `
        You are an intelligent data extractor for a Wedding Planner platform.
        Read the following text scraped from a vendor's website.
        Extract their details and return ONLY a valid JSON object. Do not include markdown formatting.

        Required JSON structure:
        {
            "companyName": "string (name of the business)",
            "contactPerson": "string (the actual name of the human who owns it/photographer, if found. e.g. 'Prabath Kanishka')",
            "phone": "string (contact phone number, if found)",
            "email": "string (contact email, if found)",
            "address": "string (physical address or city, if found)",
            "category": "string (guess ONE: Photography, Catering, Venues, Entertainment, Bridal Dressing, Cakes. If unsure, put 'Other')",
            "description": "string (A 2-3 sentence summary of the business)"
        }

        Website Text:
        ${combinedText}
        `;

        const aiResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });

        const extractedData = JSON.parse(aiResponse.text);
        console.log("4. AI successfully found these details:", extractedData);

        res.json({ success: true, data: extractedData });

    } catch (error) {
        console.error("Error occurred:", error.message);
        res.status(500).json({ success: false, error: "Failed to read the website." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Smart Multi-Page Scraper running on http://localhost:${PORT}`));