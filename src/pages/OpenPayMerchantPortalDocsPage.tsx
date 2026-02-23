import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3, BookOpen, Copy, KeyRound, Link2, Server, ShieldCheck, Store, Wallet } from "lucide-react";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import BrandLogo from "@/components/BrandLogo";

const OPENPAY_RPC_BASE = "https://YOUR_SUPABASE_PROJECT.supabase.co/rest/v1/rpc";

const OpenPayMerchantPortalDocsPage = () => {
  const navigate = useNavigate();
  const [previewTab, setPreviewTab] = useState<"home" | "api_keys" | "checkout" | "analytics" | "actual">("home");

  const sampleMode = "live";
  const sampleCurrency = "USD";
  const sampleCheckoutToken = "opsess_demo_merchant_001";
  const sampleCheckoutLink = useMemo(
    () =>
      typeof window === "undefined"
        ? `https://openpay.example/merchant-checkout?session=${sampleCheckoutToken}`
        : `${window.location.origin}/merchant-checkout?session=${sampleCheckoutToken}`,
    [],
  );
  const samplePortalEmbed = `<iframe src="/merchant-onboarding" width="100%" height="780" style="border:1px solid #d9e6ff;border-radius:12px;" loading="lazy"></iframe>`;

  const snippets = useMemo(
    () => ({
      createApiKey: `curl -X POST "${OPENPAY_RPC_BASE}/create_my_merchant_api_key" \\
  -H "apikey: YOUR_SERVICE_OR_ANON_KEY" \\
  -H "Authorization: Bearer MERCHANT_AUTH_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "p_mode": "live",
    "p_key_name": "Primary production key"
  }'`,
      createCheckoutSession: `curl -X POST "${OPENPAY_RPC_BASE}/create_merchant_checkout_session" \\
  -H "apikey: YOUR_SERVICE_OR_ANON_KEY" \\
  -H "Authorization: Bearer MERCHANT_AUTH_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "p_secret_key": "osk_live_xxx",
    "p_mode": "live",
    "p_currency": "USD",
    "p_items": [{"product_id":"PRODUCT_UUID","quantity":1}],
    "p_customer_name": "Buyer Name",
    "p_customer_email": "buyer@example.com"
  }'`,
      analytics: `curl -X POST "${OPENPAY_RPC_BASE}/get_my_merchant_analytics" \\
  -H "apikey: YOUR_SERVICE_OR_ANON_KEY" \\
  -H "Authorization: Bearer MERCHANT_AUTH_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "p_mode": "live",
    "p_days": 30
  }'`,
      transferBalance: `curl -X POST "${OPENPAY_RPC_BASE}/transfer_my_merchant_balance" \\
  -H "apikey: YOUR_SERVICE_OR_ANON_KEY" \\
  -H "Authorization: Bearer MERCHANT_AUTH_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "p_mode": "live",
    "p_destination": "wallet",
    "p_amount": 100.00
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
          <h1 className="text-xl font-bold text-paypal-dark">OpenPay Merchant Portal Documentation</h1>
          <p className="text-xs text-muted-foreground">Merchant dashboard, API key lifecycle, checkout links, and analytics</p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/30 bg-gradient-to-br from-paypal-blue to-[#0073e6] p-5 text-white shadow-xl shadow-[#004bba]/20">
        <p className="text-sm font-semibold uppercase tracking-wide">Merchant Portal Overview</p>
        <p className="mt-2 text-sm text-white/90">
          Merchant Portal is the operational console for OpenPay merchants. It manages profile, API keys, products, checkout links, balance transfers, and analytics in sandbox and live modes.
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-white p-4">
          <KeyRound className="h-4 w-4 text-paypal-blue" />
          <p className="mt-2 text-sm font-semibold text-foreground">API Key Lifecycle</p>
          <p className="mt-1 text-xs text-muted-foreground">Create, revoke, and rotate merchant keys by mode.</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-4">
          <Link2 className="h-4 w-4 text-paypal-blue" />
          <p className="mt-2 text-sm font-semibold text-foreground">Checkout Operations</p>
          <p className="mt-1 text-xs text-muted-foreground">Build checkout sessions and manage active links.</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-4">
          <BarChart3 className="h-4 w-4 text-paypal-blue" />
          <p className="mt-2 text-sm font-semibold text-foreground">Performance + Balance</p>
          <p className="mt-1 text-xs text-muted-foreground">Track volume, refunds, payouts, and transfer funds.</p>
        </div>
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-5">
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-paypal-blue" />
          <h2 className="font-semibold text-foreground">Merchant Portal Flow</h2>
        </div>
        <div className="grid gap-2 text-sm text-muted-foreground">
          <p>1. Open <code>/merchant-onboarding</code> and select <code>sandbox</code> or <code>live</code>.</p>
          <p>2. Configure merchant profile and default currency.</p>
          <p>3. Create API key for selected mode.</p>
          <p>4. Maintain product catalog and pricing.</p>
          <p>5. Generate checkout links and monitor payment status.</p>
          <p>6. Review analytics and transfer merchant balance as needed.</p>
        </div>
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-5">
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-paypal-blue" />
          <h2 className="font-semibold text-foreground">Merchant Portal Previews</h2>
        </div>
        <div className="mb-3 flex flex-wrap gap-2 rounded-xl border border-border bg-secondary/20 p-1">
          {([
            ["home", "Dashboard"],
            ["api_keys", "API Keys"],
            ["checkout", "Checkout"],
            ["analytics", "Analytics"],
            ["actual", "Actual Portal"],
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

        {previewTab === "home" && (
          <div className="rounded-2xl border border-border bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <BrandLogo className="h-5 w-5" />
              <p className="text-sm font-semibold text-foreground">Merchant Portal Dashboard ({sampleMode})</p>
            </div>
            <div className="grid gap-2 text-sm md:grid-cols-3">
              <div className="rounded-xl border border-border p-3">
                <p className="text-muted-foreground">Gross volume</p>
                <p className="font-semibold text-foreground">12,450.20 {sampleCurrency}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-muted-foreground">Succeeded payments</p>
                <p className="font-semibold text-foreground">214</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-muted-foreground">Available balance</p>
                <p className="font-semibold text-foreground">8,104.90 {sampleCurrency}</p>
              </div>
            </div>
          </div>
        )}

        {previewTab === "api_keys" && (
          <div className="rounded-2xl border border-border bg-white p-4">
            <p className="text-sm font-semibold text-foreground">API Keys Panel</p>
            <div className="mt-3 space-y-2">
              <div className="rounded-xl border border-border p-3 text-sm">
                <p className="font-semibold text-foreground">Primary live key</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">opk_live_xxxxxxxxx</p>
                <p className="text-xs text-muted-foreground">Secret ending: ****92f4</p>
              </div>
              <div className="rounded-xl border border-border p-3 text-sm">
                <p className="font-semibold text-foreground">QA sandbox key</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">opk_sandbox_xxxxxxxxx</p>
                <p className="text-xs text-muted-foreground">Secret ending: ****a1c8</p>
              </div>
            </div>
          </div>
        )}

        {previewTab === "checkout" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-white p-4">
              <p className="text-sm font-semibold text-foreground">Checkout Links Panel</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">{sampleCheckoutLink}</p>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" className="h-8 rounded-lg px-2 text-xs" onClick={() => handleCopy(sampleCheckoutLink, "Checkout link")}>
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  Copy
                </Button>
                <Button variant="outline" className="h-8 rounded-lg px-2 text-xs" onClick={() => window.open(sampleCheckoutLink, "_blank", "noopener,noreferrer")}>
                  Open
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-white p-2">
              <iframe
                src={sampleCheckoutLink}
                title="Merchant checkout preview"
                className="h-[520px] w-full rounded-lg border border-border"
                loading="lazy"
              />
            </div>
          </div>
        )}

        {previewTab === "analytics" && (
          <div className="rounded-2xl border border-border bg-white p-4">
            <p className="text-sm font-semibold text-foreground">Analytics Panel</p>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
              <div className="rounded-xl border border-border p-3">
                <p className="text-muted-foreground">30-day conversion</p>
                <p className="font-semibold text-foreground">68.4%</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-muted-foreground">Refund ratio</p>
                <p className="font-semibold text-foreground">2.1%</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-muted-foreground">Top currency</p>
                <p className="font-semibold text-foreground">USD</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-muted-foreground">Unique customers</p>
                <p className="font-semibold text-foreground">173</p>
              </div>
            </div>
          </div>
        )}

        {previewTab === "actual" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-white p-4">
              <p className="text-sm font-semibold text-foreground">Actual Merchant Portal</p>
              <p className="mt-1 text-xs text-muted-foreground">Open the live merchant interface at <code>/merchant-onboarding</code>.</p>
              <div className="mt-3 flex gap-2">
                <Button className="h-9 rounded-lg bg-paypal-blue text-white hover:bg-[#004dc5]" onClick={() => navigate("/merchant-onboarding")}>
                  Open Merchant Portal
                </Button>
                <Button variant="outline" className="h-9 rounded-lg" onClick={() => window.open("/merchant-onboarding", "_blank", "noopener,noreferrer")}>
                  Open in New Tab
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-white p-4">
              <p className="text-sm font-semibold text-foreground">Embed Snippet</p>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100"><code>{samplePortalEmbed}</code></pre>
            </div>
            <div className="rounded-xl border border-border bg-white p-2">
              <iframe
                src="/merchant-onboarding"
                title="OpenPay merchant portal actual preview"
                className="h-[720px] w-full rounded-lg border border-border"
                loading="lazy"
              />
            </div>
          </div>
        )}
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-5">
        <div className="mb-3 flex items-center gap-2">
          <Server className="h-4 w-4 text-paypal-blue" />
          <h2 className="font-semibold text-foreground">Merchant Portal RPC Endpoints</h2>
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
                <td className="py-2 pr-3 font-mono text-xs">upsert_my_merchant_profile</td>
                <td className="py-2 pr-3">Save merchant profile and default settings</td>
                <td className="py-2">merchant name, username, logo, defaults</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 font-mono text-xs">create_my_merchant_api_key</td>
                <td className="py-2 pr-3">Generate new key in sandbox/live mode</td>
                <td className="py-2">`p_mode`, `p_key_name`</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 font-mono text-xs">revoke_my_merchant_api_key</td>
                <td className="py-2 pr-3">Disable compromised key</td>
                <td className="py-2">`p_key_id`</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 font-mono text-xs">create_merchant_checkout_session</td>
                <td className="py-2 pr-3">Create hosted checkout session</td>
                <td className="py-2">secret key, mode, currency, items</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 font-mono text-xs">get_my_merchant_analytics</td>
                <td className="py-2 pr-3">Load performance metrics</td>
                <td className="py-2">`p_mode`, `p_days`</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 font-mono text-xs">get_my_merchant_balance_overview</td>
                <td className="py-2 pr-3">Load available and transferred balances</td>
                <td className="py-2">`p_mode`</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 font-mono text-xs">transfer_my_merchant_balance</td>
                <td className="py-2 pr-3">Move merchant funds to wallet/savings</td>
                <td className="py-2">`p_mode`, `p_destination`, `p_amount`</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <Snippet title="Create Merchant API Key (cURL)" code={snippets.createApiKey} />
        <Snippet title="Create Merchant Checkout Session (cURL)" code={snippets.createCheckoutSession} />
        <Snippet title="Get Merchant Analytics (cURL)" code={snippets.analytics} />
        <Snippet title="Transfer Merchant Balance (cURL)" code={snippets.transferBalance} />
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-5">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-paypal-blue" />
          <h2 className="font-semibold text-foreground">Security Notes</h2>
        </div>
        <div className="grid gap-2 text-sm text-muted-foreground">
          <p>1. Keep <code>osk_*</code> keys server-side only and rotate keys periodically.</p>
          <p>2. Separate sandbox and live credentials and data handling.</p>
          <p>3. Revoke any exposed key immediately from API keys panel.</p>
          <p>4. Verify checkout totals before sharing links externally.</p>
        </div>
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-5">
        <div className="mb-3 flex items-center gap-2">
          <Store className="h-4 w-4 text-paypal-blue" />
          <h2 className="font-semibold text-foreground">Related Routes</h2>
        </div>
        <div className="grid gap-2 text-sm text-muted-foreground">
          <p><span className="font-semibold text-foreground">Merchant portal:</span> <code>/merchant-onboarding</code></p>
          <p><span className="font-semibold text-foreground">Checkout page:</span> <code>/merchant-checkout?session={"{opsess_token}"}</code></p>
          <p><span className="font-semibold text-foreground">Checkout thank-you:</span> <code>/merchant-checkout/thank-you</code></p>
        </div>
      </div>

      <BottomNav active="menu" />
    </div>
  );
};

export default OpenPayMerchantPortalDocsPage;
