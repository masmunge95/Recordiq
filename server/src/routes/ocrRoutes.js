const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadAndAnalyze } = require('../controllers/ocrController');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// Define authorized parties for Clerk middleware
const authorizedParties = ['http://localhost:5173'];
if (process.env.CORS_ALLOWED_ORIGINS) {
    authorizedParties.push(...process.env.CORS_ALLOWED_ORIGINS.split(','));
}

// Configure multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// @route   POST /api/ocr/upload
// @desc    Upload a document for OCR analysis
// @access  Private
router.post('/upload', ClerkExpressRequireAuth({ authorizedParties }), upload.single('document'), uploadAndAnalyze);

module.exports = router;
