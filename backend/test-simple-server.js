// Simple test server
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Test server running' });
});

// Simple login test
app.post('/api/auth/login', (req, res) => {
  console.log('Login attempt:', req.body);
  res.json({ 
    success: true, 
    message: 'Login successful',
    token: 'test-token-123'
  });
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});