import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { ArrowLeft, Wallet, Send, CheckCircle2, XCircle, Clock, Loader2, Copy, Gift } from "lucide-react";
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
  const [submitting, setSubmitting] = useState(false);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    loadPayouts();
    initializePiSDK();
  }, []);

  const initializePiSDK = async () => {
    // Check if Pi SDK is available (running in Pi Browser)
    const piSdk = (window as any).Pi;
    if (typeof window !== 'undefined' && piSdk) {
      try {
        // Initialize Pi SDK first
        piSdk.init({ version: "2.0", sandbox: false });
        
        // Authenticate user and get their info
        const authResult = await piSdk.authenticate(['username', 'payments', 'wallet']);
        console.log("Pi user authenticated:", authResult);
        setCurrentUser(authResult.user);
      } catch (error) {
        console.error("Pi authentication failed:", error);
        toast.error("Please authenticate with Pi Browser");
        // Still set current user to allow button click for testing
        setCurrentUser({ uid: 'test', username: 'testuser' });
      }
    } else {
      console.log("Pi SDK not available - not in Pi Browser");
      // Fallback: get user from Supabase or set test user
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setCurrentUser(session.user);
      } else {
        // Set test user for debugging
        setCurrentUser({ uid: 'test', username: 'testuser' });
      }
    }
  };

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

  const handleAutoPayout = async () => {
    if (!currentUser) {
      toast.error("User not authenticated");
      return;
    }

    setSubmitting(true);
    try {
      // Get user's Pi UID from Pi SDK or fallback
      let piUid: string;
      const piSdk = (window as any).Pi;
      if (piSdk && currentUser) {
        // Use the authenticated user's UID from Pi SDK
        piUid = currentUser.uid || currentUser.username || currentUser.email?.split('@')[0];
      } else {
        piUid = currentUser.email?.split('@')[0] || 'unknown';
      }
      
      if (!piUid) {
        toast.error("Unable to get Pi UID");
        setSubmitting(false);
        return;
      }

      // Fixed amount for testnet A2U payout (0.01 Pi as shown in your image)
      const payoutAmount = 0.01;
      const paymentMemo = "Testnet A2U Payout - Developer Testing";

      // Call the simplified edge function
      const { data, error } = await supabase.functions.invoke("a2u-payout", {
        body: {
          piUsername: piUid,
          amount: payoutAmount,
          memo: paymentMemo,
        },
      });

      if (error) {
        toast.error(error.message || "Payout failed");
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success("A2U Payout completed successfully!");
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
          <h1 className="text-xl font-bold text-white">Testnet Payouts</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
            <Gift className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-white/80 text-sm">Developer Payouts Testing</p>
            <p className="text-white font-semibold">Only 0.01 π per click is allowed</p>
          </div>
        </div>
      </div>

      <div className="px-4 mt-6 space-y-5">
        {/* Auto Payout Card */}
        <div className="paypal-surface rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BrandLogo className="h-8 w-8" />
            <div>
              <h2 className="font-bold text-foreground">Receive your 0.01 Testnet Pi</h2>
              <p className="text-xs text-muted-foreground">
                {(window as any).Pi ? "Click to receive A2U payout to your Pi wallet" : "Please open in Pi Browser"}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleAutoPayout}
              disabled={submitting || !currentUser}
              className="w-full rounded-xl bg-yellow-400 py-4 text-black font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-yellow-300 transition"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing Payout...
                </>
              ) : (
                <>
                  <Gift className="h-5 w-5" />
                  Receive your 0.01 Testnet Pi
                </>
              )}
            </button>

            <div className="rounded-xl bg-secondary/50 p-3">
              <p className="text-xs text-muted-foreground">
                <strong>How it works:</strong> This initiates a 0.01 Pi app-to-user payout to your testnet Pi wallet. 
                You must be authenticated in the Pi Browser. This is for developer payouts testing (A2U).
              </p>
            </div>
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
                      <div className="mt-1">
                        <p className="text-xs text-muted-foreground">Payout submitted</p>
                        <button
                          onClick={() => copyTxid(p.pi_txid!)}
                          className="flex items-center gap-1 text-xs text-paypal-blue hover:underline"
                        >
                          <Copy className="h-3 w-3" />
                          {p.pi_txid.slice(0, 12)}...{p.pi_txid.slice(-6)}
                        </button>
                      </div>
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
