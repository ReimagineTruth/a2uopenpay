import express from "express";
import Joi from "joi";
import { 
  createPayment, 
  submitPayment, 
  completePayment, 
  handleIncompletePayments,
  getPayment,
  cancelPayment
} from "../services/piService.js";
import {
  savePayment,
  getPaymentByPiId,
  updatePaymentStatus,
  updatePaymentTx,
  getPaymentsByUid,
  getPaymentStats,
  getRecentPayments
} from "../models/paymentModel.js";

const router = express.Router();

// Validation schemas
const createPaymentSchema = Joi.object({
  uid: Joi.string().required().min(1),
  amount: Joi.number().required().min(0.01).max(1000),
  productId: Joi.string().required().min(1),
  memo: Joi.string().optional().max(500)
});

const submitPaymentSchema = Joi.object({
  paymentId: Joi.string().required().min(1)
});

const completePaymentSchema = Joi.object({
  paymentId: Joi.string().required().min(1),
  txid: Joi.string().required().min(1)
});

const getPaymentsSchema = Joi.object({
  uid: Joi.string().required().min(1),
  limit: Joi.number().optional().min(1).max(100).default(20),
  offset: Joi.number().optional().min(0).default(0)
});

// Middleware for validation
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map(detail => ({
          field: detail.path[0],
          message: detail.message
        }))
      });
    }
    req.body = value;
    next();
  };
};

// POST /payments/create - Create a new A2U payment
router.post("/create", validate(createPaymentSchema), async (req, res) => {
  try {
    const { uid, amount, productId, memo } = req.body;
    
    console.log(`📝 Creating payment request: UID=${uid}, Amount=${amount}, Product=${productId}`);
    
    // Handle incomplete payments first
    await handleIncompletePayments();
    
    // Create payment in Pi Network
    const paymentId = await createPayment(uid, amount, productId, memo);
    
    // Save to database
    const paymentRecord = await savePayment({
      uid,
      productId,
      amount,
      memo,
      paymentId,
      status: "created",
      metadata: {
        productId,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development"
      }
    });
    
    res.status(201).json({
      success: true,
      payment: {
        id: paymentRecord.id,
        paymentId: paymentId,
        uid: uid,
        amount: amount,
        productId: productId,
        memo: memo,
        status: "created",
        createdAt: paymentRecord.created_at
      },
      message: "Payment created successfully. Next step: submit to blockchain."
    });
    
  } catch (error) {
    console.error("❌ Create payment error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to create payment"
    });
  }
});

// POST /payments/submit - Submit payment to blockchain
router.post("/submit", validate(submitPaymentSchema), async (req, res) => {
  try {
    const { paymentId } = req.body;
    
    console.log(`⛓️ Submitting payment to blockchain: ${paymentId}`);
    
    // Check if payment exists in database
    const paymentRecord = await getPaymentByPiId(paymentId);
    if (!paymentRecord) {
      return res.status(404).json({
        success: false,
        error: "Payment not found in database",
        message: "Please create a payment first"
      });
    }
    
    // Submit to blockchain
    const txid = await submitPayment(paymentId);
    
    // Update database with transaction ID
    await updatePaymentTx(paymentId, txid);
    
    res.json({
      success: true,
      paymentId: paymentId,
      txid: txid,
      message: "Payment submitted to blockchain successfully. Next step: complete payment."
    });
    
  } catch (error) {
    console.error("❌ Submit payment error:", error.message);
    
    // Update payment status to failed
    if (req.body.paymentId) {
      try {
        const paymentRecord = await getPaymentByPiId(req.body.paymentId);
        if (paymentRecord) {
          await updatePaymentStatus(paymentRecord.id, "failed", { error_message: error.message });
        }
      } catch (updateError) {
        console.error("Failed to update payment status:", updateError.message);
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to submit payment to blockchain"
    });
  }
});

// POST /payments/complete - Complete payment
router.post("/complete", validate(completePaymentSchema), async (req, res) => {
  try {
    const { paymentId, txid } = req.body;
    
    console.log(`🎯 Completing payment: ${paymentId} with txid: ${txid}`);
    
    // Check if payment exists in database
    const paymentRecord = await getPaymentByPiId(paymentId);
    if (!paymentRecord) {
      return res.status(404).json({
        success: false,
        error: "Payment not found in database",
        message: "Please create and submit payment first"
      });
    }
    
    // Complete payment in Pi Network
    const completedPayment = await completePayment(paymentId, txid);
    
    // Update database
    await updatePaymentStatus(paymentRecord.id, "completed", { txid });
    
    res.json({
      success: true,
      payment: {
        paymentId: completedPayment.identifier,
        txid: txid,
        status: "completed",
        amount: completedPayment.amount,
        uid: completedPayment.user_uid,
        completedAt: new Date().toISOString()
      },
      message: "Payment completed successfully!"
    });
    
  } catch (error) {
    console.error("❌ Complete payment error:", error.message);
    
    // Update payment status to failed
    if (req.body.paymentId) {
      try {
        const paymentRecord = await getPaymentByPiId(req.body.paymentId);
        if (paymentRecord) {
          await updatePaymentStatus(paymentRecord.id, "failed", { 
            txid: req.body.txid,
            error_message: error.message 
          });
        }
      } catch (updateError) {
        console.error("Failed to update payment status:", updateError.message);
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to complete payment"
    });
  }
});

// GET /payments/:paymentId - Get payment details
router.get("/:paymentId", async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    console.log(`🔍 Getting payment details: ${paymentId}`);
    
    // Get from Pi Network
    const piPayment = await getPayment(paymentId);
    
    // Get from database
    const dbPayment = await getPaymentByPiId(paymentId);
    
    res.json({
      success: true,
      payment: {
        ...piPayment,
        database: dbPayment
      }
    });
    
  } catch (error) {
    console.error("❌ Get payment error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to get payment details"
    });
  }
});

// GET /payments/user/:uid - Get user's payments
router.get("/user/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    console.log(`👤 Getting payments for user: ${uid}`);
    
    const payments = await getPaymentsByUid(uid, parseInt(limit), parseInt(offset));
    
    res.json({
      success: true,
      payments: payments,
      count: payments.length,
      message: "User payments retrieved successfully"
    });
    
  } catch (error) {
    console.error("❌ Get user payments error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to get user payments"
    });
  }
});

// GET /payments/stats - Get payment statistics
router.get("/stats", async (req, res) => {
  try {
    console.log("📊 Getting payment statistics");
    
    const stats = await getPaymentStats();
    
    res.json({
      success: true,
      stats: stats,
      message: "Payment statistics retrieved successfully"
    });
    
  } catch (error) {
    console.error("❌ Get stats error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to get payment statistics"
    });
  }
});

// GET /payments/recent - Get recent payments
router.get("/recent", async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    console.log("📋 Getting recent payments");
    
    const payments = await getRecentPayments(parseInt(limit));
    
    res.json({
      success: true,
      payments: payments,
      count: payments.length,
      message: "Recent payments retrieved successfully"
    });
    
  } catch (error) {
    console.error("❌ Get recent payments error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to get recent payments"
    });
  }
});

// POST /payments/cancel/:paymentId - Cancel payment
router.post("/cancel/:paymentId", async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    console.log(`🚫 Cancelling payment: ${paymentId}`);
    
    // Check if payment exists
    const paymentRecord = await getPaymentByPiId(paymentId);
    if (!paymentRecord) {
      return res.status(404).json({
        success: false,
        error: "Payment not found",
        message: "Payment not found in database"
      });
    }
    
    // Cancel in Pi Network
    const cancelledPayment = await cancelPayment(paymentId);
    
    // Update database
    await updatePaymentStatus(paymentRecord.id, "cancelled");
    
    res.json({
      success: true,
      payment: {
        paymentId: cancelledPayment.identifier,
        status: "cancelled",
        cancelledAt: new Date().toISOString()
      },
      message: "Payment cancelled successfully"
    });
    
  } catch (error) {
    console.error("❌ Cancel payment error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to cancel payment"
    });
  }
});

// POST /payments/cleanup - Clean up incomplete payments
router.post("/cleanup", async (req, res) => {
  try {
    console.log("🧹 Cleaning up incomplete payments");
    
    const incompletePayments = await handleIncompletePayments();
    
    res.json({
      success: true,
      cleanedUp: incompletePayments.length,
      payments: incompletePayments,
      message: "Incomplete payments cleaned up successfully"
    });
    
  } catch (error) {
    console.error("❌ Cleanup error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to clean up incomplete payments"
    });
  }
});

export default router;
