import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import BrandLogo from "@/components/BrandLogo";

type SwapWithdrawalRow = {
  id: string;
  amount: number;
  openpay_account_name: string;
  openpay_account_username: string;
  openpay_account_number: string;
  pi_wallet_address: string;
  status: string;
  admin_note: string;
  reviewed_at: string | null;
  created_at: string;
};

const SETTLEMENT_ACCOUNT_NUMBER = "OPEA68BB7A9F964994A199A15786D680FA";
const SETTLEMENT_USERNAME = "@openpay";
const PI_LOGO_URL = "https://i.ibb.co/jk8XtTPj/pi-network-pi-icons-pi-logo-design-illustration-trendy-and-modern-crypto-currency-pi-symbol-for-logo.png";
const WITHDRAWAL_FEE_RATE = 0.02;
const COINGECKO_PI_PRICE_URL = "https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=usd&include_last_updated_at=true";
const COINGECKO_API_KEY = String(import.meta.env.VITE_COINGECKO_API_KEY || "");

const normalizeUsername = (value: string) => value.trim().replace(/^@+/, "").toLowerCase();

const SwapWithdrawalPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [amount, setAmount] = useState("");
  const [openpayName, setOpenpayName] = useState("");
  const [openpayUsername, setOpenpayUsername] = useState("");
  const [openpayAccountNumber, setOpenpayAccountNumber] = useState("");
  const [piWalletAddress, setPiWalletAddress] = useState("");
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [history, setHistory] = useState<SwapWithdrawalRow[]>([]);
  const [piPriceUsd, setPiPriceUsd] = useState<number | null>(null);
  const [piPriceUpdatedAt, setPiPriceUpdatedAt] = useState<number | null>(null);

  const parsedAmount = Number(amount);
  const safeAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
  const meetsMinimum = safeAmount >= 1;
  const feeAmount = safeAmount > 0 ? Number((safeAmount * WITHDRAWAL_FEE_RATE).toFixed(2)) : 0;
  const payoutAmount = safeAmount > 0 ? Number((safeAmount - feeAmount).toFixed(2)) : 0;

  const normalizedUsername = useMemo(() => normalizeUsername(openpayUsername), [openpayUsername]);
  const formattedPiPrice = useMemo(() => {
    if (piPriceUsd === null) return "Unavailable";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 6 }).format(piPriceUsd);
  }, [piPriceUsd]);
  const piPriceUpdatedLabel = useMemo(() => {
    if (!piPriceUpdatedAt) return "Not updated";
    return new Date(piPriceUpdatedAt * 1000).toLocaleString();
  }, [piPriceUpdatedAt]);

  const loadIdentity = async () => {
    const { data, error } = await supabase.rpc("upsert_my_user_account");
    if (error) return;
    const row = data as { account_number?: string; account_name?: string; account_username?: string } | null;
    setOpenpayAccountNumber((prev) => prev || String(row?.account_number || "").trim().toUpperCase());
    setOpenpayName((prev) => prev || String(row?.account_name || "").trim());
    setOpenpayUsername((prev) => prev || String(row?.account_username || "").trim());
  };

  const loadHistory = async () => {
    setRefreshing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/sign-in?mode=signin", { replace: true });
        return;
      }
      const { data, error } = await supabase
        .from("user_swap_withdrawals")
        .select("id, amount, openpay_account_name, openpay_account_username, openpay_account_number, pi_wallet_address, status, admin_note, reviewed_at, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw new Error(error.message || "Failed to load withdrawals");
      const rows = Array.isArray(data) ? data : [];
      setHistory(
        rows.map((row: any) => ({
          id: String(row.id),
          amount: Number(row.amount || 0),
          openpay_account_name: String(row.openpay_account_name || ""),
          openpay_account_username: String(row.openpay_account_username || ""),
          openpay_account_number: String(row.openpay_account_number || ""),
          pi_wallet_address: String(row.pi_wallet_address || ""),
          status: String(row.status || "pending"),
          admin_note: String(row.admin_note || ""),
          reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
          created_at: String(row.created_at || ""),
        })),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load withdrawals");
    } finally {
      setRefreshing(false);
    }
  };

  const loadPiPrice = async () => {
    try {
      const headers: HeadersInit = { accept: "application/json" };
      if (COINGECKO_API_KEY) {
        headers["x-cg-demo-api-key"] = COINGECKO_API_KEY;
      }
      const response = await fetch(COINGECKO_PI_PRICE_URL, { headers });
      if (!response.ok) {
        throw new Error("Failed to load Pi price");
      }
      const payload = (await response.json()) as {
        "pi-network"?: { usd?: number; last_updated_at?: number };
      };
      const price = payload["pi-network"]?.usd;
      const updatedAt = payload["pi-network"]?.last_updated_at;
      if (typeof price === "number") {
        setPiPriceUsd(price);
      }
      if (typeof updatedAt === "number") {
        setPiPriceUpdatedAt(updatedAt);
      }
    } catch {
      setPiPriceUsd(null);
      setPiPriceUpdatedAt(null);
    }
  };

  useEffect(() => {
    void loadIdentity();
    void loadHistory();
    void loadPiPrice();
    const timer = window.setInterval(() => {
      void loadPiPrice();
    }, 60 * 1000);
    return () => {
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitWithdrawal = async () => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!meetsMinimum) {
      toast.error("Minimum withdrawal is 1 OPEN USD");
      return;
    }
    if (!openpayName.trim() || !normalizedUsername || !openpayAccountNumber.trim() || !piWalletAddress.trim()) {
      toast.error("Complete all required fields");
      return;
    }
    if (!agreementAccepted) {
      toast.error("Accept the withdrawal agreement to continue");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("submit_swap_withdrawal", {
        p_amount: safeAmount,
        p_openpay_account_name: openpayName.trim(),
        p_openpay_account_username: normalizedUsername,
        p_openpay_account_number: openpayAccountNumber.trim().toUpperCase(),
        p_pi_wallet_address: piWalletAddress.trim(),
      });
      if (error) throw new Error(error.message || "Withdrawal submission failed");
      if (data) {
        toast.success("Withdrawal request submitted");
      } else {
        toast.message("Withdrawal request submitted");
      }
      setAmount("");
      await loadHistory();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Withdrawal submission failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-4 pb-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} aria-label="Back">
              <ArrowLeft className="h-6 w-6 text-foreground" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-paypal-blue/10">
                  <BrandLogo className="h-6 w-6 text-paypal-blue" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-paypal-dark">OpenPay</h1>
                  <p className="text-xs text-muted-foreground">Swap Withdrawal</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">OpenUSD to PI mainnet payout</p>
            </div>
          </div>
          <Button variant="outline" onClick={loadHistory} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="paypal-surface rounded-3xl p-4">
          <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">How this works</p>
            <p className="mt-2">1. Fill in your OpenPay identity and mainnet PI wallet address.</p>
            <p>2. When you submit, your OpenUSD is moved to the settlement account {SETTLEMENT_USERNAME} ({SETTLEMENT_ACCOUNT_NUMBER}).</p>
            <p>3. After admin approval, you receive PI to your mainnet wallet. Rate is always 1 OPEN USD = 1 PI.</p>
            <p>4. A 2% processing fee applies to withdrawals.</p>
            <div className="mt-3 rounded-xl border border-border/60 bg-white/70 p-3 text-xs text-foreground">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <img src={PI_LOGO_URL} alt="Pi" className="h-4 w-4" />
                  Pi market price (CoinGecko)
                </span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  <img src={PI_LOGO_URL} alt="Pi" className="h-4 w-4" />
                  <span>π</span>
                  <span>{formattedPiPrice}</span>
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Last updated</span>
                <span>{piPriceUpdatedLabel}</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Processing may be delayed due to high transaction volume or network congestion.
            </p>
          </div>

          <div className="mt-4 grid gap-3">
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>OpenUSD amount (min 1)</span>
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
              <span>OpenPay full name</span>
              <input
                value={openpayName}
                onChange={(e) => setOpenpayName(e.target.value)}
                placeholder="Full name"
                className="h-11 w-full rounded-xl border border-border px-3 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>OpenPay username</span>
              <input
                value={openpayUsername}
                onChange={(e) => setOpenpayUsername(e.target.value)}
                placeholder="@username"
                className="h-11 w-full rounded-xl border border-border px-3 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>OpenPay account number</span>
              <input
                value={openpayAccountNumber}
                onChange={(e) => setOpenpayAccountNumber(e.target.value)}
                placeholder="OPEA..."
                className="h-11 w-full rounded-xl border border-border px-3 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>Mainnet PI wallet address</span>
              <input
                value={piWalletAddress}
                onChange={(e) => setPiWalletAddress(e.target.value)}
                placeholder="Pi wallet address"
                className="h-11 w-full rounded-xl border border-border px-3 text-sm text-foreground"
              />
            </label>
          </div>

          <div className="mt-4 rounded-2xl border border-border/70 bg-secondary/30 p-3 text-sm text-foreground">
            <div className="flex items-center justify-between">
              <span>Amount</span>
              <span className="font-semibold">{safeAmount.toFixed(2)} OPEN USD</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Fee (2%)</span>
              <span>-{feeAmount.toFixed(2)} OPEN USD</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-semibold">You will receive</span>
              <span className="inline-flex items-center gap-2 font-semibold text-paypal-blue">
                <img src={PI_LOGO_URL} alt="Pi" className="h-5 w-5" />
                {payoutAmount.toFixed(2)} PI
              </span>
            </div>
          </div>

          <label className="mt-3 flex items-start gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={agreementAccepted}
              onChange={(e) => setAgreementAccepted(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I agree to the OpenPay swap withdrawal terms, including the 2% processing fee and possible delays due to network congestion.
            </span>
          </label>

          <Button
            className="mt-3 h-11 w-full rounded-xl bg-paypal-blue text-sm font-semibold text-white hover:bg-[#004dc5]"
            onClick={submitWithdrawal}
            disabled={loading || !meetsMinimum || !agreementAccepted}
          >
            {loading ? "Submitting..." : "Submit Withdrawal"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            By submitting, you authorize the transfer of your OpenUSD to {SETTLEMENT_USERNAME} ({SETTLEMENT_ACCOUNT_NUMBER}).
          </p>
        </div>

        <div className="mt-4 paypal-surface rounded-3xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">Recent withdrawals</h2>
            <p className="text-xs text-muted-foreground">{history.length} latest</p>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No withdrawal requests yet.</p>
          ) : (
            <div className="divide-y divide-border/70 rounded-2xl border border-border/70">
              {history.map((row) => (
                <div key={row.id} className="px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{row.amount.toFixed(2)} OPEN USD</p>
                    <span className="rounded-full border border-border/70 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      {row.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pi wallet: {row.pi_wallet_address}
                  </p>
                  {row.admin_note && (
                    <p className="mt-1 text-xs text-muted-foreground">Admin note: {row.admin_note}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SwapWithdrawalPage;
