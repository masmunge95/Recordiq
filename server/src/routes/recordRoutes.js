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
const upload = require('../middleware/uploadMiddleware');

// Define authorized parties for Clerk middleware
const authorizedParties = ['http://localhost:5173'];
if (process.env.CORS_ALLOWED_ORIGINS) {
    authorizedParties.push(...process.env.CORS_ALLOWED_ORIGINS.split(','));
}

// All routes in this file are protected
router.route('/')
    .post(ClerkExpressRequireAuth({ authorizedParties }), upload.single('image'), createRecord)
    .get(ClerkExpressRequireAuth({ authorizedParties }), getRecords);

router.route('/:id')
    .get(ClerkExpressRequireAuth({ authorizedParties }), getRecordById)
    .put(ClerkExpressRequireAuth({ authorizedParties }), updateRecord)
    .delete(ClerkExpressRequireAuth({ authorizedParties }), deleteRecord);

module.exports = router;