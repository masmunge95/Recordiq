const express = require('express');
const router = express.Router();
const { getMyInvoices, getMyInvoiceById } = require('../controllers/portalController');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// Define authorized parties for Clerk middleware
const authorizedParties = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    process.env.CORS_ALLOWED_ORIGINS
].filter(Boolean);

// All routes in this file are protected and intended for the logged-in user's customer portal.
router.use(ClerkExpressRequireAuth({ authorizedParties }));

router.get('/invoices', getMyInvoices);
router.get('/invoices/:id', getMyInvoiceById);

module.exports = router;