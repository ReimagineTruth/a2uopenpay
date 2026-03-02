import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import PiNetwork from "pi-backend";

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

    if (!apiKey) {
      console.error("PI_API_KEY not configured");
      return json({ error: "Pi API not configured" }, 500);
    }
    if (!walletSeed) {
      console.error("WALLET_PRIVATE_SEED not configured");
      return json({ error: "Wallet not configured" }, 500);
    }

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Missing auth" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const { amount, piUsername, memo } = await req.json();
    if (!amount || amount <= 0) return json({ error: "Invalid amount" }, 400);
    if (!piUsername) return json({ error: "Pi username required" }, 400);

    const paymentMemo = memo || `A2U payout to @${piUsername}`;

    // Insert payout record
    const { data: payout, error: insertErr } = await supabase
      .from("a2u_payouts")
      .insert({
        user_id: user.id,
        pi_username: piUsername,
        amount,
        memo: paymentMemo,
        status: "processing",
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("Failed to insert payout:", insertErr);
      return json({ error: insertErr.message }, 500);
    }

    const payoutId = (payout as any).id;

    // Initialize Pi Network with credentials
    const pi = new PiNetwork(apiKey, walletSeed);

    // Create A2U payment using SDK
    try {
      const paymentResult = await pi.createPayment({
        amount: amount.toString(),
        memo: paymentMemo,
        uid: piUsername,
        metadata: {
          payout_id: payoutId,
          user_id: user.id
        }
      });

      console.log("A2U payment created:", paymentResult);

      // Update payout record with payment details
      await supabase.from("a2u_payouts").update({
        status: "completed",
        pi_payment_id: paymentResult,
        pi_txid: paymentResult,
      }).eq("id", payoutId);

      return json({ 
        success: true, 
        paymentId: paymentResult,
        txid: paymentResult,
        payout_id: payoutId 
      });

    } catch (sdkError: any) {
      console.error("Pi SDK error:", sdkError);
      
      // Update payout record with error
      await supabase.from("a2u_payouts").update({
        status: "failed",
        error_message: sdkError.message || "SDK error occurred",
      }).eq("id", payoutId);

      return json({ 
        error: "Payment processing failed", 
        details: sdkError.message || "Unknown SDK error" 
      }, 400);
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    console.error("A2U payout error:", err);
    return json({ error: msg }, 500);
  }
});
