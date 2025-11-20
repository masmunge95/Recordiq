# Deployment Setup Guide

This guide covers setting up automated deployments to Vercel (frontend) and Render (backend) using GitHub Actions.

---

## Overview

- **Frontend (client/)**: Deploys to Vercel on every push to `main`
- **Backend (server/)**: Deploys to Render on every push to `main`
- **Android APK**: Builds automatically when you push version tags (e.g., `v1.0.0`)

---

## 1. Vercel Setup (Frontend)

### A. Create Vercel Project

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### B. Get Vercel Credentials

1. Go to [Vercel Dashboard](https://vercel.com/account/tokens)
2. Create a new token → copy it (this is `VERCEL_TOKEN`)
3. Go to your project settings
4. Copy the **Project ID** (from Settings → General)
5. Copy your **Org/Team ID**:
   - Personal account: Settings → General → Your ID
   - Team: Team Settings → General → Team ID

### C. Configure Environment Variables in Vercel

In your Vercel project settings → Environment Variables, add:

- `VITE_API_BASE_URL` = `https://your-backend.onrender.com` (your Render backend URL)
- Add any other `VITE_*` variables your app needs (Clerk publishable key, etc.)

---

## 2. Render Setup (Backend)

### A. Create Render Web Service

1. Go to [render.com](https://render.com) and sign in with GitHub
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: recordiq-backend (or your choice)
   - **Root Directory**: `server`
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (or paid for production)

### B. Configure Environment Variables in Render

In your Render service → Environment, add:

- `NODE_ENV` = `production`
- `MONGODB_URI` = `your-mongodb-connection-string` (use MongoDB Atlas)
- `PORT` = `10000` (Render default)
- `CLERK_SECRET_KEY` = `your-clerk-secret`
- `AZURE_COMPUTER_VISION_ENDPOINT` = `your-azure-endpoint`
- `AZURE_COMPUTER_VISION_KEY` = `your-azure-key`
- Any other secrets your backend needs

### C. Get Render Deploy Hook

1. In Render service → Settings → Deploy Hook
2. Create a new deploy hook
3. Copy the URL (this is `RENDER_DEPLOY_HOOK_URL`)

---

## 3. GitHub Secrets Setup

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Add these secrets:

### Vercel Secrets
- `VERCEL_TOKEN` - Your Vercel API token
- `VERCEL_ORG_ID` - Your Vercel organization/team ID
- `VERCEL_PROJECT_ID` - Your Vercel project ID
- `VITE_API_BASE_URL` - Your production API URL (e.g., `https://recordiq-backend.onrender.com`)

### Render Secrets
- `RENDER_DEPLOY_HOOK_URL` - Your Render deploy hook URL

### Optional (for other environments)
- Any other `VITE_*` environment variables your frontend needs (Clerk keys, etc.)

---

## 4. MongoDB Atlas Setup (Database)

If you haven't already:

1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Create a database user
4. Whitelist all IPs (0.0.0.0/0) for Render access, or add Render's IP ranges
5. Get your connection string and add it to Render environment as `MONGODB_URI`

---

## 5. Update CORS Configuration

Edit `server/src/server.js` to allow your Vercel domain:

```javascript
const cors = require('cors');

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://your-vercel-app.vercel.app',
  'https://your-custom-domain.com'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

---

## 6. Deployment Workflow

### Automatic Deployments

- **Push to `main`**: Automatically deploys frontend to Vercel and backend to Render
- **Create a version tag** (e.g., `git tag v1.0.0 && git push origin v1.0.0`): Builds Android APK and creates a GitHub release

### Manual Deployments

You can also trigger deployments manually:

**Vercel (frontend):**
```powershell
cd client
npm run build
vercel --prod
```

**Render (backend):**
- Use the "Manual Deploy" button in Render dashboard, or
- Push to main branch (auto-deploys)

**Android APK:**
```powershell
cd client
npm run build:android:debug
# APK is in: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 7. Testing Your Deployment

After setup:

1. **Test Frontend**: Visit your Vercel URL
2. **Test Backend**: `curl https://your-backend.onrender.com/health` (if you have a health endpoint)
3. **Test Integration**: 
   - Sign in on the Vercel frontend
   - Create a customer, invoice, or record
   - Verify data syncs to backend (check Render logs)
4. **Test Android**: Install the APK from GitHub releases and verify it connects to production backend

---

## 8. Rebuild Android APK with Production API

After deploying your backend to Render, rebuild the Android APK with the production API URL:

```powershell
cd client
$env:VITE_API_BASE_URL = 'https://your-backend.onrender.com'
npm run build
npx cap sync android
npm run android:assembleDebug
```

Or push a version tag to trigger the GitHub Actions build:

```powershell
git tag v1.0.0
git push origin v1.0.0
```

---

## 9. Troubleshooting

**Vercel build fails:**
- Check build logs in Vercel dashboard
- Verify `VITE_API_BASE_URL` is set in Vercel environment variables
- Ensure `client/package.json` has correct build script

**Render deploy fails:**
- Check Render logs for errors
- Verify all environment variables are set
- Test `npm start` locally in `server/` directory

**GitHub Actions fails:**
- Check Actions tab for error logs
- Verify all secrets are configured correctly
- Ensure `client/android` folder exists (run `npx cap add android` first)

**Android APK can't connect to backend:**
- Verify `VITE_API_BASE_URL` was set during build
- Check CORS settings on backend
- Ensure Render service is running (not sleeping on free tier)

---

## Quick Reference Commands

```powershell
# Build and test locally
cd client
npm run build
npm run preview

# Deploy manually to Vercel
vercel --prod

# Build Android APK with production API
$env:VITE_API_BASE_URL = 'https://your-backend.onrender.com'
npm run build:android:debug

# Create a version tag (triggers Android build in CI)
git tag v1.0.0
git push origin v1.0.0
```

---

## Next Steps

1. Complete Vercel and Render setup
2. Configure all GitHub secrets
3. Push to `main` to trigger first deployment
4. Test the deployed apps
5. Create a version tag to build Android APK
6. Download and test the APK from GitHub releases
