const express = require('express');
const router = express.Router();
const { User } = require('../models');
const auth = require('../middleware/auth');

// Get all users with their roles
router.get('/', auth(['admin']), async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'email', 'role', 'isActive']
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Update user role
router.put('/:userId', auth(['admin']), async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findByPk(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.update({ role });
    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ message: 'Error updating user role' });
  }
});

// Deactivate user
router.put('/:userId/deactivate', auth(['admin']), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.update({ isActive: false });
    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating user:', error);
    res.status(500).json({ message: 'Error deactivating user' });
  }
});

module.exports = router; 