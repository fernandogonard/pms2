// Debug server with detailed error handling
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Catch all uncaught exceptions and rejections
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  console.error('Stack:', err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  console.error('Stack:', err.stack);
  process.exit(1);
});

console.log('🔄 Starting debug server...');

// Load environment variables
dotenv.config({ path: './config/.env' });
console.log('✅ Environment variables loaded');

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());
console.log('✅ Basic middleware configured');

// Test route
app.get('/', (req, res) => {
  console.log('📥 GET / request received');
  res.json({ message: 'Debug server running', timestamp: new Date().toISOString() });
});

// Simple login route without complex dependencies
app.post('/api/auth/login', (req, res) => {
  console.log('📥 POST /api/auth/login request received:', req.body);
  res.json({ 
    success: true, 
    message: 'Login successful',
    token: 'debug-token-123',
    timestamp: new Date().toISOString()
  });
});

console.log('✅ Routes configured');

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm-hotelero';
console.log('🔄 Connecting to MongoDB:', MONGO_URI);

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB');
  
  // Start server only after DB connection
  const PORT = 5002;
  const server = app.listen(PORT, '0.0.0.0', (err) => {
    if (err) {
      console.error('❌ Server startup error:', err);
      return;
    }
    console.log(`🚀 Debug server running on http://localhost:${PORT}`);
    console.log('💡 Server is ready to accept connections');
    console.log(`📡 Listening on all interfaces: 0.0.0.0:${PORT}`);
  });

  server.on('error', (err) => {
    console.error('❌ Server error:', err);
  });

  // Keep process alive
  setInterval(() => {
    console.log('⏰ Server heartbeat -', new Date().toISOString());
  }, 30000);

})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

console.log('🔄 Server setup complete, waiting for MongoDB connection...');