import { getDatabase, generateId } from "../db/database.js";

const { run, get, all } = getDatabase();

/**
 * Save a new payment record
 * @param {Object} paymentData - Payment data
 * @returns {Promise<Object>} Saved payment record
 */
export const savePayment = async (paymentData) => {
  try {
    const id = generateId();
    const now = new Date().toISOString();
    
    const record = {
      id,
      uid: paymentData.uid,
      product_id: paymentData.productId,
      amount: paymentData.amount,
      memo: paymentData.memo || "A2U Reward Payment",
      payment_id: paymentData.paymentId || null,
      txid: paymentData.txid || null,
      status: paymentData.status || "pending",
      metadata: JSON.stringify(paymentData.metadata || {}),
      created_at: now,
      updated_at: now
    };

    await run(`
      INSERT INTO payments (
        id, uid, product_id, amount, memo, payment_id, txid, 
        status, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      record.id, record.uid, record.product_id, record.amount, 
      record.memo, record.payment_id, record.txid, record.status, 
      record.metadata, record.created_at, record.updated_at
    ]);

    console.log(`💾 Payment saved: ${record.id}`);
    return record;
  } catch (error) {
    console.error("❌ Failed to save payment:", error.message);
    throw new Error(`Failed to save payment: ${error.message}`);
  }
};

/**
 * Get payment by ID
 * @param {string} id - Payment ID
 * @returns {Promise<Object|null>} Payment record
 */
export const getPaymentById = async (id) => {
  try {
    const payment = await get(`
      SELECT * FROM payments WHERE id = ?
    `, [id]);
    
    if (payment) {
      payment.metadata = JSON.parse(payment.metadata || "{}");
    }
    
    return payment;
  } catch (error) {
    console.error("❌ Failed to get payment by ID:", error.message);
    throw new Error(`Failed to get payment: ${error.message}`);
  }
};

/**
 * Get payment by Pi payment ID
 * @param {string} paymentId - Pi payment ID
 * @returns {Promise<Object|null>} Payment record
 */
export const getPaymentByPiId = async (paymentId) => {
  try {
    const payment = await get(`
      SELECT * FROM payments WHERE payment_id = ?
    `, [paymentId]);
    
    if (payment) {
      payment.metadata = JSON.parse(payment.metadata || "{}");
    }
    
    return payment;
  } catch (error) {
    console.error("❌ Failed to get payment by Pi ID:", error.message);
    throw new Error(`Failed to get payment: ${error.message}`);
  }
};

/**
 * Update payment status
 * @param {string} id - Payment ID
 * @param {string} status - New status
 * @param {Object} additionalData - Additional data to update
 * @returns {Promise<Object>} Updated payment record
 */
export const updatePaymentStatus = async (id, status, additionalData = {}) => {
  try {
    const now = new Date().toISOString();
    
    // Get current payment for audit log
    const currentPayment = await getPaymentById(id);
    
    // Build update query
    const updateFields = ["status = ?", "updated_at = ?"];
    const updateValues = [status, now];
    
    if (additionalData.payment_id) {
      updateFields.push("payment_id = ?");
      updateValues.push(additionalData.payment_id);
    }
    
    if (additionalData.txid) {
      updateFields.push("txid = ?");
      updateValues.push(additionalData.txid);
    }
    
    if (additionalData.error_message) {
      updateFields.push("error_message = ?");
      updateValues.push(additionalData.error_message);
    }
    
    updateValues.push(id);
    
    await run(`
      UPDATE payments SET ${updateFields.join(", ")} WHERE id = ?
    `, updateValues);
    
    // Log status change
    await logPaymentChange(id, "status_change", currentPayment?.status, status, additionalData);
    
    console.log(`📝 Payment status updated: ${id} -> ${status}`);
    
    return await getPaymentById(id);
  } catch (error) {
    console.error("❌ Failed to update payment status:", error.message);
    throw new Error(`Failed to update payment status: ${error.message}`);
  }
};

/**
 * Update payment with transaction ID
 * @param {string} paymentId - Pi payment ID
 * @param {string} txid - Transaction ID
 * @returns {Promise<Object>} Updated payment record
 */
export const updatePaymentTx = async (paymentId, txid) => {
  try {
    await run(`
      UPDATE payments SET txid = ?, status = 'submitted', updated_at = ?
      WHERE payment_id = ?
    `, [txid, new Date().toISOString(), paymentId]);
    
    console.log(`📝 Payment TX updated: ${paymentId} -> ${txid}`);
    
    return await getPaymentByPiId(paymentId);
  } catch (error) {
    console.error("❌ Failed to update payment TX:", error.message);
    throw new Error(`Failed to update payment TX: ${error.message}`);
  }
};

/**
 * Get all payments for a user
 * @param {string} uid - User UID
 * @param {number} limit - Limit results
 * @param {number} offset - Offset results
 * @returns {Promise<Array>} Array of payment records
 */
export const getPaymentsByUid = async (uid, limit = 50, offset = 0) => {
  try {
    const payments = await all(`
      SELECT * FROM payments 
      WHERE uid = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [uid, limit, offset]);
    
    return payments.map(payment => ({
      ...payment,
      metadata: JSON.parse(payment.metadata || "{}")
    }));
  } catch (error) {
    console.error("❌ Failed to get payments by UID:", error.message);
    throw new Error(`Failed to get payments: ${error.message}`);
  }
};

/**
 * Get payment statistics
 * @returns {Promise<Object>} Payment statistics
 */
export const getPaymentStats = async () => {
  try {
    const stats = await get(`
      SELECT 
        COUNT(*) as total_payments,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_payments,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
        SUM(amount) as total_amount,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as completed_amount
      FROM payments
    `);
    
    return stats;
  } catch (error) {
    console.error("❌ Failed to get payment stats:", error.message);
    throw new Error(`Failed to get payment stats: ${error.message}`);
  }
};

/**
 * Log payment changes for audit trail
 * @param {string} paymentId - Payment ID
 * @param {string} action - Action performed
 * @param {string} statusBefore - Status before change
 * @param {string} statusAfter - Status after change
 * @param {Object} details - Additional details
 */
export const logPaymentChange = async (paymentId, action, statusBefore, statusAfter, details = {}) => {
  try {
    const logId = generateId();
    
    await run(`
      INSERT INTO payment_audit_log (
        id, payment_id, action, status_before, status_after, 
        details, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      logId, paymentId, action, statusBefore, statusAfter,
      JSON.stringify(details), details.error_message || null,
      new Date().toISOString()
    ]);
    
    console.log(`📝 Payment logged: ${paymentId} - ${action}`);
  } catch (error) {
    console.error("❌ Failed to log payment change:", error.message);
    // Don't throw here - logging failure shouldn't break the main flow
  }
};

/**
 * Get recent payments
 * @param {number} limit - Limit results
 * @returns {Promise<Array>} Array of recent payment records
 */
export const getRecentPayments = async (limit = 20) => {
  try {
    const payments = await all(`
      SELECT * FROM payments 
      ORDER BY created_at DESC 
      LIMIT ?
    `, [limit]);
    
    return payments.map(payment => ({
      ...payment,
      metadata: JSON.parse(payment.metadata || "{}")
    }));
  } catch (error) {
    console.error("❌ Failed to get recent payments:", error.message);
    throw new Error(`Failed to get recent payments: ${error.message}`);
  }
};

export default {
  savePayment,
  getPaymentById,
  getPaymentByPiId,
  updatePaymentStatus,
  updatePaymentTx,
  getPaymentsByUid,
  getPaymentStats,
  logPaymentChange,
  getRecentPayments
};
