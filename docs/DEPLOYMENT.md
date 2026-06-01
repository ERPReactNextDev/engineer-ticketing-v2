# DSI Connect — Deployment Guide

> Instructions for building and deploying DSI Connect to production.

---

## Table of Contents

1. [Build Process](#1-build-process)
2. [Environment Variables](#2-environment-variables)
3. [Netlify Deployment](#3-netlify-deployment)
4. [Vercel Deployment](#4-vercel-deployment)
5. [Self-Hosted Deployment](#5-self-hosted-deployment)
6. [Post-Deployment Checklist](#6-post-deployment-checklist)
7. [Updating the App](#7-updating-the-app)

---

## 1. Build Process

### Local Build Test

Before deploying, always test the production build locally:

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Test the production build
npm run start
# Visit http://localhost:3000 to verify
```

### Build Output

The build generates a `.next/` folder with:
- Optimized JavaScript bundles
- Static HTML for pre-rendered pages
- PWA service worker (Workbox)
- Optimized images

### Common Build Issues

**Firebase Admin private key formatting:**
The private key in `.env.local` must have literal `\n` characters:
```bash
# Correct format:
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"

# Wrong (will cause build errors):
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQ...
-----END PRIVATE KEY-----"
```

**MongoDB connection in build:**
MongoDB connections are only used at runtime (API routes), not during build. Build failures related to MongoDB usually mean an import is being used at the module level instead of inside a function.

---

## 2. Environment Variables

All environment variables must be set in your deployment platform's settings panel. They are **not** committed to the repository.

### Required Variables

```bash
# MongoDB
MONGODB_URI=mongodb+srv://...

# Firebase Client (NEXT_PUBLIC_ prefix = exposed to browser)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=

# Firebase Admin (server-side only)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Web Push
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=

# Email
EMAIL_HOST=
EMAIL_PORT=
EMAIL_USER=
EMAIL_PASS=
```

### Optional Variables

```bash
# Google Sheets integration
GOOGLE_SHEETS_CLIENT_EMAIL=
GOOGLE_SHEETS_PRIVATE_KEY=
GOOGLE_SHEETS_SPREADSHEET_ID=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## 3. Netlify Deployment

The project includes a `netlify.toml` configuration file.

### Initial Setup

1. Push your code to a Git repository (GitHub, GitLab, Bitbucket)
2. Log in to [netlify.com](https://netlify.com)
3. Click **"Add new site" → "Import an existing project"**
4. Connect your Git repository
5. Netlify auto-detects Next.js settings from `netlify.toml`

### Build Settings (auto-detected from netlify.toml)

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

### Environment Variables in Netlify

1. Go to **Site Settings → Environment Variables**
2. Add each variable from Section 2
3. For `FIREBASE_ADMIN_PRIVATE_KEY`, paste the full key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
4. Netlify handles the newline escaping automatically

### Custom Domain

1. Go to **Site Settings → Domain Management**
2. Click **"Add custom domain"**
3. Follow DNS configuration instructions
4. SSL certificate is provisioned automatically

### Deploy Previews

Netlify automatically creates preview deployments for pull requests. Each PR gets a unique URL for testing before merging.

---

## 4. Vercel Deployment

### Initial Setup

1. Push code to GitHub/GitLab/Bitbucket
2. Log in to [vercel.com](https://vercel.com)
3. Click **"New Project"**
4. Import your repository
5. Vercel auto-detects Next.js — no configuration needed

### Environment Variables in Vercel

1. During import, or go to **Project Settings → Environment Variables**
2. Add each variable
3. Set scope: **Production**, **Preview**, and **Development** as needed

### Vercel-Specific Notes

- Vercel has a 10-second timeout for serverless functions on the free plan
- MongoDB connections may need connection pooling adjustments for serverless
- The `FIREBASE_ADMIN_PRIVATE_KEY` needs `\n` escaped as `\\n` in some Vercel configurations

---

## 5. Self-Hosted Deployment

For running on your own server (VPS, on-premise):

### Requirements

- Node.js 20.x
- npm 10.x
- Reverse proxy (nginx or Apache)
- SSL certificate (Let's Encrypt recommended)
- Process manager (PM2 recommended)

### Setup Steps

```bash
# 1. Clone repository on server
git clone <repo-url> /var/www/dsi-connect
cd /var/www/dsi-connect

# 2. Install dependencies
npm install --production

# 3. Create environment file
nano .env.local
# Add all required variables

# 4. Build
npm run build

# 5. Install PM2
npm install -g pm2

# 6. Start with PM2
pm2 start npm --name "dsi-connect" -- start
pm2 save
pm2 startup  # Enable auto-start on server reboot
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 6. Post-Deployment Checklist

After deploying, verify these items:

### Functionality Checks

- [ ] Login page loads correctly
- [ ] Can log in with valid credentials
- [ ] Dashboard loads with real-time data
- [ ] Firestore real-time updates work (open two tabs, submit a request in one, verify it appears in the other)
- [ ] File upload works (upload a profile picture)
- [ ] Push notifications work (enable in browser, trigger a test notification)
- [ ] PWA install prompt appears on mobile
- [ ] Password reset email is sent and received

### Security Checks

- [ ] HTTPS is enforced (HTTP redirects to HTTPS)
- [ ] Environment variables are not exposed in browser (check Network tab)
- [ ] Firebase Admin SDK is not accessible from client-side
- [ ] Firestore security rules are in production mode (not test mode)
- [ ] MongoDB Atlas IP whitelist includes deployment server IP

### Performance Checks

- [ ] Page load time under 3 seconds on 4G connection
- [ ] No console errors in production
- [ ] Images are optimized (Next.js Image component)
- [ ] Service worker is registered (check Application tab in DevTools)

---

## 7. Updating the App

### Standard Update Process

```bash
# 1. Pull latest changes
git pull origin main

# 2. Install any new dependencies
npm install

# 3. Build
npm run build

# 4. Restart (PM2 for self-hosted)
pm2 restart dsi-connect

# For Netlify/Vercel: push to main branch triggers automatic deployment
git push origin main
```

### Zero-Downtime Updates (Self-Hosted)

```bash
# PM2 handles graceful restarts automatically
pm2 reload dsi-connect
```

### Database Migrations

If a new version requires Firestore schema changes:
1. New fields are added with default values in the code
2. Existing documents without the new field will use the default
3. No migration scripts are needed for additive changes
4. For breaking changes, a migration script must be run before deploying

### Rollback

```bash
# Git rollback
git revert HEAD
git push origin main

# Or reset to specific commit
git reset --hard <commit-hash>
git push --force origin main  # Use with caution!
```

---

*For deployment issues, contact the development team.*
*Last updated: May 2026*
