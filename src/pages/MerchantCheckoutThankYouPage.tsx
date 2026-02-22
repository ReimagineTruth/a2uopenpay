import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";
import SplashScreen from "@/components/SplashScreen";
import TransactionReceipt, { type ReceiptData } from "@/components/TransactionReceipt";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/integrations/supabase/client";

type CheckoutSessionPublic = {
  session_id: string;
  currency: string;
  amount: number;
  merchant_name: string;
  merchant_username: string;
  merchant_logo_url: string | null;
};

const MerchantCheckoutThankYouPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currencies } = useCurrency();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const sessionToken = searchParams.get("session") || "";
  const transactionId = searchParams.get("tx") || "";
  const confirmationMessage = searchParams.get("message") || "Your payment was processed successfully.";
  const fallbackMerchantName = searchParams.get("merchant_name") || "OpenPay Merchant";
  const fallbackMerchantUsername = searchParams.get("merchant_username") || "";
  const fallbackCurrency = (searchParams.get("currency") || "USD").toUpperCase();
  const fallbackAmount = Number(searchParams.get("amount") || "0");

  const [loading, setLoading] = useState(false);
  const [viewerEmail, setViewerEmail] = useState("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [sessionData, setSessionData] = useState<CheckoutSessionPublic | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  useEffect(() => {
    const boot = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) setViewerEmail(user.email);

      if (!sessionToken) return;

      setLoading(true);
      const { data } = await db.rpc("get_public_merchant_checkout_session", { p_session_token: sessionToken });
      setLoading(false);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return;

      setSessionData({
        session_id: String(row.session_id || ""),
        currency: String(row.currency || "USD"),
        amount: Number(row.amount || 0),
        merchant_name: String(row.merchant_name || "OpenPay Merchant"),
        merchant_username: String(row.merchant_username || ""),
        merchant_logo_url: row.merchant_logo_url ? String(row.merchant_logo_url) : null,
      });
    };

    void boot();
  }, [db, sessionToken]);

  const mergedCurrency = sessionData?.currency || fallbackCurrency;
  const mergedAmount = sessionData?.amount || fallbackAmount;
  const mergedMerchantName = sessionData?.merchant_name || fallbackMerchantName;
  const mergedMerchantUsername = sessionData?.merchant_username || fallbackMerchantUsername;

  const amountInUsd = useMemo(() => {
    const rate = currencies.find((c) => c.code === mergedCurrency)?.rate ?? 1;
    return Number(mergedAmount || 0) / (rate || 1);
  }, [currencies, mergedAmount, mergedCurrency]);

  useEffect(() => {
    if (!transactionId) return;
    const noteSessionId = sessionData?.session_id || sessionToken || "N/A";
    setReceiptData({
      transactionId,
      type: "send",
      amount: amountInUsd,
      otherPartyName: mergedMerchantName,
      otherPartyUsername: mergedMerchantUsername || undefined,
      note: `Merchant checkout session: ${noteSessionId}`,
      date: new Date(),
    });
  }, [amountInUsd, mergedMerchantName, mergedMerchantUsername, sessionData?.session_id, sessionToken, transactionId]);

  if (loading) {
    return <SplashScreen message="Loading payment confirmation..." />;
  }

  return (
    <div className="min-h-screen bg-[#f5f6fa] px-4 py-10">
      <div className="mx-auto w-full max-w-xl rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          <h1 className="text-2xl font-semibold text-foreground">Thank you. Payment completed.</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{confirmationMessage}</p>

        <div className="mt-4 space-y-2 rounded-xl border border-border bg-secondary/30 p-4 text-sm">
          <p className="flex items-center justify-between">
            <span className="text-muted-foreground">Merchant</span>
            <span className="font-medium text-foreground">{mergedMerchantName}</span>
          </p>
          {!!mergedMerchantUsername && (
            <p className="flex items-center justify-between">
              <span className="text-muted-foreground">Username</span>
              <span className="font-medium text-foreground">@{mergedMerchantUsername}</span>
            </p>
          )}
          {!!transactionId && (
            <p className="flex items-center justify-between">
              <span className="text-muted-foreground">Transaction ID</span>
              <span className="max-w-[68%] break-all text-right font-mono text-xs text-foreground">{transactionId}</span>
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="h-10 rounded-lg"
            onClick={() => setReceiptOpen(true)}
            disabled={!receiptData}
          >
            <ReceiptText className="mr-2 h-4 w-4" />
            View receipt
          </Button>
          <Button
            className="h-10 rounded-lg bg-paypal-blue text-white hover:bg-[#004dc5]"
            onClick={() => navigate("/merchant-onboarding")}
          >
            Merchant dashboard
          </Button>
          <Button
            variant="ghost"
            className="h-10 rounded-lg"
            onClick={() => {
              if (sessionToken) {
                navigate(`/merchant-checkout?session=${encodeURIComponent(sessionToken)}`);
                return;
              }
              navigate("/merchant-checkout");
            }}
          >
            Back to checkout
          </Button>
        </div>

        {!!viewerEmail && (
          <p className="mt-4 text-sm text-muted-foreground">Signed in as {viewerEmail}</p>
        )}
        <p className="mt-6 text-center text-sm text-muted-foreground">Powered by OpenPay</p>
      </div>

      <TransactionReceipt open={receiptOpen} onOpenChange={setReceiptOpen} receipt={receiptData} />
    </div>
  );
};

export default MerchantCheckoutThankYouPage;
