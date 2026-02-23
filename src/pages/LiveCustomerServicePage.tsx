import { useNavigate } from "react-router-dom";
import { ArrowLeft, CircleHelp, FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const LiveCustomerServicePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-8">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-6 w-6 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Live Customer Service</h1>
      </div>

      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Need help with top up, payment status, or account concerns?</p>
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Online</Badge>
        </div>

        <div className="mt-5 space-y-2 rounded-2xl border border-border p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CircleHelp className="h-4 w-4 text-paypal-blue" />
            Support options
          </p>
          <p className="text-sm text-muted-foreground">
            Start with Help Center to send a support ticket. Include your OpenPay account details and payment proof for faster handling.
          </p>
          <Button
            type="button"
            className="mt-2 h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
            onClick={() => navigate("/help-center?topic=live-customer-service")}
          >
            Open Help Center
          </Button>
        </div>

        <div className="mt-3 space-y-2 rounded-2xl border border-border p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileText className="h-4 w-4 text-paypal-blue" />
            Compliance and license
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-2xl"
            onClick={() => navigate("/legal")}
          >
            View OpenPay License
          </Button>
        </div>

        <div className="mt-3 rounded-2xl border border-paypal-light-blue/40 bg-paypal-light-blue/10 p-4 text-xs text-muted-foreground">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-paypal-blue" />
            Safety reminder
          </p>
          <p className="mt-1">
            Never share OTP, PIN, or wallet private keys with anyone. OpenPay support will not ask for your secret credentials.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LiveCustomerServicePage;
