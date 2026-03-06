// Enhanced A2U Payout Function using pi-nodejs SDK
// This ensures every authenticated Pi user can receive payouts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import PiNetwork from "https://esm.sh/pi-backend@1.3.0";

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
  return new PiNetwork(apiKey, walletSeed);
}

// Handle incomplete payments using SDK
async function handleIncompletePayments(pi: PiNetwork): Promise<void> {
  try {
    const incompletePayments = await pi.getIncompleteServerPayments();
    
    if (incompletePayments && incompletePayments.length > 0) {
      console.log(`Found ${incompletePayments.length} incomplete payments, cleaning up...`);
      
      for (const payment of incompletePayments) {
        try {
          if (payment.transaction && payment.transaction.txid) {
            // Try to complete if there's a transaction
            await pi.completePayment(payment.identifier, payment.transaction.txid);
            console.log(`Completed incomplete payment: ${payment.identifier}`);
          } else {
            // Cancel if no transaction
            await pi.cancelPayment(payment.identifier);
            console.log(`Cancelled incomplete payment: ${payment.identifier}`);
          }
        } catch (error) {
          console.log(`Failed to handle incomplete payment ${payment.identifier}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.log("Failed to check incomplete payments:", error.message);
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

    // Initialize Pi SDK
    const pi = initializePiSDK(apiKey, walletSeed);

    // Handle any incomplete payments first
    await handleIncompletePayments(pi);

    // Use the stored UID or username as fallback
    const userUid = userProfile.pi_uid || userProfile.pi_username;
    
    if (!userUid) {
      return json({ 
        error: "User UID not found", 
        details: "Please authenticate with Pi Network first"
      }, 400);
    }

    console.log(`Using UID: ${userUid} for user ${userProfile.pi_username}`);

    // Insert payout record
    const { data: payoutData, error: insertErr } = await supabase
      .from("a2u_payouts")
      .insert({
        user_id: userId,
        pi_username: userProfile.pi_username,
        pi_uid: userUid,
        amount,
        memo: memo || `A2U payout to ${userProfile.pi_username}`,
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
        memo: memo || `A2U payout to ${userProfile.pi_username}`,
        metadata: { 
          payout_id: payoutId, 
          user_id: userId,
          pi_username: userProfile.pi_username
        },
        uid: userUid,
      };

      console.log("Step 1: Creating A2U payment...");
      const paymentId = await pi.createPayment(paymentData);

      console.log("Payment created:", { paymentId });

      await supabase
        .from("a2u_payouts")
        .update({ pi_payment_id: paymentId })
        .eq("id", payoutId);

      // Step 2: Submit payment to blockchain using SDK
      console.log("Step 2: Submitting payment to blockchain...");
      const txid = await pi.submitPayment(paymentId);

      console.log("Transaction submitted, txid:", txid);

      // Step 3: Complete payment using SDK
      console.log("Step 3: Completing payment...");
      const completedPayment = await pi.completePayment(paymentId, txid);

      console.log("Payment completed:", completedPayment);

      await supabase
        .from("a2u_payouts")
        .update({ status: "completed", pi_txid: txid })
        .eq("id", payoutId);

      return json({
        success: true,
        paymentId,
        txid,
        payout_id: payoutId,
        uid_used: userUid,
        message: "A2U payout completed successfully",
      });

    } catch (piError: unknown) {
      const errMsg = piError instanceof Error ? piError.message : String(piError);
      console.error("A2U payout step failed:", errMsg);

      await supabase
        .from("a2u_payouts")
        .update({
          status: "failed",
          error_message: errMsg.substring(0, 500),
        })
        .eq("id", payoutId);

      return json({ 
        error: "Pi payment failed", 
        details: errMsg,
        uid_attempted: userUid,
      }, 400);
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    console.error("A2U payout error:", err);
    return json({ error: msg }, 500);
  }
});
