import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const COINGECKO_PI_URL = "https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=usd";

const fetchCoinGeckoPiPrice = async (): Promise<number | null> => {
  const response = await fetch(COINGECKO_PI_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; OpenPayBot/1.0; +https://openpay)",
    },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { "pi-network"?: { usd?: number | string } };
  const parsed = Number(payload?.["pi-network"]?.usd ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const cgPrice = await fetchCoinGeckoPiPrice();
    if (!cgPrice) {
      return jsonResponse(
        { success: false, error: "Unable to fetch PI price from CoinGecko" },
        502
      );
    }

    return jsonResponse({
      success: true,
      source: "https://www.coingecko.com/en/coins/pi-network",
      pair: "PI/USD",
      price_usd: cgPrice,
      fetched_at: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ success: false, error: message }, 500);
  }
});
