const express = require('express');
const router = express.Router();
const {
    createCustomer,
    getCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer
} = require('../controllers/customerController');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// Define authorized parties to ensure requests from the frontend (via proxy) are trusted.
// This MUST be consistent with other routes to avoid authentication conflicts.
const authorizedParties = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    process.env.CORS_ALLOWED_ORIGINS
].filter(Boolean);

// All routes in this file are protected
router.use(ClerkExpressRequireAuth({ authorizedParties }));

router.route('/')
    .post(createCustomer)
    .get(getCustomers);

router.route('/:id')
    .get(getCustomerById)
    .put(updateCustomer)
    .delete(deleteCustomer);

module.exports = router;
