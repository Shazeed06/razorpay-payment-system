// routes/payment.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentcontroller');

// Create order
router.post('/create-order', paymentController.createOrder);

// Verify payment
router.post('/verify-payment', paymentController.verifyPayment);

// Get payment details from Razorpay
router.get('/payment/:paymentId', paymentController.getPaymentDetails);

// Get all saved payment records
router.get('/records', paymentController.listPayments);

// Download Excel report (auto-updated file)
router.get('/export', paymentController.exportToExcel);

module.exports = router;
