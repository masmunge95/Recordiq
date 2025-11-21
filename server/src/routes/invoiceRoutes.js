const express = require('express');
const router = express.Router();
const {
    createInvoice,
    getInvoices,
    getInvoiceById,
    updateInvoice,
    deleteInvoice,
    sendInvoice
} = require('../controllers/invoiceController');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const { checkSubscription, requireLimit, trackUsage } = require('../middleware/subscriptionMiddleware');

// Define authorized parties for Clerk middleware
const authorizedParties = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    process.env.CORS_ALLOWED_ORIGINS // This should be your ngrok URL from the .env file
].filter(Boolean); // filter(Boolean) removes any undefined/null values

// All routes in this file are protected
router.use(ClerkExpressRequireAuth({ authorizedParties: authorizedParties }));

// Apply subscription check to all routes
router.use(checkSubscription);

router.route('/')
    .post(requireLimit('invoices'), trackUsage('invoices'), createInvoice)
    .get(getInvoices);

router.route('/:id')
    .get(getInvoiceById)
    .put(updateInvoice)
    .delete(deleteInvoice);

router.route('/:id/send').post(sendInvoice);

module.exports = router;
