import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Code, Link2, Plus, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import SplashScreen from "@/components/SplashScreen";
import { supabase } from "@/integrations/supabase/client";

type MerchantProductRow = {
  id: string;
  product_code: string;
  product_name: string;
  product_description: string | null;
  unit_amount: number;
  currency: string;
  is_active: boolean;
  created_at: string;
};

type MerchantProductStats = {
  product_id: string;
  total_sales: number;
  total_revenue: number;
  total_purchases: number;
};

const MerchantProductCatalogPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<MerchantProductRow[]>([]);
  const [statsByProduct, setStatsByProduct] = useState<Record<string, MerchantProductStats>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/sign-in?mode=signin");
        return;
      }

      const { data, error } = await supabase
        .from("merchant_products")
        .select("id, product_code, product_name, product_description, unit_amount, currency, is_active, created_at")
        .eq("merchant_user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error(error.message || "Failed to load products");
        setProducts([]);
      } else {
        setProducts((data || []) as MerchantProductRow[]);
      }

      const { data: statsRows } = await supabase
        .from("merchant_product_stats")
        .select("product_id, total_sales, total_revenue, total_purchases")
        .eq("merchant_user_id", user.id);
      const mapped: Record<string, MerchantProductStats> = {};
      (statsRows || []).forEach((row) => {
        if (!row?.product_id) return;
        mapped[String(row.product_id)] = {
          product_id: String(row.product_id),
          total_sales: Number(row.total_sales || 0),
          total_revenue: Number(row.total_revenue || 0),
          total_purchases: Number(row.total_purchases || 0),
        };
      });
      setStatsByProduct(mapped);

      setLoading(false);
    };

    load();
  }, [navigate]);

  const productCountLabel = useMemo(() => {
    const count = products.length;
    return `${count} product${count === 1 ? "" : "s"}`;
  }, [products.length]);

  if (loading) return <SplashScreen message="Loading product catalog..." />;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Product catalog</h1>
          </div>
          <Button className="h-10 rounded-full bg-paypal-blue text-white hover:bg-[#004dc5]" onClick={() => navigate("/merchant-products/create")}>
            <Plus className="mr-2 h-4 w-4" />
            Create product
          </Button>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3 text-sm text-muted-foreground">{productCountLabel}</div>
          <div className="hidden w-full md:block">
            <div className="grid grid-cols-[160px_1.6fr_120px_140px_150px_150px_140px_180px] gap-2 border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Created</span>
              <span>Title</span>
              <span>Price</span>
              <span>Total sales</span>
              <span>Total revenue</span>
              <span>Total purchases</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {products.length === 0 ? (
              <div className="px-5 py-6 text-sm text-muted-foreground">No products yet.</div>
            ) : (
              products.map((product) => (
                <div key={product.id} className="grid grid-cols-[160px_1.6fr_120px_140px_150px_150px_140px_180px] items-center gap-2 border-b border-border px-5 py-4 text-sm last:border-b-0">
                  <span className="text-muted-foreground">{new Date(product.created_at).toLocaleDateString()}</span>
                  <div>
                    <p className="font-medium text-foreground">{product.product_name}</p>
                    <p className="text-xs text-muted-foreground">{product.product_code}</p>
                  </div>
                  <span className="font-medium text-foreground">{Number(product.unit_amount || 0).toFixed(2)} {product.currency.toUpperCase()}</span>
                  <span className="text-foreground">{statsByProduct[product.id]?.total_sales ?? 0}</span>
                  <span className="text-foreground">{Number(statsByProduct[product.id]?.total_revenue ?? 0).toFixed(2)}</span>
                  <span className="text-foreground">{statsByProduct[product.id]?.total_purchases ?? 0}</span>
                  <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${product.is_active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                    {product.is_active ? "Published" : "Unpublished"}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="h-8 rounded-full px-3 text-xs"
                      onClick={() => navigate(`/payment-links/create?product_id=${encodeURIComponent(product.id)}`)}
                    >
                      <Link2 className="mr-1 h-3.5 w-3.5" />
                      Payment link
                    </Button>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
                      onClick={() => navigate(`/payment-links/create?product_id=${encodeURIComponent(product.id)}&share_tab=direct`)}
                      aria-label="Share link"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
                      onClick={() => navigate(`/payment-links/create?product_id=${encodeURIComponent(product.id)}&share_tab=iframe`)}
                      aria-label="Embed button"
                    >
                      <Code className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="md:hidden">
            {products.length === 0 ? (
              <div className="px-5 py-6 text-sm text-muted-foreground">No products yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {products.map((product) => (
                  <div key={product.id} className="px-5 py-4 text-sm">
                    <p className="font-medium text-foreground">{product.product_name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(product.created_at).toLocaleDateString()} · {product.product_code}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-medium text-foreground">{Number(product.unit_amount || 0).toFixed(2)} {product.currency.toUpperCase()}</span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${product.is_active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                        {product.is_active ? "Published" : "Unpublished"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Sales: {statsByProduct[product.id]?.total_sales ?? 0} · Revenue: {Number(statsByProduct[product.id]?.total_revenue ?? 0).toFixed(2)} · Purchases: {statsByProduct[product.id]?.total_purchases ?? 0}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        className="h-8 rounded-full px-3 text-xs"
                        onClick={() => navigate(`/payment-links/create?product_id=${encodeURIComponent(product.id)}`)}
                      >
                        <Link2 className="mr-1 h-3.5 w-3.5" />
                        Payment link
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 rounded-full px-3 text-xs"
                        onClick={() => navigate(`/payment-links/create?product_id=${encodeURIComponent(product.id)}&share_tab=direct`)}
                      >
                        <Share2 className="mr-1 h-3.5 w-3.5" />
                        Share
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 rounded-full px-3 text-xs"
                        onClick={() => navigate(`/payment-links/create?product_id=${encodeURIComponent(product.id)}&share_tab=iframe`)}
                      >
                        <Code className="mr-1 h-3.5 w-3.5" />
                        Embed
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MerchantProductCatalogPage;
