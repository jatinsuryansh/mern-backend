const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Post = require('../models/postModel');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for post image uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'backend/uploads/posts');
  },
  filename: function(req, file, cb) {
    cb(null, `post-${Date.now()}${path.extname(file.originalname)}`);
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

// Create a post
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    console.log('Creating post with data:', {
      body: req.body,
      file: req.file,
      user: req.user._id
    });

    const { title, content, tags } = req.body;

    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({ 
        message: 'Title and content are required' 
      });
    }

    // Create the uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'posts');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const post = new Post({
      title,
      content,
      author: req.user._id,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      image: req.file ? `/uploads/posts/${req.file.filename}` : ''
    });

    console.log('Saving post:', post);

    const createdPost = await post.save();
    const populatedPost = await Post.findById(createdPost._id)
      .populate('author', 'username profilePicture');

    console.log('Post created successfully:', populatedPost);
    
    res.status(201).json(populatedPost);
  } catch (error) {
    console.error('Error creating post:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({ 
      message: 'Failed to create post',
      error: error.toString()
    });
  }
});

// Get all posts with pagination
router.get('/', async (req, res) => {
  try {
    const pageSize = 10;
    const page = Number(req.query.page) || 1;
    const keyword = req.query.keyword
      ? {
          $or: [
            { title: { $regex: req.query.keyword, $options: 'i' } },
            { content: { $regex: req.query.keyword, $options: 'i' } }
          ]
        }
      : {};

    const count = await Post.countDocuments({ ...keyword });
    const posts = await Post.find({ ...keyword })
      .populate('author', 'username profilePicture')
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .skip(pageSize * (page - 1));

    res.json({
      posts,
      page,
      pages: Math.ceil(count / pageSize),
      total: count
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get post by ID
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'username profilePicture')
      .populate('comments.user', 'username profilePicture');
    
    if (post) {
      res.json(post);
    } else {
      res.status(404);
      throw new Error('Post not found');
    }
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// Update post
router.put('/:id', protect, upload.single('image'), async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (post) {
      if (post.author.toString() !== req.user._id.toString()) {
        res.status(401);
        throw new Error('Not authorized to update this post');
      }

      post.title = req.body.title || post.title;
      post.content = req.body.content || post.content;
      if (req.body.tags) {
        post.tags = req.body.tags.split(',').map(tag => tag.trim());
      }
      if (req.file) {
        post.image = `/uploads/posts/${req.file.filename}`;
      }

      const updatedPost = await post.save();
      res.json(updatedPost);
    } else {
      res.status(404);
      throw new Error('Post not found');
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete post
router.delete('/:id', protect, async (req, res) => {
  try {
    console.log('Delete request received:', {
      postId: req.params.id,
      userId: req.user._id
    });

    // First find the post
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      console.log('Post not found:', req.params.id);
      return res.status(404).json({ message: 'Post not found' });
    }

    console.log('Post found:', {
      postId: post._id,
      authorId: post.author,
      userId: req.user._id,
      isAuthor: post.author.toString() === req.user._id.toString()
    });

    // Check ownership
    if (post.author.toString() !== req.user._id.toString()) {
      console.log('Unauthorized delete attempt');
      return res.status(401).json({ message: 'Not authorized to delete this post' });
    }

    // Delete the post
    const deletedPost = await Post.findByIdAndDelete(req.params.id);
    
    if (deletedPost) {
      console.log('Post deleted successfully:', deletedPost._id);
      return res.status(200).json({ 
        message: 'Post deleted successfully',
        postId: deletedPost._id 
      });
    } else {
      console.log('Post not found during deletion');
      return res.status(404).json({ message: 'Post not found during deletion' });
    }
  } catch (error) {
    console.error('Error in delete route:', error);
    return res.status(500).json({ 
      message: 'Server error while deleting post',
      error: error.message 
    });
  }
});

// Add comment to post
router.post('/:id/comments', protect, async (req, res) => {
  try {
    const { text } = req.body;
    const post = await Post.findById(req.params.id);

    if (post) {
      const comment = {
        text,
        user: req.user._id
      };

      post.comments.push(comment);
      await post.save();
      
      const updatedPost = await Post.findById(req.params.id)
        .populate('comments.user', 'username profilePicture');
      
      res.status(201).json(updatedPost.comments);
    } else {
      res.status(404);
      throw new Error('Post not found');
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Like/Unlike post
router.patch('/:id/like', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const index = post.likes.findIndex(
      (id) => id.toString() === req.user._id.toString()
    );

    if (index === -1) {
      post.likes.push(req.user._id);
    } else {
      post.likes = post.likes.filter(
        (id) => id.toString() !== req.user._id.toString()
      );
    }

    const updatedPost = await post.save();
    res.json(updatedPost.likes);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router; 