import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type LoanApplicationRow = {
  id: string;
  user_id: string;
  requested_amount: number;
  requested_term_months: number;
  credit_score_snapshot: number;
  full_name: string;
  contact_number: string;
  address_line: string;
  city: string;
  country: string;
  openpay_account_number: string;
  openpay_account_username: string;
  agreement_accepted: boolean;
  status: string;
  admin_note: string;
  reviewed_at: string | null;
  created_at: string;
  applicant_display_name: string;
};

const ADMIN_PROFILE_USERNAMES = new Set(["openpay", "wainfoundation"]);

const AdminLoanApplicationsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerUsername, setViewerUsername] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [loanApplications, setLoanApplications] = useState<LoanApplicationRow[]>([]);

  const pendingCount = useMemo(() => loanApplications.length, [loanApplications]);

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

  const loadLoanApplications = async () => {
    setRefreshing(true);
    try {
      const user = await ensureAdminAccess();
      if (!user) return;
      const { data: loanApps, error: loanAppsError } = await (supabase as any).rpc("admin_list_loan_applications", {
        p_status: "pending",
        p_limit: 50,
        p_offset: 0,
      });
      if (loanAppsError) throw new Error(loanAppsError.message || "Failed to load loan applications");
      const normalizedLoanApps = Array.isArray(loanApps) ? loanApps : [];
      setLoanApplications(
        normalizedLoanApps.map((row: any) => ({
          id: String(row.id),
          user_id: String(row.user_id),
          requested_amount: Number(row.requested_amount || 0),
          requested_term_months: Number(row.requested_term_months || 0),
          credit_score_snapshot: Number(row.credit_score_snapshot || 620),
          full_name: String(row.full_name || ""),
          contact_number: String(row.contact_number || ""),
          address_line: String(row.address_line || ""),
          city: String(row.city || ""),
          country: String(row.country || ""),
          openpay_account_number: String(row.openpay_account_number || ""),
          openpay_account_username: String(row.openpay_account_username || ""),
          agreement_accepted: Boolean(row.agreement_accepted),
          status: String(row.status || "pending"),
          admin_note: String(row.admin_note || ""),
          reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
          created_at: String(row.created_at || ""),
          applicant_display_name: String(row.applicant_display_name || ""),
        })),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load loan applications");
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoanReview = async (applicationId: string, decision: "approve" | "reject") => {
    setReviewingId(applicationId);
    try {
      const { data, error } = await (supabase as any).rpc("admin_review_loan_application", {
        p_application_id: applicationId,
        p_decision: decision,
        p_admin_note: `Reviewed by @${viewerUsername || "admin"}`,
      });
      if (error) throw new Error(error.message || "Loan review failed");
      if (decision === "approve") {
        toast.success(`Loan approved${data ? ` | Loan ${String(data).slice(0, 8)}` : ""}`);
      } else {
        toast.success("Loan rejected");
      }
      await loadLoanApplications();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Loan review failed");
    } finally {
      setReviewingId(null);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadLoanApplications();
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
              <h1 className="text-xl font-bold text-paypal-dark">Loan Applications</h1>
              <p className="text-xs text-muted-foreground">Pending applications for admin review</p>
            </div>
          </div>
          <Button variant="outline" onClick={loadLoanApplications} disabled={refreshing || loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="mb-4 rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="text-base font-semibold text-foreground">@{viewerUsername || "-"}</p>
          <p className="mt-2 text-xs text-muted-foreground">{pendingCount} pending loan applications</p>
        </div>

        {loanApplications.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No pending loan applications.
          </div>
        ) : (
          <div className="space-y-3">
            {loanApplications.map((app) => (
              <div key={app.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{app.applicant_display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(app.created_at), "MMM d, yyyy h:mm a")} | Score {app.credit_score_snapshot}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-paypal-blue">
                    ${app.requested_amount.toFixed(2)} / {app.requested_term_months}m
                  </p>
                </div>
                <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <p>Full name: {app.full_name}</p>
                  <p>Contact: {app.contact_number}</p>
                  <p className="sm:col-span-2">Address: {app.address_line}, {app.city}, {app.country}</p>
                  <p>Account number: {app.openpay_account_number}</p>
                  <p>Account username: @{app.openpay_account_username}</p>
                  {app.admin_note && <p className="sm:col-span-2">Admin note: {app.admin_note}</p>}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleLoanReview(app.id, "approve")}
                    disabled={reviewingId === app.id}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleLoanReview(app.id, "reject")}
                    disabled={reviewingId === app.id}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLoanApplicationsPage;
