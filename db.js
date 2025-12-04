// db.js - SQLite database setup
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'payments.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Failed to connect to SQLite DB:', err.message);
  } else {
    console.log('✅ SQLite DB connected at', dbPath);
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      razorpay_order_id TEXT UNIQUE,
      razorpay_payment_id TEXT,
      razorpay_signature TEXT,
      amount INTEGER,
      currency TEXT,
      status TEXT,
      customer_name TEXT,
      customer_email TEXT,
      customer_contact TEXT,
      created_at TEXT
    )
  `);
});

module.exports = db;
