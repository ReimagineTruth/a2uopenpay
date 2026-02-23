import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Copy, QrCode, Receipt, RotateCcw, Server, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import BrandLogo from "@/components/BrandLogo";

const OPENPAY_RPC_BASE = "https://YOUR_SUPABASE_PROJECT.supabase.co/rest/v1/rpc";

const OpenPayPosDocsPage = () => {
  const navigate = useNavigate();
  const [previewTab, setPreviewTab] = useState<"qr" | "deeplink" | "button" | "widget" | "receipt" | "actual" | "thankyou">("qr");
  const sampleSessionToken = "opsess_pos_demo_001";
  const sampleStore = "OpenPay Merchant POS";
  const sampleMerchant = "openpaymerchant";
  const sampleAmount = "49.99";
  const sampleCurrency = "USD";
  const sampleIssuedAt = "2026-02-23T09:30:00Z";
  const sampleStatus = "succeeded";
  const samplePosDeepLink = `openpay-pos://checkout/${sampleSessionToken}`;
  const samplePosThankYouLink = `/pos-thank-you?session=${sampleSessionToken}&tx=tx_pos_demo_001`;
  const sampleCheckoutLink = useMemo(
    () =>
      typeof window === "undefined"
        ? `https://openpay.example/merchant-checkout?session=${sampleSessionToken}`
        : `${window.location.origin}/merchant-checkout?session=${sampleSessionToken}`,
    [sampleSessionToken],
  );
  const samplePosButtonCode = `<a href="${sampleCheckoutLink}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:8px;background:#0057d8;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700"><img src="/openpay-o.svg" alt="OpenPay" width="16" height="16" style="display:block;border-radius:999px" />Pay at POS</a>`;
  const samplePosWidgetCode = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f8fbff;font-family:Arial,sans-serif">
    <div style="max-width:360px;margin:0 auto;border:1px solid #d9e6ff;border-radius:16px;padding:20px;background:#fff">
      <p style="margin:0;color:#5c6b82;font-size:12px;letter-spacing:.08em;text-transform:uppercase">OpenPay POS</p>
      <h3 style="margin:8px 0 0;font-size:24px;color:#10213a">${sampleStore}</h3>
      <p style="margin:8px 0 16px;color:#5c6b82;font-size:14px">${sampleAmount} ${sampleCurrency} • Scan or tap to pay</p>
      <a href="${sampleCheckoutLink}" target="_blank" rel="noopener noreferrer" style="display:block;text-align:center;background:#0057d8;color:#fff;padding:12px 16px;border-radius:10px;text-decoration:none;font-weight:700">Open POS checkout</a>
    </div>
  </body>
</html>`;

  const snippets = useMemo(
    () => ({
      createPosSession: `curl -X POST "${OPENPAY_RPC_BASE}/create_my_pos_checkout_session" \\
  -H "apikey: YOUR_SERVICE_OR_ANON_KEY" \\
  -H "Authorization: Bearer MERCHANT_AUTH_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "p_mode": "live",
    "p_amount": 49.99,
    "p_currency": "USD",
    "p_note": "POS payment",
    "p_customer_name": "Walk-in customer"
  }'`,
      getPosTransactions: `curl -X POST "${OPENPAY_RPC_BASE}/get_my_pos_transactions" \\
  -H "apikey: YOUR_SERVICE_OR_ANON_KEY" \\
  -H "Authorization: Bearer MERCHANT_AUTH_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "p_mode": "live",
    "p_status": null,
    "p_limit": 50,
    "p_offset": 0
  }'`,
      refundPosTransaction: `curl -X POST "${OPENPAY_RPC_BASE}/refund_my_pos_transaction" \\
  -H "apikey: YOUR_SERVICE_OR_ANON_KEY" \\
  -H "Authorization: Bearer MERCHANT_AUTH_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "p_mode": "live",
    "p_transaction_id": "POS_TX_UUID",
    "p_reason": "POS refund"
  }'`,
      upsertPosApiKey: `curl -X POST "${OPENPAY_RPC_BASE}/upsert_my_pos_api_key" \\
  -H "apikey: YOUR_SERVICE_OR_ANON_KEY" \\
  -H "Authorization: Bearer MERCHANT_AUTH_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "p_mode": "live",
    "p_secret_key": "osk_live_xxx"
  }'`,
    }),
    [],
  );

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const Snippet = ({ title, code }: { title: string; code: string }) => (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <Button variant="outline" className="h-8 rounded-lg px-2 text-xs" onClick={() => handleCopy(code, title)}>
          <Copy className="mr-1 h-3.5 w-3.5" />
          Copy
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );

  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-4">
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => navigate("/openpay-documentation")}
          className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full"
          aria-label="Back to docs"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-paypal-dark">OpenPay POS Documentation</h1>
          <p className="text-xs text-muted-foreground">Merchant POS setup, QR checkout, refunds, and API references</p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/30 bg-gradient-to-br from-paypal-blue to-[#0073e6] p-5 text-white shadow-xl shadow-[#004bba]/20">
        <p className="text-sm font-semibold uppercase tracking-wide">POS Overview</p>
        <p className="mt-2 text-sm text-white/90">
          OpenPay POS lets merchants create in-person checkout sessions, display a QR, accept wallet payment, print receipts, and issue refunds using the same merchant account.
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-white p-4">
          <QrCode className="h-4 w-4 text-paypal-blue" />
          <p className="mt-2 text-sm font-semibold text-foreground">Create POS QR</p>
          <p className="mt-1 text-xs text-muted-foreground">Generate session token and render payment QR at checkout counter.</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-4">
          <Receipt className="h-4 w-4 text-paypal-blue" />
          <p className="mt-2 text-sm font-semibold text-foreground">Complete + Print</p>
          <p className="mt-1 text-xs text-muted-foreground">Customer pays in wallet, merchant prints confirmation receipt.</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-4">
          <RotateCcw className="h-4 w-4 text-paypal-blue" />
          <p className="mt-2 text-sm font-semibold text-foreground">Refund Controls</p>
          <p className="mt-1 text-xs text-muted-foreground">Use transaction history to process POS refunds with audit detail.</p>
        </div>
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-5">
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-paypal-blue" />
          <h2 className="font-semibold text-foreground">POS Flow</h2>
        </div>
        <div className="grid gap-2 text-sm text-muted-foreground">
          <p>1. Open POS page at <code>/merchant-pos</code> and select sandbox or live mode.</p>
          <p>2. Save your POS secret key via <code>upsert_my_pos_api_key</code>.</p>
          <p>3. Create a POS checkout session and show generated QR to customer.</p>
          <p>4. Customer scans and pays from OpenPay wallet.</p>
          <p>5. Merchant prints receipt and verifies transaction in history.</p>
          <p>6. If required, issue refund via <code>refund_my_pos_transaction</code>.</p>
        </div>
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-5">
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-paypal-blue" />
          <h2 className="font-semibold text-foreground">POS Share Method Previews</h2>
        </div>
        <div className="mb-3 flex flex-wrap gap-2 rounded-xl border border-border bg-secondary/20 p-1">
          {([
            ["qr", "POS QR"],
            ["deeplink", "POS Link"],
            ["button", "Button"],
            ["widget", "Widget"],
            ["receipt", "Receipt"],
            ["actual", "Actual POS"],
            ["thankyou", "Thank You"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPreviewTab(key)}
              className={`rounded-lg px-3 py-2 text-sm ${previewTab === key ? "bg-white font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {previewTab === "qr" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-white p-4 text-center">
              <p className="text-sm font-semibold text-foreground">Scan QR Code to Pay</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{sampleStore}</p>
              <div className="mt-3 flex justify-center">
                <QRCodeSVG
                  value={samplePosDeepLink}
                  size={220}
                  level="H"
                  includeMargin
                  imageSettings={{ src: "/openpay-o.svg", height: 34, width: 34, excavate: true }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{sampleAmount} {sampleCurrency}</p>
              <p className="mt-1 text-xs text-muted-foreground">@{sampleMerchant}</p>
              <div className="mt-3 flex justify-center gap-2">
                <Button variant="outline" className="h-9 rounded-lg" onClick={() => handleCopy(samplePosDeepLink, "POS QR link")}>
                  <Copy className="mr-2 h-4 w-4" /> Copy QR link
                </Button>
                <Button variant="outline" className="h-9 rounded-lg" onClick={() => window.open(sampleCheckoutLink, "_blank", "noopener,noreferrer")}>
                  Open checkout
                </Button>
              </div>
            </div>
          </div>
        )}

        {previewTab === "deeplink" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-white p-4">
              <p className="text-sm font-semibold text-foreground">POS Deep Link</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">{samplePosDeepLink}</p>
              <Button variant="outline" className="mt-3 h-8 rounded-lg px-2 text-xs" onClick={() => handleCopy(samplePosDeepLink, "POS deep link")}>
                <Copy className="mr-1 h-3.5 w-3.5" />
                Copy
              </Button>
            </div>
            <div className="rounded-xl bg-secondary/20 p-4 text-sm text-muted-foreground">
              Use POS deep link for native scanner routing and app-to-app POS checkout handoff.
            </div>
          </div>
        )}

        {previewTab === "button" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-white p-4">
              <p className="text-sm font-semibold text-foreground">POS Button Embed Code</p>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100"><code>{samplePosButtonCode}</code></pre>
            </div>
            <div className="rounded-xl bg-secondary/30 p-6 text-center">
              <a href={sampleCheckoutLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-[10px] bg-paypal-blue px-6 py-3 font-bold text-white">
                <BrandLogo className="h-4 w-4" />
                Pay at POS
              </a>
            </div>
          </div>
        )}

        {previewTab === "widget" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-white p-4">
              <p className="text-sm font-semibold text-foreground">POS Widget HTML</p>
              <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100"><code>{samplePosWidgetCode}</code></pre>
            </div>
            <div className="rounded-xl bg-secondary/20 p-4">
              <div className="mx-auto max-w-sm rounded-xl border border-border bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <BrandLogo className="h-5 w-5" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">OpenPay POS</p>
                </div>
                <p className="text-sm text-muted-foreground">In-store checkout</p>
                <p className="text-xl font-semibold text-foreground">{sampleStore}</p>
                <p className="mt-1 text-sm text-muted-foreground">{sampleAmount} {sampleCurrency} • Scan or tap to pay</p>
                <a href={sampleCheckoutLink} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-full bg-paypal-blue text-sm font-semibold text-white">
                  Open POS checkout
                </a>
              </div>
            </div>
          </div>
        )}

        {previewTab === "receipt" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-white p-4 text-xs text-muted-foreground">
              POS receipt preview matching merchant print layout.
            </div>
            <div className="flex justify-center rounded-xl bg-white p-4">
              <div className="w-[302px] bg-card px-4 py-3 font-mono text-[11px] leading-4 text-black">
                <p className="text-center text-[15px] font-bold">OpenPay Merchant POS</p>
                <p className="text-center">{sampleStore}</p>
                <p className="text-center">@{sampleMerchant}</p>
                <p className="mt-1 text-center">{new Date(sampleIssuedAt).toLocaleString()}</p>
                <p className="mt-2 border-t border-dashed border-black pt-2 text-center font-bold">ACKNOWLEDGEMENT RECEIPT</p>
                <p className="mt-2">Type: POS RECEIVE</p>
                <p>Mode: LIVE</p>
                <p>Currency: {sampleCurrency}</p>
                <p>Amount: {sampleAmount}</p>
                <p>Status: {sampleStatus.toUpperCase()}</p>
                <p className="break-all">Session: {sampleSessionToken}</p>
                <p className="mt-2 border-t border-dashed border-black pt-2 text-center">SCAN QR CODE TO PAY</p>
                <div className="mt-2 flex justify-center">
                  <QRCodeSVG
                    value={samplePosDeepLink}
                    size={170}
                    level="H"
                    includeMargin
                    imageSettings={{ src: "/openpay-o.svg", height: 28, width: 28, excavate: true }}
                  />
                </div>
                <p className="mt-1 text-center text-[10px]">@{sampleMerchant}</p>
                <p className="mt-1 text-center text-[10px]">Merchant and amount are pre-filled after scan.</p>
                <p className="mt-2 border-t border-dashed border-black pt-2 text-center">Thank you for using OpenPay</p>
              </div>
            </div>
          </div>
        )}

        {previewTab === "actual" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-white p-4">
              <p className="text-sm font-semibold text-foreground">Actual POS Screen</p>
              <p className="mt-1 text-xs text-muted-foreground">
                This opens the real POS experience at <code>/merchant-pos</code>. Authentication is required.
              </p>
              <div className="mt-3 flex gap-2">
                <Button className="h-9 rounded-lg bg-paypal-blue text-white hover:bg-[#004dc5]" onClick={() => navigate("/merchant-pos")}>
                  Open Actual POS
                </Button>
                <Button variant="outline" className="h-9 rounded-lg" onClick={() => window.open("/merchant-pos", "_blank", "noopener,noreferrer")}>
                  Open in New Tab
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-white p-2">
              <iframe
                src="/merchant-pos"
                title="OpenPay POS actual preview"
                className="h-[620px] w-full rounded-lg border border-border"
                loading="lazy"
              />
            </div>
          </div>
        )}

        {previewTab === "thankyou" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-white p-4">
              <p className="text-sm font-semibold text-foreground">Actual POS Thank You Page</p>
              <p className="mt-1 text-xs text-muted-foreground">
                This opens the real POS success page at <code>/pos-thank-you</code> using a demo session query.
              </p>
              <div className="mt-3 flex gap-2">
                <Button className="h-9 rounded-lg bg-paypal-blue text-white hover:bg-[#004dc5]" onClick={() => navigate(samplePosThankYouLink)}>
                  Open Thank You Page
                </Button>
                <Button variant="outline" className="h-9 rounded-lg" onClick={() => window.open(samplePosThankYouLink, "_blank", "noopener,noreferrer")}>
                  Open in New Tab
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-white p-2">
              <iframe
                src={samplePosThankYouLink}
                title="OpenPay POS thank you page preview"
                className="h-[620px] w-full rounded-lg border border-border"
                loading="lazy"
              />
            </div>
          </div>
        )}
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-5">
        <div className="mb-3 flex items-center gap-2">
          <Server className="h-4 w-4 text-paypal-blue" />
          <h2 className="font-semibold text-foreground">POS RPC Endpoints</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-2 pr-3">RPC</th>
                <th className="pb-2 pr-3">Purpose</th>
                <th className="pb-2">Main Inputs</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 font-mono text-xs">create_my_pos_checkout_session</td>
                <td className="py-2 pr-3">Create new POS session for QR payment</td>
                <td className="py-2">`p_mode`, `p_amount`, `p_currency`, `p_note`, customer fields</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 font-mono text-xs">get_my_pos_transactions</td>
                <td className="py-2 pr-3">Load POS transaction history</td>
                <td className="py-2">`p_mode`, `p_status`, `p_limit`, `p_offset`</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 font-mono text-xs">get_my_pos_dashboard</td>
                <td className="py-2 pr-3">Load summary stats for POS dashboard</td>
                <td className="py-2">`p_mode`</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 font-mono text-xs">upsert_my_pos_api_key</td>
                <td className="py-2 pr-3">Save/update POS API secret for mode</td>
                <td className="py-2">`p_mode`, `p_secret_key`</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 font-mono text-xs">get_my_pos_api_key_settings</td>
                <td className="py-2 pr-3">Get current POS API key metadata</td>
                <td className="py-2">no arguments</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 font-mono text-xs">refund_my_pos_transaction</td>
                <td className="py-2 pr-3">Create refund for POS payment</td>
                <td className="py-2">`p_mode`, `p_transaction_id`, `p_reason`</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <Snippet title="Create POS Checkout Session (cURL)" code={snippets.createPosSession} />
        <Snippet title="Get POS Transactions (cURL)" code={snippets.getPosTransactions} />
        <Snippet title="Refund POS Transaction (cURL)" code={snippets.refundPosTransaction} />
        <Snippet title="Save POS API Key (cURL)" code={snippets.upsertPosApiKey} />
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-5">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-paypal-blue" />
          <h2 className="font-semibold text-foreground">Security Notes</h2>
        </div>
        <div className="grid gap-2 text-sm text-muted-foreground">
          <p>1. Keep POS <code>osk_*</code> values on trusted backend or secure merchant environment.</p>
          <p>2. Validate amount and currency before creating POS sessions.</p>
          <p>3. Use <code>sandbox</code> first for print/checkout/refund QA.</p>
          <p>4. Rotate POS keys immediately if leaked.</p>
        </div>
      </div>

      <BottomNav active="menu" />
    </div>
  );
};

export default OpenPayPosDocsPage;
