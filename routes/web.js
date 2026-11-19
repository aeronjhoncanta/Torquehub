const express = require('express');
const router = express.Router();
const path = require('path');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');
const authController = require('../controllers/authController');

const rootPath = path.resolve(__dirname, '..');

// Helper function to serve views with error handling
const serveView = (viewPath) => {
  return (req, res) => {
    try {
      const filePath = path.join(rootPath, 'views', viewPath);
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error(`Error serving ${viewPath}:`, err);
          res.status(500).send('Internal Server Error');
        }
      });
    } catch (err) {
      console.error(`Error serving ${viewPath}:`, err);
      res.status(500).send('Internal Server Error');
    }
  };
};

// Public routes
router.get('/', serveView('index.html'));

// Test route for debugging
router.get('/test-auth', (req, res) => {
  console.log('Test auth route accessed');
  console.log('Session:', req.session);
  console.log('User:', req.user);
  res.json({
    session: req.session,
    user: req.user,
    authenticated: !!(req.session && req.session.user),
    isAdmin: req.session && req.session.user && (req.session.user.role_id === 2 || (req.session.user.role && req.session.user.role.toLowerCase() === 'admin'))
  });
});

// Authentication routes - serve HTML pages
router.get('/login', serveView('auth/login.html'));
router.get('/register', serveView('auth/register.html'));

// Email verification route
router.get('/auth/verify-email', authController.verifyEmail);

// Protected routes
router.get('/dashboard', ensureAuthenticated, serveView('dashboard.html'));
router.get('/adashboard', ensureAuthenticated, ensureAdmin, serveView('adashboard.html'));
// router.get('/addproduct', ensureAuthenticated, serveView('addproduct.html')); // Removed - functionality moved to product-management
router.get('/editprofile', ensureAuthenticated, serveView('editprofile.html'));
router.get('/cart', ensureAuthenticated, serveView('cart.html'));
router.get('/checkout', ensureAuthenticated, serveView('checkout.html'));

// New feature routes
// router.get('/transactions', ensureAuthenticated, serveView('transactions.html')); // Removed - functionality moved to transaction-management
router.get('/user-management', ensureAuthenticated, ensureAdmin, serveView('user-management.html'));
router.get('/product-management', ensureAuthenticated, ensureAdmin, serveView('product-management.html'));
router.get('/category-management', ensureAuthenticated, ensureAdmin, serveView('category-management.html'));
router.get('/services-management', ensureAuthenticated, ensureAdmin, serveView('services-management.html'));
// router.get('/file-uploads', ensureAuthenticated, serveView('file-uploads.html')); // Removed - functionality integrated into other pages
router.get('/charts', ensureAuthenticated, ensureAdmin, serveView('charts.html'));

// Enhanced Transaction Management Route
router.get('/transaction-management', ensureAuthenticated, serveView('transaction-management.html'));

// Purchase History Route
router.get('/purchase-history', ensureAuthenticated, serveView('purchase-history.html'));

// Login History route
router.get('/login-history', ensureAuthenticated, ensureAdmin, serveView('login-history.html'));

// Bulk Upload Route
router.get('/bulk-upload', ensureAuthenticated, ensureAdmin, serveView('bulk-upload.html'));

router.get('/my-transactions', ensureAuthenticated, (req, res) => {
  // Redirect to transaction management page
  res.redirect('/transaction-management');
});

// Error pages
router.get('/404', serveView('404.html'));
router.get('/500', serveView('500.html'));

module.exports = router;