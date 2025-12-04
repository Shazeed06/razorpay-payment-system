require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const store = require('./store');
const PaymentRoutes = require('./routes/payment');
require('./db'); // initialize SQLite

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// Debug logger
app.use((req, res, next) => {
  console.log('>> INCOMING:', req.method, req.url);
  next();
});

// API routes
app.use('/api/payments', PaymentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Razorpay Payment Gateway API', status: 'Running' });
});

// dev only: see last created order in browser
app.get('/last-order', (req, res) => {
  const order = store.getLastOrder();
  if (order) return res.json({ ok: true, lastOrder: order });
  return res.status(404).json({ ok: false, message: 'No order saved yet' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`server is running on port ${PORT}`);
  console.log(`Visiting : http://localhost:${PORT}`);
});
