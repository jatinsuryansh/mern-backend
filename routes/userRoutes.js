const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/userModel');
const multer = require('multer');
const path = require('path');

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'backend/uploads/profiles');
  },
  filename: function(req, file, cb) {
    cb(null, `user-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 5 }, // 5MB limit
  fileFilter: function(req, file, cb) {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb('Error: Images only!');
    }
  }
});

// Register user
router.post('/register', async (req, res) => {
  try {
    console.log('Register request:', {
      username: req.body.username,
      email: req.body.email
    });

    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        message: 'Please provide all required fields'
      });
    }

    const userExists = await User.findOne({ $or: [{ email }, { username }] });

    if (userExists) {
      return res.status(400).json({
        message: userExists.email === email ? 'Email already registered' : 'Username already taken'
      });
    }

    const user = await User.create({
      username,
      email,
      password
    });

    console.log('User created:', {
      userId: user._id,
      username: user.username
    });

    const token = generateToken(user._id);
    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(400).json({ 
      message: error.message || 'Registration failed',
      error: error.toString()
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    console.log('Login request:', {
      email: req.body.email
    });

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Please provide email and password'
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    console.log('User logged in:', {
      userId: user._id,
      username: user.username
    });

    const token = generateToken(user._id);
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      profilePicture: user.profilePicture,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ 
      message: error.message || 'Login failed',
      error: error.toString()
    });
  }
});

// Update profile
router.put('/profile', protect, upload.single('profilePicture'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.username = req.body.username || user.username;
      user.email = req.body.email || user.email;
      user.bio = req.body.bio || user.bio;
      
      if (req.file) {
        user.profilePicture = `/uploads/profiles/${req.file.filename}`;
      }
      
      if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();
      res.json({
        _id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        profilePicture: updatedUser.profilePicture,
        bio: updatedUser.bio,
        token: generateToken(updatedUser._id)
      });
    } else {
      res.status(404);
      throw new Error('User not found');
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get user profile
router.get('/profile/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (user) {
      res.json(user);
    } else {
      res.status(404);
      throw new Error('User not found');
    }
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

module.exports = router; 