import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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

  const handleProceed = () => {
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
    </div>
  );
};

export default TopUpProviderPage;
