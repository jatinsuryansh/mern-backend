const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');

const protect = asyncHandler(async (req, res, next) => {
  let token;

  console.log('Auth Headers:', {
    authorization: req.headers.authorization,
    method: req.method,
    path: req.path
  });

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token decoded:', { userId: decoded.id });

      // Get user from token
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        throw new Error('User not found');
      }

      req.user = user;
      console.log('User authenticated:', { 
        userId: user._id,
        username: user.username 
      });

      next();
    } catch (error) {
      console.error('Auth Error:', {
        message: error.message,
        token: token ? 'Present' : 'Missing',
        error: error.toString()
      });
      
      res.status(401).json({
        message: 'Not authorized, token failed',
        error: error.message
      });
    }
  } else {
    console.error('No token provided in request');
    res.status(401).json({
      message: 'Not authorized, no token'
    });
  }
});

module.exports = { protect }; 