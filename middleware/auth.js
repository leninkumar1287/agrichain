const jwt = require('jsonwebtoken');
const { User } = require('../models');

const auth = (allowedRoles = []) => {
    return async (req, res, next) => {
        try {
            console.log('Auth middleware called');
            // Get token from header
            const token = req.header('Authorization')?.replace('Bearer ', '');
            
            if (!token) {
                return res.status(401).json({ message: 'No token provided' });
            }

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Get user from database
            const user = await User.findByPk(decoded.id);
            if (!user || !user.isActive) {
                return res.status(401).json({ message: 'User not found or inactive' });
            }

            // Check if user's role is allowed
            if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
                return res.status(403).json({ message: 'Access denied' });
            }

            // Add user to request object
            req.user = user;
            next();
        } catch (error) {
            console.error('Auth middleware error:', error);
            res.status(401).json({ message: 'Invalid token' });
        }
    };
};

module.exports = auth; 