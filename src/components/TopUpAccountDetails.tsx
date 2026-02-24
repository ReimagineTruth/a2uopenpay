import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type TopUpAccountDetailsProps = {
  providerName: string;
  amount: number;
  className?: string;
  submitLabel?: string;
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
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  const submitTopUpRequest = async () => {
    if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
      toast.error("Enter a valid top up amount first");
      return;
    }
    if (!openpayName.trim() || !normalizedUsername || !openpayAccountNumber.trim()) {
      toast.error("OpenPay account details are required");
      return;
    }
    if (!referenceCode.trim()) {
      toast.error("Payment reference is required");
      return;
    }
    if (!proofFile) {
      toast.error("Payment proof screenshot is required");
      return;
    }
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
        toast.success("Top up request submitted");
      } else {
        toast.message("Top up request submitted");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Top up request failed");
    } finally {
      setUploading(false);
      setSubmitting(false);
    }
  };

  return (
    <div className={className}>
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

      <label className="mt-3 block space-y-1 text-xs text-muted-foreground">
        <span>Upload payment proof (screenshot)</span>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
          className="w-full text-sm text-foreground"
        />
      </label>

      <Button
        type="button"
        className="mt-3 h-11 w-full rounded-xl bg-paypal-blue text-sm font-semibold text-white hover:bg-[#004dc5]"
        onClick={submitTopUpRequest}
        disabled={submitting || uploading || safeAmount <= 0}
      >
        {uploading ? "Uploading..." : submitting ? "Submitting..." : submitLabel}
      </Button>
    </div>
  );
};

export default TopUpAccountDetails;
