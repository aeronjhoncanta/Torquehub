# Email Notification Setup Guide

## Current Status
✅ **Server is running on port 3000**  
✅ **Email service code is properly implemented**  
✅ **SMTP configuration is working**  
✅ **Email notifications are functional**

## The Problem
Your email notifications are not working because the SMTP (email server) configuration is not set up. The system is trying to use default placeholder values which don't work.

## Solution: Set Up Gmail SMTP

### Step 1: Enable 2-Factor Authentication on Gmail
1. Go to your Google Account settings: https://myaccount.google.com/
2. Navigate to "Security"
3. Enable "2-Step Verification" if not already enabled

### Step 2: Generate an App Password
1. In your Google Account settings, go to "Security"
2. Find "App passwords" (under 2-Step Verification)
3. Select "Mail" and "Other (Custom name)"
4. Name it "TorqueHub" and click "Generate"
5. **Copy the 16-character password** (you'll only see it once!)

### Step 3: Create .env File
Create a file named `.env` in your project root (same folder as `package.json`) with this content:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=torquehubmotor

# Server Configuration
PORT=3000
NODE_ENV=development

# SMTP Configuration for Email Notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-actual-gmail@gmail.com
SMTP_PASS=your-16-character-app-password

# Base URL for email links
BASE_URL=http://localhost:3000

# JWT Secret
JWT_SECRET=your-secret-key-here
```

**Important:** Replace `your-actual-gmail@gmail.com` with your real Gmail address and `your-16-character-app-password` with the app password you generated.

### Step 4: Restart the Server
After creating the `.env` file, restart your server:

```bash
npm start
```

### Step 5: Test Email Configuration
Run the test script to verify everything is working:

```bash
node test-email-config.js
```

You should see:
- ✅ SMTP connection verified successfully!
- ✅ Email notifications should work properly!

## What This Enables

Once configured, you'll get email notifications for:

1. **New Transaction Creation** - When a user places an order
2. **Status Updates** - When transaction status changes (pending → confirmed → shipped → delivered)
3. **Order Receipts** - Comprehensive email with all order details after checkout
4. **PDF Receipts** - For delivered orders, emails with PDF attachments

## Email Features Already Implemented

✅ **Rich HTML Email Templates** - Professional-looking emails with TorqueHub branding  
✅ **Status-Specific Messages** - Different content based on order status  
✅ **PDF Receipt Generation** - Automatic PDF creation for delivered orders  
✅ **Order Confirmation Emails** - Detailed emails after checkout with all items  
✅ **Dashboard Integration** - Recent orders section with email functionality  

## Troubleshooting

### If emails still don't work:
1. **Check Gmail settings**: Make sure "Less secure app access" is disabled (use App Passwords instead)
2. **Verify App Password**: Make sure you copied the 16-character password correctly
3. **Check .env file**: Ensure it's in the project root and has no extra spaces
4. **Restart server**: Always restart after changing .env file

### Common Errors:
- `535-5.7.8 Username and Password not accepted` → Wrong credentials or 2FA not enabled
- `Connection timeout` → Check internet connection
- `Authentication failed` → Use App Password, not regular password

## Test the Setup

After configuration, test by:
1. Going to your transaction management page
2. Changing a transaction status
3. Check your email for the notification
4. Check server console for success messages

## Security Notes

- Never commit your `.env` file to version control
- Use App Passwords instead of your main Gmail password
- The `.env` file is already in `.gitignore` to prevent accidental commits

---

**Need Help?** If you're still having issues after following this guide, check the server console for specific error messages when trying to send emails. 