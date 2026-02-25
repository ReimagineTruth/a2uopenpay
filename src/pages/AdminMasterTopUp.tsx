import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const AdminMasterTopUp = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [amount, setAmount] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      const normalized = String(profile?.username || "").trim().toLowerCase().replace(/^@/, "");
      if (normalized !== "wainfoundation") {
        toast.error("Access restricted to @wainfoundation");
        navigate("/dashboard", { replace: true });
        return;
      }
      setCheckingAccess(false);
    };
    void checkAccess();
  }, [navigate]);

  const submitTopUp = async () => {
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!accountNumber.trim() && !username.trim()) {
      toast.error("Enter account number or username");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("master_topup_internal", {
        p_amount: parsedAmount,
        p_target_account_number: accountNumber.trim() || null,
        p_target_username: username.trim() || null,
      });
      if (error) throw new Error(error.message || "Master top up failed");
      toast.success("Master top up completed");
      setAmount("");
      setAccountNumber("");
      setUsername("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Master top up failed");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-background px-4 pt-6">
        <p className="text-sm text-muted-foreground">Checking access...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-10">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => navigate("/menu")} aria-label="Back">
          <ArrowLeft className="h-6 w-6 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Master Top Up</h1>
      </div>

      <div className="paypal-surface rounded-3xl p-5 space-y-4">
        <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <ShieldCheck className="h-4 w-4 text-paypal-blue" />
            Internal admin credit
          </div>
          <p className="mt-2">
            This tool is restricted to @wainfoundation. Credits added here do not appear in the public OpenLedger.
          </p>
        </div>

        <div className="grid gap-3">
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Amount (OPEN USD)</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              min="1"
              step="0.01"
              placeholder="Enter amount"
              className="h-11 w-full rounded-xl border border-border px-3 text-sm text-foreground"
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Target account number</span>
            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="OPEA..."
              className="h-11 w-full rounded-xl border border-border px-3 text-sm text-foreground"
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Target username (optional)</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@username"
              className="h-11 w-full rounded-xl border border-border px-3 text-sm text-foreground"
            />
          </label>
        </div>

        <Button
          type="button"
          className="h-11 w-full rounded-xl bg-paypal-blue text-white hover:bg-[#004dc5]"
          onClick={submitTopUp}
          disabled={loading}
        >
          {loading ? "Submitting..." : "Submit Master Top Up"}
        </Button>
      </div>
    </div>
  );
};

export default AdminMasterTopUp;
