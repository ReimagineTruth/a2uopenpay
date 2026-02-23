import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SplashScreen from "@/components/SplashScreen";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";

const defaultTagsPlaceholder = "Search for relevant skills, tools, and industries";

const sanitizeCode = (name: string) => {
  const base = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!base) return "PRODUCT";
  return base.slice(0, 18);
};

const MerchantProductCreatePage = () => {
  const navigate = useNavigate();
  const { currencies } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [merchantName, setMerchantName] = useState("OpenPay Merchant");

  const [productName, setProductName] = useState("");
  const [productTags, setProductTags] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [checkoutInfo, setCheckoutInfo] = useState("");
  const [paymentType, setPaymentType] = useState<"one_time" | "subscription">("one_time");
  const [amount, setAmount] = useState("0.00");
  const [currency, setCurrency] = useState("USD");
  const [taxCode, setTaxCode] = useState("downloadable_software_personal");
  const [repeatEvery, setRepeatEvery] = useState("1");
  const [repeatUnit, setRepeatUnit] = useState("month");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const boot = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/sign-in?mode=signin");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", user.id)
        .single();
      setMerchantName(profile?.full_name || profile?.username || "OpenPay Merchant");
      if (currencies.length) {
        const defaultCurrency = currencies.find((c) => c.code === "USD")?.code || currencies[0].code;
        setCurrency(defaultCurrency);
      }
      setLoading(false);
    };
    boot();
  }, [currencies, navigate]);

  const previewAmount = useMemo(() => {
    const parsed = Number(amount);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [amount]);

  const handleSave = async (publish: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sign in first");
      navigate("/sign-in?mode=signin");
      return;
    }
    if (!productName.trim()) {
      toast.error("Enter a product name");
      return;
    }
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setSaving(true);
    const productCode = sanitizeCode(productName);
    const tags = productTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const { error } = await supabase.from("merchant_products").insert({
      merchant_user_id: user.id,
      product_code: productCode,
      product_name: productName.trim(),
      product_description: productDescription.trim(),
      unit_amount: parsedAmount,
      currency: currency.toUpperCase(),
      is_active: publish,
      product_tags: tags,
      checkout_info: checkoutInfo.trim(),
      pricing_type: paymentType,
      repeat_every: paymentType === "subscription" ? Number(repeatEvery) || 1 : null,
      repeat_unit: paymentType === "subscription" ? repeatUnit : null,
      tax_code: taxCode,
      published_at: publish ? new Date().toISOString() : null,
    });
    setSaving(false);

    if (error) {
      toast.error(error.message || "Failed to save product");
      return;
    }
    toast.success(publish ? "Product published" : "Product saved as unpublished");
    navigate("/merchant-products");
  };

  if (loading) return <SplashScreen message="Loading product builder..." />;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-white px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-foreground">
            <button onClick={() => navigate("/merchant-products")} className="flex h-9 w-9 items-center justify-center rounded-full border border-border">
              <X className="h-4 w-4" />
            </button>
            <p className="text-sm font-medium">Create product</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-9 rounded-full" disabled={saving} onClick={() => handleSave(false)}>
              Save as unpublished
            </Button>
            <Button className="h-9 rounded-full bg-[#1f2530] text-white hover:bg-[#11151b]" disabled={saving} onClick={() => handleSave(true)}>
              Continue to publish
            </Button>
          </div>
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-64px)] grid-cols-1 gap-6 px-6 py-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="max-h-[calc(100vh-120px)] overflow-y-auto rounded-2xl border border-border bg-white p-6">
          <div className="flex items-center gap-4 text-sm font-semibold text-foreground">
            <span>Details</span>
            <span className="text-muted-foreground">Content</span>
          </div>

          <div className="mt-6 space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Product name</p>
                <span className="text-xs text-muted-foreground">{productName.length}/64</span>
              </div>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Add a product name"
                className="mt-2 h-11 rounded-lg"
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground">Visuals</p>
              <p className="text-xs text-muted-foreground">Include screenshots and videos to show what customers are getting.</p>
              <div className="mt-2 flex h-32 items-center justify-center rounded-xl border border-dashed border-border bg-secondary/20 text-sm text-muted-foreground">
                Drag and drop, or browse
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Add an image or video for your product's featured media.</p>
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground">Product tags</p>
              <Input
                value={productTags}
                onChange={(e) => setProductTags(e.target.value)}
                placeholder={defaultTagsPlaceholder}
                className="mt-2 h-11 rounded-lg"
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground">Product description</p>
              <textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Describe your product's benefits..."
                className="mt-2 h-32 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground">Checkout information</p>
              <p className="text-xs text-muted-foreground">Add details to display on the checkout page.</p>
              <textarea
                value={checkoutInfo}
                onChange={(e) => setCheckoutInfo(e.target.value)}
                placeholder="Add any policies, demo links, or contact details..."
                className="mt-2 h-28 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              <p className="mt-2 text-xs text-muted-foreground">Optional</p>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Payment details</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentType("one_time")}
                    className={`rounded-xl border px-3 py-3 text-left ${paymentType === "one_time" ? "border-foreground" : "border-border"}`}
                  >
                    <p className="text-sm font-semibold">One-time</p>
                    <p className="text-xs text-muted-foreground">Charge a one-time amount</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType("subscription")}
                    className={`rounded-xl border px-3 py-3 text-left ${paymentType === "subscription" ? "border-foreground" : "border-border"}`}
                  >
                    <p className="text-sm font-semibold">Subscription</p>
                    <p className="text-xs text-muted-foreground">Charge an ongoing amount</p>
                  </button>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground">Amount</p>
                <div className="mt-2 grid grid-cols-[1fr_120px] gap-2">
                  <Input value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 rounded-lg" />
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
                  >
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Charge what you want. Enter $0 for free products.</p>
              </div>

              {paymentType === "subscription" && (
                <div>
                  <p className="text-sm font-semibold text-foreground">Repeat payment every</p>
                  <div className="mt-2 grid grid-cols-[120px_1fr] gap-2">
                    <Input value={repeatEvery} onChange={(e) => setRepeatEvery(e.target.value)} className="h-11 rounded-lg" />
                    <select
                      value={repeatUnit}
                      onChange={(e) => setRepeatUnit(e.target.value)}
                      className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
                    >
                      <option value="week">week</option>
                      <option value="month">month</option>
                      <option value="year">year</option>
                    </select>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Customers will be charged every {repeatUnit}.</p>
                </div>
              )}

              <div>
                <p className="text-sm font-semibold text-foreground">Product tax code</p>
                <select
                  value={taxCode}
                  onChange={(e) => setTaxCode(e.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-border bg-white px-3 text-sm"
                >
                  <option value="downloadable_software_personal">Downloadable software - personal use</option>
                  <option value="digital_goods">Digital goods</option>
                  <option value="services">Services</option>
                  <option value="physical_goods">Physical goods</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-6">
          <div className="flex items-center gap-6 text-sm font-semibold text-foreground">
            <span>Product page</span>
            <span className="text-muted-foreground">Checkout</span>
          </div>
          <div className="mt-4 rounded-2xl border border-border bg-secondary/20 p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-secondary" />
              <div>
                <p className="text-sm font-semibold">{productName || "Untitled Product"}</p>
                <p className="text-xs text-muted-foreground">{merchantName}</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-border bg-white p-4 text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Get it for</p>
              <p className="mt-1 text-2xl font-semibold">{currency} {previewAmount.toFixed(2)}{paymentType === "subscription" ? ` / ${repeatUnit}` : ""}</p>
              <Button className="mt-4 w-full rounded-full bg-[#1f2530] text-white hover:bg-[#11151b]">Buy</Button>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">Product created by {merchantName}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MerchantProductCreatePage;
