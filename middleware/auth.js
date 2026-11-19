// Basic authentication middleware placeholder
const ensureAuthenticated = (req, res, next) => {
  try {
    console.log('=== AUTHENTICATION CHECK ===');
    console.log('Session:', req.session);
    console.log('User in session:', req.session?.user);
    console.log('Path:', req.path);
    
    if (req.session && req.session.user) {
      req.user = req.session.user;
      console.log('User authenticated:', req.user);
      return next();
    }
    
    console.log('No user in session');
    
    // Check if it's an API request
    if (req.path.startsWith('/api/')) {
      console.log('API request without authentication - returning 401');
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // For web routes, redirect to login
    console.log('Web request without authentication - redirecting to login');
    res.redirect('/login');
  } catch (error) {
    console.error('Authentication error:', error);
    if (req.path.startsWith('/api/')) {
      return res.status(500).json({ error: 'Authentication error' });
    }
    res.redirect('/login');
  }
};

// Middleware to ensure the user is an admin
const ensureAdmin = (req, res, next) => {
  try {
    console.log('=== ADMIN CHECK ===');
    console.log('User data:', req.user);
    console.log('User role_id:', req.user?.role_id);
    console.log('User role:', req.user?.role);
    
    // Check if user exists and has admin role
    // Check both role_id and role field for compatibility
    const isAdmin = req.user && (
      req.user.role_id === 2 || 
      (req.user.role && req.user.role.toLowerCase() === 'admin')
    );
    
    console.log('Admin check result:', isAdmin);
    
    if (isAdmin) {
      console.log('User is admin - proceeding');
      return next();
    }
    
    console.log('User is not admin');
    
    // Check if it's an API request
    if (req.path.startsWith('/api/')) {
      console.log('API request from non-admin - returning 403');
      return res.status(403).json({ error: 'Forbidden: Admins only' });
    }
    
    // For web routes, redirect to dashboard
    console.log('Web request from non-admin - redirecting to dashboard');
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Admin authorization error:', error);
    if (req.path.startsWith('/api/')) {
      return res.status(500).json({ error: 'Authorization error' });
    }
    res.redirect('/dashboard');
  }
};

module.exports = {
  ensureAuthenticated,
  ensureAdmin,
};
