# Git and GitHub Setup Guide

Complete guide to initialize Git, connect to GitHub, and push your project.

---

## Current Status

✅ Project files ready
✅ `.gitignore` files configured
✅ Android APK builds successfully
⏳ Not yet linked to remote GitHub repository

---

## Step-by-Step Git & GitHub Setup

### 1. Initialize Local Git Repository

```powershell
# From project root
cd "d:\PLP Academy\JULY 2025 COHORT\Specialization Final Project"

# Initialize git
git init

# Check git status
git status
```

### 2. Review What Will Be Committed

The `.gitignore` files will exclude:
- ❌ `node_modules/`
- ❌ `client/android/` (native project - regenerated via `npx cap add android`)
- ❌ `.env` files
- ❌ Build artifacts (`.apk`, `.aab`)
- ❌ Keystores
- ✅ Source code
- ✅ Configuration files
- ✅ Documentation

### 3. Stage All Files

```powershell
# Add all files (respecting .gitignore)
git add .

# Verify what's staged
git status
```

Expected output: Should show many files staged, but NOT `node_modules`, `android/`, `.env`, etc.

### 4. Create Initial Commit

```powershell
git commit -m "Initial commit: Recordiq offline-first invoicing app with pagination and mobile packaging"
```

### 5. Create GitHub Repository

**Option A: Via GitHub Website (Easier)**

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `recordiq` (or your choice)
3. Description: "Offline-first invoicing and record management app with sync, OCR, and mobile support"
4. Visibility: **Private** (recommended for now) or Public
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

**Option B: Via GitHub CLI (Advanced)**

```powershell
# Install GitHub CLI first (if not installed)
# https://cli.github.com/

# Login
gh auth login

# Create repo
gh repo create recordiq --private --description "Offline-first invoicing app" --source=. --push
```

### 6. Link Local Repo to GitHub

After creating the GitHub repo, you'll see commands like:

```powershell
# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/recordiq.git

# Verify remote
git remote -v
```

### 7. Push to GitHub

```powershell
# Rename default branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

---

## Important: Before Pushing

### A. Verify Sensitive Files Are Excluded

```powershell
# Check that these are NOT staged:
git status | Select-String "node_modules"  # Should be empty
git status | Select-String ".env"          # Should be empty
git status | Select-String "android/"      # Should be empty
git status | Select-String ".keystore"     # Should be empty
```

If any sensitive files appear, add them to `.gitignore` and run:

```powershell
git rm --cached <file-path>
git add .gitignore
git commit --amend -m "Initial commit: Recordiq app (fix sensitive files)"
```

### B. Double-Check Environment Variables

Ensure these files exist and are in `.gitignore`:
- `client/.env`
- `server/.env`

Add example files for reference (safe to commit):

```powershell
# Client example
@"
# API Configuration
VITE_API_BASE_URL=http://localhost:5000

# Clerk (get from https://dashboard.clerk.com/)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
"@ | Out-File -FilePath "client\.env.example" -Encoding UTF8

# Server example
@"
# Database
MONGODB_URI=mongodb://localhost:27017/recordiq

# Server
PORT=5000
NODE_ENV=development

# Clerk
CLERK_SECRET_KEY=sk_test_...

# Azure OCR
AZURE_COMPUTER_VISION_ENDPOINT=https://...
AZURE_COMPUTER_VISION_KEY=...

# IntaSend Payment (optional)
INTASEND_PUBLISHABLE_KEY=...
INTASEND_SECRET_KEY=...
"@ | Out-File -FilePath "server\.env.example" -Encoding UTF8

# Stage and commit
git add client/.env.example server/.env.example
git commit -m "Add .env.example files for reference"
```

---

## Post-Push Setup

### 1. Configure GitHub Secrets (for CI/CD)

Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret

Add these secrets (see `DEPLOYMENT.md` for details):

**Vercel:**
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `VITE_API_BASE_URL`

**Render:**
- `RENDER_DEPLOY_HOOK_URL`

**Optional (future iOS builds):**
- Apple certificates and provisioning profiles

### 2. Enable GitHub Actions

The workflow file `.github/workflows/deploy.yml` will run automatically on push to `main`.

Verify:
- Go to your repo → Actions tab
- You should see a workflow run
- Check for any errors

### 3. Protect Main Branch (Recommended)

1. Go to repo → Settings → Branches
2. Add branch protection rule for `main`:
   - ✅ Require pull request reviews
   - ✅ Require status checks to pass
   - ✅ Require branches to be up to date

---

## Daily Workflow (After Setup)

### Making Changes

```powershell
# Check status
git status

# Stage changes
git add .

# Commit
git commit -m "feat: add customer search pagination"

# Push
git push
```

### Creating Version Tags (Triggers Android Build)

```powershell
# Tag a release
git tag v1.0.0

# Push tag
git push origin v1.0.0

# GitHub Actions will build APK and create a release
```

### Pulling Changes (if working on multiple machines)

```powershell
git pull origin main
```

---

## Gradle Deprecation Warning - Not a Problem!

The warning you saw:
```
Deprecated Gradle features were used in this build, making it incompatible with Gradle 9.0.
```

**This is safe to ignore** because:
- ✅ You're using Gradle 8.x (current stable)
- ✅ Gradle 9.0 is not released yet (future version)
- ✅ Your APK builds successfully
- ✅ Capacitor will update their Gradle config before Gradle 9.0 is mandatory

You can suppress it by adding to `client/android/gradle.properties`:
```properties
org.gradle.warning.mode=none
```

But it's not necessary - the warning is just a heads-up for future compatibility.

---

## Clone and Setup (for teammates or new machines)

When someone clones your repo:

```powershell
# Clone
git clone https://github.com/YOUR_USERNAME/recordiq.git
cd recordiq

# Install dependencies
cd client
npm install
cd ../server
npm install
cd ..

# Copy and configure environment variables
Copy-Item client/.env.example client/.env
Copy-Item server/.env.example server/.env
# Edit .env files with actual credentials

# Regenerate Android platform (not in git)
cd client
npx cap add android
npx cap sync android

# Build and run
npm run build:android:debug
```

---

## Quick Commands Reference

```powershell
# Check current status
git status

# View commit history
git log --oneline

# View remote URL
git remote -v

# Create and push tag
git tag v1.0.1
git push origin v1.0.1

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Discard all local changes
git reset --hard HEAD

# View what will be committed
git diff --cached

# Remove file from git (but keep locally)
git rm --cached <file>
```

---

## Next Steps

After pushing to GitHub:

1. ✅ Verify files on GitHub (check that sensitive files are NOT there)
2. ✅ Set up Vercel and Render (see `DEPLOYMENT.md`)
3. ✅ Configure GitHub secrets
4. ✅ Test the CI/CD pipeline (push a small change)
5. ✅ Create your first version tag (`v1.0.0`) to build APK

---

## Troubleshooting

**"Permission denied" when pushing:**
- Use HTTPS: `https://github.com/USER/REPO.git`
- Or set up SSH keys: [docs.github.com/authentication/connecting-to-github-with-ssh](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

**Accidentally committed sensitive files:**
```powershell
# Remove from history (careful!)
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch path/to/sensitive/file" --prune-empty --tag-name-filter cat -- --all

# Force push (dangerous - only if repo is private and you're the only contributor)
git push origin --force --all
```

**Large files blocking push:**
- Check `.gitignore` includes `node_modules/`, `android/`, `*.apk`
- GitHub has 100MB file size limit

**Want to rename repo:**
- GitHub: Repo → Settings → Rename
- Local: `git remote set-url origin https://github.com/USER/NEW-NAME.git`
