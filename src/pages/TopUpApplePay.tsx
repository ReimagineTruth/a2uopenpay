import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Copy, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

const APPLE_PAY_ICON_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Apple_Pay_logo.svg/1920px-Apple_Pay_logo.svg.png";

const TopUpApplePay = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showInstructions, setShowInstructions] = useState(false);
  const [showTopUpInstructions, setShowTopUpInstructions] = useState(false);
  const [showSafetyAgreement, setShowSafetyAgreement] = useState(false);
  const [safetyAgreementChecked, setSafetyAgreementChecked] = useState(false);
  const [safetyAccepted, setSafetyAccepted] = useState(false);

  const parsedUsdAmount = Number(searchParams.get("openUsdAmount") || searchParams.get("amount") || "0");
  const safeUsdAmount = Number.isFinite(parsedUsdAmount) && parsedUsdAmount > 0 ? parsedUsdAmount : 0;
  const usdDisplay = safeUsdAmount > 0 ? safeUsdAmount.toFixed(2) : "0.00";
  const openUsdDisplay = usdDisplay;
  const applePayCheckoutUrl = "https://www.apple.com/apple-pay/";

  const handleCopyApplePayLink = async () => {
    try {
      await navigator.clipboard.writeText(applePayCheckoutUrl);
      toast.success("Apple Pay link copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleOpenApplePay = () => {
    setSafetyAgreementChecked(false);
    setShowSafetyAgreement(true);
  };

  const confirmOpenApplePay = () => {
    setSafetyAccepted(true);
    setShowSafetyAgreement(false);
  };

  return (
    <div className="min-h-screen bg-background px-4 pt-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-6 w-6 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">Top Up - Apple Pay</h1>
        <img src={APPLE_PAY_ICON_URL} alt="Apple Pay" className="ml-auto h-7 w-auto object-contain" />
        <button
          onClick={() => setShowInstructions(true)}
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground"
        >
          <HelpCircle className="h-4 w-4" />
          How it works
        </button>
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

        {safeUsdAmount > 0 && (
          <div className="mt-5 rounded-2xl border border-border bg-white p-4">
            <p className="text-center text-xs font-semibold text-muted-foreground">Pay with Apple Pay</p>
            {!safetyAccepted ? (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={handleOpenApplePay}
                  className="paypal-surface w-full max-w-md rounded-md border border-border bg-black py-3 text-center text-base font-semibold text-white shadow-sm"
                >
                  Apple Pay
                </button>
              </div>
            ) : (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => toast.info("Apple Pay button will appear once Apple Pay is enabled.")}
                  className="paypal-surface w-full max-w-md rounded-md border border-border bg-black py-3 text-center text-base font-semibold text-white shadow-sm"
                >
                  Apple Pay
                </button>
              </div>
            )}
          </div>
        )}

        <p className="mt-3 text-center text-sm font-medium text-foreground">
          Note: Apple Pay checkout may redirect you. Review the top-up instructions below, then proceed with your top up.
        </p>

        <Button
          type="button"
          variant="outline"
          className="mt-4 h-11 w-full rounded-2xl border-paypal-blue/40 bg-white text-foreground hover:bg-secondary/30"
          onClick={() => {
            if (!safetyAccepted) {
              handleOpenApplePay();
              return;
            }
          }}
        >
          <img src={APPLE_PAY_ICON_URL} alt="Apple Pay" className="mr-2 h-5 w-auto object-contain" />
          Pay with Apple Pay
        </Button>

        <Button
          type="button"
          variant="outline"
          className="mt-2 h-11 w-full rounded-2xl border-paypal-blue/40 bg-white text-foreground hover:bg-secondary/30"
          onClick={() => setShowTopUpInstructions(true)}
        >
          OpenPay Top-Up Instructions
        </Button>

        <Button
          type="button"
          variant="outline"
          className="mt-2 h-11 w-full rounded-2xl"
          onClick={handleCopyApplePayLink}
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy Apple Pay Link
        </Button>

        <Button
          type="button"
          variant="outline"
          className="mt-2 h-11 w-full rounded-2xl"
          onClick={() => navigate("/live-customer-service")}
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

      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogTitle className="text-xl font-bold text-foreground">Top Up Instructions</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Top up works on OpenPay app and browser across desktop, mobile, and tablet.
          </DialogDescription>

          <div className="rounded-2xl border border-border p-3 text-sm text-foreground">
            <p>1. You can top up your OpenPay balance using Pi payments or approved third-party partner providers.</p>
            <p>2. Third-party provider top up is supported on desktop, mobile, tablet, and browser.</p>
            <p>3. Pi Payment top up works only in Pi Browser.</p>
            <p>4. If you use OpenPay app with email login, sign in with the same email in Pi Browser first, then top up.</p>
            <p>5. If you do not have Pi in your wallet, buy Pi in your Pi Wallet onramp first, then top up in OpenPay.</p>
            <p>6. Third-party provider availability, limits, fees, and processing time depend on partner terms.</p>
            <p>7. You can also exchange with another OpenPay user or merchant who accepts real-currency exchange.</p>
            <p>8. OpenPay top up has no fee from OpenPay. A merchant or partner may add exchange or processing fee terms.</p>
          </div>

          <Button
            className="h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
            onClick={() => setShowInstructions(false)}
          >
            I Understand
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showTopUpInstructions} onOpenChange={setShowTopUpInstructions}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-2xl">
          <DialogTitle className="text-2xl font-bold text-paypal-blue">OpenPay Top-Up Instructions</DialogTitle>

          <div className="space-y-4 text-sm text-foreground">
            <div>
              <h3 className="text-base font-semibold text-teal-700">Step 1: Enter Amount in OpenPay</h3>
              <ul className="list-disc pl-5">
                <li>Go to <strong>OpenPay → Top Up</strong>.</li>
                <li>Enter your desired top-up amount.</li>
                <li>Review the final USD amount displayed.</li>
              </ul>
            </div>
          </div>

          <Button
            type="button"
            className="h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#162c6e]"
            onClick={() => setShowTopUpInstructions(false)}
          >
            Accept & Continue
          </Button>
        </DialogContent>
      </Dialog>

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
            onClick={confirmOpenApplePay}
          >
            Pay with Apple Pay
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

export default TopUpApplePay;
