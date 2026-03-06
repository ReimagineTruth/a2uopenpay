// Enhanced A2U Payout Function for All Pi Users
// This ensures every authenticated Pi user can receive payouts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const PI_API_BASE = "https://api.minepi.com";

// Enhanced Pi API request with retry logic
async function piApiRequest(
  method: string,
  path: string,
  apiKey: string,
  body?: Record<string, unknown>,
  retries = 3
): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const opts: RequestInit = {
      method,
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
    };
    if (body) opts.body = JSON.stringify(body);

    const resp = await fetch(`${PI_API_BASE}${path}`, opts);
    const data = await resp.json();

    if (resp.ok) {
      return data;
    }

    // Log error for debugging
    console.error(`Pi API error [${resp.status}] ${path} (attempt ${attempt + 1}):`, JSON.stringify(data));

    // Don't retry on user not found or authentication errors
    if (data?.error === "user_not_found" || resp.status === 401 || resp.status === 403) {
      throw new Error(data?.error_message || data?.message || `Pi API error: ${resp.status}`);
    }

    // Retry on network issues or server errors
    if (attempt < retries - 1 && (resp.status >= 500 || resp.status === 429)) {
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }

    throw new Error(data?.error_message || data?.message || `Pi API error: ${resp.status}`);
  }
}

// Comprehensive UID validation and fixing
async function validateAndFixPiUid(
  piUid: string | null,
  piUsername: string | null,
  apiKey: string
): Promise<string> {
  console.log("Validating Pi UID:", { piUid, piUsername });

  if (!piUsername) {
    throw new Error("Pi username is required for payouts");
  }

  // Array of UID formats to test, in order of preference
  const uidFormats = [];

  // Add stored UID if available
  if (piUid && piUid.trim()) {
    uidFormats.push(piUid.trim());
  }

  // Add username variations
  uidFormats.push(
    piUsername,
    `@${piUsername}`,
    piUsername.toLowerCase(),
    `@${piUsername.toLowerCase()}`
  );

  // Remove duplicates while preserving order
  const uniqueFormats = [...new Set(uidFormats)];

  console.log("Testing UID formats:", uniqueFormats);

  for (const uid of uniqueFormats) {
    try {
      // Test with a minimal payment to validate the UID
      const testData = {
        amount: 0.001,
        memo: "UID validation test",
        metadata: { 
          test: true,
          validation_type: "uid_check",
          timestamp: Date.now()
        },
        uid: uid
      };

      const paymentId = await piApiRequest("POST", "/v2/payments", apiKey, testData);
      
      // Immediately cancel the test payment
      try {
        await piApiRequest("POST", `/v2/payments/${paymentId.identifier}/cancel`, apiKey);
      } catch (cancelError) {
        console.log("Warning: Could not cancel test payment:", cancelError.message);
      }

      console.log(`✅ UID format works: ${uid}`);
      return uid;

    } catch (error) {
      if (error.message.includes("User with uid was not found")) {
        console.log(`❌ UID format invalid: ${uid}`);
        continue;
      } else {
        console.log(`⚠ Other error for ${uid}: ${error.message}`);
        // For other errors, the UID might be valid but there's a different issue
        return uid;
      }
    }
  }

  throw new Error(`No valid UID format found for user ${piUsername}. Tried formats: ${uniqueFormats.join(', ')}`);
}

// Handle incomplete payments
async function handleIncompletePayments(apiKey: string): Promise<void> {
  try {
    const incomplete = await piApiRequest("GET", "/v2/payments/incomplete", apiKey);
    
    if (incomplete && incomplete.length > 0) {
      console.log(`Found ${incomplete.length} incomplete payments, cleaning up...`);
      
      for (const payment of incomplete) {
        try {
          if (payment.transaction && payment.transaction.txid) {
            // Try to complete if there's a transaction
            await piApiRequest("POST", `/v2/payments/${payment.identifier}/complete`, apiKey, {
              txid: payment.transaction.txid
            });
            console.log(`Completed incomplete payment: ${payment.identifier}`);
          } else {
            // Cancel if no transaction
            await piApiRequest("POST", `/v2/payments/${payment.identifier}/cancel`, apiKey);
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

    // Handle any incomplete payments first
    await handleIncompletePayments(apiKey);

    // Validate and fix the UID
    const validUid = await validateAndFixPiUid(
      userProfile.pi_uid,
      userProfile.pi_username,
      apiKey
    );

    console.log(`Using validated UID: ${validUid} for user ${userProfile.pi_username}`);

    // Insert payout record
    const { data: payoutData, error: insertErr } = await supabase
      .from("a2u_payouts")
      .insert({
        user_id: userId,
        pi_username: userProfile.pi_username,
        pi_uid: validUid,
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
    console.log("Starting A2U payout:", { payoutId, validUid, amount });

    try {
      // Step 1: Create A2U payment
      const paymentBody = {
        amount,
        memo: memo || `A2U payout to ${userProfile.pi_username}`,
        metadata: { 
          payout_id: payoutId, 
          user_id: userId,
          pi_username: userProfile.pi_username
        },
        uid: validUid,
      };

      console.log("Step 1: Creating A2U payment...");
      const createResp = await piApiRequest("POST", "/v2/payments", apiKey, paymentBody);
      const paymentId = createResp.identifier;

      console.log("Payment created:", { paymentId });

      await supabase
        .from("a2u_payouts")
        .update({ pi_payment_id: paymentId })
        .eq("id", payoutId);

      // Step 2: Build & submit Stellar transaction
      const StellarSdk = await import("https://esm.sh/stellar-sdk@11.3.0");

      const myKeypair = StellarSdk.Keypair.fromSecret(walletSeed);
      const myPublicKey = myKeypair.publicKey();

      const piSandbox = Deno.env.get("VITE_PI_SANDBOX") || "false";
      const isTestnet = piSandbox.toLowerCase() === "true";
      const horizonUrl = isTestnet
        ? "https://api.testnet.minepi.com"
        : "https://api.mainnet.minepi.com";
      const networkPassphrase = isTestnet ? "Pi Testnet" : "Pi Network";

      console.log("Step 2: Loading account from", horizonUrl);
      const server = new StellarSdk.Horizon.Server(horizonUrl);
      const myAccount = await server.loadAccount(myPublicKey);
      const baseFee = await server.fetchBaseFee();

      // Step 3: Build transaction
      console.log("Step 3: Building transaction...");
      const recipientAddress = createResp.recipient;
      const payment = StellarSdk.Operation.payment({
        destination: recipientAddress,
        asset: StellarSdk.Asset.native(),
        amount: amount.toString(),
      });

      const timebounds = await server.fetchTimebounds(180);

      const transaction = new StellarSdk.TransactionBuilder(myAccount, {
        fee: baseFee.toString(),
        networkPassphrase,
        timebounds,
      })
        .addOperation(payment)
        .addMemo(StellarSdk.Memo.text(paymentId))
        .build();

      // Step 4: Sign
      console.log("Step 4: Signing transaction...");
      transaction.sign(myKeypair);

      // Step 5: Submit
      console.log("Step 5: Submitting transaction...");
      const submitResult = await server.submitTransaction(transaction);
      const txid = (submitResult as any).id || (submitResult as any).hash;
      console.log("Transaction submitted, txid:", txid);

      // Step 6: Complete payment
      console.log("Step 6: Completing payment...");
      await piApiRequest("POST", `/v2/payments/${paymentId}/complete`, apiKey, { txid });

      await supabase
        .from("a2u_payouts")
        .update({ status: "completed", pi_txid: txid })
        .eq("id", payoutId);

      return json({
        success: true,
        paymentId,
        txid,
        payout_id: payoutId,
        uid_used: validUid,
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
        uid_attempted: validUid,
      }, 400);
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    console.error("A2U payout error:", err);
    return json({ error: msg }, 500);
  }
});
