import PiNetwork from "pi-backend";
import dotenv from "dotenv";

dotenv.config();

// Initialize Pi Network SDK
const pi = new PiNetwork(
  process.env.PI_API_KEY,
  process.env.PI_WALLET_PRIVATE_SEED
);

// Validate SDK initialization
if (!process.env.PI_API_KEY || !process.env.PI_WALLET_PRIVATE_SEED) {
  throw new Error("Missing required environment variables: PI_API_KEY, PI_WALLET_PRIVATE_SEED");
}

/**
 * Create an A2U payment
 * @param {string} uid - Pi Network user UID
 * @param {number} amount - Amount in Pi
 * @param {string} productId - Product identifier
 * @param {string} memo - Payment memo
 * @returns {Promise<string>} Payment identifier
 */
export const createPayment = async (uid, amount, productId, memo = "A2U Reward Payment") => {
  try {
    console.log(`📝 Creating payment for UID: ${uid}, amount: ${amount}, productId: ${productId}`);
    
    const paymentData = {
      amount: amount,
      memo: memo,
      metadata: { 
        productId: productId,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development"
      },
      uid: uid
    };

    const payment = await pi.createPayment(paymentData);
    console.log(`✅ Payment created: ${payment.identifier}`);
    
    return payment.identifier;
  } catch (error) {
    console.error("❌ Failed to create payment:", error.message);
    
    // Enhanced error handling for specific Pi Network errors
    if (error.message.includes("User with uid was not found")) {
      throw new Error(`UID '${uid}' not found in Pi Network. Please verify the user UID.`);
    } else if (error.message.includes("insufficient")) {
      throw new Error(`Insufficient Pi balance in wallet for this payout of ${amount} Pi.`);
    } else if (error.message.includes("You need to complete the ongoing payment")) {
      throw new Error(`Another payment is in progress. Please complete or cancel it first.`);
    } else if (error.message.includes("authentication")) {
      throw new Error(`Pi Network authentication failed. Check your API key configuration.`);
    } else {
      throw new Error(`Payment creation failed: ${error.message}`);
    }
  }
};

/**
 * Submit payment to blockchain
 * @param {string} paymentId - Payment identifier
 * @returns {Promise<string>} Transaction ID
 */
export const submitPayment = async (paymentId) => {
  try {
    console.log(`⛓️ Submitting payment to blockchain: ${paymentId}`);
    
    const payment = await pi.submitPayment(paymentId);
    const txid = payment.transaction.txid;
    
    console.log(`✅ Transaction submitted: ${txid}`);
    return txid;
  } catch (error) {
    console.error("❌ Failed to submit payment:", error.message);
    
    if (error.message.includes("not found")) {
      throw new Error(`Payment ${paymentId} not found. It may have been cancelled.`);
    } else if (error.message.includes("already completed")) {
      throw new Error(`Payment ${paymentId} is already completed.`);
    } else if (error.message.includes("network")) {
      throw new Error(`Network error during blockchain submission. Please try again.`);
    } else {
      throw new Error(`Payment submission failed: ${error.message}`);
    }
  }
};

/**
 * Complete payment
 * @param {string} paymentId - Payment identifier
 * @param {string} txid - Transaction ID
 * @returns {Promise<Object>} Completed payment details
 */
export const completePayment = async (paymentId, txid) => {
  try {
    console.log(`🎯 Completing payment: ${paymentId} with txid: ${txid}`);
    
    const payment = await pi.completePayment(paymentId, txid);
    
    console.log(`✅ Payment completed successfully:`, {
      paymentId: payment.identifier,
      status: payment.status,
      amount: payment.amount,
      uid: payment.user_uid
    });
    
    return payment;
  } catch (error) {
    console.error("❌ Failed to complete payment:", error.message);
    
    if (error.message.includes("not found")) {
      throw new Error(`Payment ${paymentId} not found or transaction ${txid} is invalid.`);
    } else if (error.message.includes("already completed")) {
      throw new Error(`Payment ${paymentId} is already completed.`);
    } else if (error.message.includes("invalid transaction")) {
      throw new Error(`Transaction ${txid} is invalid or doesn't match payment ${paymentId}.`);
    } else {
      throw new Error(`Payment completion failed: ${error.message}`);
    }
  }
};

/**
 * Get incomplete payments and clean them up
 * @returns {Promise<Array>} Array of incomplete payments
 */
export const handleIncompletePayments = async () => {
  try {
    console.log("🔍 Checking for incomplete payments...");
    
    const incompletePayments = await pi.getIncompleteServerPayments();
    
    if (incompletePayments && incompletePayments.length > 0) {
      console.log(`Found ${incompletePayments.length} incomplete payments, cleaning up...`);
      
      for (const payment of incompletePayments) {
        try {
          if (payment.transaction && payment.transaction.txid) {
            // Try to complete if there's a transaction
            await pi.completePayment(payment.identifier, payment.transaction.txid);
            console.log(`✅ Completed incomplete payment: ${payment.identifier}`);
          } else {
            // Cancel if no transaction
            await pi.cancelPayment(payment.identifier);
            console.log(`🚫 Cancelled incomplete payment: ${payment.identifier}`);
          }
        } catch (error) {
          console.error(`❌ Failed to handle incomplete payment ${payment.identifier}:`, error.message);
        }
      }
    } else {
      console.log("No incomplete payments found");
    }
    
    return incompletePayments;
  } catch (error) {
    console.error("❌ Failed to check incomplete payments:", error.message);
    return [];
  }
};

/**
 * Get payment details
 * @param {string} paymentId - Payment identifier
 * @returns {Promise<Object>} Payment details
 */
export const getPayment = async (paymentId) => {
  try {
    console.log(`🔍 Getting payment details: ${paymentId}`);
    
    const payment = await pi.getPayment(paymentId);
    console.log(`✅ Payment details retrieved for: ${paymentId}`);
    
    return payment;
  } catch (error) {
    console.error("❌ Failed to get payment details:", error.message);
    
    if (error.message.includes("not found")) {
      throw new Error(`Payment ${paymentId} not found.`);
    } else {
      throw new Error(`Failed to retrieve payment details: ${error.message}`);
    }
  }
};

/**
 * Cancel payment
 * @param {string} paymentId - Payment identifier
 * @returns {Promise<Object>} Cancelled payment details
 */
export const cancelPayment = async (paymentId) => {
  try {
    console.log(`🚫 Cancelling payment: ${paymentId}`);
    
    const payment = await pi.cancelPayment(paymentId);
    console.log(`✅ Payment cancelled: ${paymentId}`);
    
    return payment;
  } catch (error) {
    console.error("❌ Failed to cancel payment:", error.message);
    
    if (error.message.includes("not found")) {
      throw new Error(`Payment ${paymentId} not found.`);
    } else if (error.message.includes("already completed")) {
      throw new Error(`Cannot cancel payment ${paymentId} - it's already completed.`);
    } else {
      throw new Error(`Failed to cancel payment: ${error.message}`);
    }
  }
};

// Export the Pi SDK instance for advanced usage
export { pi };

export default {
  createPayment,
  submitPayment,
  completePayment,
  handleIncompletePayments,
  getPayment,
  cancelPayment,
  pi
};
