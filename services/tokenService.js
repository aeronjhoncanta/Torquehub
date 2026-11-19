const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { User } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const TOKEN_EXPIRY = '24h';

class TokenService {
  // Generate JWT token
  static generateToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.Role ? user.Role.name : 'User',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };

    return jwt.sign(payload, JWT_SECRET);
  }

  // Verify JWT token
  static verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Generate auth token and save to database
  static async generateAndSaveToken(user) {
    // If user doesn't have Role loaded, fetch it
    if (!user.Role) {
      await user.reload({
        include: [{ model: require('../models').Role, as: 'Role' }]
      });
    }
    
    const token = this.generateToken(user);
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await user.update({
      auth_token: token,
      token_expires_at: tokenExpiry
    });

    return token;
  }

  // Validate token from database
  static async validateStoredToken(token) {
    try {
      const user = await User.findOne({
        where: {
          auth_token: token,
          token_expires_at: {
            [require('sequelize').Op.gt]: new Date()
          }
        }
      });

      if (!user) {
        return null;
      }

      // Verify JWT token
      const decoded = this.verifyToken(token);
      return user;
    } catch (error) {
      return null;
    }
  }

  // Clear user token
  static async clearUserToken(userId) {
    await User.update({
      auth_token: null,
      token_expires_at: null
    }, {
      where: { id: userId }
    });
  }

  // Generate verification token
  static generateVerificationToken() {
    return uuidv4();
  }

  // Generate password reset token
  static generatePasswordResetToken() {
    return uuidv4();
  }
}

module.exports = TokenService; 