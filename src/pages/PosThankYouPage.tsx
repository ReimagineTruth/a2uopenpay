import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";
import SplashScreen from "@/components/SplashScreen";
import TransactionReceipt, { type ReceiptData } from "@/components/TransactionReceipt";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/integrations/supabase/client";

type PosSessionPublic = {
  session_id: string;
  currency: string;
  amount: number;
  merchant_name: string;
  merchant_username: string;
};

const PosThankYouPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currencies } = useCurrency();

  const sessionToken = searchParams.get("session") || "";
  const initialTx = searchParams.get("tx") || "";
  const origin = (searchParams.get("origin") || "").trim().toLowerCase();
  const isMerchantOrigin = origin === "merchant-pos";

  const [loading, setLoading] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [transactionId, setTransactionId] = useState(initialTx);
  const [sessionData, setSessionData] = useState<PosSessionPublic | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!sessionToken) return;
      setLoading(true);
      const { data } = await supabase.rpc("get_public_merchant_checkout_session", { p_session_token: sessionToken });
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setSessionData({
          session_id: String(row.session_id || ""),
          currency: String(row.currency || "USD"),
          amount: Number(row.amount || 0),
          merchant_name: String(row.merchant_name || "OpenPay Merchant"),
          merchant_username: String(row.merchant_username || ""),
        });
      }
      setLoading(false);
    };
    void load();
  }, [sessionToken]);

  useEffect(() => {
    const loadTx = async () => {
      if (transactionId || !sessionData?.session_id) return;
      const { data } = await supabase
        .from("merchant_payments")
        .select("transaction_id")
        .eq("session_id", sessionData.session_id)
        .maybeSingle();
      if (data?.transaction_id) {
        setTransactionId(String(data.transaction_id));
      }
    };
    void loadTx();
  }, [sessionData?.session_id, transactionId]);

  const amountInUsd = useMemo(() => {
    if (!sessionData) return 0;
    const rate = currencies.find((c) => c.code === sessionData.currency)?.rate ?? 1;
    return Number(sessionData.amount || 0) / (rate || 1);
  }, [currencies, sessionData]);

  useEffect(() => {
    if (!sessionData || !transactionId) return;
    setReceiptData({
      transactionId,
      ledgerTransactionId: transactionId,
      type: "send",
      amount: amountInUsd,
      otherPartyName: sessionData.merchant_name,
      otherPartyUsername: sessionData.merchant_username || undefined,
      note: `POS payment session: ${sessionData.session_id}`,
      date: new Date(),
    });
  }, [amountInUsd, sessionData, transactionId]);

  if (loading) return <SplashScreen message="Loading POS confirmation..." />;

  return (
    <div className="min-h-screen bg-[#f5f6fa] px-4 py-10">
      <div className="mx-auto w-full max-w-xl rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          <h1 className="text-2xl font-semibold text-foreground">POS payment completed</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Thank you. Your POS payment was processed successfully.</p>

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
            onClick={() => navigate(isMerchantOrigin ? "/merchant-pos" : "/dashboard")}
          >
            {isMerchantOrigin ? "Back to POS" : "Back to Home"}
          </Button>
          <Button variant="ghost" className="h-10 rounded-lg" onClick={() => navigate("/activity")}>
            Activity
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">Powered by OpenPay</p>
      </div>
      <TransactionReceipt open={receiptOpen} onOpenChange={setReceiptOpen} receipt={receiptData} />
    </div>
  );
};

export default PosThankYouPage;
