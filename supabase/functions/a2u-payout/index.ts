// Enhanced A2U Payout Function using pi-nodejs SDK
// This ensures every authenticated Pi user can receive payouts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import PiNetwork from "pi-backend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Initialize Pi Network SDK
function initializePiSDK(apiKey: string, walletSeed: string): PiNetwork {
  try {
    return new PiNetwork(apiKey, walletSeed);
  } catch (error) {
    console.error("Failed to initialize Pi SDK:", error);
    throw new Error("Pi SDK initialization failed");
  }
}

// Handle incomplete payments using SDK
async function handleIncompletePayments(pi: PiNetwork): Promise<void> {
  try {
    console.log("Checking for incomplete payments...");
    const incompletePayments = await pi.getIncompleteServerPayments();
    
    if (incompletePayments && incompletePayments.length > 0) {
      console.log(`Found ${incompletePayments.length} incomplete payments, cleaning up...`);
      
      for (const payment of incompletePayments) {
        try {
          console.log(`Processing incomplete payment: ${payment.identifier}`);
          
          if (payment.transaction && payment.transaction.txid) {
            // Try to complete if there's a transaction
            await pi.completePayment(payment.identifier, payment.transaction.txid);
            console.log(`✅ Completed incomplete payment: ${payment.identifier}`);
          } else {
            // Cancel if no transaction
            await pi.cancelPayment(payment.identifier);
            console.log(`🚫 Cancelled incomplete payment: ${payment.identifier}`);
          }
        } catch (error: any) {
          console.error(`❌ Failed to handle incomplete payment ${payment.identifier}:`, error.message);
          // Continue with other payments even if one fails
        }
      }
    } else {
      console.log("No incomplete payments found");
    }
  } catch (error: any) {
    console.error("Failed to check incomplete payments:", error.message);
    // Don't throw here - continue with payout even if cleanup fails
  }
}

// Main payout function
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("PI_API_KEY");
    const walletSeed = Deno.env.get("WALLET_PRIVATE_SEED");

    if (!apiKey) return json({ error: "Pi API not configured" }, 500);
    if (!walletSeed) return json({ error: "Wallet not configured" }, 500);

    const supabase = createClient(supabaseUrl, serviceKey);

    // Authentication
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data, error: userErr } = await supabase.auth.getUser(token);
      if (!userErr && data?.user) userId = data.user.id;
    }
    if (!userId) return json({ error: "Authentication required" }, 401);

    const { amount, memo } = await req.json();
    if (!amount || amount <= 0) return json({ error: "Invalid amount" }, 400);

    console.log("Starting A2U payout for user:", userId);

    // Get user's Pi Network information
    const { data: userProfile, error: profileErr } = await supabase
      .from("user_profiles")
      .select("pi_uid, pi_username, pi_verified")
      .eq("supabase_user_id", userId)
      .single();

    if (profileErr || !userProfile || !userProfile.pi_verified) {
      return json({ 
        error: "User not authenticated with Pi Network",
        details: "Please authenticate with Pi Network first"
      }, 400);
    }

    // Type assertion for user profile
    const profile = userProfile as {
      pi_uid: string | null;
      pi_username: string | null;
      pi_verified: boolean;
    };

    // Initialize Pi SDK
    const pi = initializePiSDK(apiKey, walletSeed);

    // Handle any incomplete payments first
    await handleIncompletePayments(pi);

    // Use the stored UID or username as fallback
    const userUid = profile.pi_uid || profile.pi_username;
    
    if (!userUid) {
      console.error("No UID found for user:", { 
        userId, 
        pi_uid: profile.pi_uid, 
        pi_username: profile.pi_username 
      });
      return json({ 
        error: "User UID not found", 
        details: "Please authenticate with Pi Network first. User profile missing UID.",
        debug: {
          has_pi_uid: !!profile.pi_uid,
          has_pi_username: !!profile.pi_username,
          pi_username: profile.pi_username
        }
      }, 400);
    }

    console.log(`✅ Using UID: ${userUid} for user ${profile.pi_username}`);

    // Insert payout record
    const { data: payoutData, error: insertErr } = await supabase
      .from("a2u_payouts")
      .insert({
        user_id: userId,
        pi_username: profile.pi_username,
        pi_uid: userUid,
        amount,
        memo: memo || `A2U payout to ${profile.pi_username}`,
        status: "processing",
      })
      .select("id")
      .single();

    if (insertErr || !payoutData) {
      console.error("Failed to insert payout:", insertErr);
      return json({ error: "Failed to create payout record" }, 500);
    }

    const payoutId = (payoutData as any).id;
    console.log("Starting A2U payout:", { payoutId, userUid, amount });

    try {
      // Step 1: Create A2U payment using SDK
      const paymentData = {
        amount,
        memo: memo || `A2U payout to ${profile.pi_username}`,
        metadata: { 
          payout_id: payoutId, 
          user_id: userId,
          pi_username: profile.pi_username,
          timestamp: new Date().toISOString()
        },
        uid: userUid,
      };

      console.log("📝 Step 1: Creating A2U payment...");
      console.log("Payment data:", { ...paymentData, metadata: paymentData.metadata });
      
      const paymentId = await pi.createPayment(paymentData);
      console.log("✅ Payment created:", { paymentId });

      // Update database with payment ID
      const updateResult = await supabase
        .from("a2u_payouts")
        .update({ pi_payment_id: paymentId })
        .eq("id", payoutId);
        
      if (updateResult.error) {
        console.error("Failed to update payout with payment ID:", updateResult.error);
        // Continue anyway - payment was created
      }

      // Step 2: Submit payment to blockchain using SDK
      console.log("⛓️ Step 2: Submitting payment to blockchain...");
      const txid = await pi.submitPayment(paymentId);
      console.log("✅ Transaction submitted, txid:", txid);

      // Step 3: Complete payment using SDK
      console.log("🎯 Step 3: Completing payment...");
      const completedPayment = await pi.completePayment(paymentId, txid);
      console.log("✅ Payment completed:", completedPayment);

      // Update database with completion status
      const completeResult = await supabase
        .from("a2u_payouts")
        .update({ status: "completed", pi_txid: txid })
        .eq("id", payoutId);
        
      if (completeResult.error) {
        console.error("Failed to update payout completion status:", completeResult.error);
        // Return success anyway - payment was completed
      }

      return json({
        success: true,
        paymentId,
        txid,
        payout_id: payoutId,
        uid_used: userUid,
        message: "A2U payout completed successfully",
        payment_details: {
          amount,
          memo: memo || `A2U payout to ${profile.pi_username}`,
          username: profile.pi_username,
          timestamp: new Date().toISOString()
        }
      });

    } catch (piError: any) {
      const errMsg = piError?.message || String(piError);
      console.error("❌ A2U payout step failed:", errMsg);
      console.error("Full error:", piError);

      // Update database with error status
      const errorResult = await supabase
        .from("a2u_payouts")
        .update({
          status: "failed",
          error_message: errMsg.substring(0, 500),
        })
        .eq("id", payoutId);
        
      if (errorResult.error) {
        console.error("Failed to update payout error status:", errorResult.error);
      }

      // Provide more detailed error information
      let errorDetails = errMsg;
      if (errMsg.includes("User with uid was not found")) {
        errorDetails = `UID '${userUid}' not found in Pi Network. Please check user authentication.`;
      } else if (errMsg.includes("insufficient")) {
        errorDetails = `Insufficient Pi balance in wallet for this payout.`;
      } else if (errMsg.includes("network")) {
        errorDetails = `Network error. Please try again.`;
      }

      return json({ 
        error: "Pi payment failed", 
        details: errorDetails,
        uid_attempted: userUid,
        error_type: "payment_error",
        timestamp: new Date().toISOString()
      }, 400);
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    console.error("A2U payout error:", err);
    return json({ error: msg }, 500);
  }
});
