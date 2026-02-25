import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type TopUpAccountDetailsProps = {
  providerName: string;
  amount: number;
  className?: string;
  submitLabel?: string;
};

type TopUpHistoryRow = {
  id: string;
  amount: number;
  provider: string;
  status: string;
  admin_note: string;
  created_at: string;
};

const normalizeUsername = (value: string) => value.trim().replace(/^@+/, "").toLowerCase();

const TopUpAccountDetails = ({
  providerName,
  amount,
  className,
  submitLabel = "Submit Top Up Request",
}: TopUpAccountDetailsProps) => {
  const [openpayName, setOpenpayName] = useState("");
  const [openpayUsername, setOpenpayUsername] = useState("");
  const [openpayAccountNumber, setOpenpayAccountNumber] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [history, setHistory] = useState<TopUpHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const normalizedUsername = useMemo(() => normalizeUsername(openpayUsername), [openpayUsername]);
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;

  useEffect(() => {
    const loadIdentity = async () => {
      const { data, error } = await supabase.rpc("upsert_my_user_account");
      if (error) return;
      const row = data as { account_number?: string; account_name?: string; account_username?: string } | null;
      setOpenpayAccountNumber(String(row?.account_number || "").trim().toUpperCase());
      setOpenpayName(String(row?.account_name || "").trim());
      setOpenpayUsername(String(row?.account_username || "").trim());
    };
    void loadIdentity();
  }, []);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHistory([]);
        return;
      }
      const { data, error } = await supabase
        .from("user_topup_requests")
        .select("id, amount, provider, status, admin_note, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw new Error(error.message || "Failed to load top ups");
      const rows = Array.isArray(data) ? data : [];
      setHistory(
        rows.map((row: any) => ({
          id: String(row.id),
          amount: Number(row.amount || 0),
          provider: String(row.provider || ""),
          status: String(row.status || "pending"),
          admin_note: String(row.admin_note || ""),
          created_at: String(row.created_at || ""),
        })),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load top ups");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!proofFile) {
      setProofPreview(null);
      return;
    }
    const previewUrl = URL.createObjectURL(proofFile);
    setProofPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [proofFile]);

  useEffect(() => {
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateTopUp = () => {
    setSubmitted(false);
    if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
      toast.error("Enter a valid top up amount first");
      return false;
    }
    if (!openpayName.trim() || !normalizedUsername || !openpayAccountNumber.trim()) {
      toast.error("OpenPay account details are required");
      return false;
    }
    if (!referenceCode.trim()) {
      toast.error("Payment reference is required");
      return false;
    }
    if (!proofFile) {
      toast.error("Payment proof screenshot is required");
      return false;
    }
    return true;
  };

  const submitTopUpRequest = async () => {
    setSubmitting(true);
    try {
      setUploading(true);
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Sign in required");
      }
      const safeName = proofFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${user.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("topup-proof")
        .upload(filePath, proofFile, { upsert: true });
      if (uploadError) {
        throw new Error(uploadError.message || "Upload failed");
      }
      const { data: publicData } = supabase.storage.from("topup-proof").getPublicUrl(filePath);
      const proofUrl = publicData?.publicUrl || "";
      if (!proofUrl) {
        throw new Error("Failed to get proof URL");
      }
      setUploading(false);

      const { data, error } = await supabase.rpc("submit_topup_request", {
        p_amount: Number(safeAmount.toFixed(2)),
        p_provider: providerName,
        p_openpay_account_name: openpayName.trim(),
        p_openpay_account_username: normalizedUsername,
        p_openpay_account_number: openpayAccountNumber.trim().toUpperCase(),
        p_reference_code: referenceCode.trim(),
        p_proof_url: proofUrl,
      });
      if (error) throw new Error(error.message || "Top up request failed");
      if (data) {
        toast.success("Thank you! Top up request submitted.");
      } else {
        toast.message("Thank you! Top up request submitted.");
      }
      toast.message("Please wait for admin confirmation. You will receive updates in your dashboard activity history.");
      setSubmitted(true);
      await loadHistory();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Top up request failed");
    } finally {
      setUploading(false);
      setSubmitting(false);
    }
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmModal(false);
    await submitTopUpRequest();
  };

  return (
    <div className={className}>
      <label className="block space-y-1 text-xs text-muted-foreground">
        <span>Upload payment proof (screenshot)</span>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
          className="w-full text-sm text-foreground"
        />
      </label>

      {proofPreview ? (
        <div className="mt-2 overflow-hidden rounded-xl border border-border bg-secondary/20">
          <button type="button" className="block w-full" onClick={() => setShowImageModal(true)}>
            <img src={proofPreview} alt="Payment proof preview" className="h-40 w-full object-cover" />
          </button>
          <button
            type="button"
            onClick={() => setShowImageModal(true)}
            className="w-full px-3 py-2 text-xs font-semibold text-paypal-blue"
          >
            View full image
          </button>
        </div>
      ) : null}

      <p className="text-sm font-semibold text-foreground">OpenPay account details</p>
      <p className="text-xs text-muted-foreground">These details are locked for admin verification.</p>

      <div className="mt-3 grid gap-3">
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Top up amount</span>
          <input
            value={safeAmount > 0 ? safeAmount.toFixed(2) : ""}
            readOnly
            aria-readonly="true"
            className="h-11 w-full rounded-xl border border-border bg-secondary/30 px-3 text-sm text-foreground"
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>OpenPay full name</span>
          <input
            value={openpayName}
            readOnly
            aria-readonly="true"
            className="h-11 w-full rounded-xl border border-border bg-secondary/30 px-3 text-sm text-foreground"
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>OpenPay username</span>
          <input
            value={openpayUsername}
            readOnly
            aria-readonly="true"
            className="h-11 w-full rounded-xl border border-border bg-secondary/30 px-3 text-sm text-foreground"
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>OpenPay account number</span>
          <input
            value={openpayAccountNumber}
            readOnly
            aria-readonly="true"
            className="h-11 w-full rounded-xl border border-border bg-secondary/30 px-3 text-sm text-foreground"
          />
        </label>
      </div>

      <label className="mt-3 block space-y-1 text-xs text-muted-foreground">
        <span>Payment reference / receipt number</span>
        <input
          value={referenceCode}
          onChange={(event) => setReferenceCode(event.target.value)}
          placeholder="Enter reference number"
          className="h-11 w-full rounded-xl border border-border px-3 text-sm text-foreground"
        />
      </label>

      <Button
        type="button"
        className="mt-3 h-11 w-full rounded-xl bg-paypal-blue text-sm font-semibold text-white hover:bg-[#004dc5]"
        onClick={() => {
          if (!validateTopUp()) return;
          setShowConfirmModal(true);
        }}
        disabled={submitting || uploading || safeAmount <= 0}
      >
        {uploading ? "Uploading..." : submitting ? "Submitting..." : submitLabel}
      </Button>

      {submitted ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Thank you! Your top up request is complete. Please wait for admin confirmation. You will receive updates in your
          dashboard activity history.
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-border/70 bg-secondary/30 p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Recent top ups</p>
          <p className="text-xs text-muted-foreground">{history.length} latest</p>
        </div>
        {historyLoading ? (
          <p className="mt-2 text-xs text-muted-foreground">Loading top ups...</p>
        ) : history.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No top up requests yet.</p>
        ) : (
          <div className="mt-2 divide-y divide-border/70 rounded-xl border border-border/70">
            {history.map((row) => (
              <div key={row.id} className="px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{row.amount.toFixed(2)} OPEN USD</p>
                  <span className="rounded-full border border-border/70 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {row.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.provider || "Top up"} â€¢ {row.created_at ? format(new Date(row.created_at), "MMM d, yyyy HH:mm") : "Pending"}
                </p>
                {row.admin_note ? (
                  <p className="mt-1 text-xs text-muted-foreground">Admin note: {row.admin_note}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogTitle className="text-lg font-bold text-foreground">Confirm Top Up Request</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Review your details before submitting this top up request.
          </DialogDescription>
          <div className="mt-2 rounded-2xl border border-border p-3 text-sm text-foreground space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold">{safeAmount.toFixed(2)} OPEN USD</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Provider</span>
              <span className="font-semibold">{providerName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Account</span>
              <span className="font-semibold">{openpayAccountNumber || "N/A"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Reference</span>
              <span className="font-semibold">{referenceCode || "N/A"}</span>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              className="flex-1 h-11 rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
              onClick={handleConfirmSubmit}
              disabled={submitting || uploading}
            >
              Confirm & Submit
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-2xl"
              onClick={() => setShowConfirmModal(false)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="rounded-3xl sm:max-w-3xl">
          <DialogTitle className="text-lg font-bold text-foreground">Payment Proof</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Full-size preview of your uploaded screenshot.
          </DialogDescription>
          {proofPreview ? (
            <img src={proofPreview} alt="Payment proof full size" className="mt-2 w-full rounded-2xl object-contain" />
          ) : (
            <p className="text-sm text-muted-foreground">No image available.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TopUpAccountDetails;
