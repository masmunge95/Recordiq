const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const asyncHandler = require('../utils/asyncHandler');
const mongoose = require('mongoose');
const paymentProvider = require('../utils/paymentProvider');
const { v4: uuidv4 } = require('uuid');

/**
 * @desc    Create a pending payment and get a payment link from IntaSend
 * @route   POST /api/payments/initiate
 * @access  Private
 */
exports.makePayment = asyncHandler(async (req, res) => {
    const { _id, invoiceId, name, email, phone, paymentMethod } = req.body;

    if (!_id || !invoiceId || !name || !email) {
        res.status(400);
        throw new Error('Please provide _id and all required payment details.');
    }

    // Validate payment method
    const method = paymentMethod || 'mpesa'; // Default to M-Pesa for backward compatibility
    if (!['mpesa', 'card'].includes(method)) {
        res.status(400);
        throw new Error('Invalid payment method. Use "mpesa" or "card".');
    }

    // M-Pesa requires phone number
    if (method === 'mpesa' && !phone) {
        res.status(400);
        throw new Error('Phone number is required for M-Pesa payment.');
    }

    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
        res.status(404);
        throw new Error('Invoice not found.');
    }

    if (invoice.status === 'paid') {
        res.status(400);
        throw new Error('Invoice has already been paid.');
    }

    const [firstName, ...lastName] = name.split(' ');

    let response;

    if (method === 'mpesa') {
        response = await paymentProvider.collectMpesaPayment({
            first_name: firstName,
            last_name: lastName.join(' '),
            amount: invoice.total,
            currency: 'KES',
            email,
            phone_number: phone,
            api_ref: invoice._id.toString(),
        });
    } else if (method === 'card') {
        response = await paymentProvider.collectCardPayment({
            first_name: firstName,
            last_name: lastName.join(' '),
            amount: invoice.total,
            currency: 'KES', // or 'USD' depending on your preference
            email,
            api_ref: invoice._id.toString(),
        });
    }

    res.status(200).json({
        ...response,
        paymentMethod: method
    });
});

/**
 * @desc    Webhook to handle payment success events from IntaSend
 * @route   POST /api/payments/webhook
 * @access  Public (secured by webhook signature)
 */
exports.handlePaymentWebhook = asyncHandler(async (req, res) => {
    // 1. Acknowledge the webhook immediately to prevent timeouts and retries from IntaSend.
    res.status(200).send({ received: true });

    // 2. Process the webhook asynchronously.
    // Parse the payload from the raw buffer.
    let payload;
    try {
        payload = JSON.parse(req.rawBody);
    } catch (err) {
        console.error('Webhook Error: Invalid JSON payload.');
        return; // Stop processing
    }

    console.log('Received IntaSend webhook payload:', payload);

    // Basic validation: check for the challenge string if you have one set up.
    if (payload.challenge !== process.env.INTASEND_CHALLENGE_TOKEN) {
        console.error('Webhook Error: Challenge validation failed.');
        return;
    }

    let intasendInvoiceId = payload.invoice_id;
    if (!intasendInvoiceId && payload.transaction && payload.transaction.invoice) {
        intasendInvoiceId = payload.transaction.invoice.invoice_id;
    }

    let invoiceId = payload.api_ref;
    if (!invoiceId && payload.transaction && payload.transaction.invoice) {
        invoiceId = payload.transaction.invoice.api_ref;
    }

    if (!invoiceId || !intasendInvoiceId) {
        console.error('Webhook Error: Payload missing api_ref or invoice_id.');
        return;
    }

    // 3. Do NOT trust the payload. Verify the transaction by calling the IntaSend API.
    try {
        const verifiedData = await paymentProvider.verifyTransaction(intasendInvoiceId);

        // We only care about completed payments from the verified data
        if (verifiedData.invoice.state !== 'COMPLETE') {
            console.log(`Ignoring webhook for invoice ${invoiceId}. Status is '${verifiedData.invoice.state}'.`);
            return;
        }

        const invoice = await Invoice.findById(invoiceId);

        if (!invoice || invoice.status === 'paid') {
            console.log(`Invoice ${invoiceId} not found or already paid. Webhook ignored.`);
            return;
        }

        // 4. If verification is successful and status is COMPLETE, update the database.
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            // Create the Payment record
            const payment = new Payment({
                _id: uuidv4(), // Generate UUID for payment ID
                invoice: invoiceId,
                customer: invoice.customer,
                amount: verifiedData.invoice.value,
                provider: 'IntaSend',
                transactionId: verifiedData.invoice.id, // Use the verified transaction ID
                status: 'completed',
            });
            await payment.save({ session });

            // Update the Invoice status to 'paid'
            invoice.status = 'paid';
            await invoice.save({ session });

            await session.commitTransaction();
            console.log(`Payment for invoice ${invoiceId} successfully processed and verified.`);
        } catch (dbError) {
            await session.abortTransaction();
            console.error(`Database update failed for invoice ${invoiceId} after verification:`, dbError);
        } finally {
            session.endSession();
        }
    } catch (verificationError) {
        console.error(`Webhook processing failed for invoice ${invoiceId}:`, verificationError.message);
    }
});

exports.verifyPayment = asyncHandler(async (req, res) => {
    const { invoiceId } = req.params;
    const userId = req.auth.userId;

    const invoice = await Invoice.findOne({ _id: invoiceId, user: userId });

    if (!invoice) {
        res.status(404);
        throw new Error('Invoice not found.');
    }

    if (invoice.status === 'paid') {
        res.status(400);
        throw new Error('Invoice has already been paid.');
    }

    try {
        const verifiedData = await paymentProvider.verifyTransaction(invoiceId);

        if (verifiedData.invoice.state !== 'COMPLETE') {
            return res.status(200).json({ message: `Payment status is '${verifiedData.invoice.state}'.` });
        }

        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const payment = new Payment({
                invoice: invoiceId,
                customer: invoice.customer,
                amount: verifiedData.invoice.value,
                provider: 'IntaSend',
                transactionId: verifiedData.invoice.id,
                status: 'completed',
            });
            await payment.save({ session });

            invoice.status = 'paid';
            await invoice.save({ session });

            await session.commitTransaction();
            res.status(200).json({ message: 'Payment successfully verified and invoice updated.' });
        } catch (dbError) {
            await session.abortTransaction();
            throw new Error('Database update failed after verification.');
        } finally {
            session.endSession();
        }
    } catch (verificationError) {
        throw new Error('Failed to verify payment with provider.');
    }
});
