import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore - Stellar SDK for Deno
import * as StellarSdk from "https://esm.sh/stellar-sdk@11.3.0";

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

// Pi API base URL
const PI_API_BASE = "https://api.minepi.com";

// Helper: make authenticated Pi API request
async function piApiRequest(
  method: string,
  path: string,
  apiKey: string,
  body?: Record<string, unknown>,
) {
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("PI_API_KEY");
    const walletSeed = Deno.env.get("WALLET_PRIVATE_SEED");

    if (!apiKey) return json({ error: "Pi API not configured" }, 500);
    if (!walletSeed) return json({ error: "Wallet not configured" }, 500);

    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth — get calling user
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

    // Insert payout record
    const { data: payout, error: insertErr } = await supabase
      .from("a2u_payouts")
      .insert({
        user_id: userId,
        pi_username: piUsername,
        amount,
        memo: paymentMemo,
        status: "processing",
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("Failed to insert payout:", insertErr);
      return json({ error: "Failed to create payout record" }, 500);
    }

    const payoutId = payout.id;
    console.log("Starting A2U payout:", { payoutId, piUsername, amount });

    try {
      // ===== STEP 1: Create payment via Pi API =====
      const paymentBody = {
        amount,
        memo: paymentMemo,
        metadata: { payout_id: payoutId, user_id: userId },
        uid: piUsername,
      };

      console.log("Step 1: Creating payment via Pi API...");
      const createResp = await piApiRequest("POST", "/v2/payments", apiKey, paymentBody);
      const paymentId = createResp.identifier;
      const recipientAddress = createResp.recipient;

      console.log("Payment created:", { paymentId, recipientAddress });

      await supabase
        .from("a2u_payouts")
        .update({ pi_payment_id: paymentId })
        .eq("id", payoutId);

      // ===== STEP 2: Determine network & load account =====
      // Derive public key from wallet seed
      const myKeypair = StellarSdk.Keypair.fromSecret(walletSeed);
      const myPublicKey = myKeypair.publicKey();

      // Determine network based on sandbox setting or payment network
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
      const payment = StellarSdk.Operation.payment({
        destination: recipientAddress,
        asset: StellarSdk.Asset.native(),
        amount: amount.toString(),
      });

      const timebounds = await server.fetchTimebounds(180);

      let transaction = new StellarSdk.TransactionBuilder(myAccount, {
        fee: baseFee.toString(),
        networkPassphrase,
        timebounds,
      })
        .addOperation(payment)
        .addMemo(StellarSdk.Memo.text(paymentId))
        .build();

      // ===== STEP 4: Sign transaction =====
      console.log("Step 4: Signing transaction...");
      transaction.sign(myKeypair);

      // ===== STEP 5: Submit transaction to Pi Blockchain =====
      console.log("Step 5: Submitting transaction...");
      const submitResult = await server.submitTransaction(transaction);
      const txid = submitResult.id || submitResult.hash;
      console.log("Transaction submitted, txid:", txid);

      // ===== STEP 6: Complete payment via Pi API =====
      console.log("Step 6: Completing payment...");
      const completeResp = await piApiRequest(
        "POST",
        `/v2/payments/${paymentId}/complete`,
        apiKey,
        { txid },
      );
      console.log("Payment completed:", completeResp);

      // Update payout record as completed
      await supabase
        .from("a2u_payouts")
        .update({ status: "completed", pi_txid: txid })
        .eq("id", payoutId);

      return json({
        success: true,
        paymentId,
        txid,
        payout_id: payoutId,
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

      return json({ error: "Pi payment failed", details: errMsg }, 400);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    console.error("A2U payout error:", err);
    return json({ error: msg }, 500);
  }
});
