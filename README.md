# Recordiq - Utility Billing & Invoice Management Platform

A modern, offline-first utility billing and invoice management system with OCR capabilities for service providers. Built with React, Node.js, MongoDB, Capacitor, and Dexie for seamless local-first data synchronization across web and mobile platforms.

🌐 **Live Demo:** [https://recordiq.vercel.app](https://recordiq.vercel.app)  
📱 **Platform:** Web + Android Mobile App

## 🌍 UN Sustainable Development Goals

Recordiq contributes to the following UN SDGs:

- **SDG 8 - Decent Work & Economic Growth**: Empowering small businesses, utility providers, and service entrepreneurs with professional tools for financial management, helping formalize operations and scale efficiently
- **SDG 9 - Industry, Innovation & Infrastructure**: Democratizing access to business infrastructure through technology, making professional invoicing, billing, and payment tools accessible to all
- **SDG 10 - Reduced Inequalities**: Leveling the playing field for micro-entrepreneurs and utility service providers by providing enterprise-grade tools previously only available to large corporations
- **SDG 11 - Sustainable Cities & Communities**: Facilitating efficient utility service management and billing, supporting sustainable infrastructure development in communities

## 🚀 Features

### Core Invoice & Billing Management
- **Create & Manage Invoices** - Generate professional invoices with dynamic line items and service templates
- **Customer Management** - Track customers with contact information, payment history, and utility consumption
- **Invoice Status Tracking** - Draft → Sent → Paid workflow with real-time updates
- **Payment Processing** - Integrated IntaSend payment gateway for M-Pesa, cards, and online collections (KSH)
- **Customer Portal** - Customers can view sent invoices and make payments via secure portal

### Utility Services & Meter Reading
- **Utility Service Templates** - Configure services (water, electricity, gas) with fees, units, and auto-calculation
- **Meter Reading Records** - Track meter readings with previous/current readings and automatic consumption calculation
- **OCR for Meter Reading** - Upload meter photos and extract readings via Azure Computer Vision OCR
- **Service Fee Calculation** - Automatic fee calculation based on consumption tiers and additional charges

### OCR & Document Processing
- **Receipt/Meter Scanning** - Upload images of meters, invoices, or documents for OCR processing
- **Azure AI Integration** - Powered by Azure Computer Vision and Document Intelligence for accurate extraction
- **Auto-Population** - Scanned data auto-fills invoice and record forms
- **Records Management** - Organize and search processed documents with metadata

### Advanced Capabilities
- **Offline-First Architecture** - Full offline functionality with background sync using Dexie IndexedDB
- **Role-Based Access** - Separate seller (service provider) and customer dashboards
- **Subscription Management** - Premium features with IntaSend payment integration (USD pricing, KES processing)
- **Dark/Light Theme** - User preference persistence across sessions
- **Android Mobile App** - Native Android app built with Capacitor for on-the-go management
- **Responsive Design** - Mobile-optimized interface for all devices

### Business Intelligence
- **Seller Dashboard** - Overview of invoices, revenue, records, and top customers
- **Analytics** - Key metrics: total invoices, sent count, paid count, revenue (KSH), customer count
- **Customer Dashboard** - Track utility consumption, payment history, and pending invoices
- **Recent Activity** - Quick access to recent invoices, payments, and meter readings

## 📸 Screenshots

### Application Interface

<div align="center">

#### Dashboard & Invoice Management
![Seller Dashboard](screenshots/seller-dashboard.png)
*Seller dashboard with real-time analytics, recent invoices, and top customers*

![Invoice Management](screenshots/invoice-list.png)
*Invoice list view with status tracking, filtering, and export options*

![Invoice Detail](screenshots/invoice-detail.png)
*Detailed invoice view with print, PDF export, and payment options*

#### Customer Portal & Payments
![Customer Dashboard](screenshots/customer-dashboard.png)
*Customer portal showing pending invoices and payment history*

![Payment Gateway](screenshots/payment-form.png)
*Integrated IntaSend payment gateway for M-Pesa and card payments*

#### Utility Services & OCR
![Meter Reading](screenshots/meter-reading.png)
*Meter reading records with OCR extraction and consumption tracking*

![OCR Upload](screenshots/ocr-upload.png)
*Azure AI-powered OCR for automatic data extraction from documents*

![Customer Management](screenshots/customer-list.png)
*Customer management with contact information and export capabilities*

</div>

### CI/CD Pipeline

<div align="center">

#### GitHub Actions Workflow
![CI/CD Workflow Overview](screenshots/cicd-workflow-overview.png)
*Automated deployment pipeline with build, test, and deploy stages*

![CI/CD Job Details](screenshots/cicd-job-details.png)
*Detailed job execution logs showing build steps and deployment status*

</div>

## 🏗️ Architecture

### Frontend Stack
- **React 19** - UI component framework
- **React Router 7** - Client-side routing
- **Tailwind CSS 4** - Utility-first styling
- **Dexie 4** - IndexedDB wrapper for offline data
- **Clerk** - Authentication & user management
- **Vite 5** - Fast build tool and dev server
- **Capacitor 7** - Native mobile app wrapper (Android)
- **Axios** - HTTP client for API calls

### Backend Stack
- **Node.js + Express** - REST API server
- **MongoDB Atlas** - Cloud document database
- **Mongoose 8** - Schema validation & ORM
- **Multer** - File upload handling
- **Azure Computer Vision** - OCR text extraction
- **Azure Document Intelligence** - Advanced document processing
- **IntaSend** - Payment gateway (M-Pesa, Cards, KES/USD)
- **Clerk** - Authentication webhook integration
- **Node-Cron** - Subscription scheduler
- **Nodemailer** - Email notifications

### Mobile Platform
- **Capacitor** - Cross-platform native runtime
- **Android SDK 35** - Target Android version
- **Gradle 8.13** - Android build system
- **ProGuard/R8** - Code optimization and obfuscation

### Key Architecture Patterns
- **Offline-First**: Local-first with background sync to server
- **Optimistic Updates**: UI updates before server confirmation
- **Idempotent Operations**: Safe retry logic for failed syncs
- **Role-Based Access Control**: Seller vs customer permission layers
- **String-based IDs**: UUID strings instead of MongoDB ObjectIds for client-server compatibility
- **Environment-Based Configuration**: Development, staging, and production URL management

## 📋 Project Structure

```
├── client/                          # React frontend (Vite + Capacitor)
│   ├── android/                     # Native Android project
│   │   ├── app/
│   │   │   ├── src/main/
│   │   │   │   ├── AndroidManifest.xml
│   │   │   │   ├── res/
│   │   │   │   │   ├── values/
│   │   │   │   │   │   ├── colors.xml
│   │   │   │   │   │   ├── strings.xml
│   │   │   │   │   │   └── styles.xml
│   │   │   │   │   └── xml/
│   │   │   │   │       ├── network_security_config.xml
│   │   │   │   │       └── file_paths.xml
│   │   │   ├── build.gradle
│   │   │   └── proguard-rules.pro
│   │   ├── build.gradle
│   │   ├── variables.gradle
│   │   ├── keystore.properties.example
│   │   └── .gitignore
│   ├── src/
│   │   ├── components/              # Reusable React components
│   │   │   ├── Header.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── Layout.jsx
│   │   │   ├── Button.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── AddInvoiceForm.jsx
│   │   │   ├── AddRecordForm.jsx
│   │   │   ├── CustomerOcrRecordForm.jsx
│   │   │   ├── OcrUploader.jsx
│   │   │   ├── PaymentForm.jsx
│   │   │   └── ServiceForm.jsx
│   │   ├── pages/                   # Page components
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── SellerDashboardPage.jsx (removed)
│   │   │   ├── InvoicesPage.jsx
│   │   │   ├── InvoiceDetailPage.jsx
│   │   │   ├── CustomersPage.jsx
│   │   │   ├── CustomerDetailPage.jsx
│   │   │   ├── CustomerDashboardPage.jsx
│   │   │   ├── RecordsPage.jsx
│   │   │   ├── UtilityServicesPage.jsx
│   │   │   ├── RoleSelectionPage.jsx
│   │   │   ├── AboutPage.jsx
│   │   │   ├── ContactPage.jsx
│   │   │   └── PrivacyPolicyPage.jsx
│   │   ├── services/                # API & business logic
│   │   │   ├── api.js               # Axios instance with env-based URL
│   │   │   ├── syncService.js       # Offline sync engine
│   │   │   ├── invoiceService.js
│   │   │   ├── customerService.js
│   │   │   ├── recordService.js
│   │   │   ├── utilityService.js
│   │   │   ├── paymentService.js
│   │   │   ├── portalService.js
│   │   │   └── ocrService.js
│   │   ├── context/                 # React context
│   │   │   └── ThemeContext.jsx
│   │   ├── db.js                    # Dexie schema definition (v5)
│   │   ├── App.jsx                  # Root component & routing
│   │   └── main.jsx
│   ├── public/
│   │   └── service-worker.js        # Offline service worker
│   ├── .env                         # Environment variables (DEV/PROD URLs)
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js               # Environment-aware proxy config
│   ├── capacitor.config.json        # Capacitor mobile configuration
│   ├── tailwind.config.js
│   └── jsconfig.json
│
├── server/                          # Node.js backend (Express)
│   ├── src/
│   │   ├── server.js                # Express app entry
│   │   ├── config/
│   │   │   └── db.js                # MongoDB connection
│   │   ├── controllers/             # Request handlers
│   │   │   ├── invoiceController.js
│   │   │   ├── customerController.js
│   │   │   ├── recordController.js
│   │   │   ├── paymentController.js
│   │   │   ├── ocrController.js
│   │   │   ├── portalController.js
│   │   │   └── utilityServiceController.js
│   │   ├── models/                  # MongoDB schemas
│   │   │   ├── Invoice.js
│   │   │   ├── Customer.js
│   │   │   ├── Record.js
│   │   │   ├── Payment.js
│   │   │   ├── UtilityService.js
│   │   │   └── Counter.js
│   │   ├── routes/                  # API endpoints
│   │   │   ├── invoiceRoutes.js
│   │   │   ├── customerRoutes.js
│   │   │   ├── recordRoutes.js
│   │   │   ├── paymentRoutes.js
│   │   │   ├── ocrRoutes.js
│   │   │   ├── portalRoutes.js
│   │   │   ├── utilityServiceRoutes.js
│   │   │   └── webhookRoutes.js
│   │   ├── middleware/              # Express middleware
│   │   │   ├── authMiddleware.js
│   │   │   ├── errorHandler.js
│   │   │   ├── logger.js
│   │   │   ├── uploadMiddleware.js
│   │   │   └── performanceMonitor.js
│   │   ├── services/
│   │   │   ├── ocrService.js        # Azure OCR integration
│   │   │   └── emailService.js      # Nodemailer email service
│   │   └── utils/
│   │       ├── asyncHandler.js
│   │       └── paymentProvider.js   # IntaSend integration
│   ├── uploads/                     # User-uploaded files
│   │   ├── invoices/
│   │   └── records/
│   ├── .env                         # Environment configuration
│   ├── package.json
│   ├── jest.config.js
│   └── tests/
│       ├── setup.js
│       ├── unit/
│       └── integration/
│
├── guides/
│   └── ANDROID_PACKAGING.md         # Comprehensive Android build guide
│
└── README.md (this file)
```

## 🔄 Data Flow & Sync Architecture

### Offline-First Sync Flow
```
User Action (Create Invoice)
    ↓
[1] Optimistically update local Dexie DB
[2] Add job to syncQueue table
[3] UI updates immediately
    ↓
Background Sync (every 5 seconds in App.jsx)
    ↓
[4] Process syncQueue items via syncService.js
[5] Call appropriate API endpoint (POST/PUT/DELETE)
[6] On success: Write server response back to Dexie
[7] Remove item from syncQueue
[8] If offline: Queue persists, retries when online
```

### Data Types & String IDs
- **Invoice**: `_id` (string UUID), `customer` (string ref to Customer._id)
- **Customer**: `_id` (string UUID), unique `email` and `phone`
- **Record**: `_id` (string UUID), `invoice` (string ref)
- **Payment**: `_id` (string UUID), `invoice` (string ref)
- **UtilityService**: `_id` (string UUID), `fees` (array of objects)

All IDs are **strings** (not MongoDB ObjectIds) to ensure client-server compatibility and enable client-side UUID generation.

## 🎯 Role-Based Features

### Seller Dashboard
```
📊 Seller Dashboard
├─ Statistics Cards (Total, Sent, Paid, Revenue)
├─ Recent Invoices (Last 5 with status badges)
├─ Top Customers (By revenue)
└─ Quick Actions (Create Invoice, Manage Customers, View Records)
```

### Customer Portal
```
📋 Customer Dashboard
├─ My Invoices (Filtered by email, status: sent/paid/overdue)
├─ Invoice Details (View full invoice, payment options)
└─ Payment Gateway (Pay via card/online)
```

## 🛠️ Tech Stack Details

### Frontend Technologies

| Technology | Purpose | Version |
|-----------|---------|---------|
| React | UI framework | 19.2.0 |
| Vite | Build tool | 6.x |
| React Router | Client routing | 7.9.6 |
| Tailwind CSS | Styling | 4.1.17 |
| Dexie | IndexedDB layer | 4.2.1 |
| Clerk | Auth & user mgmt | 5.55.0 |
| Axios | HTTP client | 1.13.2 |
| Capacitor | Mobile runtime | 7.4.4 |
| Capacitor Android | Android platform | 7.4.4 |

### Backend Technologies

| Technology | Purpose | Version |
|-----------|---------|---------|
| Node.js | Runtime | 18+ |
| Express | Web framework | 4.18.2 |
| MongoDB | Database | 5.0+ (Atlas) |
| Mongoose | ODM | 8.19.4 |
| Multer | File uploads | 1.4.5-lts.1 |
| Azure Computer Vision | OCR text extraction | Latest |
| Azure Document Intelligence | Document processing | Latest |
| IntaSend | Payment gateway | 1.1.2 |
| Clerk SDK Node | Backend auth | 4.13.23 |
| Node-Cron | Task scheduler | 3.0.3 |
| Nodemailer | Email service | 6.10.1 |
| Jest | Testing | 30.2.0 |

### Mobile & Build Technologies

| Technology | Purpose | Version |
|-----------|---------|---------|
| Gradle | Android build | 8.13.1 |
| Android SDK | Target platform | API 35 |
| Min SDK | Minimum support | API 23 |
| ProGuard/R8 | Code optimization | Built-in |
| Java | Android compatibility | 17 |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB 5.0+ Atlas (cloud database)
- Clerk account for authentication
- Azure account for Computer Vision & Document Intelligence
- IntaSend account for payment processing
- Modern browser with IndexedDB support
- (Optional) Android Studio for mobile app development

### Frontend Setup

```bash
cd client
npm install

# Configure environment variables
# Edit .env with your API keys and URLs

# Development URLs (for ngrok testing)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
VITE_API_BASE_URL_DEV=https://your-ngrok-url.ngrok-free.dev/api
VITE_API_BASE_URL_PROD=https://your-production-backend.onrender.com/api
VITE_API_BASE_URL=https://your-ngrok-url.ngrok-free.dev/api

# Start development server
npm run dev
# Frontend runs on http://localhost:5173
```

### Backend Setup

```bash
cd server
npm install

# Configure environment variables in .env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/recordiq
CLERK_SECRET_KEY=sk_test_your_secret_key
CLERK_WEBHOOK_SECRET_LOCAL=whsec_your_webhook_secret

# IntaSend Payment Configuration
INTASEND_PUBLISHABLE_KEY=ISPubKey_test_your_key
INTASEND_SECRET_KEY=ISSecretKey_test_your_key

# Azure OCR Configuration
AZURE_COMPUTER_VISION_KEY=your_azure_key
AZURE_COMPUTER_VISION_ENDPOINT=https://your-service.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=your_azure_key
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-service.cognitiveservices.azure.com/

# Frontend URLs for CORS
FRONTEND_URL_DEV=http://localhost:5173
FRONTEND_URL_NGROK=https://your-ngrok-url.ngrok-free.dev
FRONTEND_URL_PROD=https://your-frontend.vercel.app
FRONTEND_URL=http://localhost:5173

CORS_ALLOWED_ORIGINS=http://localhost:5173,https://your-ngrok-url.ngrok-free.dev,capacitor://localhost,http://localhost

# Start development server
npm run dev
# Backend runs on http://localhost:5000
```

### Android App Setup

```bash
cd client

# Build web assets
npm run build

# Initialize Capacitor (first time only)
npm run cap:init

# Add Android platform (first time only)
npm run cap:add:android

# Sync web assets to Android
npm run cap:sync

# Open in Android Studio
npm run cap:open:android

# Build debug APK
npm run build:android:debug

# Build release APK (requires keystore)
npm run build:android:release
```

See `guides/ANDROID_PACKAGING.md` for comprehensive Android build instructions.

### Initial Configuration

1. **Clerk Setup**
   - Create application in Clerk dashboard
   - Get publishable key for frontend
   - Get secret key for backend
   - Configure webhooks for user management
   - Add custom metadata fields: `role` (seller/customer)

2. **MongoDB Atlas Setup**
   - Create free cluster on MongoDB Atlas
   - Whitelist your IP address
   - Create database user with read/write permissions
   - Get connection string
   - Collections auto-created on first write

3. **Azure Setup**
   - Create Computer Vision resource
   - Create Document Intelligence resource
   - Get API keys and endpoints for both services
   - Configure for OCR text extraction

4. **IntaSend Setup**
   - Create account on IntaSend
   - Get test API keys for development
   - Get production API keys for live payments
   - Configure webhooks for payment notifications
   - Note: Pricing in USD, processing in KES

5. **Environment Variables Summary**
   - **Frontend**: `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_BASE_URL_DEV`, `VITE_API_BASE_URL_PROD`
   - **Backend**: All keys listed in `.env` template above

## 📱 Key Features Walkthrough

### Creating a Utility Service Invoice

```jsx
// User flow
1. Navigate to /invoices
2. Click "Add Invoice"
3. Select customer from dropdown
4. Add utility service (water/electricity/gas)
5. Enter meter reading (previous/current)
6. Additional line items if needed
7. System calculates consumption and fees automatically
8. Set due date
9. Click "Save Invoice"

// Behind the scenes
→ Locally stored in Dexie as draft
→ Added to syncQueue
→ Background sync sends to server (5-second interval)
→ Server generates invoiceNumber (auto-increment)
→ Response synced back to local DB
→ UI updates with server-generated data
```

### OCR Meter Reading

```jsx
// User flow
1. Navigate to /records
2. Click "Add Record with OCR"
3. Upload meter photo
4. Azure Computer Vision extracts text
5. System identifies meter reading numbers
6. Auto-populates current reading
7. Select service and customer
8. Previous reading fetched automatically
9. Consumption calculated
10. Save record

// Behind the scenes
→ Image uploaded to server via multer
→ Azure Computer Vision API called
→ OCR text extracted and parsed
→ Meter reading identified via pattern matching
→ Record saved with OCR metadata
→ Synced to local Dexie DB
```

### Sending Invoice & Payment

```jsx
// User flow
1. Open invoice detail (/invoices/{id})
2. Click "Send Invoice"
3. Status changes to "sent"
4. Customer receives email notification
5. Customer views invoice in portal
6. Customer clicks "Pay Now"
7. Redirected to IntaSend payment page
8. Completes M-Pesa or card payment
9. Webhook updates invoice status to "paid"

// Behind the scenes
→ Local status updated to "sent"
→ syncQueue item added with action="update"
→ Server updates invoice status
→ Email service sends notification to customer
→ Customer accesses /customer-dashboard
→ Payment initiated via IntaSend API
→ Webhook receives payment confirmation
→ Invoice status updated to "paid"
→ Background sync updates local DB
```

### Offline Functionality

```
When offline:
✓ All data operations (CRUD) work normally
✓ Changes stored locally in Dexie
✓ syncQueue accumulates pending actions
✓ Service Worker caches API responses

When coming back online:
✓ Background sync automatically triggers
✓ syncQueue processes all pending items
✓ Server confirms or rejects changes
✓ Conflicts resolved via server-of-truth pattern
✓ UI automatically refreshes
```

## 🔐 Security & Authentication

- **Clerk Integration**: All requests validated via Clerk JWT tokens
- **Role-Based Access**: Middleware checks `publicMetadata.role` (seller/customer)
- **Data Isolation**: Users can only access their own data
- **String IDs**: UUIDs generated client-side, harder to enumerate
- **Customer Portal**: Invoices filtered by email + status constraints

## 📊 API Endpoints

### Invoices
```
GET    /api/invoices?sync=true        # Get all invoices (for sync)
GET    /api/invoices/{id}             # Get single invoice
POST   /api/invoices                  # Create invoice
PUT    /api/invoices/{id}             # Update invoice
DELETE /api/invoices/{id}             # Delete invoice
```

### Customers
```
GET    /api/customers                 # Get all customers
POST   /api/customers                 # Create customer
PUT    /api/customers/{id}            # Update customer
DELETE /api/customers/{id}            # Delete customer
```

### Customer Portal
```
GET    /api/portal/invoices           # Get customer's invoices (filtered by email)
GET    /api/portal/invoices/{id}      # Get single invoice (with access check)
```

### Records (OCR)
```
GET    /api/records                   # Get all records
POST   /api/records                   # Create record
PUT    /api/records/{id}              # Update record
DELETE /api/records/{id}              # Delete record
GET    /api/ocr/extract               # Extract text from image
```

## 🎨 UI/UX Highlights

### Responsive Design
- Mobile-first approach with Tailwind breakpoints
- Optimized form layouts for small screens
- Touch-friendly button sizing (min 44px)
- Collapsible navigation on mobile

### Accessibility
- Semantic HTML structure
- ARIA labels where needed
- Keyboard navigation support
- High contrast dark/light modes
- Form validation with clear error messages

### Performance
- Code splitting via React Router
- Lazy loading of pages
- Service Worker caching
- Dexie for instant data access
- Optimistic UI updates

## 📸 Screenshots (Placeholder)

<div style="text-align: center; padding: 20px;">

### Dashboard Overview
```
[Screenshot: Seller Dashboard with stats cards]
📊 Statistics overview with key metrics
- Total Invoices card
- Sent Invoices card
- Paid Invoices card
- Total Revenue card (green)
```

### Invoice Management
```
[Screenshot: Invoice creation form]
📝 Dynamic invoice form with:
- Customer selector dropdown
- Line item grid (description, qty, price)
- Quick add from service templates
- Total calculation
```

### Mobile Experience
```
[Screenshot: Mobile navigation menu]
📱 Responsive mobile menu with:
- Hamburger navigation
- Sign-in buttons for guests
- Dark/light theme toggle
- Navigation links
```

### Customer Portal
```
[Screenshot: Customer invoice view]
🔒 Customer-facing invoice portal with:
- Invoice details
- Payment options
- Status display
- Download/print options
```

</div>

## 🌐 Deployment

### Frontend Deployment

**Vercel (Recommended)**
```bash
# 1. Push code to GitHub
# 2. Connect repo to Vercel
# 3. Add environment variables:
#    - VITE_CLERK_PUBLISHABLE_KEY
#    - VITE_API_URL (backend URL)
# 4. Deploy automatically on push

# Live URL: [Add your Vercel deployment link here]
```

**Alternative: Netlify**
```bash
npm run build
netlify deploy --prod --dir=dist

# Live URL: [Add your Netlify deployment link here]
```

**Alternative: Self-hosted (Docker)**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY client/ .
RUN npm install && npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

### Backend Deployment

**Render (Recommended)**
```bash
# 1. Connect GitHub repo
# 2. Add environment variables:
#    - MONGODB_URI
#    - CLERK_SECRET_KEY
#    - NODE_ENV=production
# 3. Deploy automatically on push

# Live URL: [Add your Render deployment link here]
```

**Alternative: Railway**
```bash
railway login
railway link
railway up

# Live URL: [Add your Railway deployment link here]
```

**Alternative: Self-hosted (Docker)**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY server/ .
RUN npm install
EXPOSE 5000
CMD ["npm", "start"]
```

**Alternative: Heroku**
```bash
heroku login
heroku create recordiq-api
git push heroku main

# Live URL: [Add your Heroku deployment link here]
```

## 🔗 Deployment Links

| Component | Provider | Status | Link |
|-----------|----------|--------|------|
| Frontend | Vercel | 🚀 Live | [Add frontend URL] |
| Backend | Render | 🚀 Live | [Add backend URL] |
| Database | MongoDB Atlas | 🚀 Live | [Private] |
| Auth | Clerk | ✅ Configured | [Configured] |

## 📈 Monitoring & Logging

### Frontend Monitoring
- Browser console logs for development
- Error boundaries for crash handling
- Performance metrics via Web Vitals
- Offline status detection

### Backend Monitoring
- Express request logging (morgan)
- Error stack traces
- Database query logging
- Performance monitoring middleware

## 🧪 Testing

### Frontend Tests
```bash
cd client
npm run test          # Run unit tests
npm run test:e2e      # Run E2E tests
```

### Backend Tests
```bash
cd server
npm run test          # Run unit tests
npm run test:integration  # Run integration tests
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Git Workflow

```bash
# Clone
git clone https://github.com/masmunge95/Recordiq.git
cd Recordiq

# Setup
cd client && npm install && cd ..
cd server && npm install && cd ..

# Development
# Terminal 1: Frontend
cd client && npm run dev

# Terminal 2: Backend
cd server && npm run dev

# Commit
git add .
git commit -m "feat: description"
git push origin main
```

## 🐛 Troubleshooting

### Sync Issues
**Problem**: Changes not syncing to server
- Check browser console for errors
- Verify network connectivity
- Check server logs for API errors
- Inspect syncQueue in Dexie DevTools

**Solution**:
```javascript
// In browser console
await db.syncQueue.toArray()  // See pending items
await db.open()               // Reconnect to DB
```

### Offline Issues
**Problem**: No offline functionality
- Ensure service worker is registered
- Check IndexedDB quota
- Clear browser cache and retry

### Authentication Issues
**Problem**: Clerk login not working
- Verify Clerk publishable key
- Check Clerk dashboard configuration
- Clear browser cookies

## 📚 Additional Resources

- [React Documentation](https://react.dev)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Dexie.js Guide](https://dexie.org)
- [MongoDB Manual](https://docs.mongodb.com)
- [Express.js Guide](https://expressjs.com)
- [Clerk Documentation](https://clerk.com/docs)

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Team

- **Developer**: Samuel Munge Waema
- **Project**: Recordiq - Invoice Management & OCR Platform
- **Started**: 2025

## 📞 Support

- Email: waemasamuel95@gmail.com

---

**Last Updated**: November 20, 2025  
**Status**: Active Development  
**Version**: 1.0.0
