const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');

// GET all users (admin only)
router.get('/', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      include: [{ model: require('../models').Role, as: 'Role' }],
      attributes: ['id', 'full_name', 'email', 'verified', 'is_active', 'profile_picture', 'dealership_name', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    // Transform the data to include role name
    const transformedUsers = users.map(user => ({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.Role ? user.Role.name : 'User',
      verified: user.verified,
      is_active: user.is_active,
      profile_picture: user.profile_picture || null,
      dealership_name: user.dealership_name || null,
      createdAt: user.createdAt
    }));

    res.json(transformedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET single user (admin only)
router.get('/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await User.findByPk(userId, {
      include: [{ model: require('../models').Role, as: 'Role' }],
      attributes: ['id', 'full_name', 'email', 'verified', 'is_active', 'profile_picture', 'createdAt']
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Transform the data to include role name
    const transformedUser = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.Role ? user.Role.name : 'User',
      verified: user.verified,
      is_active: user.is_active,
      profile_picture: user.profile_picture,
      createdAt: user.createdAt
    };

    res.json(transformedUser);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PUT update user role (MyADMIN only)
router.put('/:id/role', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const { role } = req.body;
    if (!role || !['User', 'Admin'].includes(role)) {
      return res.status(400).json({ error: 'Valid role is required (User or Admin)' });
    }

    // Check if the current user is MyADMIN
    if (req.user.full_name !== 'MyADMIN') {
      return res.status(403).json({ error: 'Only MyADMIN can change user roles' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent MyADMIN from changing their own role
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    // Find the role by name and update the user's role_id
    const Role = require('../models').Role;
    const roleRecord = await Role.findOne({ where: { name: role } });
    if (!roleRecord) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    await user.update({ role_id: roleRecord.id });

    res.json({ 
      message: 'User role updated successfully',
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: role
      }
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// PUT activate/deactivate user (MyADMIN only)
router.put('/:id/status', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' });
    }

    // Check if the current user is MyADMIN
    if (req.user.full_name !== 'MyADMIN') {
      return res.status(403).json({ error: 'Only MyADMIN can activate/deactivate users' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent MyADMIN from deactivating themselves
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    await user.update({ is_active });

    res.json({ 
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully`,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        is_active: user.is_active
      }
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// DELETE user (MyADMIN only)
router.delete('/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Check if the current user is MyADMIN
    if (req.user.full_name !== 'MyADMIN') {
      return res.status(403).json({ error: 'Only MyADMIN can delete users' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent MyADMIN from deleting themselves
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await user.destroy();

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// GET user statistics (admin only)
router.get('/stats/overview', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { is_active: true } });
    const verifiedUsers = await User.count({ where: { verified: true } });
    
    // Count admin users using the role relationship
    const Role = require('../models').Role;
    const adminRole = await Role.findOne({ where: { name: 'Admin' } });
    const adminUsers = adminRole ? await User.count({ where: { role_id: adminRole.id } }) : 0;

    res.json({
      total: totalUsers,
      active: activeUsers,
      verified: verifiedUsers,
      admins: adminUsers
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
});

module.exports = router; 