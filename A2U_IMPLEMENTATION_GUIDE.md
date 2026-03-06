# A2U (App-to-User) Implementation Guide

## Overview
This guide provides a complete implementation for Pi Network A2U payouts using the official pi-nodejs SDK. Follow these steps to integrate A2U functionality into your applications.

## Prerequisites

### 1. Pi Network App Setup
- Create a Pi Network app at [developers.minepi.com](https://developers.minepi.com)
- Get your **API Key** from the app dashboard
- Create and fund a **Pi Wallet** for payouts
- Export your **Wallet Private Seed** (starts with "S_")

### 2. Environment Variables
Set these environment variables in your deployment:

```bash
# Pi Network Configuration
PI_API_KEY=your_pi_api_key_here
WALLET_PRIVATE_SEED=S_your_wallet_private_seed_here

# Supabase Configuration (if using)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Pi Network Environment
VITE_PI_SANDBOX=true  # Set to "false" for mainnet
```

## Database Schema

### User Profiles Table
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id UUID REFERENCES auth.users(id),
  pi_uid VARCHAR(255),
  pi_username VARCHAR(255),
  pi_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### A2U Payouts Table
```sql
CREATE TABLE a2u_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  pi_username VARCHAR(255) NOT NULL,
  pi_uid VARCHAR(255) NOT NULL,
  amount DECIMAL(10,8) NOT NULL,
  memo TEXT,
  status VARCHAR(20) DEFAULT 'processing',
  pi_payment_id VARCHAR(255),
  pi_txid VARCHAR(255),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Backend Implementation

### 1. Install Dependencies
```bash
npm install pi-backend @supabase/supabase-js
# or
yarn add pi-backend @supabase/supabase-js
```

### 2. A2U Payout Function
Create a serverless function (example for Supabase Edge Functions):

```typescript
// a2u-payout/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import PiNetwork from "https://esm.sh/pi-backend@1.3.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
            // Complete if transaction exists
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
```

## Frontend Implementation

### 1. Pi Network SDK Integration
```typescript
// Initialize Pi SDK in your app
import { useEffect, useState } from 'react';

const usePiNetwork = () => {
  const [piUser, setPiUser] = useState<any>(null);
  const [isPiBrowser, setIsPiBrowser] = useState(false);

  useEffect(() => {
    // Check if running in Pi Browser
    const piSdk = (window as any).Pi;
    if (typeof window !== 'undefined' && piSdk) {
      setIsPiBrowser(true);
      
      const initializePi = async () => {
        try {
          const sandbox = process.env.REACT_APP_PI_SANDBOX === "true";
          piSdk.init({ version: "2.0", sandbox });
          
          const authResult = await piSdk.authenticate(['username', 'payments']);
          console.log("Pi user authenticated:", authResult);
          setPiUser(authResult.user);
        } catch (error) {
          console.error("Pi authentication failed:", error);
        }
      };
      
      initializePi();
    }
  }, []);

  return { piUser, isPiBrowser };
};
```

### 2. A2U Payout Component
```typescript
import { useState } from 'react';
import { supabase } from './supabaseClient';

const A2UPayoutComponent = ({ piUser }: { piUser: any }) => {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('0.01');

  const handlePayout = async () => {
    if (!piUser) {
      alert("Please authenticate with Pi Network first");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("a2u-payout", {
        body: {
          amount: parseFloat(amount),
          memo: "Test payout from my app",
        },
      });

      if (error) {
        console.error("Payout error:", error);
        alert("Payout failed: " + error.message);
      } else if (data?.success) {
        alert("A2U Payout completed successfully!");
        console.log("Payout result:", data);
      } else {
        alert("Payout failed: " + (data?.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Payout error:", error);
      alert("Payout failed: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <h3>A2U Payout</h3>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        step="0.01"
        min="0.01"
        placeholder="Amount in Pi"
      />
      <button onClick={handlePayout} disabled={loading}>
        {loading ? "Processing..." : "Request Payout"}
      </button>
    </div>
  );
};
```

## Testing & Deployment

### 1. Testnet Testing
```bash
# Enable testnet mode
VITE_PI_SANDBOX=true

# Use testnet API and wallet
PI_API_KEY=your_testnet_api_key
WALLET_PRIVATE_SEED=S_your_testnet_wallet_seed
```

### 2. Common Issues & Solutions

#### "User with uid was not found"
- Check UID format in user profile
- Ensure user is properly authenticated with Pi Network
- Verify user exists in Pi Network

#### "You need to complete the ongoing payment first"
- The `handleIncompletePayments()` function should resolve this
- Manually check for incomplete payments in Pi Network dashboard

#### "Wallet not configured"
- Ensure `WALLET_PRIVATE_SEED` is set and starts with "S_"
- Verify wallet has sufficient Pi balance

### 3. Production Checklist
- [ ] Environment variables configured
- [ ] Database tables created
- [ ] Pi Network app approved for production
- [ ] Wallet funded with sufficient Pi
- [ ] Test transactions completed successfully
- [ ] Error monitoring setup
- [ ] Transaction logging implemented

## API Reference

### SDK Methods
```typescript
// Initialize SDK
const pi = new PiNetwork(apiKey, walletSeed);

// Create payment
const paymentId = await pi.createPayment({
  amount: 1.0,
  memo: "Payment memo",
  metadata: { custom_data: "value" },
  uid: "user_uid"
});

// Submit to blockchain
const txid = await pi.submitPayment(paymentId);

// Complete payment
const payment = await pi.completePayment(paymentId, txid);

// Get incomplete payments
const incomplete = await pi.getIncompleteServerPayments();

// Cancel payment
await pi.cancelPayment(paymentId);
```

### Payment Data Structure
```typescript
interface PaymentData {
  amount: number;
  memo: string;
  metadata: Record<string, any>;
  uid: string;
}

interface PaymentResult {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  metadata: Record<string, any>;
  status: {
    developer_approved: boolean;
    transaction_verified: boolean;
    developer_completed: boolean;
    cancelled: boolean;
    user_cancelled: boolean;
  };
  transaction: {
    txid: string;
    verified: boolean;
    _link: string;
  } | null;
}
```

## Security Best Practices

1. **Environment Variables**: Never expose API keys or wallet seeds in frontend code
2. **Input Validation**: Validate all user inputs before processing
3. **Rate Limiting**: Implement rate limiting on payout endpoints
4. **Transaction Limits**: Set maximum payout amounts per user/time period
5. **Audit Logs**: Log all payout attempts for compliance
6. **Error Handling**: Never expose sensitive error details to users

## Support & Resources

- [Pi Network Developer Documentation](https://developers.minepi.com/docs)
- [pi-nodejs GitHub Repository](https://github.com/pi-apps/pi-nodejs)
- [Pi Network Community](https://community.minepi.com)
- [Pi Network Discord](https://discord.gg/minepi)

---

This implementation guide provides a complete, production-ready A2U payout system using the official Pi Network SDK. Customize the database schema and frontend components to fit your specific application requirements.
