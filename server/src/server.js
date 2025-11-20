const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// Load environment variables
dotenv.config();

// --- CORS Configuration ---
const allowedOrigins = [
  'http://localhost:5173', // Vite dev server
];
if (process.env.CORS_ALLOWED_ORIGINS) {
  allowedOrigins.push(...process.env.CORS_ALLOWED_ORIGINS.split(','));
}

const corsOptions = {
  origin: (origin, callback) => {
    // Log the origin for debugging purposes
    console.log('Request Origin:', origin);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true, // Allow cookies and authorization headers
};


// Local imports
const connectDB = require('./config/db');
const recordRoutes = require('./routes/recordRoutes');
const customerRoutes = require('./routes/customerRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const webhookRoutes = require('./routes/webhookRoutes'); // 1. Import the new webhook router
const ocrRoutes = require('./routes/ocrRoutes');
const portalRoutes = require('./routes/portalRoutes');
const utilityServiceRoutes = require('./routes/utilityServiceRoutes');
const logger = require('./middleware/logger');
const performanceMonitor = require('./middleware/performanceMonitor');
const errorHandler = require('./middleware/errorHandler');

// Initialize Express app
const app = express();

// Connect to Database
connectDB();

// --- Core Middleware ---

// Apply CORS middleware
app.use(cors(corsOptions));

// Raw body parser for the Clerk webhook, must come before express.json()
// This ensures we have the raw body for signature verification.
app.use('/api/webhooks/clerk', express.raw({ type: 'application/json' }));

// Body parsing middleware
// We need the raw body for webhook signature verification
app.use(express.json({
    verify: (req, res, buf) => {
        const url = req.originalUrl;
        if (url.startsWith('/api/records/webhook') || url.startsWith('/api/payments/webhook')) {
            req.rawBody = buf.toString();
        }
    }
}));
app.use(express.urlencoded({ extended: true }));

// Custom logging and performance middleware
app.use(logger);
app.use(performanceMonitor);

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- Routes ---

app.get('/api', (req, res) => {
    res.send('API is running...');
});

app.use('/api/records', recordRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/webhooks', webhookRoutes); // 2. Use the webhook router
app.use('/api/ocr', ocrRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/services', utilityServiceRoutes);

// --- Error Handling Middleware ---
// This should be the last piece of middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});