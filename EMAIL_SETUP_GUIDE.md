# Email Invitation Setup Guide

## Current Status
✅ Invitation system is working - users are being added to the database
✅ Email service code is implemented
⚠️ Emails are not being sent because Gmail SMTP credentials need to be configured

## Setup Steps

### 1. Create Gmail App Password

1. **Go to your Google Account**: https://myaccount.google.com/
2. **Enable 2-Factor Authentication** (if not already enabled):
   - Go to Security → 2-Step Verification
   - Follow the prompts to enable it

3. **Create an App Password**:
   - Go to Security → App passwords
   - Select "Mail" and "Other (Custom name)"
   - Name it "JuaAfya SMTP"
   - Click "Generate"
   - **Copy the 16-character password** (you won't be able to see it again)

### 2. Configure Supabase Environment Variables

1. **Open your Supabase Dashboard**:
   - Go to https://supabase.com/dashboard
   - Select your project
   - Navigate to **Settings** → **Edge Functions**

2. **Add the following environment variables** (Custom SMTP Preferred):
   ```
   SMTP_HOST = mail.yourdomain.com
   SMTP_PORT = 587
   SMTP_USER = notifications@yourdomain.com
   SMTP_PASSWORD = your-secure-smtp-password
   SMTP_FROM = "JuaAfya Support" <notifications@yourdomain.com>
   ```

3. **Or persist with Gmail (Legacy support)**:
   ```
   GMAIL_SMTP_USER = your-email@gmail.com
   GMAIL_SMTP_PASSWORD = xxxxyyyyyxxxxzzzz  (the 16-character app password)
   ```

3. **Save** the environment variables

### 3. Deploy the Edge Function (if not already deployed)

Run this command in your terminal:
```bash
npx supabase functions deploy send-email
```

### 4. Test the Invitation System

1. Reload your application
2. Go to Settings → Team Members
3. Click "Invite User"
4. Enter an email address and select a role
5. Click "Send Invite"

**Expected Result**: The invited user should:
- Appear in the team list with "Invited" status (already working ✅)
- Receive an email with a signup link (will work after Step 2 is completed)

## Troubleshooting

### Email Still Not Sending?

1. **Check the browser console** for any error messages
2. **Check Supabase Function Logs**:
   - Go to Supabase Dashboard → Edge Functions → send-email
   - Click on "Logs" to see if there are any errors

### Common Issues:

1. **"Gmail authentication failed"**:
   - Make sure you're using an App Password, not your regular Gmail password
   - Verify the App Password is correct (no spaces)

2. **"Email service not configured"**:
   - Environment variables are not set in Supabase
   - Redeploy the Edge Function after adding env vars

3. **"SMTP server connection failed"**:
   - Check if your network/firewall blocks port 587
   - Try using port 465 with SSL instead

## Alternative: Use a Different Email Service

If Gmail SMTP doesn't work for you, you can integrate with:
- **Resend** (resend.com) - Easy to set up, generous free tier
- **SendGrid** - Popular email service
- **AWS SES** - Good for high volume

Let me know if you need help setting up an alternative!
