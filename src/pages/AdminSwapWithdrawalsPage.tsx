import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";

type SwapWithdrawalRow = {
  id: string;
  user_id: string;
  amount: number;
  openpay_account_name: string;
  openpay_account_username: string;
  openpay_account_number: string;
  pi_wallet_address: string;
  status: string;
  admin_note: string;
  reviewed_at: string | null;
  created_at: string;
  applicant_display_name: string;
};

const ADMIN_PROFILE_USERNAMES = new Set(["openpay", "wainfoundation"]);
const PI_LOGO_URL =
  "https://i.ibb.co/jk8XtTPj/pi-network-pi-icons-pi-logo-design-illustration-trendy-and-modern-crypto-currency-pi-symbol-for-logo.png";
const WITHDRAWAL_FEE_RATE = 0.02;

const AdminSwapWithdrawalsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerUsername, setViewerUsername] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [swapWithdrawals, setSwapWithdrawals] = useState<SwapWithdrawalRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [qrWalletAddress, setQrWalletAddress] = useState<string | null>(null);

  const pendingCount = useMemo(() => swapWithdrawals.length, [swapWithdrawals]);

  const ensureAdminAccess = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sign in first to open admin dashboard");
      navigate("/sign-in?mode=signin", { replace: true });
      return null;
    }

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      const normalizedUsername = (profile?.username || "").trim().toLowerCase().replace(/^@+/, "");
      setViewerUsername(normalizedUsername);
      if (!ADMIN_PROFILE_USERNAMES.has(normalizedUsername)) {
        toast.error("Admin access is restricted to @openpay and @wainfoundation");
        navigate("/dashboard", { replace: true });
        return null;
      }
      return user;
    } catch {
      setViewerUsername("");
      toast.error("Admin access check failed");
      navigate("/dashboard", { replace: true });
      return null;
    }
  };

  const loadSwapWithdrawals = async (nextStatus = statusFilter) => {
    setRefreshing(true);
    try {
      const user = await ensureAdminAccess();
      if (!user) return;
      const { data: swapRows, error: swapError } = await (supabase as any).rpc("admin_list_swap_withdrawals", {
        p_limit: 50,
        p_offset: 0,
        p_status: nextStatus,
      });
      if (swapError) throw new Error(swapError.message || "Failed to load swap withdrawals");
      const normalizedSwapRows = Array.isArray(swapRows) ? swapRows : [];
      setSwapWithdrawals(
        normalizedSwapRows.map((row: any) => ({
          id: String(row.id),
          user_id: String(row.user_id),
          amount: Number(row.amount || 0),
          openpay_account_name: String(row.openpay_account_name || ""),
          openpay_account_username: String(row.openpay_account_username || ""),
          openpay_account_number: String(row.openpay_account_number || ""),
          pi_wallet_address: String(row.pi_wallet_address || ""),
          status: String(row.status || "pending"),
          admin_note: String(row.admin_note || ""),
          reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
          created_at: String(row.created_at || ""),
          applicant_display_name: String(row.applicant_display_name || ""),
        })),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load swap withdrawals");
    } finally {
      setRefreshing(false);
    }
  };

  const handleSwapWithdrawalReview = async (withdrawalId: string, decision: "approve" | "reject") => {
    setReviewingId(withdrawalId);
    try {
      const { error } = await (supabase as any).rpc("admin_review_swap_withdrawal", {
        p_admin_note: `Reviewed by @${viewerUsername || "admin"}`,
        p_decision: decision,
        p_withdrawal_id: withdrawalId,
      });
      if (error) throw new Error(error.message || "Withdrawal review failed");
      toast.success(decision === "approve" ? "Withdrawal approved" : "Withdrawal rejected");
      await loadSwapWithdrawals();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Withdrawal review failed");
    } finally {
      setReviewingId(null);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadSwapWithdrawals();
      setLoading(false);
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background px-4 py-4 pb-10">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} aria-label="Back">
              <ArrowLeft className="h-6 w-6 text-foreground" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-paypal-dark">Swap Withdrawals</h1>
              <p className="text-xs text-muted-foreground">Pending requests for OpenUSD to PI payouts</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => loadSwapWithdrawals()} disabled={refreshing || loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {([
            { key: "pending", label: "Pending" },
            { key: "approved", label: "Approved" },
            { key: "rejected", label: "Rejected" },
            { key: "all", label: "All" },
          ] as const).map((tab) => (
            <Button
              key={tab.key}
              variant={statusFilter === tab.key ? "default" : "outline"}
              onClick={() => {
                setStatusFilter(tab.key);
                void loadSwapWithdrawals(tab.key);
              }}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <div className="mb-4 rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="text-base font-semibold text-foreground">@{viewerUsername || "-"}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {pendingCount} {statusFilter === "all" ? "total" : statusFilter} swap withdrawals
          </p>
        </div>

        {swapWithdrawals.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No {statusFilter === "all" ? "swap" : statusFilter} swap withdrawals.
          </div>
        ) : (
          <div className="space-y-3">
            {swapWithdrawals.map((row) => (
              <div key={row.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{row.applicant_display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(row.created_at), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-paypal-blue">{row.amount.toFixed(2)} OPEN USD</p>
                    <div className="mt-1 inline-flex items-center justify-end gap-2 text-xs text-muted-foreground">
                      <img src={PI_LOGO_URL} alt="Pi Network" className="h-5 w-auto object-contain" />
                      <span>PI payout</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <p>OpenPay name: {row.openpay_account_name}</p>
                  <p>OpenPay username: @{row.openpay_account_username}</p>
                  <p>Account number: {row.openpay_account_number}</p>
                  <p className="sm:col-span-2">
                    PI to send: {(row.amount * (1 - WITHDRAWAL_FEE_RATE)).toFixed(2)} PI (after 2% fee)
                  </p>
                  <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                    <span>PI wallet: {row.pi_wallet_address}</span>
                    {row.pi_wallet_address ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(row.pi_wallet_address);
                            toast.success("PI wallet address copied");
                          } catch {
                            toast.error("Copy failed");
                          }
                        }}
                      >
                        Copy
                      </Button>
                    ) : null}
                    {row.pi_wallet_address ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setQrWalletAddress(row.pi_wallet_address)}
                      >
                        QR
                      </Button>
                    ) : null}
                  </div>
                  {row.admin_note && <p className="sm:col-span-2">Admin note: {row.admin_note}</p>}
                </div>
                <div className="mt-3 flex gap-2">
                  {statusFilter === "pending" ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleSwapWithdrawalReview(row.id, "approve")}
                        disabled={reviewingId === row.id}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSwapWithdrawalReview(row.id, "reject")}
                        disabled={reviewingId === row.id}
                      >
                        Reject
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs font-semibold uppercase text-muted-foreground">{row.status}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={Boolean(qrWalletAddress)} onOpenChange={(open) => (!open ? setQrWalletAddress(null) : null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogTitle className="text-xl font-bold text-foreground">PI Wallet QR</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Scan to copy the recipient wallet address.
          </DialogDescription>
          <div className="mt-3 flex items-center justify-center rounded-2xl border border-border bg-white p-4">
            {qrWalletAddress ? (
              <QRCodeSVG value={qrWalletAddress} size={220} includeMargin />
            ) : null}
          </div>
          {qrWalletAddress ? (
            <p className="mt-3 break-all text-xs text-muted-foreground">{qrWalletAddress}</p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="mt-3 h-10 w-full rounded-xl"
            onClick={async () => {
              if (!qrWalletAddress) return;
              try {
                await navigator.clipboard.writeText(qrWalletAddress);
                toast.success("PI wallet address copied");
              } catch {
                toast.error("Copy failed");
              }
            }}
          >
            Copy address
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSwapWithdrawalsPage;
