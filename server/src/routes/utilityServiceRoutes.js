const express = require('express');
const router = express.Router();
const {
  getServices,
  createService,
  getServiceById,
  updateService,
  deleteService,
} = require('../controllers/utilityServiceController');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// Define authorized parties to ensure requests from the frontend are trusted.
const authorizedParties = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    process.env.CORS_ALLOWED_ORIGINS
].filter(Boolean);

// Protect all service routes, ensuring the user is authenticated
router.use(ClerkExpressRequireAuth({ authorizedParties }));

router.route('/')
  .get(getServices)
  .post(createService);

router.route('/:id')
  .get(getServiceById)
  .put(updateService)
  .delete(deleteService);

module.exports = router;