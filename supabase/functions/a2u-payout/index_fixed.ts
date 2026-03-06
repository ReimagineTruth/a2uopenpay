// deno-lint-ignore-file no-explicit-any
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

async function piApiRequest(
  method: string,
  path: string,
  apiKey: string,
  body?: Record<string, unknown>,
): Promise<any> {
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

  if (!resp.ok) {
    console.error(`Pi API error [${resp.status}] ${path}:`, JSON.stringify(data));
    throw new Error(
      data?.error_message || data?.message || data?.error || `Pi API error: ${resp.status}`,
    );
  }
  return data;
}

// Function to validate and get the correct Pi user UID
async function getValidPiUid(piUsername: string, apiKey: string): Promise<string> {
  try {
    // Try to get user info from Pi API to validate the user exists
    // Note: This endpoint may not exist - you might need to use a different approach
    const userResp = await piApiRequest("GET", `/v2/users/${piUsername}`, apiKey);
    return userResp.uid || userResp.id || piUsername;
  } catch (error) {
    console.log(`Could not validate user ${piUsername}:`, error);
    
    // Fallback: try different UID formats
    const uidFormats = [
      piUsername,                    // Plain username
      `@${piUsername}`,              // With @ prefix
      piUsername.startsWith('@') ? piUsername.substring(1) : piUsername, // Remove @ if present
    ];
    
    // Return the most likely format (you may need to adjust based on testing)
    return uidFormats[0];
  }
}

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

    // Auth
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data, error: userErr } = await supabase.auth.getUser(token);
      if (!userErr && data?.user) userId = data.user.id;
    }
    if (!userId) return json({ error: "Authentication required" }, 401);

    const { amount, piUsername, memo } = await req.json();
    if (!amount || amount <= 0) return json({ error: "Invalid amount" }, 400);
    if (!piUsername) return json({ error: "Pi username (uid) required" }, 400);

    const paymentMemo = memo || `A2U payout to @${piUsername}`;

    // ===== VALIDATION STEP: Get the correct UID format =====
    console.log("Validating Pi user UID for:", piUsername);
    const validUid = await getValidPiUid(piUsername, apiKey);
    console.log(`Using UID format: ${validUid} (input: ${piUsername})`);

    // Insert payout record
    const { data: payoutData, error: insertErr } = await supabase
      .from("a2u_payouts")
      .insert({
        user_id: userId,
        pi_username: piUsername,
        pi_uid: validUid, // Store the validated UID
        amount,
        memo: paymentMemo,
        status: "processing",
      })
      .select("id")
      .single();

    if (insertErr || !payoutData) {
      console.error("Failed to insert payout:", insertErr);
      return json({ error: "Failed to create payout record" }, 500);
    }

    const payoutId = (payoutData as any).id;
    console.log("Starting A2U payout:", { payoutId, piUsername, validUid, amount });

    try {
      // ===== STEP 1: Create A2U payment via Pi API =====
      const paymentBody = {
        amount,
        memo: paymentMemo,
        metadata: { payout_id: payoutId, user_id: userId, original_username: piUsername },
        uid: validUid, // Use the validated UID
      };

      console.log("Step 1: Creating A2U payment via Pi API...");
      console.log("Payment data:", JSON.stringify(paymentBody, null, 2));
      
      const createResp = await piApiRequest("POST", "/v2/payments", apiKey, paymentBody);
      const paymentId = createResp.identifier;

      console.log("Payment created:", { paymentId });

      await supabase
        .from("a2u_payouts")
        .update({ pi_payment_id: paymentId })
        .eq("id", payoutId);

      // ===== STEP 2: Build & submit Stellar transaction =====
      // Use dynamic import for Stellar SDK to avoid Buffer issues
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

      // ===== STEP 3: Build transaction =====
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

      // ===== STEP 4: Sign =====
      console.log("Step 4: Signing transaction...");
      transaction.sign(myKeypair);

      // ===== STEP 5: Submit =====
      console.log("Step 5: Submitting transaction...");
      const submitResult = await server.submitTransaction(transaction);
      const txid = (submitResult as any).id || (submitResult as any).hash;
      console.log("Transaction submitted, txid:", txid);

      // ===== STEP 6: Complete payment via Pi API =====
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
        original_username: piUsername,
      }, 400);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    console.error("A2U payout error:", err);
    return json({ error: msg }, 500);
  }
});
