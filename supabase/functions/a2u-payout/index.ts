import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore - npm specifier for Deno
import PiNetwork from "npm:pi-backend@0.1.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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

    // Auth
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data, error: userErr } = await supabase.auth.getUser(token);
      if (!userErr && data?.user) {
        userId = data.user.id;
      }
    }

    if (!userId) {
      return json({ error: "Authentication required" }, 401);
    }

    const { amount, piUsername, memo } = await req.json();
    if (!amount || amount <= 0) return json({ error: "Invalid amount" }, 400);
    if (!piUsername) return json({ error: "Pi username required" }, 400);

    const paymentMemo = memo || `A2U payout to @${piUsername}`;

    // Initialize Pi SDK
    const pi = new PiNetwork(apiKey, walletSeed);

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

    const paymentData = {
      amount,
      memo: paymentMemo,
      metadata: { payout_id: payoutId, user_id: userId },
      uid: piUsername,
    };

    try {
      // Step 1: Create payment using Pi SDK
      const paymentId = await pi.createPayment(paymentData);
      console.log("Payment created:", paymentId);

      await supabase.from("a2u_payouts").update({
        pi_payment_id: paymentId,
      }).eq("id", payoutId);

      // Step 2: Submit payment (builds & submits Stellar transaction)
      const txid = await pi.submitPayment(paymentId);
      console.log("Payment submitted, txid:", txid);

      // Step 3: Complete payment
      const completedPayment = await pi.completePayment(paymentId, txid);
      console.log("Payment completed:", completedPayment);

      await supabase.from("a2u_payouts").update({
        status: "completed",
        pi_txid: txid,
      }).eq("id", payoutId);

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

      await supabase.from("a2u_payouts").update({
        status: "failed",
        error_message: errMsg.substring(0, 500),
      }).eq("id", payoutId);

      return json({ error: "Pi payment failed", details: errMsg }, 400);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    console.error("A2U payout error:", err);
    return json({ error: msg }, 500);
  }
});
