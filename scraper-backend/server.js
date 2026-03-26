require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const { GoogleGenAI } = require('@google/genai');

// --- NEW: FIREBASE ADMIN & CRON TOOLS ---
const admin = require('firebase-admin');
const cron = require('node-cron');
const serviceAccount = require('./firebase-key.json');

// Initialize Firebase with Super Admin Powers
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// =========================================================
// HELPER: Get a random User-Agent (mimics real browsers)
// =========================================================
function getRandomUserAgent() {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// =========================================================
// HELPER: Fetch page with retry logic and better headers
// =========================================================
async function fetchWithRetry(url, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': getRandomUserAgent(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Cache-Control': 'no-cache'
                },
                timeout: 15000,
                maxRedirects: 5
            });
            return response;
        } catch (error) {
            console.log(`Attempt ${i + 1} failed for ${url}: ${error.message}`);
            if (i === maxRetries - 1) throw error;
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
        }
    }
}

// =========================================================
// EXISTING ENDPOINT - VENDOR DETAILS EXTRACTION (IMPROVED)
// =========================================================
app.post('/api/extract-vendor', async (req, res) => {
    const targetUrl = req.body.url;
    if (!targetUrl) return res.status(400).json({ error: "URL is required" });

    try {
        console.log(`\n--- New AI Scrape Request ---`);
        console.log(`1. Fetching Home Page: ${targetUrl}`);
        
        // Use improved fetch with retry
        const response1 = await fetchWithRetry(targetUrl);
        const $1 = cheerio.load(response1.data);

        // Get main image
        let mainImageUrl = $1('meta[property="og:image"]').attr('content') || 
                           $1('meta[name="twitter:image"]').attr('content') || 
                           $1('link[rel="apple-touch-icon"]').attr('href') || null;
                           
        if (mainImageUrl && mainImageUrl.startsWith('/')) {
            try {
                mainImageUrl = new URL(mainImageUrl, targetUrl).href;
            } catch(e) {}
        }
        console.log(`🖼️ Found Main Image: ${mainImageUrl}`);
        
        // Find contact page
        let contactPageUrl = null;
        $1('a').each((i, link) => {
            const href = $1(link).attr('href');
            const text = $1(link).text().toLowerCase();
            if (href && (text.includes('contact') || href.toLowerCase().includes('contact'))) {
                try {
                    contactPageUrl = new URL(href, targetUrl).href;
                } catch(e) {}
            }
        });

        // Clean home page text
        $1('script, style, noscript, img, nav, footer, header').remove();
        let combinedText = "--- HOME PAGE TEXT ---\n" + $1('body').text().replace(/\s+/g, ' ').trim();

        // Fetch contact page if found
        if (contactPageUrl && contactPageUrl !== targetUrl) {
            try {
                console.log(`2. Found Contact Page! Fetching: ${contactPageUrl}`);
                const response2 = await fetchWithRetry(contactPageUrl);
                const $2 = cheerio.load(response2.data);
                $2('script, style, noscript, img, nav, footer, header').remove();
                combinedText += "\n\n--- CONTACT PAGE TEXT ---\n" + $2('body').text().replace(/\s+/g, ' ').trim();
            } catch (err) {
                console.log("Could not load contact page, proceeding with just home page.");
            }
        }

        // Limit text size
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
            "category": "string (guess ONE: Photography, Catering, Venues, Entertainment, Bridal Dressing, Cakes, Florist. If unsure, put 'Other')",
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

        res.json({ success: true, data: extractedData, imageUrl: mainImageUrl });

    } catch (error) {
        console.error("Error occurred:", error.message);
        
        // Provide more helpful error message
        let errorMessage = "Failed to read the website.";
        if (error.response?.status === 403) {
            errorMessage = "Website is blocking automated access. Please try a different website or contact the website owner.";
        } else if (error.code === 'ECONNABORTED') {
            errorMessage = "Connection timeout. The website took too long to respond.";
        } else if (error.response?.status === 404) {
            errorMessage = "Website not found. Please check the URL.";
        }
        
        res.status(500).json({ success: false, error: errorMessage });
    }
});


// =========================================================
// IMPROVED PRODUCT SCRAPING ENDPOINT
// =========================================================
app.post('/api/scrape-products', async (req, res) => {
    const { url, vendorId, vendorType } = req.body;
    
    if (!url) {
        return res.status(400).json({ success: false, error: "URL is required" });
    }

    try {
        console.log(`\n--- Product Scraping Started ---`);
        console.log(`URL: ${url}`);
        
        const response = await fetchWithRetry(url);
        const $ = cheerio.load(response.data);
        
        // Remove unwanted elements
        $('script, style, noscript, nav, footer, header, iframe, form').remove();
        
        let products = [];
        
        // STRATEGY 1: Find elements with price patterns
        const pricePatterns = [
            /LKR[\s]*[\d,]+/i,
            /Rs[\s]*[\d,]+/i,
            /₹[\s]*[\d,]+/i,
            /\$[\s]*[\d,]+/i,
            /[\d,]+[\s]*(LKR|Rs|₹|\$)/i,
            /Starting from/i,
            /From[\s]*LKR/i,
            /Price/i,
            /[0-9,]+/  // Any numbers (last resort)
        ];
        
        // Find all elements that might contain prices
        const allElements = $('body').find('*');
        
        allElements.each((index, element) => {
            const $el = $(element);
            const text = $el.text().trim();
            const html = $el.html() || '';
            
            // Skip if element is too big or too small
            if (text.length < 5 || text.length > 500) return;
            
            // Check if this element contains price-like text
            let hasPrice = false;
            let priceMatch = null;
            
            for (const pattern of pricePatterns) {
                if (pattern.test(text)) {
                    hasPrice = true;
                    priceMatch = text.match(pattern);
                    break;
                }
            }
            
            if (hasPrice) {
                // Found a potential product container
                const $container = $el.closest('div, section, article, li, .product, .item, .service, .card');
                
                // Extract title
                let title = '';
                const $heading = $container.find('h1, h2, h3, h4, strong, .title, .name, [class*="title"], [class*="name"]').first();
                if ($heading.length) {
                    title = $heading.text().trim();
                }
                
                // If no title found, try the first strong text
                if (!title) {
                    const $strong = $container.find('strong').first();
                    if ($strong.length) title = $strong.text().trim();
                }
                
                // If still no title, use first part of text before price
                if (!title && priceMatch) {
                    const parts = text.split(priceMatch[0]);
                    if (parts[0] && parts[0].length < 50) {
                        title = parts[0].trim();
                    }
                }
                
                // Extract description
                let description = '';
                const $paragraphs = $container.find('p');
                $paragraphs.each((i, p) => {
                    const pText = $(p).text().trim();
                    if (pText !== title && !pricePatterns.some(p => p.test(pText))) {
                        if (pText.length > 20 && pText.length < 300) {
                            description = pText;
                            return false;
                        }
                    }
                });
                
                // IMPROVED IMAGE EXTRACTION
                let images = [];
                
                // 1. Find images in the container
                const $imgs = $container.find('img');
                $imgs.each((i, img) => {
                    let src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-lazy-src');
                    if (src) {
                        // Skip icons, logos, and tiny images
                        if (!src.includes('logo') && !src.includes('icon') && !src.includes('arrow') && !src.includes('social')) {
                            if (src.startsWith('/')) {
                                try {
                                    src = new URL(src, url).href;
                                } catch(e) {}
                            }
                            if (src.startsWith('http')) {
                                images.push(src);
                            }
                        }
                    }
                });
                
                // 2. If no images in container, look for gallery images on page
                if (images.length === 0) {
                    // Look for common gallery selectors
                    const gallerySelectors = [
                        '.gallery img', '.portfolio img', '.products img', 
                        '[class*="gallery"] img', '[class*="portfolio"] img', 
                        '[class*="product"] img', '.service-image img'
                    ];
                    
                    for (const selector of gallerySelectors) {
                        const galleryImgs = $(selector);
                        galleryImgs.each((i, img) => {
                            let src = $(img).attr('src') || $(img).attr('data-src');
                            if (src && src.startsWith('http')) {
                                images.push(src);
                            }
                        });
                        if (images.length > 0) break;
                    }
                }
                
                // 3. Look for Open Graph image (often the main product image)
                if (images.length === 0) {
                    const ogImage = $('meta[property="og:image"]').attr('content');
                    if (ogImage) images.push(ogImage);
                }
                
                // 4. Look for the first large image on the page
                if (images.length === 0) {
                    $('img').each((i, img) => {
                        let src = $(img).attr('src');
                        if (src && src.startsWith('http')) {
                            const width = $(img).attr('width');
                            const height = $(img).attr('height');
                            // Prefer images that might be product photos (not tiny icons)
                            if ((width && parseInt(width) > 100) || (height && parseInt(height) > 100)) {
                                images.push(src);
                                return false;
                            }
                        }
                    });
                }
                
                images = [...new Set(images)].slice(0, 5); // Unique images, max 5
                
                // Clean price text
                let price = priceMatch ? priceMatch[0] : '';
                let priceNumber = null;
                
                const numericMatch = price.match(/[\d,]+/);
                if (numericMatch) {
                    priceNumber = parseInt(numericMatch[0].replace(/,/g, ''));
                }
                
                // Only add if we have at least a title
                if (title) {
                    products.push({
                        title: title.substring(0, 200),
                        description: description.substring(0, 500),
                        price: price || "Price on request",
                        priceNumber: priceNumber,
                        images: images,
                        containerClass: $container.attr('class') || '',
                        containerId: $container.attr('id') || ''
                    });
                }
            }
        });
        
        // Remove duplicate products by title
        const uniqueProducts = [];
        const titles = new Set();
        
        for (const product of products) {
            const normalizedTitle = product.title.toLowerCase().trim();
            if (!titles.has(normalizedTitle)) {
                titles.add(normalizedTitle);
                uniqueProducts.push(product);
            }
        }
        
        // Limit to 30 products
        const finalProducts = uniqueProducts.slice(0, 30);
        
        console.log(`Found ${finalProducts.length} products with images: ${finalProducts.filter(p => p.images.length > 0).length} have images`);
        
        // If no products found with strategy 1, try strategy 2
        if (finalProducts.length === 0) {
            console.log("Strategy 1 found no products, trying Strategy 2 (service cards)...");
            
            const cardSelectors = [
                '.service', '.product', '.package', '.card', '.item', 
                '[class*="service"]', '[class*="product"]', '[class*="package"]',
                '.portfolio-item', '.gallery-item', '.service-item', '.product-item'
            ];
            
            for (const selector of cardSelectors) {
                $(selector).each((i, card) => {
                    const $card = $(card);
                    const title = $card.find('h2, h3, h4, strong').first().text().trim();
                    const desc = $card.find('p').first().text().trim();
                    
                    // Extract price
                    let price = '';
                    let priceNumber = null;
                    const priceText = $card.text();
                    const priceMatch = priceText.match(/LKR[\s]*[\d,]+|Rs[\s]*[\d,]+|[\d,]+/i);
                    if (priceMatch) {
                        price = priceMatch[0];
                        const numMatch = price.match(/[\d,]+/);
                        if (numMatch) priceNumber = parseInt(numMatch[0].replace(/,/g, ''));
                    }
                    
                    // Extract images
                    let images = [];
                    $card.find('img').each((i, img) => {
                        let src = $(img).attr('src');
                        if (src && src.startsWith('http') && !src.includes('logo') && !src.includes('icon')) {
                            images.push(src);
                        }
                    });
                    
                    if (title) {
                        finalProducts.push({
                            title: title.substring(0, 200),
                            description: desc.substring(0, 500),
                            price: price || "Price on request",
                            priceNumber: priceNumber,
                            images: images.slice(0, 3)
                        });
                    }
                });
                if (finalProducts.length > 0) break;
            }
        }
        
        res.json({
            success: true,
            products: finalProducts,
            totalFound: finalProducts.length,
            imagesFound: finalProducts.filter(p => p.images.length > 0).length,
            url: url,
            scrapedAt: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("Product scraping error:", error.message);
        
        let errorMessage = error.message;
        if (error.response?.status === 403) {
            errorMessage = "Website is blocking automated access. Cannot scrape products.";
        }
        
        res.status(500).json({ 
            success: false, 
            error: errorMessage,
            products: [] 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'running', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Smart Multi-Page Scraper running on http://localhost:${PORT}`));

// =========================================================
// 🔄 AUTOMATED DAILY UPDATER (SAFE MERGE LOGIC)
// Runs every night at 2:00 AM to update existing prices ONLY
// =========================================================
async function runDailyVendorUpdate() {
    console.log("⏰ [SYSTEM] Starting SAFE daily price update...");
    const currentPort = process.env.PORT || 3000;

    try {
        const collections = ['company_vendors', 'individual_vendors'];
        
        for (const collName of collections) {
            // 1. Get all approved vendors from Firebase
            const snapshot = await db.collection(collName)
                .where('status', '==', 'approved')
                .where('isActive', '==', true)
                .get();

            for (const doc of snapshot.docs) {
                const vendor = doc.data();
                const vendorId = doc.id;

                if (!vendor.website || vendor.website.trim() === '') continue;

                console.log(`\n🔍 Checking price updates for: ${vendor.companyName || vendor.fullName}`);
                
                try {
                    // 2. Call our scraper to get today's live website data
                    const response = await axios.post(`http://localhost:${currentPort}/api/scrape-products`, {
                        url: vendor.website,
                        vendorId: vendorId,
                        vendorType: collName === 'company_vendors' ? 'company' : 'individual'
                    });

                    if (response.data.success && response.data.products.length > 0) {
                        const liveScrapedProducts = response.data.products;

                        // 3. Get the existing products ALREADY in our database
                        const existingProductsSnap = await db.collection('products')
                            .where('vendorId', '==', vendorId)
                            .get();

                        const batch = db.batch();
                        let updatedPricesCount = 0;
                        
                        // 4. SAFE MERGE LOGIC: Only update prices of matching items
                        existingProductsSnap.forEach(oldDoc => {
                            const dbProduct = oldDoc.data();
                            
                            // Try to find the exact same package on the live website by matching the Title
                            const matchingLiveProduct = liveScrapedProducts.find(liveProd => 
                                liveProd.title.toLowerCase() === dbProduct.title.toLowerCase() ||
                                liveProd.title.toLowerCase().includes(dbProduct.title.toLowerCase())
                            );

                            // 5. If we found a match, check if the price changed!
                            if (matchingLiveProduct) {
                                if (dbProduct.price !== matchingLiveProduct.price) {
                                    // ONLY update the price fields. Leave images and descriptions untouched!
                                    batch.update(oldDoc.ref, {
                                        price: matchingLiveProduct.price,
                                        priceNumber: matchingLiveProduct.priceNumber,
                                        lastPriceAutoUpdate: new Date().toISOString()
                                    });
                                    updatedPricesCount++;
                                    console.log(`   💸 Price updated for "${dbProduct.title}": ${matchingLiveProduct.price}`);
                                }
                            }
                        });

                        // 6. Update the vendor's profile to show we checked today
                        const vendorRef = db.collection(collName).doc(vendorId);
                        batch.update(vendorRef, {
                            lastAutomatedCheck: new Date().toISOString()
                        });

                        // Commit all database changes safely
                        await batch.commit();
                        console.log(`✅ Safe Sync Complete! Updated ${updatedPricesCount} prices for ${vendor.companyName || vendor.fullName}.`);
                    }
                } catch (err) {
                    console.error(`❌ Failed to update vendor ${vendorId}:`, err.message);
                }
                
                // Wait 5 seconds between vendors so we don't get blocked by their servers
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        console.log("🎉 [SYSTEM] Daily Safe Price Update Complete!");
    } catch (error) {
        console.error("❌ [SYSTEM] Critical error during daily update:", error);
    }
}