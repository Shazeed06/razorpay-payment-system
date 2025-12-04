// store.js - very small in-memory store for dev only
let lastOrder = null;
let lastPayment = null;

function setLastOrder(order) {
  lastOrder = order;
}

function getLastOrder() {
  return lastOrder;
}

function setLastPayment(payment) {
  lastPayment = payment;
}

function getLastPayment() {
  return lastPayment;
}

module.exports = {
  setLastOrder,
  getLastOrder,
  setLastPayment,
  getLastPayment
};
