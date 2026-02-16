# Shared Hosting Deployment Guide

## Prerequisites
- Shared hosting with cPanel or FTP access
- Node.js installed locally (for building)
- Supabase account (free tier available)

## Step 1: Build the Application

Run these commands in your project folder:

```bash
# Install dependencies (if not already done)
npm install

# Build for production
npm run build
```

This creates a `dist` folder with all your static files.

## Step 2: Configure for Shared Hosting

### A. Update Base URL in `vite.config.ts`

If your site will be in a subdirectory (e.g., yourdomain.com/juaafya), update:

```typescript
export default defineConfig({
  base: '/juaafya/', // or '/' if at root domain
  // ... rest of config
})
```

### B. Create `.htaccess` for React Router

Create this file in your `dist` folder (or upload it with your files):

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

This ensures React Router works properly on shared hosting.

## Step 3: Upload Files

### Via cPanel File Manager:
1. Go to cPanel → File Manager
2. Navigate to `public_html` (or your domain folder)
3. Upload all files from the `dist` folder
4. Make sure `.htaccess` is uploaded too

### Via FTP:
1. Connect using FileZilla or similar FTP client
2. Upload `dist` folder contents to your web root
3. Ensure `.htaccess` is uploaded

## Step 4: Update Environment Variables

Your Supabase URL and keys are already in the built files (from `.env`), but verify:

```bash
# .env file should have:
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Note**: These are PUBLIC keys, safe to expose in frontend code (protected by RLS).

## Step 5: Configure Supabase for Your Domain

In Supabase Dashboard:
1. Go to Authentication → URL Configuration
2. Add your shared hosting domain to "Site URL"
3. Add your domain to "Redirect URLs" (for OAuth)

Example:
- Site URL: `https://yourdomain.com`
- Redirect URLs: 
  - `https://yourdomain.com/**`
  - `http://yourdomain.com/**` (for testing)

## Step 6: Test Your Deployment

1. Visit your domain
2. Test login/signup
3. Verify database operations work
4. Check Edge Functions (email, SMS, etc.)

---

## Cost Breakdown

### Recommended Setup:
- **Shared Hosting**: $3-10/month (your current hosting)
- **Supabase Free Tier**: 
  - ✅ 500MB database
  - ✅ 50,000+ monthly active users
  - ✅ 2GB file storage
  - ✅ Edge Functions (2M invocations/month)

**Total**: $3-10/month (just hosting cost!)

### When to Upgrade Supabase:
- **Pro ($25/month)**: 8GB database, 100GB storage, better support
- Only when you exceed free tier limits

---

## Performance Tips

### 1. Enable Compression
Add to `.htaccess`:
```apache
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript
</IfModule>
```

### 2. Browser Caching
Add to `.htaccess`:
```apache
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
</IfModule>
```

### 3. CDN (Optional but Recommended)
- **Cloudflare** (free tier): Add your domain for caching & DDoS protection

---

## Troubleshooting

### Issue: "404 on page refresh"
**Solution**: Upload the `.htaccess` file

### Issue: "Supabase connection failed"
**Solution**: Check CORS settings in Supabase Dashboard

### Issue: "Slow loading"
**Solution**: Enable compression and caching in `.htaccess`

---

## Alternative: Fully Self-Hosted

If you want EVERYTHING on your server (not recommended for this stack):

### Requirements:
- **VPS/Dedicated Server** (not shared hosting)
- Linux with root access
- Docker installed
- 2GB+ RAM minimum

### Stack Changes Needed:
1. Self-host Supabase (complex, requires Docker)
2. Self-host PostgreSQL
3. Set up mail server (or use SMTP service)
4. Configure SSL certificates

**Cost**: $10-40/month for VPS + maintenance time

### Verdict: 
❌ **Not worth it** for this application. The hybrid approach (frontend on shared hosting + Supabase cloud) is:
- Cheaper
- More reliable
- Less maintenance
- Better performance
