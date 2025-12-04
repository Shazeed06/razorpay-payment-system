// controllers/paymentcontroller.js
const Razorpay = require('razorpay');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const store = require('../store');
const db = require('../db');

// Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Excel report path setup
const REPORT_DIR = path.join(__dirname, '../reports');
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR);
}
const REPORT_PATH = path.join(REPORT_DIR, 'payments_report.xlsx');

// Helper: regenerate Excel from DB
function regenerateExcelReport() {
  db.all(
    `SELECT 
        id,
        razorpay_order_id,
        razorpay_payment_id,
        amount,
        amount/100 AS amount_rupees,
        currency,
        status,
        customer_name,
        customer_email,
        customer_contact,
        created_at
     FROM payments
     ORDER BY id DESC`,
    async (err, rows) => {
      if (err) {
        console.error('Excel regenerate error:', err.message);
        return;
      }

      try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Payments');

        sheet.columns = [
          { header: 'ID', key: 'id', width: 8 },
          { header: 'Order ID', key: 'razorpay_order_id', width: 28 },
          { header: 'Payment ID', key: 'razorpay_payment_id', width: 28 },
          { header: 'Amount (₹)', key: 'amount_rupees', width: 14 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Name', key: 'customer_name', width: 18 },
          { header: 'Email', key: 'customer_email', width: 25 },
          { header: 'Contact', key: 'customer_contact', width: 18 },
          { header: 'Created At', key: 'created_at', width: 22 }
        ];

        rows.forEach(r => sheet.addRow(r));

        await workbook.xlsx.writeFile(REPORT_PATH);
        console.log('✅ Excel report updated at:', REPORT_PATH);
      } catch (e) {
        console.error('Excel write error:', e.message);
      }
    }
  );
}

// ================= CREATE ORDER =================
exports.createOrder = async (req, res) => {
  try {
    console.log('--- createOrder called ---');
    console.log('Request body:', req.body);

    const {
      amount,
      currency,
      receipt,
      customerName,
      customerEmail,
      customerContact
    } = req.body;

    if (!amount) {
      return res
        .status(400)
        .json({ success: false, message: 'Amount is required' });
    }

    const options = {
      amount: Math.round(Number(amount) * 100), // rupees -> paise
      currency: currency || 'INR',
      receipt: receipt || `rcpt_${Date.now()}`,
      payment_capture: 1
    };
    console.log('Order options (sent to Razorpay):', options);

    const order = await razorpay.orders.create(options);
    console.log('Razorpay order response:', order);

    store.setLastOrder(order);

    const createdAt = new Date().toISOString();
    db.run(
      `INSERT OR IGNORE INTO payments 
       (razorpay_order_id, amount, currency, status, customer_name, customer_email, customer_contact, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order.id,
        order.amount,
        order.currency,
        'CREATED',
        customerName || null,
        customerEmail || null,
        customerContact || null,
        createdAt
      ],
      (err) => {
        if (err) {
          console.error('Error inserting payment row:', err.message);
        } else {
          regenerateExcelReport();
        }
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Order created successfully',
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status
      },
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
};

// ================= VERIFY PAYMENT =================
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res
        .status(400)
        .json({ success: false, message: 'Missing payment details' });
    }

    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature === expectedSign) {
      db.run(
        `UPDATE payments
         SET razorpay_payment_id = ?, razorpay_signature = ?, status = ?
         WHERE razorpay_order_id = ?`,
        [razorpay_payment_id, razorpay_signature, 'PAID', razorpay_order_id],
        (err) => {
          if (err) {
            console.error('Error updating payment row:', err.message);
          } else {
            regenerateExcelReport();
          }
        }
      );

      store.setLastPayment({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        status: 'PAID'
      });

      return res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid signature - Payment verification failed'
      });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message
    });
  }
};

// ================= PAYMENT DETAILS (direct from Razorpay) =================
exports.getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;

    if (!paymentId) {
      return res
        .status(400)
        .json({ success: false, message: 'Payment ID is required' });
    }

    const payment = await razorpay.payments.fetch(paymentId);

    return res.status(200).json({
      success: true,
      message: 'Payment details retrieved',
      payment
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch payment details',
      error: error.message
    });
  }
};

// ================= LIST PAYMENTS FROM DB =================
exports.listPayments = (req, res) => {
  db.all(
    `SELECT 
        id,
        razorpay_order_id,
        razorpay_payment_id,
        amount,
        amount/100 AS amount_rupees,
        currency,
        status,
        customer_name,
        customer_email,
        customer_contact,
        created_at
     FROM payments
     ORDER BY id DESC`,
    (err, rows) => {
      if (err) {
        console.error('Error listing payments:', err.message);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch payments',
          error: err.message
        });
      }

      return res.status(200).json({
        success: true,
        payments: rows
      });
    }
  );
};

// ================= DOWNLOAD EXCEL FILE =================
exports.exportToExcel = (req, res) => {
  if (!fs.existsSync(REPORT_PATH)) {
    return res.status(404).json({
      success: false,
      message: 'Report file not generated yet'
    });
  }

  res.download(REPORT_PATH, 'payments_report.xlsx');
};
