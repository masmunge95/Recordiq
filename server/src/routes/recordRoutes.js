const express = require('express');
const router = express.Router();
const {
    createRecord,
    getRecords,
    getRecordById,
    updateRecord,
    deleteRecord
} = require('../controllers/recordController');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const { upload } = require('../middleware/uploadMiddleware');
const { checkSubscription, requireLimit, trackUsage, trackCustomerOcrUsage } = require('../middleware/subscriptionMiddleware');

// Define authorized parties for Clerk middleware
const authorizedParties = ['http://localhost:5173'];
if (process.env.CORS_ALLOWED_ORIGINS) {
    authorizedParties.push(...process.env.CORS_ALLOWED_ORIGINS.split(','));
}

// All routes in this file are protected
router.route('/')
    .post(
        ClerkExpressRequireAuth({ authorizedParties }),
        checkSubscription,
        requireLimit('records'),
        upload.single('image'),
        trackUsage('records'),
        trackCustomerOcrUsage, // Track customer OCR if OCR data is present
        createRecord
    )
    .get(ClerkExpressRequireAuth({ authorizedParties }), checkSubscription, getRecords);

router.route('/:id')
    .get(ClerkExpressRequireAuth({ authorizedParties }), checkSubscription, getRecordById)
    .put(ClerkExpressRequireAuth({ authorizedParties }), checkSubscription, updateRecord)
    .delete(ClerkExpressRequireAuth({ authorizedParties }), checkSubscription, deleteRecord);

module.exports = router;