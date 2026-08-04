const express = require('express');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors({
  origin: '*', // Production mein apni frontend URL yahan set kar sakte ho
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. Root / Health Check Route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Vercel Express Server is running active and live!',
    timestamp: new Date().toISOString()
  });
});

// 2. Sample API GET Route
app.get('/api/v1/users', (req, res) => {
  res.status(200).json({
    success: true,
    data: [
      { id: 1, name: 'Vanshika', role: 'Admin' },
      { id: 2, name: 'Developer', role: 'User' }
    ]
  });
});

// 3. Sample API POST Route
app.post('/api/v1/data', (req, res) => {
  const payload = req.body;
  
  if (!payload || Object.keys(payload).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No data provided in request body'
    });
  }

  res.status(201).json({
    success: true,
    message: 'Data received successfully',
    receivedData: payload
  });
});

// 4. 404 Route Handling (Agar koi galat URL hit kare)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API Route not found'
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: err.message
  });
});

// Local testing port
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server is running locally at http://localhost:${PORT}`);
  });
}

// Vercel Serverless Function execution ke liye export karna mandatory hai
module.exports = app;
