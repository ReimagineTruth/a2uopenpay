import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import TopUpAccountDetails from "@/components/TopUpAccountDetails";

type TopUpProviderPageProps = {
  providerName: string;
  providerLogoUrl?: string;
  providerUrl?: string;
  accentClassName?: string;
};

const TopUpProviderPage = ({
  providerName,
  providerLogoUrl,
  providerUrl,
  accentClassName = "text-foreground",
}: TopUpProviderPageProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const parsedUsdAmount = Number(searchParams.get("openUsdAmount") || searchParams.get("amount") || "0");
  const safeUsdAmount = Number.isFinite(parsedUsdAmount) && parsedUsdAmount > 0 ? parsedUsdAmount : 0;
  const usdDisplay = safeUsdAmount > 0 ? safeUsdAmount.toFixed(2) : "0.00";

  const openUsdDisplay = useMemo(() => usdDisplay, [usdDisplay]);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [showSafetyAgreement, setShowSafetyAgreement] = useState(false);
  const [safetyAgreementChecked, setSafetyAgreementChecked] = useState(false);
  const [safetyAccepted, setSafetyAccepted] = useState(false);

  const handleProceed = () => {
    if (!providerUrl) {
      toast.error(`${providerName} top-up is not configured yet.`);
      return;
    }
    if (!safetyAccepted) {
      setSafetyAgreementChecked(false);
      setShowSafetyAgreement(true);
      return;
    }
    window.open(providerUrl, "_blank", "noopener,noreferrer");
  };

  const confirmProceed = () => {
    setSafetyAccepted(true);
    setShowSafetyAgreement(false);
    if (!providerUrl) {
      toast.error(`${providerName} top-up is not configured yet.`);
      return;
    }
    window.open(providerUrl, "_blank", "noopener,noreferrer");
  };
  const openSupportWidget = () => {
    window.dispatchEvent(new CustomEvent("open-support-widget", { detail: { tab: "messages" } }));
  };

  return (
    <div className="min-h-screen bg-background px-4 pt-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-6 w-6 text-foreground" />
        </button>
        <h1 className={`text-lg font-semibold ${accentClassName}`}>Top Up - {providerName}</h1>
        {providerLogoUrl && (
          <img src={providerLogoUrl} alt={providerName} className="ml-auto h-7 w-auto object-contain" />
        )}
      </div>

      <div className="paypal-surface mt-8 rounded-3xl p-6">
        <p className="text-center text-sm text-muted-foreground">Amount to pay</p>
        <p className="mt-1 text-center text-5xl font-bold text-foreground">{usdDisplay} USD</p>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          You will receive {openUsdDisplay} OPEN USD (1 OPEN USD = 1 USD)
        </p>
        <p className="mt-2 text-center text-sm font-semibold text-foreground">
          OPEN USD to receive: {openUsdDisplay} OPEN USD
        </p>

        <div className="mt-5 rounded-2xl border border-border bg-white p-4">
          <p className="text-center text-xs font-semibold text-muted-foreground">Pay with {providerName}</p>
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={handleProceed}
              className="paypal-surface w-full max-w-md rounded-md border border-border bg-white py-3 text-center text-base font-semibold text-foreground shadow-sm"
            >
              {providerName}
            </button>
          </div>
          {!providerUrl && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {providerName} top-up is coming soon. Please choose another method or contact support.
            </p>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          className="mt-4 h-11 w-full rounded-2xl"
          onClick={() => setPaymentCompleted(true)}
          disabled={!safetyAccepted || safeUsdAmount <= 0}
        >
          I completed {providerName} payment
        </Button>

        {paymentCompleted && (
          <div className="mt-5 rounded-2xl border border-border bg-white p-4">
            <TopUpAccountDetails
              providerName={providerName}
              amount={safeUsdAmount}
              submitLabel={`Submit ${providerName} Top Up`}
            />
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          className="mt-4 h-11 w-full rounded-2xl border-paypal-blue/40 bg-white text-foreground hover:bg-secondary/30"
          onClick={openSupportWidget}
        >
          Live Customer Service
        </Button>

        <Button
          type="button"
          className="mt-2 h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
          onClick={() => navigate("/dashboard")}
        >
          Done
        </Button>
      </div>

      <Dialog open={showSafetyAgreement} onOpenChange={setShowSafetyAgreement}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogTitle className="text-xl font-bold text-foreground">OpenPay Top-Up Safety Agreement</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Please review and accept before proceeding with your top-up transaction.
          </DialogDescription>
          <div className="rounded-2xl border border-border p-3 text-sm text-foreground">
            <p className="font-semibold">1. Nature of Service</p>
            <p className="mt-1">
              OpenPay is a technology platform that facilitates digital payments and transaction processing. OpenPay is not a bank, financial institution, investment platform, remittance company, or licensed money service business unless otherwise stated under applicable law.
            </p>
            <p className="mt-3 font-semibold">2. Payment Authorization</p>
            <p className="mt-1">By proceeding with this top-up, you:</p>
            <p className="mt-1">Authorize OpenPay to process the transaction using your selected payment method.</p>
            <p className="mt-1">Confirm that you are the authorized holder of the payment method used.</p>
            <p className="mt-1">Understand that payment processing is handled through third-party providers.</p>
            <p className="mt-3 font-semibold">3. Fees, Rates, and Processing</p>
            <p className="mt-1">You acknowledge and agree that:</p>
            <p className="mt-1">Exchange rates (if applicable), service fees, and third-party processing fees may apply.</p>
            <p className="mt-1">Processing times may vary depending on your payment provider, banking institution, or network conditions.</p>
            <p className="mt-1">OpenPay is not responsible for delays caused by third-party payment processors.</p>
            <p className="mt-3 font-semibold">4. User Responsibility</p>
            <p className="mt-1">Before completing your transaction, you agree to:</p>
            <p className="mt-1">Verify the top-up amount.</p>
            <p className="mt-1">Confirm the recipient account or wallet details.</p>
            <p className="mt-1">Review all payment information carefully.</p>
            <p className="mt-1">Transactions completed with incorrect details may not be reversible.</p>
            <p className="mt-3 font-semibold">5. No Deposit Insurance</p>
            <p className="mt-1">
              Funds topped up into your OpenPay balance are not bank deposits and are not insured by any government deposit insurance corporation.
            </p>
            <p className="mt-3 font-semibold">6. License & Compliance</p>
            <p className="mt-1">
              OpenPay operates as a payment technology platform and partners with regulated third-party payment providers where required by law. OpenPay complies with applicable digital commerce and platform regulations in the jurisdictions where it operates.
            </p>
            <p className="mt-1">
              OpenPay does not directly hold customer deposits as a bank and does not provide investment or financial advisory services.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              OpenPay License:{" "}
              <a href="/legal" className="font-semibold text-paypal-blue underline">
                View License
              </a>
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-1"
              checked={safetyAgreementChecked}
              onChange={(e) => setSafetyAgreementChecked(e.target.checked)}
            />
            <span>I understand and agree to proceed with this top up.</span>
          </label>
          <Button
            className="h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
            disabled={!safetyAgreementChecked}
            onClick={confirmProceed}
          >
            Accept & Continue
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-2xl"
            onClick={() => setShowSafetyAgreement(false)}
          >
            Cancel
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TopUpProviderPage;
