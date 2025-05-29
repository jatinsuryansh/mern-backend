const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { createDirectories } = require('./config/init');
const userRoutes = require('./routes/userRoutes');
const postRoutes = require('./routes/postRoutes');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Create necessary directories
createDirectories();

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5000'], // Allow frontend access from both ports
  credentials: true
}));

// Increase payload size limit
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    body: req.method === 'POST' ? 'POST DATA' : req.body,
    query: req.query,
    params: req.params,
    headers: {
      'content-type': req.headers['content-type'],
      'authorization': req.headers['authorization'] ? 'Bearer token present' : 'No token'
    }
  });
  next();
});

// Serve static files from the uploads directory with proper path
const uploadsPath = path.join(__dirname, 'uploads');
console.log('Uploads directory path:', uploadsPath);
app.use('/api/uploads', express.static(uploadsPath));

// MongoDB connection with retry logic
const connectDB = async (retryCount = 0) => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mern-blog';
    console.log('Connecting to MongoDB...', { mongoURI, retryCount });
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log('MongoDB Connected Successfully');
    
    // Test the connection by making a simple query
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));
    
  } catch (err) {
    console.error('MongoDB connection error:', err);
    
    if (retryCount < 3) {
      console.log(`Retrying connection in 5 seconds... (Attempt ${retryCount + 1}/3)`);
      setTimeout(() => connectDB(retryCount + 1), 5000);
    } else {
      console.error('Failed to connect to MongoDB after 3 attempts');
      process.exit(1);
    }
  }
};

// Connect to MongoDB before starting the server
connectDB().then(() => {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : null
  });
}); 