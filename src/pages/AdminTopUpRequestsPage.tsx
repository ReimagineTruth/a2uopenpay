import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { playGoogleWalletSuccessSound } from "@/lib/soundEffects";

type TopUpRequestRow = {
  id: string;
  user_id: string;
  provider: string;
  amount: number;
  openpay_account_name: string;
  openpay_account_username: string;
  openpay_account_number: string;
  reference_code: string;
  proof_url: string;
  status: string;
  admin_note: string;
  reviewed_at: string | null;
  created_at: string;
  applicant_display_name: string;
};

const ADMIN_PROFILE_USERNAMES = new Set(["openpay", "wainfoundation"]);
const PROVIDER_LOGOS: Record<string, string> = {
  "Pi Payment": "https://i.ibb.co/jk8XtTPj/pi-network-pi-icons-pi-logo-design-illustration-trendy-and-modern-crypto-currency-pi-symbol-for-logo.png",
  PayPal: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/PayPal.svg/1920px-PayPal.svg.png",
  "Ewallet QR PH": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/QR_Ph_Logo.svg/960px-QR_Ph_Logo.svg.png?20250310160234",
  "Apple Pay": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Apple_Pay_logo.svg/1920px-Apple_Pay_logo.svg.png",
  "Google Pay": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Google_Pay_Logo.svg/1920px-Google_Pay_Logo.svg.png",
  "Debit Card": "https://i.ibb.co/G3FGwngR/Visa-Inc-logo-2021-present-svg.png",
  "Credit Card": "https://i.ibb.co/9kkZmFDq/Mastercard-2019-logo-svg.png",
  Stripe: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Stripe_Logo%2C_revised_2016.svg/1920px-Stripe_Logo%2C_revised_2016.svg.png",
  Venmo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Venmo_Logo.svg/1920px-Venmo_Logo.svg.png",
};

const AdminTopUpRequestsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerUsername, setViewerUsername] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [topUpRequests, setTopUpRequests] = useState<TopUpRequestRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewRow, setPreviewRow] = useState<TopUpRequestRow | null>(null);

  const pendingCount = useMemo(() => topUpRequests.length, [topUpRequests]);

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

  const loadTopUpRequests = async (nextStatus = statusFilter) => {
    setRefreshing(true);
    try {
      const user = await ensureAdminAccess();
      if (!user) return;
      const { data: rows, error } = await (supabase as any).rpc("admin_list_topup_requests", {
        p_limit: 50,
        p_offset: 0,
        p_status: nextStatus,
      });
      if (error) throw new Error(error.message || "Failed to load top up requests");
      const normalizedRows = Array.isArray(rows) ? rows : [];
      setTopUpRequests(
        normalizedRows.map((row: any) => ({
          id: String(row.id),
          user_id: String(row.user_id),
          provider: String(row.provider || ""),
          amount: Number(row.amount || 0),
          openpay_account_name: String(row.openpay_account_name || ""),
          openpay_account_username: String(row.openpay_account_username || ""),
          openpay_account_number: String(row.openpay_account_number || ""),
          reference_code: String(row.reference_code || ""),
          proof_url: String(row.proof_url || ""),
          status: String(row.status || "pending"),
          admin_note: String(row.admin_note || ""),
          reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
          created_at: String(row.created_at || ""),
          applicant_display_name: String(row.applicant_display_name || ""),
        })),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load top up requests");
    } finally {
      setRefreshing(false);
    }
  };

  const handleTopUpReview = async (requestId: string, decision: "approve" | "reject") => {
    if (decision === "approve") {
      playGoogleWalletSuccessSound();
    }
    setReviewingId(requestId);
    try {
      const { error } = await (supabase as any).rpc("admin_review_topup_request", {
        p_admin_note: `Reviewed by @${viewerUsername || "admin"}`,
        p_decision: decision,
        p_request_id: requestId,
      });
      if (error) throw new Error(error.message || "Top up review failed");
      toast.success(decision === "approve" ? "Top up approved" : "Top up rejected");
      await loadTopUpRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Top up review failed");
    } finally {
      setReviewingId(null);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadTopUpRequests();
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
              <h1 className="text-xl font-bold text-paypal-dark">Top Up Requests</h1>
              <p className="text-xs text-muted-foreground">Pending top ups awaiting approval</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => loadTopUpRequests()} disabled={refreshing || loading}>
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
                void loadTopUpRequests(tab.key);
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
            {pendingCount} {statusFilter === "all" ? "total" : statusFilter} top up requests
          </p>
        </div>

        {topUpRequests.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No {statusFilter === "all" ? "top up" : statusFilter} top up requests.
          </div>
        ) : (
          <div className="space-y-3">
            {topUpRequests.map((row) => (
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
                      {PROVIDER_LOGOS[row.provider] ? (
                        <img
                          src={PROVIDER_LOGOS[row.provider]}
                          alt={row.provider}
                          className="h-5 w-auto object-contain"
                        />
                      ) : null}
                      <span>{row.provider}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <p>OpenPay name: {row.openpay_account_name}</p>
                  <p>OpenPay username: @{row.openpay_account_username}</p>
                  <p>Account number: {row.openpay_account_number}</p>
                  <p className="sm:col-span-2">Reference: {row.reference_code}</p>
                  {row.proof_url && (
                    <p className="sm:col-span-2">
                      <button
                        type="button"
                        className="font-semibold text-paypal-blue underline"
                        onClick={() => {
                          setPreviewUrl(row.proof_url);
                          setPreviewRow(row);
                        }}
                      >
                        View payment proof
                      </button>
                    </p>
                  )}
                  {row.admin_note && <p className="sm:col-span-2">Admin note: {row.admin_note}</p>}
                </div>
                <div className="mt-3 flex gap-2">
                  {statusFilter === "pending" ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleTopUpReview(row.id, "approve")}
                        disabled={reviewingId === row.id}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTopUpReview(row.id, "reject")}
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

      <Dialog
        open={!!previewUrl}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewUrl(null);
            setPreviewRow(null);
          }
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-3xl">
          <DialogTitle className="text-lg font-bold text-foreground">Payment Proof</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Preview the uploaded payment screenshot without leaving this page.
          </DialogDescription>
          {previewRow && (
            <div className="mt-2 rounded-2xl border border-border bg-secondary/30 p-3 text-sm text-foreground">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Applicant</p>
                  <p className="font-semibold">{previewRow.applicant_display_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="font-semibold text-paypal-blue">{previewRow.amount.toFixed(2)} OPEN USD</p>
                </div>
              </div>
              <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <p>OpenPay name: {previewRow.openpay_account_name}</p>
                <p>OpenPay username: @{previewRow.openpay_account_username}</p>
                <p>Account number: {previewRow.openpay_account_number}</p>
                <p>Reference: {previewRow.reference_code}</p>
              </div>
            </div>
          )}
          {previewUrl ? (
            <img src={previewUrl} alt="Payment proof preview" className="mt-2 w-full rounded-2xl object-contain" />
          ) : (
            <p className="text-sm text-muted-foreground">No image available.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTopUpRequestsPage;
