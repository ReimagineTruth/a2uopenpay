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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("PI_API_KEY");
    const walletSeed =
      Deno.env.get("WALLET_PRIVATE_SEED") || Deno.env.get("PI_WALLET_PRIVATE_SEED");

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

    const { amount, piUsername, memo, accessToken } = await req.json();
    if (!amount || amount <= 0) return json({ error: "Invalid amount" }, 400);
    if (!piUsername && !accessToken) {
      return json({ error: "Pi uid or accessToken required" }, 400);
    }

    // Resolve uid: prefer accessToken verification to ensure uid belongs to this app
    let resolvedUid: string | null = null;
    let resolvedUsername: string | null = null;
    if (accessToken && typeof accessToken === "string") {
      try {
        const meResp = await fetch("https://api.minepi.com/v2/me", {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const meData = await meResp.json();
        if (!meResp.ok || !meData?.uid) {
          console.error("Pi /v2/me failed:", meResp.status, meData);
          throw new Error("Pi auth token verification failed");
        }
        resolvedUid = String(meData.uid);
        resolvedUsername = typeof meData.username === "string" ? meData.username : null;
      } catch (e) {
        console.error("Failed to verify accessToken:", e);
      }
    }
    // Fallback to provided uid (named piUsername in payload)
    if (!resolvedUid && piUsername) resolvedUid = String(piUsername);

    if (!resolvedUid) return json({ error: "Could not resolve Pi uid" }, 400);

    const paymentMemo = memo || `A2U payout to @${resolvedUsername || "user"}`;

    // Insert payout record
    const { data: payoutData, error: insertErr } = await supabase
      .from("a2u_payouts")
      .insert({
        user_id: userId,
        pi_username: resolvedUsername || resolvedUid,
        pi_uid: resolvedUid,
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

    const payoutId = payoutData.id;
    console.log("Starting A2U payout:", { payoutId, uid: resolvedUid, amount });

    try {
      // Step 1: Create A2U payment via Pi API
      const paymentBody = {
        amount,
        memo: paymentMemo,
        metadata: { payout_id: payoutId, user_id: userId },
        uid: resolvedUid,
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

      const isTestnet = (Deno.env.get("VITE_PI_SANDBOX") || "false").toLowerCase() === "true";
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
      const txid = submitResult.id || submitResult.hash;
      console.log("Transaction submitted, txid:", txid);

      // Step 6: Complete payment via Pi API
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
        uid_used: resolvedUid,
        message: "A2U payout completed successfully",
      });
    } catch (piError: any) {
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
        uid_attempted: piUsername,
      }, 400);
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    console.error("A2U payout error:", err);
    return json({ error: msg }, 500);
  }
});
