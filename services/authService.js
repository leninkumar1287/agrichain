const { User } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class AuthService {
  async register(userData) {
    try {
      const { username, email, password, role, walletAddress } = userData;

      // Check if user already exists
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [{ email }, { username }]
        }
      });

      if (existingUser) {
        throw new Error('User with this email or username already exists');
      }

      // Create new user
      const user = await User.create({
        username,
        email,
        password,
        role,
        walletAddress
      });

      // Generate JWT token
      const token = this.generateToken(user);

      return { user, token };
    } catch (error) {
      throw new Error(`Error registering user: ${error.message}`);
    }
  }

  async login(email, password) {
    try {
      const user = await User.findOne({ where: { email } });
      if (!user) {
        throw new Error('User not found');
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        throw new Error('Invalid credentials');
      }

      const token = this.generateToken(user);
      return { user, token };
    } catch (error) {
      throw new Error(`Error logging in: ${error.message}`);
    }
  }

  generateToken(user) {
    return jwt.sign(
      { 
        id: user.id,
        role: user.role,
        email: user.email
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
  }

  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const user = await User.findByPk(decoded.id);
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    } catch (error) {
      throw new Error(`Invalid token: ${error.message}`);
    }
  }

  async updateUser(userId, updateData) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // If updating password, hash it
      if (updateData.password) {
        const salt = await bcrypt.genSalt(10);
        updateData.password = await bcrypt.hash(updateData.password, salt);
      }

      await user.update(updateData);
      return user;
    } catch (error) {
      throw new Error(`Error updating user: ${error.message}`);
    }
  }
}

module.exports = new AuthService(); 