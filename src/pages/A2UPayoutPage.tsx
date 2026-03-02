import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { ArrowLeft, Wallet, Send, CheckCircle2, XCircle, Clock, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import BrandLogo from "@/components/BrandLogo";

interface PayoutRecord {
  id: string;
  pi_username: string;
  amount: number;
  memo: string;
  status: string;
  pi_payment_id: string | null;
  pi_txid: string | null;
  error_message: string | null;
  created_at: string;
}

const A2UPayoutPage = () => {
  const navigate = useNavigate();
  const [piUsername, setPiUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    loadPayouts();
  }, []);

  const loadPayouts = async () => {
    setLoadingHistory(true);
    const { data } = await (supabase as any)
      .from("a2u_payouts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setPayouts(data || []);
    setLoadingHistory(false);
  };

  const handleSubmit = async () => {
    if (!piUsername.trim()) { toast.error("Enter Pi username"); return; }
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) { toast.error("Enter valid amount"); return; }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); setSubmitting(false); return; }

      const { data, error } = await supabase.functions.invoke("a2u-payout", {
        body: {
          piUsername: piUsername.trim().replace(/^@/, ""),
          amount: numAmount,
          memo: memo.trim() || undefined,
        },
      });

      if (error) {
        toast.error(error.message || "Payout failed");
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success("A2U Payout completed successfully!");
        setPiUsername("");
        setAmount("");
        setMemo("");
        loadPayouts();
      }
    } catch (e: any) {
      toast.error(e.message || "Payout failed");
    }
    setSubmitting(false);
  };

  const copyTxid = async (txid: string) => {
    try {
      await navigator.clipboard.writeText(txid);
      toast.success("Transaction ID copied");
    } catch { toast.error("Copy failed"); }
  };

  const statusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (status === "failed") return <XCircle className="h-5 w-5 text-red-500" />;
    return <Clock className="h-5 w-5 text-yellow-500" />;
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-paypal-blue to-[#0a3ba8] px-4 pt-6 pb-8">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-white">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-white">A2U Payout</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
            <Wallet className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-white/80 text-sm">App-to-User Withdrawal</p>
            <p className="text-white font-semibold">Send Pi from app wallet to user blockchain wallet</p>
          </div>
        </div>
      </div>

      <div className="px-4 mt-6 space-y-5">
        {/* Payout Form Card */}
        <div className="paypal-surface rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BrandLogo className="h-8 w-8" />
            <div>
              <h2 className="font-bold text-foreground">Request A2U Payout</h2>
              <p className="text-xs text-muted-foreground">Withdraw Pi to blockchain wallet</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Pi Username</label>
              <input
                type="text"
                value={piUsername}
                onChange={(e) => setPiUsername(e.target.value)}
                placeholder="e.g. johndoe"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-paypal-blue"
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Amount (π)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-paypal-blue text-2xl font-bold"
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Memo (optional)</label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Payment memo"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-paypal-blue"
                disabled={submitting}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || !piUsername.trim() || !amount}
              className="w-full rounded-xl bg-paypal-blue py-3.5 text-white font-semibold text-lg flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-paypal-blue/90 transition"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing Payout...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Send A2U Payout
                </>
              )}
            </button>
          </div>

          <div className="mt-4 rounded-xl bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground">
              <strong>How it works:</strong> This sends Pi from the app's wallet directly to the user's Pi blockchain wallet using the Pi Platform A2U payment flow.
              The payment is created, approved, signed with the app wallet, submitted to the Pi blockchain, and completed automatically.
            </p>
          </div>
        </div>

        {/* Payout History */}
        <div className="paypal-surface rounded-2xl p-5">
          <h3 className="font-bold text-foreground mb-3">Payout History</h3>
          {loadingHistory ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No payouts yet</p>
          ) : (
            <div className="space-y-3">
              {payouts.map((p) => (
                <div key={p.id} className="flex items-start gap-3 border-b border-border/50 pb-3 last:border-0 last:pb-0">
                  {statusIcon(p.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">@{p.pi_username}</span>
                      <span className="font-bold text-foreground">{p.amount} π</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.memo}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()} · {p.status}
                    </p>
                    {p.pi_txid && (
                      <button
                        onClick={() => copyTxid(p.pi_txid!)}
                        className="mt-1 flex items-center gap-1 text-xs text-paypal-blue hover:underline"
                      >
                        <Copy className="h-3 w-3" />
                        {p.pi_txid.slice(0, 12)}...{p.pi_txid.slice(-6)}
                      </button>
                    )}
                    {p.error_message && p.status === "failed" && (
                      <p className="text-xs text-red-500 mt-1 truncate">{p.error_message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav active="menu" />
    </div>
  );
};

export default A2UPayoutPage;
