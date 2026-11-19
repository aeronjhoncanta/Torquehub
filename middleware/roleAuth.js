const { User } = require('../models');

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findByPk(req.user.id, {
      include: [{ model: require('../models').Role, as: 'Role' }]
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.Role || user.Role.name.toLowerCase() !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Role authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Middleware to check if user is active
const requireActiveUser = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    next();
  } catch (error) {
    console.error('Active user check error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = {
  requireAdmin,
  requireActiveUser
}; 