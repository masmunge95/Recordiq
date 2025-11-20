# Recordiq - Invoice Management & OCR Platform

A modern, offline-first invoice management system with OCR capabilities for small businesses and service providers. Built with React, Node.js, MongoDB, and Dexie for local-first data synchronization.

## 🚀 Features

### Core Invoice Management
- **Create & Manage Invoices** - Generate professional invoices with dynamic line items
- **Customer Management** - Track customers with contact information and payment history
- **Invoice Status Tracking** - Draft → Sent → Paid workflow with real-time updates
- **Payment Processing** - Integrated payment gateway for online collections
- **Invoice Portal** - Customers can view sent invoices via secure portal

### OCR & Document Processing
- **Receipt/Document Scanning** - Upload images and extract invoice data via OCR
- **Auto-Population** - Scanned data auto-fills invoice forms
- **Records Management** - Organize and search processed documents

### Advanced Capabilities
- **Utility Services** - Configure service templates with fees and auto-calculation
- **Role-Based Access** - Separate seller and customer dashboards
- **Offline Support** - Full offline functionality with background sync
- **Dark/Light Theme** - User preference persistence across sessions
- **Responsive Design** - Mobile-optimized interface for all devices

### Business Intelligence
- **Seller Dashboard** - Overview of invoices, revenue, and top customers
- **Analytics** - Key metrics: total invoices, sent count, paid count, revenue
- **Recent Activity** - Quick access to recent invoices and customer interactions

## 🏗️ Architecture

### Frontend Stack
- **React 18** - UI component framework
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first styling
- **Dexie 5** - IndexedDB wrapper for offline data
- **Clerk** - Authentication & user management
- **Vite** - Fast build tool and dev server

### Backend Stack
- **Node.js + Express** - REST API server
- **MongoDB** - Document database
- **Mongoose** - Schema validation & ORM
- **Multer** - File upload handling
- **Tesseract.js** - OCR processing

### Key Architecture Patterns
- **Offline-First**: Local-first with background sync to server
- **Optimistic Updates**: UI updates before server confirmation
- **Idempotent Operations**: Safe retry logic for failed syncs
- **Role-Based Access Control**: Seller vs customer permission layers
- **String-based IDs**: UUID strings instead of MongoDB ObjectIds for client-server compatibility

## 📋 Project Structure

```
├── client/                          # React frontend (Vite)
│   ├── src/
│   │   ├── components/              # Reusable React components
│   │   │   ├── Header.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── Button.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── AddInvoiceForm.jsx
│   │   │   ├── AddRecordForm.jsx
│   │   │   └── OcrUploader.jsx
│   │   ├── pages/                   # Page components
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── SellerDashboardPage.jsx
│   │   │   ├── InvoicesPage.jsx
│   │   │   ├── InvoiceDetailPage.jsx
│   │   │   ├── CustomersPage.jsx
│   │   │   ├── RecordsPage.jsx
│   │   │   ├── UtilityServicesPage.jsx
│   │   │   ├── CustomerDashboardPage.jsx
│   │   │   ├── RoleSelectionPage.jsx
│   │   │   └── [other pages]
│   │   ├── services/                # API & business logic
│   │   │   ├── api.js               # Axios instance
│   │   │   ├── syncService.js       # Offline sync engine
│   │   │   ├── invoiceService.js
│   │   │   ├── customerService.js
│   │   │   ├── recordService.js
│   │   │   ├── dbUtils.js           # Data sanitization
│   │   │   └── [other services]
│   │   ├── context/                 # React context
│   │   │   └── ThemeContext.jsx
│   │   ├── db.js                    # Dexie schema definition
│   │   ├── App.jsx                  # Root component & routing
│   │   └── main.jsx
│   ├── public/
│   │   ├── recordiq.svg
│   │   └── service-worker.js        # Offline service worker
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
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
│   │   │   ├── utilityServiceController.js
│   │   │   └── salesController.js
│   │   ├── models/                  # MongoDB schemas
│   │   │   ├── Invoice.js
│   │   │   ├── Customer.js
│   │   │   ├── Record.js
│   │   │   ├── Payment.js
│   │   │   ├── UtilityService.js
│   │   │   └── [other models]
│   │   ├── routes/                  # API endpoints
│   │   │   ├── invoiceRoutes.js
│   │   │   ├── customerRoutes.js
│   │   │   ├── recordRoutes.js
│   │   │   ├── paymentRoutes.js
│   │   │   ├── ocrRoutes.js
│   │   │   ├── portalRoutes.js
│   │   │   └── [other routes]
│   │   ├── middleware/              # Express middleware
│   │   │   ├── authMiddleware.js
│   │   │   ├── errorHandler.js
│   │   │   ├── logger.js
│   │   │   ├── uploadMiddleware.js
│   │   │   └── performanceMonitor.js
│   │   ├── services/
│   │   │   └── ocrService.js
│   │   └── utils/
│   │       ├── asyncHandler.js
│   │       └── paymentProvider.js
│   ├── uploads/                     # User-uploaded files
│   ├── package.json
│   ├── jest.config.js
│   └── tests/
│       ├── unit/
│       └── integration/
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
| React | UI framework | 18.x |
| Vite | Build tool | 4.x |
| React Router | Client routing | 6.x |
| Tailwind CSS | Styling | 3.x |
| Dexie | IndexedDB layer | 5.x |
| Clerk | Auth & user mgmt | Latest |
| Axios | HTTP client | Latest |

### Backend Technologies

| Technology | Purpose | Version |
|-----------|---------|---------|
| Node.js | Runtime | 18+ |
| Express | Web framework | 4.x |
| MongoDB | Database | 5.0+ |
| Mongoose | ODM | 7.x |
| Multer | File uploads | 1.4.x |
| Tesseract.js | OCR | 4.x |
| Jest | Testing | Latest |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB 5.0+ (local or Atlas)
- Clerk account for authentication
- Modern browser with IndexedDB support

### Frontend Setup

```bash
cd client
npm install
cp .env.example .env.local

# Add your Clerk API keys to .env.local
VITE_CLERK_PUBLISHABLE_KEY=your_key_here

npm run dev
# Frontend runs on http://localhost:5173
```

### Backend Setup

```bash
cd server
npm install
cp .env.example .env

# Add configuration to .env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/recordiq
CLERK_SECRET_KEY=your_secret_key
PORT=5000

npm run dev
# Backend runs on http://localhost:5000
```

### Initial Configuration

1. **Clerk Setup**
   - Create organization in Clerk dashboard
   - Set up authentication flows
   - Configure webhooks for role management

2. **MongoDB Setup**
   - Create database `recordiq`
   - Collections auto-created on first write
   - Indexes created by Mongoose schemas

3. **Environment Variables**
   - Frontend: `VITE_CLERK_PUBLISHABLE_KEY`
   - Backend: `MONGODB_URI`, `CLERK_SECRET_KEY`, `STRIPE_KEY` (if using payments)

## 📱 Key Features Walkthrough

### Creating an Invoice

```jsx
// User flow
1. Navigate to /invoices
2. Click "Add Invoice"
3. Select customer
4. Add line items (description, qty, price)
5. Set due date
6. Click "Save Invoice"

// Behind the scenes
→ Locally stored in Dexie as draft
→ Added to syncQueue
→ 5-second sync sends to server
→ Server generates invoiceNumber
→ Response synced back to local DB
```

### Sending Invoice to Customer

```jsx
// User flow
1. Open invoice detail (/invoices/{id})
2. Click "Send Invoice"
3. Status changes to "sent"
4. Customer receives access via portal

// Behind the scenes
→ Local status updated to "sent"
→ syncQueue item added with action="send"
→ Sync calls updateInvoice(id, { status: 'sent' })
→ Server response written back to local DB
→ Customer can now view on portal (/customer-dashboard)
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
- Sign-in button for guests
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
git clone https://github.com/yourusername/recordiq.git
cd recordiq

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

- **Developer**: [Your Name]
- **Project**: Recordiq - Invoice Management & OCR Platform
- **Started**: 2025

## 📞 Support

- Email: support@recordiq.local
- Issues: [GitHub Issues Link]
- Discussions: [GitHub Discussions Link]

---

**Last Updated**: November 20, 2025  
**Status**: Active Development  
**Version**: 1.0.0
