import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/contexts/CurrencyContext";
import { getFunctionErrorMessage } from "@/lib/supabaseFunctionError";
import TransactionReceipt, { type ReceiptData } from "@/components/TransactionReceipt";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const PI_PAYMENT_ICON_URL = "https://i.ibb.co/BV8PHjB4/Pi-200x200.png";

const TopUp = () => {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showSafetyAgreement, setShowSafetyAgreement] = useState(false);
  const [safetyAgreementChecked, setSafetyAgreementChecked] = useState(false);
  const [generatedTopUpLink, setGeneratedTopUpLink] = useState("");
  const [userAccountNumber, setUserAccountNumber] = useState("");
  const [userAccountUsername, setUserAccountUsername] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currencies } = useCurrency();
  const usdCurrency = currencies.find((c) => c.code === "USD") ?? currencies[0];
  const sandbox = String(import.meta.env.VITE_PI_SANDBOX || "false").toLowerCase() === "true";
  const parsedAmount = Number(amount);
  const safeAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
  const linkAccountNumber = (searchParams.get("account_number") || "").trim().toUpperCase();
  const linkUsername = (searchParams.get("username") || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
  const buildTopUpLink = (value: number) => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams({
      amount: value.toFixed(2),
      mode: "link",
    });
    const targetAccountNumber = linkAccountNumber || userAccountNumber;
    const targetUsername = linkUsername || userAccountUsername;
    if (targetAccountNumber) params.set("account_number", targetAccountNumber);
    if (targetUsername) params.set("username", targetUsername);
    return `${window.location.origin}/topup?${params.toString()}`;
  };

  const createTopUpLink = () => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount first");
      return;
    }
    const link = buildTopUpLink(parsedAmount);
    if (!link) return;
    setGeneratedTopUpLink(link);
    void navigator.clipboard.writeText(link).then(
      () => toast.success("Top up link copied"),
      () => toast.success("Top up link generated"),
    );
  };

  const copyGeneratedTopUpLink = async () => {
    if (!generatedTopUpLink) return;
    try {
      await navigator.clipboard.writeText(generatedTopUpLink);
      toast.success("Top up link copied");
    } catch {
      toast.error("Unable to copy link");
    }
  };

  useEffect(() => {
    const loadAccountIdentity = async () => {
      const { data, error } = await supabase.rpc("upsert_my_user_account");
      if (error) return;
      const row = data as { account_number?: string; account_username?: string } | null;
      setUserAccountNumber(String(row?.account_number || "").trim().toUpperCase());
      setUserAccountUsername(String(row?.account_username || "").trim().replace(/^@+/, "").toLowerCase());
    };
    void loadAccountIdentity();
  }, []);

  useEffect(() => {
    const amountFromLink = searchParams.get("amount");
    if (!amountFromLink) return;
    const parsed = Number(amountFromLink);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setAmount(parsed.toFixed(2));
  }, [searchParams]);

  const initPi = () => {
    if (!window.Pi) {
      return false;
    }
    window.Pi.init({ version: "2.0", sandbox });
    return true;
  };

  const invokeTopUpAction = async (body: Record<string, unknown>, fallbackError: string) => {
    const { data, error } = await supabase.functions.invoke("top-up", { body });
    if (error) throw new Error(await getFunctionErrorMessage(error, fallbackError));
    const payload = data as { success?: boolean; error?: string; transaction_id?: string | null } | null;
    if (payload && payload.success === false) throw new Error(payload.error || fallbackError);
    return payload;
  };

  const verifyPiAccessToken = async (accessToken: string) => {
    const { data, error } = await supabase.functions.invoke("pi-platform", {
      body: { action: "auth_verify", accessToken },
    });
    if (error) throw new Error(await getFunctionErrorMessage(error, "Pi auth verification failed"));
    const payload = data as { success?: boolean; data?: { uid?: string; username?: string }; error?: string } | null;
    if (!payload?.success || !payload.data?.uid) throw new Error(payload?.error || "Pi auth verification failed");
    return { uid: String(payload.data.uid), username: String(payload.data.username || "") };
  };

  const processTopUp = async () => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (linkAccountNumber && userAccountNumber && linkAccountNumber !== userAccountNumber) {
      toast.error(`This top-up link belongs to account ${linkAccountNumber}. Please sign in to that account.`);
      return;
    }
    if (linkUsername && userAccountUsername && linkUsername !== userAccountUsername) {
      toast.error(`This top-up link belongs to @${linkUsername}. Please sign in to that account.`);
      return;
    }

    if (!initPi() || !window.Pi) {
      const link = buildTopUpLink(parsedAmount);
      if (link) {
        setGeneratedTopUpLink(link);
        void navigator.clipboard.writeText(link).then(
          () => toast.message("Top up requires Pi Browser. Link copied for Pi Browser."),
          () => toast.message("Top up requires Pi Browser. Use the generated link below."),
        );
      }
      return;
    }

    setLoading(true);
    try {
      const auth = await window.Pi.authenticate(["username", "payments"], async (payment) => {
        const incompleteTxid = payment.transaction?.txid;
        if (!incompleteTxid) return;
        try {
          await invokeTopUpAction(
            { action: "complete", paymentId: payment.identifier, txid: incompleteTxid },
            "Failed to recover previous payment",
          );
        } catch {
          // no-op
        }
      });

      const verified = await verifyPiAccessToken(auth.accessToken);
      await supabase.auth.updateUser({
        data: {
          pi_uid: verified.uid,
          pi_username: verified.username || auth.user.username,
          pi_connected_at: new Date().toISOString(),
        },
      });

      let completedPaymentId = "";
      let completedTxid = "";
      let creditedTransactionId = "";

      await new Promise<void>((resolve, reject) => {
        let completed = false;
        window.Pi!.createPayment(
          {
            amount: parsedAmount,
            memo: "OpenPay wallet top up (PI to USD)",
            metadata: {
              feature: "top_up",
              amount_pi: parsedAmount,
              amount_usd: parsedAmount,
              requestedAt: new Date().toISOString(),
            },
          },
          {
            onReadyForServerApproval: async (paymentId: string) => {
              await invokeTopUpAction({ action: "approve", paymentId }, "Pi server approval failed");
            },
            onReadyForServerCompletion: async (paymentId: string, txid: string) => {
              if (completed) return;
              completed = true;
              completedPaymentId = paymentId;
              completedTxid = txid;
              await invokeTopUpAction({ action: "complete", paymentId, txid }, "Pi server completion failed");
              const creditResult = await invokeTopUpAction(
                {
                  action: "credit",
                  amount: parsedAmount,
                  amountUsd: parsedAmount,
                  paymentId,
                  txid,
                  targetAccountNumber: linkAccountNumber || userAccountNumber || undefined,
                  targetUsername: linkUsername || userAccountUsername || undefined,
                },
                "Top up failed",
              );
              if (typeof creditResult?.transaction_id === "string" && creditResult.transaction_id) {
                creditedTransactionId = creditResult.transaction_id;
              }
              resolve();
            },
            onCancel: () => reject(new Error("Payment cancelled")),
            onError: (error) => {
              const message =
                error instanceof Error
                  ? error.message
                  : error && typeof error === "object" && "message" in error
                    ? String((error as { message?: unknown }).message || "Payment failed")
                    : "Payment failed";
              reject(new Error(message));
            },
          },
        );
      });

      const receiptTransactionId = creditedTransactionId || completedTxid || completedPaymentId || crypto.randomUUID();
      setReceiptData({
        transactionId: receiptTransactionId,
        ledgerTransactionId: isUuid(creditedTransactionId) ? creditedTransactionId : undefined,
        type: "topup",
        amount: parsedAmount,
        note: "Pi Network top up (PI -> OPEN USD)",
        date: new Date(),
      });
      setReceiptOpen(true);
      toast.success(`${usdCurrency.symbol}${parsedAmount.toFixed(2)} added to your balance!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Top up failed");
    } finally {
      setLoading(false);
    }
  };

  const handleTopUp = () => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSafetyAgreementChecked(false);
    setShowSafetyAgreement(true);
  };

  const confirmTopUpWithAgreement = () => {
    setShowSafetyAgreement(false);
    void processTopUp();
  };

  const topUpButtonLabel = loading
    ? "Processing Pi payment..."
    : safeAmount > 0
      ? `Pay with Pi and add ${usdCurrency.symbol}${safeAmount.toFixed(2)} OPEN USD`
      : "Enter amount to top up";

  return (
    <div className="min-h-screen bg-background px-4 pt-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/dashboard")}><ArrowLeft className="h-6 w-6 text-foreground" /></button>
        <h1 className="text-lg font-semibold text-paypal-dark">Top Up</h1>
        <img src={PI_PAYMENT_ICON_URL} alt="Pi Payment" className="ml-auto h-7 w-7 rounded-full object-cover" />
        <button
          onClick={() => setShowInstructions(true)}
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground"
        >
          <HelpCircle className="h-4 w-4" />
          How it works
        </button>
      </div>

      <div className="paypal-surface mt-10 rounded-3xl p-6">
        <div className="mb-8 text-center">
          <p className="text-5xl font-bold text-foreground">{usdCurrency.symbol}{safeAmount.toFixed(2)}</p>
          <p className="mt-2 text-muted-foreground">Enter amount to add - OPEN USD</p>
        </div>
        <Input
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mb-6 h-14 rounded-2xl border-white/70 bg-white text-center text-2xl"
          min="0.01"
          step="0.01"
        />
        <div className="mb-4 grid grid-cols-2 gap-3 text-center text-xs text-muted-foreground">
          <p className="rounded-xl border border-border px-3 py-2">Pay: {safeAmount.toFixed(2)} PI</p>
          <p className="rounded-xl border border-border px-3 py-2">Add: {usdCurrency.symbol}{safeAmount.toFixed(2)} OPEN USD</p>
        </div>
        <p className="mb-4 text-center text-xs text-muted-foreground">OpenPay uses a stable in-app value: 1 Pi = 1 OPEN USD.</p>
        <Button
          onClick={handleTopUp}
          disabled={loading || safeAmount <= 0}
          className="h-14 w-full rounded-full bg-paypal-blue text-lg font-semibold text-white hover:bg-[#004dc5]"
        >
          {!loading && safeAmount > 0 && <img src={PI_PAYMENT_ICON_URL} alt="Pi Payment" className="mr-2 h-5 w-5 rounded-full object-cover" />}
          {topUpButtonLabel}
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Pi payment completes in Pi Browser. If you are not in Pi Browser, generate a top-up link and open it there.
        </p>

        <div className="mt-4 rounded-2xl border border-border p-3">
          <p className="text-sm font-semibold text-foreground">Top up link (Desktop / Other browser)</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Generate a link with this amount, open it in Pi Browser, then complete payment there.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              onClick={createTopUpLink}
              disabled={safeAmount <= 0}
            >
              Generate Top Up Link
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              onClick={copyGeneratedTopUpLink}
              disabled={!generatedTopUpLink}
            >
              Copy Link
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              onClick={() => window.open(generatedTopUpLink, "_blank")}
              disabled={!generatedTopUpLink}
            >
              Open Link
            </Button>
          </div>
          {!!generatedTopUpLink && (
            <p className="mt-2 break-all text-xs text-muted-foreground">{generatedTopUpLink}</p>
          )}
        </div>
      </div>

      <TransactionReceipt
        open={receiptOpen}
        onOpenChange={(open) => {
          setReceiptOpen(open);
          if (!open) navigate("/dashboard");
        }}
        receipt={receiptData}
      />

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

          <div className="rounded-2xl border border-paypal-light-blue/40 bg-paypal-light-blue/10 p-3 text-xs text-muted-foreground">
            OpenPay is an independent platform built for the Pi Network ecosystem and is not affiliated with any
            government authority or central bank. OpenPay is powered by the Pi digital currency. For more information,
            visit{" "}
            <a href="https://minepi.com" target="_blank" rel="noreferrer" className="font-semibold text-paypal-blue">
              minepi.com
            </a>
            .
          </div>

          <Button
            className="h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
            onClick={() => setShowInstructions(false)}
          >
            I Understand
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
            onClick={confirmTopUpWithAgreement}
          >
            Accept & Continue
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TopUp;
