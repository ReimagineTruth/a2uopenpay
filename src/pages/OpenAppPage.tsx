import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const OPENAPP_URL = "https://openapp7296.pinet.com/";

const OpenAppPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-10">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/menu")}
            className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-paypal-dark">OpenApp Utility Apps</h1>
        </div>
        <Button
          onClick={() => window.open(OPENAPP_URL, '_blank')}
          className="bg-paypal-blue hover:bg-[#004dc5] text-white font-semibold px-4 py-2"
        >
          Open OpenApp
          <ExternalLink className="h-4 w-4 ml-2" />
        </Button>
      </div>

      <div className="rounded-3xl border border-white/30 bg-gradient-to-br from-paypal-blue to-[#0073e6] p-5 text-white shadow-xl shadow-[#004bba]/20">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 overflow-hidden">
            <img 
              src="https://i.ibb.co/JwH255BZ/photo-2026-02-27-14-47-30.jpg" 
              alt="OpenApp" 
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <p className="text-base font-bold uppercase tracking-wide">OpenPay + OpenApp</p>
            <p className="mt-1 text-sm text-white/80">Utility Wallet Integration</p>
          </div>
        </div>
        <p className="mt-3 text-base text-white/90">
          OpenPay works as a utility wallet across OpenApp so users can spend, receive earnings from Pioneers, and accept
          payments in one simple flow.
        </p>
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-5 space-y-4 text-base text-foreground">
        <p className="font-bold text-lg text-paypal-dark">What this means for users and merchants</p>
        <p className="leading-relaxed">1. OpenPay can be used for utility-app checkout scenarios supported by OpenApp projects.</p>
        <p className="leading-relaxed">2. Merchants can share checkout links and receive payments faster inside OpenPay flows.</p>
        <p className="leading-relaxed">3. Users can complete payment with transparent records and simple confirmation steps.</p>
        <p className="leading-relaxed">4. OpenPay can be used as a utility wallet across OpenApp to receive Pioneer earnings and other payment scenarios.</p>
        <p className="leading-relaxed">5. OpenPay provides a stable payment experience with support for 170+ currencies for conversion and display.</p>
        <p className="leading-relaxed">6. OpenPay works for physical, digital, online, and hybrid payment experiences powered by Pi Network.</p>

        <div className="rounded-2xl border border-border/70 bg-secondary/40 p-4">
          <p className="font-bold text-lg text-paypal-dark">OpenPay utility wallet statement</p>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            OpenPay is a pure Pi-powered wallet for the OpenApp ecosystem. You can use it to receive earnings, get paid by
            Pioneers, and handle merchant checkout in real-world scenarios. OpenPay is built for stable day-to-day use and
            supports physical, digital, and online payments.
          </p>
        </div>
      </div>
    </div>
  );
};

export default OpenAppPage;
