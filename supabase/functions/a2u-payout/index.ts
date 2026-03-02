import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    if (!apiKey) return json({ error: "PI_API_KEY not configured" }, 500);
    if (!walletSeed) return json({ error: "WALLET_PRIVATE_SEED not configured" }, 500);

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

    if (insertErr) return json({ error: insertErr.message }, 500);

    // Step 1: Create A2U payment via Pi Platform API
    const createRes = await fetch("https://api.minepi.com/v2/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({
        payment: {
          amount,
          memo: paymentMemo,
          metadata: { payout_id: payout.id },
          uid: piUsername,
        },
      }),
    });

    const createData = await createRes.json();
    if (!createRes.ok) {
      await supabase.from("a2u_payouts").update({
        status: "failed",
        error_message: JSON.stringify(createData),
      }).eq("id", payout.id);
      return json({ error: "Failed to create Pi payment", details: createData }, 400);
    }

    const paymentId = createData.identifier;

    // Update record with payment ID
    await supabase.from("a2u_payouts").update({
      pi_payment_id: paymentId,
    }).eq("id", payout.id);

    // Step 2: Approve the payment (server-side)
    const approveRes = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
    });

    if (!approveRes.ok) {
      const approveErr = await approveRes.text();
      await supabase.from("a2u_payouts").update({
        status: "failed",
        error_message: `Approve failed: ${approveErr}`,
      }).eq("id", payout.id);
      return json({ error: "Failed to approve payment", details: approveErr }, 400);
    }

    // Step 3: Submit transaction to Pi blockchain using Stellar SDK approach
    // Build and submit the transaction using the Pi Blockchain API
    // For A2U, we use the horizon endpoint to build and submit
    const horizonUrl = "https://api.mainnet.minepi.com";

    // Get the payment details to find the transaction data
    const getPaymentRes = await fetch(`https://api.minepi.com/v2/payments/${paymentId}`, {
      method: "GET",
      headers: {
        Authorization: `Key ${apiKey}`,
      },
    });

    const paymentData = await getPaymentRes.json();
    if (!getPaymentRes.ok) {
      await supabase.from("a2u_payouts").update({
        status: "failed",
        error_message: `Get payment failed: ${JSON.stringify(paymentData)}`,
      }).eq("id", payout.id);
      return json({ error: "Failed to get payment details", details: paymentData }, 400);
    }

    // Use the Pi SDK approach: build transaction from payment data
    // The Pi Platform provides transaction data that needs to be signed and submitted
    const fromAddress = paymentData.from_address;
    const toAddress = paymentData.to_address;
    const piAmount = paymentData.amount;

    // Load source account from horizon
    const accountRes = await fetch(`${horizonUrl}/accounts/${fromAddress}`);
    const accountData = await accountRes.json();
    if (!accountRes.ok) {
      await supabase.from("a2u_payouts").update({
        status: "failed",
        error_message: `Account load failed: ${JSON.stringify(accountData)}`,
      }).eq("id", payout.id);
      return json({ error: "Failed to load source account" }, 400);
    }

    // Build and submit transaction using Stellar horizon transaction builder
    // We need to use the raw horizon API since we can't use Stellar SDK in Deno easily
    const sequence = (BigInt(accountData.sequence) + BigInt(1)).toString();
    const networkPassphrase = "Pi Network";

    // Build the XDR transaction envelope
    // For simplicity and reliability, we use the Pi backend approach:
    // After approve, get the transaction_data from Pi API and submit it
    
    // The Pi SDK handles this internally - let's use a simpler approach
    // by importing stellar-base for transaction building
    // Actually, for Deno edge functions, let's use the direct horizon submission

    // Pi's A2U flow: after approval, Pi provides a transaction we need to sign
    // Let's check if there's a transaction to complete
    if (paymentData.transaction && paymentData.transaction.txid) {
      // Transaction already submitted by Pi
      const txid = paymentData.transaction.txid;
      
      // Step 4: Complete the payment
      const completeRes = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${apiKey}`,
        },
        body: JSON.stringify({ txid }),
      });

      const completeData = await completeRes.json();
      if (!completeRes.ok) {
        await supabase.from("a2u_payouts").update({
          status: "failed",
          error_message: `Complete failed: ${JSON.stringify(completeData)}`,
        }).eq("id", payout.id);
        return json({ error: "Failed to complete payment", details: completeData }, 400);
      }

      await supabase.from("a2u_payouts").update({
        status: "completed",
        pi_txid: txid,
      }).eq("id", payout.id);

      return json({ success: true, paymentId, txid, payout_id: payout.id });
    }

    // If no txid yet, we need to build and submit the blockchain transaction
    // Use Stellar SDK via esm.sh for transaction building
    const { Keypair, TransactionBuilder, Networks, Operation, Asset, Account } = await import(
      "https://esm.sh/stellar-base@10.0.1"
    );

    const keypair = Keypair.fromSecret(walletSeed);
    const sourceAccount = new Account(fromAddress, accountData.sequence);

    // Fetch base fee
    const feeStatsRes = await fetch(`${horizonUrl}/fee_stats`);
    const feeStats = await feeStatsRes.json();
    const baseFee = feeStats?.last_ledger_base_fee || "100000";

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: baseFee,
      networkPassphrase: networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination: toAddress,
          asset: Asset.native(),
          amount: String(piAmount),
        })
      )
      .setTimeout(180)
      .build();

    transaction.sign(keypair);

    const txXdr = transaction.toEnvelope().toXDR("base64");

    // Submit to horizon
    const submitRes = await fetch(`${horizonUrl}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `tx=${encodeURIComponent(txXdr)}`,
    });

    const submitData = await submitRes.json();
    if (!submitRes.ok) {
      await supabase.from("a2u_payouts").update({
        status: "failed",
        error_message: `Submit failed: ${JSON.stringify(submitData)}`,
      }).eq("id", payout.id);
      return json({ error: "Blockchain submission failed", details: submitData }, 400);
    }

    const txid = submitData.hash;

    // Step 4: Complete the payment on Pi Platform
    const completeRes = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({ txid }),
    });

    const completeData = await completeRes.json();
    if (!completeRes.ok) {
      await supabase.from("a2u_payouts").update({
        status: "failed",
        error_message: `Complete failed: ${JSON.stringify(completeData)}`,
      }).eq("id", payout.id);
      return json({ error: "Failed to complete payment", details: completeData }, 400);
    }

    // Mark as completed
    await supabase.from("a2u_payouts").update({
      status: "completed",
      pi_txid: txid,
    }).eq("id", payout.id);

    return json({ success: true, paymentId, txid, payout_id: payout.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    console.error("A2U payout error:", err);
    return json({ error: msg }, 500);
  }
});
