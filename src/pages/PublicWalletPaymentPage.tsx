import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CreditCard, Wallet, QrCode, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import BrandLogo from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SplashScreen from "@/components/SplashScreen";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

type CheckoutSessionPublic = {
  session_id: string;
  currency: string;
  amount: number;
  fee_amount: number;
  total_amount: number;
  merchant_name: string;
  merchant_username: string;
  merchant_logo_url?: string;
  items?: Array<{
    item_name: string;
    unit_amount: number;
    quantity: number;
    line_total: number;
  }>;
};

const PublicWalletPaymentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const sessionToken = searchParams.get("session") || "";
  const [loading, setLoading] = useState(false);
  const [sessionData, setSessionData] = useState<CheckoutSessionPublic | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "card">("wallet");

  // Wallet payment states
  const [accountNumber, setAccountNumber] = useState("");
  const [pin, setPin] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  // Virtual card states
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiryMonth, setCardExpiryMonth] = useState("");
  const [cardExpiryYear, setCardExpiryYear] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      if (!sessionToken) return;
      setLoading(true);
      try {
        const { data } = await db.rpc("get_public_merchant_checkout_session", {
          p_session_token: sessionToken,
        });
        const row = Array.isArray(data) ? data[0] : data;
        if (row) {
          setSessionData({
            session_id: String(row.session_id || ""),
            currency: String(row.currency || "USD"),
            amount: Number(row.amount || 0),
            fee_amount: Number(row.fee_amount || 0),
            total_amount: Number(row.total_amount || 0),
            merchant_name: String(row.merchant_name || "OpenPay Merchant"),
            merchant_username: String(row.merchant_username || ""),
            merchant_logo_url: row.merchant_logo_url || undefined,
            items: Array.isArray(row.items) ? row.items : [],
          });
        }
      } catch (error) {
        toast.error("Failed to load payment session");
      }
      setLoading(false);
    };
    loadSession();
  }, [sessionToken]);

  const handleWalletPayment = async () => {
    if (!accountNumber.trim() || !pin.trim()) {
      toast.error("Account number and PIN are required");
      return;
    }

    if (!sessionData) {
      toast.error("Invalid payment session");
      return;
    }

    setProcessing(true);
    try {
      const { data: result, error } = await db.rpc("pay_merchant_checkout_public_wallet", {
        p_session_token: sessionToken,
        p_payer_account_number: accountNumber.trim(),
        p_payer_pin: pin.trim(),
        p_customer_name: customerName.trim() || null,
        p_customer_email: customerEmail.trim() || null,
        p_customer_phone: customerPhone.trim() || null,
        p_customer_address: customerAddress.trim() || null,
      });

      if (error) throw error;

      const paymentResult = Array.isArray(result) ? result[0] : result;
      if (paymentResult?.status === "success") {
        toast.success("Payment completed successfully");
        const isPos = String(sessionData.items?.[0]?.item_name || "").toLowerCase().includes("pos payment");
        const thankYouPath = isPos ? "/pos-thank-you" : "/merchant-checkout/thank-you";
        navigate(`${thankYouPath}?session=${encodeURIComponent(sessionToken)}&tx=${encodeURIComponent(paymentResult.transaction_id)}`, { replace: true });
      } else {
        toast.error(paymentResult?.message || "Payment failed");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleCardPayment = async () => {
    const parsedMonth = Number(cardExpiryMonth.trim());
    const parsedYear = Number(cardExpiryYear.trim());

    if (!cardNumber.trim() || !cardExpiryMonth.trim() || !cardExpiryYear.trim() || !cardCvc.trim()) {
      toast.error("All card fields are required");
      return;
    }

    if (!Number.isFinite(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
      toast.error("Invalid expiry month");
      return;
    }

    if (!Number.isFinite(parsedYear) || parsedYear < 2026) {
      toast.error("Invalid expiry year");
      return;
    }

    if (!sessionData) {
      toast.error("Invalid payment session");
      return;
    }

    setProcessing(true);
    try {
      const { data: result, error } = await db.rpc("pay_merchant_checkout_public_virtual_card", {
        p_session_token: sessionToken,
        p_card_number: cardNumber,
        p_expiry_month: parsedMonth,
        p_expiry_year: parsedYear,
        p_cvc: cardCvc,
        p_customer_name: customerName.trim() || null,
        p_customer_email: customerEmail.trim() || null,
        p_customer_phone: customerPhone.trim() || null,
        p_customer_address: customerAddress.trim() || null,
      });

      if (error) throw error;

      const paymentResult = Array.isArray(result) ? result[0] : result;
      if (paymentResult?.status === "success") {
        toast.success("Payment completed successfully");
        const isPos = String(sessionData.items?.[0]?.item_name || "").toLowerCase().includes("pos payment");
        const thankYouPath = isPos ? "/pos-thank-you" : "/merchant-checkout/thank-you";
        navigate(`${thankYouPath}?session=${encodeURIComponent(sessionToken)}&tx=${encodeURIComponent(paymentResult.transaction_id)}`, { replace: true });
      } else {
        toast.error(paymentResult?.message || "Payment failed");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment failed");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <SplashScreen message="Loading payment details..." />;
  if (!sessionData) return <SplashScreen message="Payment session not found" />;

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      <div className="flex h-14 items-center border-b border-border bg-white px-4">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-secondary" aria-label="Back">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="mx-3 h-7 w-px bg-border" />
        <p className="flex items-center gap-2 text-xl font-medium text-foreground">
          <Wallet className="h-5 w-5" />
          Public Payment
        </p>
      </div>

      <div className="grid min-h-[calc(100vh-56px)] grid-cols-1 lg:grid-cols-[1fr_900px]">
        <div className="border-r border-border bg-[#f3f4f7] px-6 py-10">
          <div className="mx-auto w-full max-w-xl">
            {sessionData.merchant_logo_url ? (
              <img src={sessionData.merchant_logo_url} alt={sessionData.merchant_name} className="mb-4 h-48 w-full rounded-2xl border border-border object-cover" />
            ) : null}
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-paypal-blue/20 text-[10px] font-bold text-paypal-blue">
                {(sessionData.merchant_name || "M").slice(0, 1).toUpperCase()}
              </div>
              <p className="text-3xl font-semibold text-foreground">{sessionData.merchant_name}</p>
            </div>
            <p className="text-6xl font-semibold leading-none text-foreground">
              {sessionData.currency} {sessionData.total_amount.toFixed(2)}
            </p>
            <p className="mt-8 text-4xl font-semibold leading-tight text-foreground">
              {sessionData.items?.[0]?.item_name || "OpenPay Payment"}
            </p>
          </div>
        </div>

        <div className="bg-white px-6 py-10">
          <div className="mx-auto w-full max-w-lg">
            <h2 className="text-4xl font-semibold text-foreground">Complete Payment</h2>

            <div className="mt-5 rounded-2xl border border-border bg-white p-5 shadow-sm">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("wallet")}
                  className={`flex h-16 items-center gap-2 rounded-md border px-3 text-left ${
                    paymentMethod === "wallet" ? "border-paypal-blue text-paypal-blue" : "border-border text-muted-foreground"
                  }`}
                >
                  <Wallet className="h-5 w-5" />
                  <span className="text-lg font-medium">OpenPay Wallet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("card")}
                  className={`flex h-16 items-center gap-2 rounded-md border px-3 text-left ${
                    paymentMethod === "card" ? "border-paypal-blue text-paypal-blue" : "border-border text-muted-foreground"
                  }`}
                >
                  <CreditCard className="h-5 w-5" />
                  <span className="text-lg font-medium">Virtual Card</span>
                </button>
              </div>

              {paymentMethod === "wallet" ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="mb-1 text-xl text-foreground">Account Number</p>
                    <Input
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="OP123456789"
                      className="h-12 rounded-md text-lg"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xl text-foreground">PIN</p>
                    <Input
                      type="password"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="Enter your PIN"
                      className="h-12 rounded-md text-lg"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">Enter your OpenPay account details to complete this payment.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="mb-1 text-xl text-foreground">Virtual card number</p>
                    <Input
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="1234 1234 1234 1234"
                      className="h-12 rounded-md text-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="mb-1 text-xl text-foreground">Expiry date</p>
                      <Input
                        value={cardExpiryMonth}
                        onChange={(e) => setCardExpiryMonth(e.target.value)}
                        placeholder="MM / YY"
                        className="h-12 rounded-md text-lg"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xl text-foreground">Security code</p>
                      <Input
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        placeholder="CVC"
                        className="h-12 rounded-md text-lg"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">Use your OpenPay virtual card to complete this payment.</p>
                </div>
              )}

              <div className="mt-4 space-y-2 rounded-md border border-border p-3">
                <p className="text-sm font-semibold text-foreground">Customer details (optional)</p>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Full name"
                  className="h-11 rounded-md"
                />
                <Input
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="Email"
                  className="h-11 rounded-md"
                />
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone"
                  className="h-11 rounded-md"
                />
                <Input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Address"
                  className="h-11 rounded-md"
                />
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <div className="flex items-center justify-between text-lg">
                  <span className="text-foreground">Subtotal</span>
                  <span className="font-semibold text-foreground">
                    {sessionData.currency} {sessionData.amount.toFixed(2)}
                  </span>
                </div>
                {sessionData.fee_amount > 0 && (
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">OpenPay fee (2%)</span>
                    <span className="font-semibold text-foreground">
                      {sessionData.currency} {sessionData.fee_amount.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between text-lg font-bold">
                  <span className="text-foreground">Total</span>
                  <span className="font-bold text-foreground">
                    {sessionData.currency} {sessionData.total_amount.toFixed(2)}
                  </span>
                </div>
              </div>

              <Button
                onClick={paymentMethod === "wallet" ? handleWalletPayment : handleCardPayment}
                disabled={processing}
                className="mt-4 h-12 w-full rounded-full text-base bg-paypal-blue text-white hover:bg-[#004dc5]"
              >
                {processing ? (
                  <span className="inline-flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Processing...
                  </span>
                ) : (
                  <span className="inline-flex items-center">
                    <BrandLogo className="mr-2 h-4 w-4" />
                    Pay with OpenPay
                  </span>
                )}
              </Button>

              <div className="mt-4 text-center text-sm text-muted-foreground">
                <p className="inline-flex items-center gap-1 font-medium">
                  <ShieldCheck className="h-4 w-4" /> Secure Public Payment
                </p>
                <p className="mt-2">No sign-in required. Your payment is processed securely.</p>
              </div>
            </div>

            <p className="mt-8 text-center text-sm text-muted-foreground">Powered by OpenPay</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicWalletPaymentPage;
