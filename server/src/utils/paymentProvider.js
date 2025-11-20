const IntaSend = require('intasend-node');

// Initialize the Intasend client with your credentials from .env
// The last argument `true` sets it to the test environment.
const intasend = new IntaSend(
    process.env.INTASEND_PUBLISHABLE_KEY,
    process.env.INTASEND_SECRET_KEY,
    true 
);

/**
 * Creates a checkout URL with Intasend.
 * @param {object} options - Options for creating the checkout.
 * @param {number} options.amount - The amount to charge.
 * @param {string} options.currency - The currency code (e.g., 'usd').
 * @param {string} options.api_ref - Your internal reference for the transaction (e.g., orderId).
 * @returns {Promise<string>} The payment link URL from Intasend.
 */
const createIntasendCheckout = async ({ amount, currency, api_ref }) => {
    try {
        const response = await intasend.checkout.create({
            amount,
            currency,
            api_ref,
            // 'service' can be specified here, e.g., 'MPESA', 'CARD'
            // 'host' is your frontend URL where user is redirected after payment
            host: process.env.FRONTEND_URL || 'http://localhost:3000',
        });
        // Intasend returns a payment link in the response
        return response.data.payment_link;
    } catch (error) {
        console.error('Intasend SDK Error:', error.message);
        throw new Error('Failed to create payment checkout.');
    }
};

/*
 * As per research, IntaSend does not use cryptographic webhook signing secrets in a verifiable way.
 * The `intasend.signature.verify` method is therefore not used.
 * Instead, we will verify transactions by making a direct API call.
 */

/**
 * Verifies a transaction's status by calling the IntaSend API directly.
 * This is the secure way to confirm a payment.
 * @param {string} invoiceId - The invoice ID used as the `api_ref`.
 * @returns {Promise<object>} The verified transaction data from IntaSend.
 */
const verifyTransaction = async (invoiceId) => {
    try {
        const response = await intasend.collection().status(invoiceId);
        return response;
    } catch (error) {
        console.error(`IntaSend API verification failed for invoice ${invoiceId}:`, error.message);
        throw new Error('Failed to verify transaction with provider.');
    }
};

const collectMpesaPayment = async ({ amount, currency, email, phone_number, api_ref, first_name, last_name }) => {
    try {
        const collection = intasend.collection();
        const response = await collection.mpesaStkPush({
            first_name,
            last_name,
            email,
            host: process.env.FRONTEND_URL || 'http://localhost:3000',
            amount,
            phone_number,
            api_ref,
            currency
        });
        return response;
    } catch (error) {
        console.error('Intasend SDK Error:', error.message);
        throw new Error('Failed to initiate M-Pesa payment.');
    }
};

module.exports = { createIntasendCheckout, verifyTransaction, collectMpesaPayment };