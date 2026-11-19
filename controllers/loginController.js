const bcrypt = require('bcryptjs');
const { User, LoginHistory } = require('../models');
const TokenService = require('../services/tokenService');

// Helper function to get client IP address
const getClientIP = (req) => {
  return req.headers['x-forwarded-for'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         'unknown';
};

// Helper function to log login attempt
const logLoginAttempt = async (email, ip, userAgent, status, userId = null, failureReason = null) => {
  try {
    await LoginHistory.create({
      user_id: userId,
      email: email,
      ip_address: ip,
      user_agent: userAgent,
      status: status,
      failure_reason: failureReason,
      login_time: new Date()
    });
  } catch (error) {
    console.error('Error logging login attempt:', error);
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      // Log failed attempt
      await logLoginAttempt(
        email || 'unknown',
        getClientIP(req),
        req.headers['user-agent'],
        'failed',
        null,
        'Missing email or password'
      );
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    
    const user = await User.findOne({ 
      where: { email },
      include: [{ model: require('../models').Role, as: 'Role' }]
    });
    
    if (!user) {
      // Log failed attempt
      await logLoginAttempt(
        email,
        getClientIP(req),
        req.headers['user-agent'],
        'failed',
        null,
        'User not found'
      );
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    
    if (!user.verified) {
      // Log failed attempt
      await logLoginAttempt(
        email,
        getClientIP(req),
        req.headers['user-agent'],
        'failed',
        user.id,
        'Email not verified'
      );
      return res.status(403).json({ error: 'Please verify your email before logging in.' });
    }
    
    if (!user.is_active) {
      // Log failed attempt
      await logLoginAttempt(
        email,
        getClientIP(req),
        req.headers['user-agent'],
        'failed',
        user.id,
        'Account deactivated'
      );
      return res.status(403).json({ error: 'Account is deactivated. Please contact administrator.' });
    }
    
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      // Log failed attempt
      await logLoginAttempt(
        email,
        getClientIP(req),
        req.headers['user-agent'],
        'failed',
        user.id,
        'Invalid password'
      );
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    
    // Log successful login
    await logLoginAttempt(
      email,
      getClientIP(req),
      req.headers['user-agent'],
      'success',
      user.id
    );
    
    // Generate JWT token and save to database
    const token = await TokenService.generateAndSaveToken(user);
    
    // Set user info in session
    req.session.user = {
      id: user.id,
      full_name: user.full_name,
      profile_picture: user.profile_picture,
      role: user.Role ? user.Role.name : 'User',
      role_id: user.role_id
    };
    
    console.log('=== LOGIN SUCCESS ===');
    console.log('User logged in:', req.session.user);
    console.log('Session ID:', req.sessionID);
    console.log('Role ID:', user.role_id);
    console.log('Role Name:', user.Role ? user.Role.name : 'User');
    
    res.json({ 
      message: 'Login successful', 
      user: req.session.user,
      token: token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
};
