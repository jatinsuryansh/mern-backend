const fs = require('fs');
const path = require('path');

// Create necessary directories if they don't exist
const createDirectories = () => {
  const dirs = [
    path.join(__dirname, '..', 'uploads'),
    path.join(__dirname, '..', 'uploads', 'posts'),
    path.join(__dirname, '..', 'uploads', 'profiles')
  ];

  dirs.forEach(dir => {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      } else {
        console.log(`Directory already exists: ${dir}`);
      }
    } catch (error) {
      console.error(`Error creating directory ${dir}:`, error);
    }
  });
};

module.exports = { createDirectories }; 