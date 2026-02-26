import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";
import SplashScreen from "@/components/SplashScreen";
import TransactionReceipt, { type ReceiptData } from "@/components/TransactionReceipt";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

type CheckoutSessionPublic = {
  session_id: string;
  currency: string;
  amount: number;
  merchant_name: string;
  merchant_username: string;
  items?: Array<{
    item_name: string;
    delivery_type?: "file" | "link" | null;
    delivery_file_name?: string | null;
    delivery_file_data_url?: string | null;
    delivery_link_url?: string | null;
  }>;
};

const MerchantCheckoutThankYouPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currencies } = useCurrency();

  const sessionToken = searchParams.get("session") || "";
  const initialTx = searchParams.get("tx") || "";
  const confirmationMessage = searchParams.get("message") || "Thank you. Your POS payment was processed successfully.";
  const fallbackMerchantName = searchParams.get("merchant_name") || "OpenPay Merchant";
  const fallbackMerchantUsername = searchParams.get("merchant_username") || "";
  const fallbackCurrency = (searchParams.get("currency") || "USD").toUpperCase();
  const fallbackAmount = Number(searchParams.get("amount") || "0");

  const [loading, setLoading] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [transactionId, setTransactionId] = useState(initialTx);
  const [sessionData, setSessionData] = useState<CheckoutSessionPublic | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!sessionToken) return;
      setLoading(true);
      const { data } = await db.rpc("get_public_merchant_checkout_session", { p_session_token: sessionToken });
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setSessionData({
          session_id: String(row.session_id || ""),
          currency: String(row.currency || "USD"),
          amount: Number(row.amount || 0),
          merchant_name: String(row.merchant_name || "OpenPay Merchant"),
          merchant_username: String(row.merchant_username || ""),
          items: Array.isArray(row.items) ? row.items : [],
        });
      }
      setLoading(false);
    };
    void load();
  }, [sessionToken]);

  useEffect(() => {
    const loadTx = async () => {
      if (transactionId) return;
      const lookupSessionId = sessionData?.session_id;
      if (!lookupSessionId) return;
      const { data } = await db
        .from("merchant_payments")
        .select("transaction_id")
        .eq("session_id", lookupSessionId)
        .maybeSingle();
      if (data?.transaction_id) {
        setTransactionId(String(data.transaction_id));
      }
    };
    void loadTx();
  }, [sessionData?.session_id, transactionId]);

  const mergedCurrency = sessionData?.currency || fallbackCurrency;
  const mergedAmount = sessionData?.amount || fallbackAmount;
  const mergedMerchantName = sessionData?.merchant_name || fallbackMerchantName;
  const mergedMerchantUsername = sessionData?.merchant_username || fallbackMerchantUsername;
  const mergedSessionId = sessionData?.session_id || sessionToken || "N/A";
  const firstItem = sessionData?.items?.[0];
  const downloadFileName = firstItem?.delivery_file_name || `${firstItem?.item_name || "digital-product"}.bin`;

  const amountInUsd = useMemo(() => {
    const rate = currencies.find((c) => c.code === mergedCurrency)?.rate ?? 1;
    return Number(mergedAmount || 0) / (rate || 1);
  }, [currencies, mergedAmount, mergedCurrency]);

  useEffect(() => {
    if (!transactionId) return;
    setReceiptData({
      transactionId,
      ledgerTransactionId: transactionId,
      type: "send",
      amount: amountInUsd,
      otherPartyName: mergedMerchantName,
      otherPartyUsername: mergedMerchantUsername || undefined,
      note: `Merchant checkout session: ${mergedSessionId}`,
      date: new Date(),
    });
  }, [amountInUsd, mergedMerchantName, mergedMerchantUsername, mergedSessionId, transactionId]);

  if (loading) return <SplashScreen message="Loading payment confirmation..." />;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          <h1 className="text-2xl font-semibold text-foreground">Payment Completed</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{confirmationMessage || "Thank you! Your payment was processed successfully."}</p>

        {!!transactionId && (
          <p className="mt-4 text-xs text-muted-foreground">
            Transaction ID: <span className="font-mono text-foreground">{transactionId}</span>
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="outline" className="h-10 rounded-lg" onClick={() => setReceiptOpen(true)} disabled={!receiptData}>
            <ReceiptText className="mr-2 h-4 w-4" />
            View receipt
          </Button>
          <Button
            className="h-10 rounded-lg bg-paypal-blue text-white hover:bg-[#004dc5]"
            onClick={() => navigate("/dashboard")}
          >
            Back to wallet
          </Button>
          <Button variant="ghost" className="h-10 rounded-lg" onClick={() => navigate("/activity")}>
            Activity
          </Button>
        </div>
        {firstItem?.delivery_file_data_url && (
          <Button
            className="mt-3 h-10 rounded-lg bg-paypal-blue text-white hover:bg-[#004dc5]"
            onClick={() => {
              const link = document.createElement("a");
              link.href = firstItem.delivery_file_data_url || "";
              link.download = downloadFileName;
              link.click();
            }}
          >
            Download digital file
          </Button>
        )}
        {firstItem?.delivery_link_url && (
          <Button
            variant="outline"
            className="mt-3 h-10 rounded-lg"
            onClick={() => window.open(firstItem.delivery_link_url || "", "_blank", "noopener,noreferrer")}
          >
            Open download link
          </Button>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">Powered by OpenPay</p>
      </div>
      <TransactionReceipt open={receiptOpen} onOpenChange={setReceiptOpen} receipt={receiptData} />
    </div>
  );
};

export default MerchantCheckoutThankYouPage;
