const http = require('http');

const data = JSON.stringify({
  email: 'test@test.com',
  password: 'test123'
});

const options = {
  hostname: 'localhost',
  port: 5002,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('Testing login API...');

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    console.log('Response Body:', body);
    try {
      const response = JSON.parse(body);
      console.log('Parsed Response:', response);
    } catch (e) {
      console.log('Failed to parse JSON');
    }
  });
});

req.on('error', (error) => {
  console.error('Request Error:', error.message);
});

req.write(data);
req.end();