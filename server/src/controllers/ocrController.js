// ocrController.js (V27 - Final Definitive Fix)

const { analyzeImage, analyzeDocument } = require('../services/ocrService.js');
const asyncHandler = require('../utils/asyncHandler.js');

// --- Helper Functions for Spatial Analysis ---

const getCenterX = (box) => (box[0] + box[2] + box[4] + box[6]) / 4;
const getMidY = (box) => (box[1] + box[7]) / 2;
const isNumerical = (text) => text.match(/^[\d\.]+$/);
const isBarcode = (text) => text.match(/^\d{8,14}$/); // Kept for classification, but not used as a strict check for item detection

// --- List of keywords found in noise/headers that should NOT be items ---
const IGNORE_KEYWORDS = ['Shift', 'Ente', 'Delete', 'Num', 'Lock', 'Home', 'PgUp', 'PgDn', 'Customer', 'Delivery', 'Total', 'Item Qty', 'No.'];
const FEE_KEYWORDS = ['charges', 'Fee', 'Charge', 'Service'];
const ADDRESS_NOISE = ['AK', '0', '75', '95', '800-22/1322', '404020002859089', 'Order Date', 'Date', 'No.', 'In Carrefour', 'Printed On', 'be', '3 25', 'PROMO', 'Discount', 'Payment', 'Method'];

/**
 * Parses OCR results specifically for utility bills.
 * Looks for common utility bill fields like meter numbers, usage, and amount due.
 */
const parseUtilityBill = (results) => {
    const extractedData = {
        manufacturer: "",
        serialNumber: "",
        standard: "",
        modelSpecs: {
            q3: "",
            q3_q1_ratio: "", 
            pn: "",
            class: "",
            multipliers: []
        },
        mainReading: ""
    };

    if (!results || results.length === 0) {
        return extractedData;
    }

     // 1. Flatten all lines and pre-process them with spatial data
    const allLines = results.flatMap(page => page.lines)
        .map(line => {
            const normalizedText = line.text.trim();
            return {
                text: normalizedText,
                upperText: normalizedText.toUpperCase(),
                midY: getMidY(line.boundingBox),
                centerX: getCenterX(line.boundingBox),
                boundingBox: line.boundingBox, 
                isUsed: false,
            };
        })
        .filter(line => line.text.length >= 2);

    // --- 2. Extraction Logic ---
    const M3_UNIT_LINE_TEXT = "M3";
    
    // A. Standard (ISO 4064)
    for (const line of allLines) {
        const isoMatch = line.upperText.match(/ISO\s*(\d+)/);
        if (isoMatch) {
            extractedData.standard = `ISO ${isoMatch[1]}`;
            line.isUsed = true;
            break;
        }
    }

    // B. Model Specs (Q3, PN, Class, Multipliers)
    const specKeywordLocations = [];
    for (const line of allLines) {
        if (line.isUsed) continue;

        const q3Match = line.text.match(/Q3:\s*(.*)/i);
        if (q3Match) {
            extractedData.modelSpecs.q3 = q3Match[1];
            specKeywordLocations.push({ midY: line.midY });
            line.isUsed = true;
            continue; 
        }

        const q3q1Match = line.upperText.match(/Q3\/Q1\s*=\s*(\d+)/);
        if (q3q1Match) {
            extractedData.modelSpecs.q3_q1_ratio = q3q1Match[1];
            specKeywordLocations.push({ midY: line.midY });
            line.isUsed = true;
            continue; 
        }

        const pnMatch = line.text.match(/PN\s*[:\s]?\s*(.*)/i);
        if (pnMatch) {
            extractedData.modelSpecs.pn = pnMatch[1];
            specKeywordLocations.push({ midY: line.midY });
            line.isUsed = true;
        }

        const classMatch = line.upperText.match(/CLASS\s+([A-Z])/);
        if (classMatch) {
            extractedData.modelSpecs.class = classMatch[1];
            specKeywordLocations.push({ midY: line.midY });
            line.isUsed = true;
        }

        const multiplierMatch = line.upperText.match(/(X0\.\d+)/g);
        if (multiplierMatch) {
            extractedData.modelSpecs.multipliers.push(...multiplierMatch);
            specKeywordLocations.push({ midY: line.midY });
            line.isUsed = true;
        }
    }
    
    // C. Manufacturer Detection
    const manufacturerCandidates = [];
    const noiseKeywords = ['ISO', 'CLASS', 'PN', 'Q3', ...extractedData.modelSpecs.multipliers];
    for (const line of allLines) {
        if (line.isUsed || !/^[A-Z]{4,}$/.test(line.upperText) || noiseKeywords.some(noise => line.upperText.includes(noise))) {
            continue;
        }

        let minDistance = Infinity;
        if (specKeywordLocations.length > 0) {
            for (const spec of specKeywordLocations) {
                const distance = Math.abs(line.midY - spec.midY);
                if (distance < minDistance) {
                    minDistance = distance;
                }
            }
            if (minDistance < 200) { 
                manufacturerCandidates.push({ text: line.text, distance: minDistance });
            }
        }
    }

    if (manufacturerCandidates.length > 0) {
        manufacturerCandidates.sort((a, b) => a.distance - b.distance);
        extractedData.manufacturer = manufacturerCandidates[0].text;
        const foundLine = allLines.find(l => l.text === extractedData.manufacturer);
        if (foundLine) foundLine.isUsed = true;
    }

    // D. Serial Number (Refined to look for longer codes)
    let longestSerial = '';
    let serialLine = null;
    for (const line of allLines) {
        if (line.isUsed) continue;
        const cleanedText = line.text.replace(/\s/g, '');
        const serialMatch = cleanedText.match(/\b(\d{5,15})\b/); 
        if (serialMatch && serialMatch[1].length > longestSerial.length) {
            longestSerial = serialMatch[1];
            serialLine = line; 
        }
    }
    extractedData.serialNumber = longestSerial;
    if (serialLine) {
        serialLine.isUsed = true; 
    }

    // E. Main Reading Extraction (FIXED: Prioritize Length Over Simple Proximity)
    const unitLine = allLines.find(line => line.upperText.includes(M3_UNIT_LINE_TEXT));

    if (unitLine) {
        const readingCandidates = [];
        const MAX_VERTICAL_SEARCH = 250; 
        const MAX_HORIZONTAL_SEARCH = 150; 

        for (const line of allLines) {
            if (line.isUsed) continue;

            const cleanedText = line.text.replace(/\s/g, '');
            // Only consider numerical strings
            if (!isNumerical(cleanedText) || isBarcode(cleanedText)) continue;
            
            const horizontalDistance = Math.abs(line.centerX - unitLine.centerX);
            const verticalDistance = Math.abs(line.midY - unitLine.midY);
            
            // 1. Initial Candidate Selection (Flexible Spatial Check)
            if (horizontalDistance < MAX_HORIZONTAL_SEARCH && verticalDistance < MAX_VERTICAL_SEARCH) { 
                
                // Score based on: 
                // 1. Length (Highest Weight)
                // 2. Combined distance (Lower Weight, closer is better)
                // We use a high multiplier for length to ensure "00046" beats "87".
                const LENGTH_WEIGHT_FACTOR = 50; 
                
                const score = (cleanedText.length * LENGTH_WEIGHT_FACTOR) - (horizontalDistance + verticalDistance); 
                readingCandidates.push({ value: line.text, score: score, length: cleanedText.length, line });
            }
        }

        if (readingCandidates.length > 0) {
            // Filter out the serial number (if it was captured)
            let finalCandidates = readingCandidates.filter(
                candidate => candidate.value.replace(/\s/g, '') !== extractedData.serialNumber
            );
            
            if (finalCandidates.length === 0) {
                 return extractedData; 
            }

            // 2. Final Selection: Sort by the newly weighted score (Highest score first)
            finalCandidates.sort((a, b) => b.score - a.score);
            
            const bestReading = finalCandidates[0];
            extractedData.mainReading = bestReading.value.replace(/\s/g, ''); 
            bestReading.line.isUsed = true; 
        }
    }
    console.log('Extracted Utility Bill Data:', extractedData);
    return extractedData;
};


// --- Main Parsing Logic ---

const parseOcrResult = (results) => {
    const PROXIMITY_RANGE = 250; 
    
    const extractedData = {
        businessName: '', // Will be dynamically assigned
        businessAddress: '',
        invoiceNo: '', // FINAL FIELD NAME
        invoiceDate: '',
        deliveryDetails: {},
        items: [],
        fees: [], 
        subtotal: 0.00,
        tax: 0.00,
        total: 0.00,
        paymentMethod: '',
        promotions: '',
    };

    if (!results || results.length === 0) {
        return extractedData;
    }

    const allLines = results.flatMap(page => page.lines);
    const sortedLines = allLines.map(line => ({
        text: line.text,
        midY: getMidY(line.boundingBox),
        centerX: getCenterX(line.boundingBox),
        boundingBox: line.boundingBox,
        isUsed: false,
        isIgnore: IGNORE_KEYWORDS.some(k => line.text.includes(k)) || line.text.length < 3 
    })).sort((a, b) => a.midY - b.midY);

    const COLUMNS = {
        DESCRIPTION_MAX_X: 1450, 
        PRICE_MIN_X: 1450
    };

    // --- 1. Header and Address Extraction ---
    let headerStart = 0;
    
    // Dynamically find the first significant line as the business name
    const nameLine = sortedLines.find(l => !l.isIgnore && l.text.length > 5);
    if (nameLine) {
        let businessName = nameLine.text;
        // Clean up leading conjunctions like "In" from the business name
        const conjunctionRegex = /^(In|At|On|For|The|A|An)\s/i;
        businessName = businessName.replace(conjunctionRegex, '');

        extractedData.businessName = businessName;
        nameLine.isUsed = true;
        headerStart = sortedLines.indexOf(nameLine) + 1;
    }
    // Extract Invoice No/Date
    const topLines = sortedLines.slice(0, 60);
    for (const line of topLines) {
        
        // V3 Invoice No. extraction: Find label, then find value to its right.
        // V6 Update: Use horizontal proximity for two-column layouts.
        const invoiceRegex = /\b(Invoice No|Invoice Number)\b/i;
        if (invoiceRegex.test(line.text)) {
            const labelLine = line;
            const sameLineMatch = labelLine.text.match(/(\d{7,})/);
            if (sameLineMatch) {
                extractedData.invoiceNo = sameLineMatch[0];
                labelLine.isUsed = true;
            } else {
                const valueLine = sortedLines.find(l =>
                    !l.isUsed && isNumerical(l.text) && l.text.length >= 7 &&
                    Math.abs(l.midY - labelLine.midY) < 50 && // Allow for slight vertical deviation
                    l.centerX > labelLine.centerX // Must be to the right
                );
                if (valueLine) {
                    extractedData.invoiceNo = valueLine.text;
                    valueLine.isUsed = true;
                    labelLine.isUsed = true;
                }
            }
        }
        
        if (line.text.includes('Invoice Date')) {
            const dateLine = sortedLines.find(l => 
                l.text.match(/(\d{1,2}-\w{3}-\d{4})/) && l.midY > line.midY - 20 && l.midY < line.midY + PROXIMITY_RANGE
            );
            if (dateLine) {
                extractedData.invoiceDate = dateLine.text.match(/(\d{1,2}-\w{3}-\d{4})/)?.[0] || '';
                dateLine.isUsed = true;
            }
        }
    }

    // Address extraction
    let businessAddressLines = [];
    const headerEndIndex = sortedLines.findIndex(l => l.text.includes('Delivery Note'));
    const headerEnd = headerEndIndex !== -1 ? headerEndIndex : sortedLines.length;
    
    for(let i = headerStart; i < headerEnd; i++){
        const line = sortedLines[i];
        
        const isNoise = ADDRESS_NOISE.some(n => line.text.includes(n));

        if (!line.isUsed && !line.isIgnore && !isNoise && line.text.length > 5) { 
             businessAddressLines.push(line.text);
             line.isUsed = true;
        }
    }
    extractedData.businessAddress = businessAddressLines.join(', ');


    // --- 2. Item and Fee Extraction ---
    for (let i = 0; i < sortedLines.length; i++) {
        const currentLine = sortedLines[i];
        
        // Final check to filter out known noisy lines
        if (currentLine.isUsed || currentLine.isIgnore) continue;

        const lineText = currentLine.text;

        // A. General Document/Footer Details
        if (lineText.includes('Apartment:') || lineText.includes('Building:') || lineText.includes('Delivery Area:')) {
            extractedData.deliveryDetails[lineText.split(':')[0].trim()] = lineText.split(':')[1]?.trim() || lineText;
            currentLine.isUsed = true;
            continue;
        }

        const paymentRegex = /\b(Payment|Paid By|Method)\b/i;
        if (paymentRegex.test(lineText) && lineText.length < 15) { // Avoid matching long sentences
            console.log(`[OCR DEBUG] Found potential payment label: "${lineText}"`);
            const labelLine = currentLine;
            
            // V2: Search horizontally first, then vertically as a fallback.
            let valueLine = sortedLines.find(l =>
                !l.isUsed && !isNumerical(l.text) && l.text.length > 3 &&
                Math.abs(l.midY - labelLine.midY) < 50 && // Vertically close
                l.centerX > labelLine.centerX // To the right
            );
            
            // Fallback: check the line immediately below if nothing is found to the right
            if (!valueLine) {
                const nextLine = sortedLines[i + 1];
                if (nextLine && !nextLine.isUsed && !isNumerical(nextLine.text) && nextLine.text.length > 3) {
                    if (Math.abs(nextLine.midY - labelLine.midY) < 50) {
                        valueLine = nextLine;
                    }
                }
            }
            
            if (valueLine) {
                extractedData.paymentMethod = valueLine.text;
                valueLine.isUsed = true;
                labelLine.isUsed = true;
                continue;
            }
        }

        const promoRegex = /\b(PROMO|Discount)\b/i;
        if (promoRegex.test(lineText)) {
            console.log(`[OCR DEBUG] Found potential promotion line: "${lineText}"`);
            const promoMatch = lineText.match(/\((.+)\)/);
            if(promoMatch) extractedData.promotions = promoMatch[1];
            
            // Now, find the associated discount value
            const valueLine = sortedLines.find(l =>
                !l.isUsed && l.text.match(/^\d+\.\d{2}$/) && // Looks like currency
                Math.abs(l.midY - currentLine.midY) < 50 && // Allow for slight vertical deviation
                l.centerX > currentLine.centerX // To the right
            );
            if (valueLine) {
                const discountAmount = parseFloat(valueLine.text);
                if (discountAmount > 0) {
                    extractedData.fees.push({ description: `Discount (${promoMatch ? promoMatch[1] : ''})`, amount: -discountAmount, isDelivery: false });
                    valueLine.isUsed = true;
                }
            }
            currentLine.isUsed = true;
            continue;
        }

        // B. Fee Isolation (V2 - More Robust)
        const feeRegex = /\b(Delivery|Service|Charge|Fee)\b/i;
        if (feeRegex.test(lineText)) {
            let fee = { description: lineText, amount: 0.00, isDelivery: /\bDelivery\b/i.test(lineText) };
            let feeFound = false;

            // Case 1: Fee and amount are on the same line
            const sameLineMatch = lineText.match(/([\d\.]+)$/);
            if (sameLineMatch) {
                fee.amount = parseFloat(sameLineMatch[1]);
                feeFound = true;
            } else {
                // Case 2: Amount is on a subsequent line in the price column
                const nextLine = sortedLines.slice(i + 1, i + 4).find(l =>
                    l.centerX >= COLUMNS.PRICE_MIN_X && isNumerical(l.text)
                );
                if (nextLine) {
                    fee.amount = parseFloat(nextLine.text);
                    nextLine.isUsed = true;
                    feeFound = true;
                }
            }

            // Case 3: The fee is explicitly marked as "Free"
            if (lineText.toLowerCase().includes('free')) {
                fee.amount = 0.00;
                feeFound = true;
            }

            if (feeFound) {
                extractedData.fees.push(fee);
                currentLine.isUsed = true;
                continue;
            }
        }

        // C. Item Grouping (V2 - Barcode-First Approach)
        // This has been moved to a separate loop to avoid stateful `isUsed` issues with similar items.
    }

    // --- Item Extraction (Barcode-First Approach) ---
    const barcodeLines = sortedLines.filter(l => isBarcode(l.text) && !l.isUsed);

    for (const barcodeLine of barcodeLines) {
        let item = { sku: barcodeLine.text, description: '', quantity: 0, unitPrice: 0.00, totalPrice: 0.00 };
        let descriptionFound = false;
        let pricingFound = false;

        // --- Step 1: Find the Description Line (usually right below the barcode) ---
        const descriptionLine = sortedLines.find(l =>
            !isNumerical(l.text) &&
            l.centerX < COLUMNS.DESCRIPTION_MAX_X &&
            l.midY > barcodeLine.midY && l.midY < barcodeLine.midY + 100 // Relaxed vertical search
        );

        if (descriptionLine) {
            item.description = descriptionLine.text;
            descriptionFound = true;
            descriptionLine.isUsed = true; // Mark as used
        }

        // --- Step 2: Find the Pricing Line (Qty x Price) ---
        // Search in the vertical vicinity of the description or barcode line
        const searchMidY = descriptionFound ? descriptionLine.midY : barcodeLine.midY;
        const pricingLine = sortedLines.find(l =>
            !l.isUsed && // Ensure the line hasn't been consumed
            l.text.match(/(\d+(\.\d+)?)\s*[xX×]\s*([\d\.]+)/) &&
            l.centerX >= COLUMNS.PRICE_MIN_X &&
            Math.abs(l.midY - searchMidY) < 100
        );

        if (pricingLine) {
            const qtyPriceMatch = pricingLine.text.match(/(\d+(\.\d+)?)\s*[xX×]\s*([\d\.]+)/);
            if (qtyPriceMatch) {
                item.quantity = parseFloat(qtyPriceMatch[1]);
                item.unitPrice = parseFloat(qtyPriceMatch[3]);
                pricingFound = true;
                pricingLine.isUsed = true; // Mark as used
            }
        }

        // --- Step 3: Find the Total Price Line ---
        const totalLine = sortedLines.find(l =>
            !l.isUsed && // Ensure the line hasn't been consumed
            isNumerical(l.text) &&
            l.centerX >= COLUMNS.PRICE_MIN_X &&
            Math.abs(l.midY - searchMidY) < 100 &&
            (!pricingLine || Math.abs(l.midY - pricingLine.midY) > 5) // Ensure it's not the same line as pricing
        );

        if (totalLine) {
            item.totalPrice = parseFloat(totalLine.text);
            totalLine.isUsed = true; // Mark as used
        }

        // --- Final Item Validation and Addition ---
        if (descriptionFound && pricingFound) {
            // If total is missing, calculate it
            if (item.totalPrice === 0 && item.quantity > 0 && item.unitPrice > 0) {
                item.totalPrice = parseFloat((item.quantity * item.unitPrice).toFixed(2));
            }
            
            // Add the item if it's valid
            extractedData.items.push(item);
            barcodeLine.isUsed = true; // Mark the anchor barcode as used
        }
    }

    // --- Fallback Item Extraction (Description-First) ---
    // This loop catches items that don't have a barcode.
    for (const line of sortedLines) {
        if (line.isUsed || isNumerical(line.text) || line.centerX > COLUMNS.DESCRIPTION_MAX_X) {
            continue;
        }

        // Potential description found
        let item = { sku: '', description: line.text, quantity: 0, unitPrice: 0.00, totalPrice: 0.00 };
        let pricingFound = false;

        const pricingLine = sortedLines.find(l =>
            !l.isUsed &&
            l.text.match(/(\d+(\.\d+)?)\s*[xX×]\s*([\d\.]+)/) &&
            l.centerX >= COLUMNS.PRICE_MIN_X &&
            Math.abs(l.midY - line.midY) < 100 // Relaxed vertical search to match barcode logic
        );

        if (pricingLine) {
            const qtyPriceMatch = pricingLine.text.match(/(\d+(\.\d+)?)\s*[xX×]\s*([\d\.]+)/);
            if (qtyPriceMatch) {
                item.quantity = parseFloat(qtyPriceMatch[1]);
                item.unitPrice = parseFloat(qtyPriceMatch[3]);
                pricingFound = true;
            }
        }

        if (pricingFound) {
            line.isUsed = true;
            pricingLine.isUsed = true;
            item.totalPrice = parseFloat((item.quantity * item.unitPrice).toFixed(2));
            
            // Only if we found a qty/price line, we can also look for an explicit total to be more accurate.
            const totalLine = sortedLines.find(l => !l.isUsed && isNumerical(l.text) && l.centerX >= COLUMNS.PRICE_MIN_X && Math.abs(l.midY - line.midY) < 50);
            if (totalLine) {
                item.totalPrice = parseFloat(totalLine.text);
            }

            extractedData.items.push(item);
        }
    }

    // --- Post-Processing: Re-classify items that are actually fees ---
    const feeRegex = /\b(Delivery|Service|Charge|Fee)\b/i;
    const itemsToKeep = [];
    for (const item of extractedData.items) {
        if (feeRegex.test(item.description)) {
            extractedData.fees.push({
                description: item.description,
                amount: item.totalPrice,
                isDelivery: /\bDelivery\b/i.test(item.description)
            });
        } else {
            itemsToKeep.push(item);
        }
    }
    extractedData.items = itemsToKeep;

    // --- Final Pass: Recalculate item totals for consistency ---
    // This ensures that totalPrice always equals quantity * unitPrice.
    extractedData.items.forEach(item => {
        if (item.quantity > 0 && item.unitPrice > 0) {
            item.totalPrice = parseFloat((item.quantity * item.unitPrice).toFixed(2));
        }
    });

    // --- Final total and subtotal calculation (V2 - Corrected Order) ---
    // This now runs AFTER the final item price recalculation to ensure accuracy.
    const finalItemSubtotal = extractedData.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const feeTotal = extractedData.fees.reduce((sum, fee) => sum + fee.amount, 0);
    extractedData.subtotal = parseFloat(finalItemSubtotal.toFixed(2));
    extractedData.total = parseFloat((finalItemSubtotal + feeTotal + extractedData.tax).toFixed(2));
    
    console.log('Extracted Data:', JSON.stringify(extractedData, null, 2));
    return extractedData;
};

// @desc    Upload a document for OCR analysis
// @route   POST /api/ocr/upload
// @access  Private
const uploadAndAnalyze = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('Please upload a file');
  }

  const fileBuffer = req.file.buffer;
  const mimeType = req.file.mimetype;

  // Get the document type from the request body
  const { documentType } = req.body; // 'receipt' or 'utility'

  try {
    let results;
    let extractedData;

    if (mimeType.startsWith('image/')) {
      results = await analyzeImage(fileBuffer);
    } else if (mimeType === 'application/pdf') {
      results = await analyzeDocument(fileBuffer);
    } else {
      res.status(400);
      throw new Error('Unsupported file type. Please upload an image or a PDF document.');
    }

    // Call the appropriate parser based on the document type
    if (documentType === 'utility') {
      extractedData = parseUtilityBill(results);
    } else { // Default to receipt/invoice parser
      extractedData = parseOcrResult(results);
    }

    res.status(200).json({
      message: 'File analyzed successfully',
      data: extractedData,
      documentType: documentType || 'receipt', // Return the type for frontend use
    });
  } catch (error) {
    console.error('OCR Analysis Error:', error);
    res.status(500);
    throw new Error('Failed to analyze the document.');
  }
});

module.exports = {
  uploadAndAnalyze,
};