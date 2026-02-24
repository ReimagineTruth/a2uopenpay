import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { Send, ArrowLeftRight, CircleDollarSign, FileText, Wallet, Activity, HelpCircle, Info, Scale, LogOut, Clapperboard, ShieldAlert, FileCheck, Lock, Users, Store, BookOpen, Download, Megaphone, Smartphone, CreditCard, ShieldCheck, Handshake, Monitor, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { clearAllAppSecurityUnlocks } from "@/lib/appSecurity";
import { canAccessRemittanceMerchant, isRemittanceUiEnabled } from "@/lib/remittanceAccess";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import BrandLogo from "@/components/BrandLogo";
import { QRCodeSVG } from "qrcode.react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const MenuPage = () => {
  const OPENPAY_APK_URL = "https://mega.nz/file/pFsECZjD#Lwdlo7tjgprWpU-N7UzKOy_aolGk5t4pgzHXA4VLm7M";
  const OPENPAY_DESKTOP_EXE_URL = String(import.meta.env.VITE_OPENPAY_DESKTOP_EXE_URL || "").trim();
  const navigate = useNavigate();
  const remittanceUiEnabled = isRemittanceUiEnabled();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [showApkModal, setShowApkModal] = useState(false);
  const [welcomeClaimedAt, setWelcomeClaimedAt] = useState<string | null>(null);
  const [claimingWelcome, setClaimingWelcome] = useState(false);
  const [hasRemittanceAccess, setHasRemittanceAccess] = useState(false);
  const [canOpenAdminDashboard, setCanOpenAdminDashboard] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    const loadWelcomeStatus = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();
      const normalizedUsername = String(profile?.username || "")
        .trim()
        .toLowerCase()
        .replace(/^@/, "");
      setCanOpenAdminDashboard(normalizedUsername === "openpay" || normalizedUsername === "wainfoundation");
      if (remittanceUiEnabled) {
        setHasRemittanceAccess(canAccessRemittanceMerchant(user.id, profile?.username || null));
      }

      const { data: wallet } = await supabase
        .from("wallets")
        .select("welcome_bonus_claimed_at")
        .eq("user_id", user.id)
        .single();
      setWelcomeClaimedAt(wallet?.welcome_bonus_claimed_at || null);
    };
    loadWelcomeStatus();
  }, [remittanceUiEnabled]);

  const handleInstall = async () => {
    if (!installPrompt) {
      window.open(OPENPAY_APK_URL, "_blank", "noopener,noreferrer");
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setCanInstall(choice.outcome === "accepted" ? false : true);
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
      return;
    }
    window.open(OPENPAY_APK_URL, "_blank", "noopener,noreferrer");
  };

  const handleDesktopExe = () => {
    if (!OPENPAY_DESKTOP_EXE_URL) {
      toast.message("OpenPay Desktop EXE coming soon");
      return;
    }
    window.open(OPENPAY_DESKTOP_EXE_URL, "_blank", "noopener,noreferrer");
  };

  const handleOpenApkModal = () => {
    setShowApkModal(true);
  };

  const handleDownloadApk = () => {
    window.open(OPENPAY_APK_URL, "_blank", "noopener,noreferrer");
  };

  const handleCopyApkLink = async () => {
    try {
      await navigator.clipboard.writeText(OPENPAY_APK_URL);
      toast.success("APK link copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleCopyMegaKey = async () => {
    const megaKey = "Lwdlo7tjgprWpU-N7UzKOy_aolGk5t4pgzHXA4VLm7M";
    try {
      await navigator.clipboard.writeText(megaKey);
      toast.success("Mega key copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleLogout = async () => {
    clearAllAppSecurityUnlocks();
    await supabase.auth.signOut();
    toast.success("Logged out");
    navigate("/auth");
  };

  const handleClaimWelcome = async () => {
    setClaimingWelcome(true);
    const { data, error } = await supabase.rpc("claim_welcome_bonus");
    setClaimingWelcome(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const claimed = (data as { claimed?: boolean } | null)?.claimed;
    if (claimed) {
      toast.success("Welcome bonus claimed");
    } else {
      toast.message("Welcome bonus already claimed");
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: wallet } = await supabase
      .from("wallets")
      .select("welcome_bonus_claimed_at")
      .eq("user_id", user.id)
      .single();
    setWelcomeClaimedAt(wallet?.welcome_bonus_claimed_at || null);
  };

  const sections = [
    {
      title: "Transactions",
      items: [
        { icon: Send, label: "Express Send", action: () => navigate("/send") },
        { icon: ArrowLeftRight, label: "Transfer balance", action: () => navigate("/topup") },
        { icon: ArrowLeftRight, label: "Swap Withdrawal", action: () => navigate("/swap-withdrawal") },
        { icon: CircleDollarSign, label: "Request payment", action: () => navigate("/request-payment") },
        { icon: FileText, label: "Send invoice", action: () => navigate("/send-invoice") },
      ],
    },
    {
      title: "Wallet and Account",
      items: [
        { icon: Wallet, label: "Wallet", action: () => navigate("/dashboard") },
        { icon: Users, label: "User profile", action: () => navigate("/profile") },
        { icon: CreditCard, label: "OpenPay Virtual Card", action: () => navigate("/virtual-card") },
        { icon: ArrowLeftRight, label: "Currency converter", action: () => navigate("/currency-converter") },
      ],
    },
    {
      title: "Merchant",
      items: [
        { icon: Store, label: "Merchant Portal", action: () => navigate("/merchant-onboarding") },
        { icon: Store, label: "Product Catalog", action: () => navigate("/merchant-products") },
        { icon: Store, label: "Merchant POS", action: () => navigate("/merchant-pos") },
        { icon: FileText, label: "Payment Link Creator", action: () => navigate("/payment-links/create") },
        ...(remittanceUiEnabled
          ? [{
              icon: Store,
              label: hasRemittanceAccess ? "Remittance merchant center" : "Remittance merchant center (Coming soon)",
              action: () => {
                if (hasRemittanceAccess) {
                  navigate("/remittance-merchant");
                  return;
                }
                toast.message("Coming soon");
              },
              disabled: !hasRemittanceAccess,
              subtitle: hasRemittanceAccess ? "Developer access enabled" : "Under development",
            }]
          : []),
      ],
    },
    {
      title: "Activity and Records",
      items: [
        { icon: Activity, label: "Activity", action: () => navigate("/activity") },
        { icon: BookOpen, label: "OpenLedger", action: () => navigate("/ledger") },
      ],
    },
    {
      title: "Earning and Bonus",
      items: [
        { icon: Clapperboard, label: "Pi Ad Network", action: () => navigate("/pi-ads") },
        {
          icon: CircleDollarSign,
          label: welcomeClaimedAt ? "Welcome bonus claimed" : "Claim $1 welcome bonus",
          action: () => handleClaimWelcome(),
          disabled: Boolean(welcomeClaimedAt) || claimingWelcome,
          subtitle: welcomeClaimedAt ? "Already redeemed" : "One-time reward",
        },
      ],
    },
    {
      title: "Support",
      items: [
        { icon: ShieldAlert, label: "Disputes", action: () => navigate("/disputes") },
        { icon: HelpCircle, label: "Help Center", action: () => navigate("/help-center") },
        { icon: Megaphone, label: "Announcements", action: () => navigate("/announcements") },
        { icon: Smartphone, label: "OpenPay Official Page", action: () => navigate("/openpay-official") },
        { icon: Store, label: "Where to use OpenPay", action: () => navigate("/openpay-guide") },
        { icon: Handshake, label: "Open Partner", action: () => navigate("/open-partner") },
      ],
    },
    {
      title: "Legal and Docs",
      items: [
        { icon: BookOpen, label: "OpenPay Documentation", action: () => navigate("/openpay-documentation") },
        { icon: FileText, label: "Pi Whitepaper", action: () => navigate("/pi-whitepaper") },
        { icon: FileText, label: "Pi MiCA Whitepaper", action: () => navigate("/pi-mica-whitepaper") },
        { icon: ShieldCheck, label: "GDPR", action: () => navigate("/gdpr") },
        { icon: Info, label: "About OpenPay", action: () => navigate("/about-openpay") },
        { icon: FileCheck, label: "Terms", action: () => navigate("/terms") },
        { icon: Lock, label: "Privacy", action: () => navigate("/privacy") },
        { icon: Scale, label: "Legal", action: () => navigate("/legal") },
      ],
    },
    {
      title: "API Docs",
      items: [
        { icon: BookOpen, label: "OpenPay API Docs", action: () => navigate("/openpay-api-docs") },
        { icon: BookOpen, label: "OpenPay POS Docs", action: () => navigate("/openpay-pos-docs") },
        { icon: BookOpen, label: "OpenPay Merchant Portal Docs", action: () => navigate("/openpay-merchant-portal-docs") },
      ],
    },
    ...(canOpenAdminDashboard
      ? [{
          title: "Admin",
          items: [
            { icon: ShieldCheck, label: "Admin Dashboard", action: () => navigate("/admin-dashboard") },
            { icon: ShieldCheck, label: "Swap Withdrawals", action: () => navigate("/admin-swap-withrawals") },
            { icon: ShieldCheck, label: "Loan Applications", action: () => navigate("/admin-loan-applications") },
            { icon: ShieldCheck, label: "Top Up Requests", action: () => navigate("/admin-topup-requests") },
          ],
        }]
      : []),
    {
      title: "Utility App",
      items: [
        { icon: Smartphone, label: "OpenApp Utility Apps", action: () => navigate("/openapp") },
      ],
    },
    {
      title: "Install OpenPay",
      items: [
        {
          icon: Monitor,
          label: "Pi Browser",
          action: () => navigate("/openpay-desktop"),
          subtitle: "Pi Browser sign-in",
        },
        {
          icon: Monitor,
          label: "OpenPay Desktop EXE",
          action: () => handleDesktopExe(),
          subtitle: OPENPAY_DESKTOP_EXE_URL ? "Desktop browser app" : "Coming soon",
        },
        {
          icon: Download,
          label: canInstall ? "Install OpenPay" : "Install OpenPay APK",
          action: () => handleOpenApkModal(),
          subtitle: "Android phone & tablet APK",
        },
        {
          icon: Smartphone,
          label: "OpenPay App Tablet",
          action: () => handleOpenApkModal(),
          subtitle: "Android tablets APK",
        },
        {
          icon: Smartphone,
          label: "OpenPay App for iOS",
          action: () => toast.message("Coming soon"),
          subtitle: "Coming soon",
          disabled: true,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 pt-6">
        <h1 className="paypal-heading mb-5">Menu</h1>
        {sections.map((section) => (
          <div key={section.title} className="mb-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</h2>
            <div className="paypal-surface overflow-hidden rounded-2xl">
            {section.items.map(({ icon: Icon, label, action, subtitle, disabled }) => (
              <button
                key={label}
                onClick={action}
                className={`flex w-full items-center gap-4 border-b border-border/60 px-3 py-3.5 text-left last:border-b-0 transition ${
                  disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-secondary/60"
                }`}
                disabled={disabled}
              >
                <Icon className="h-5 w-5 text-paypal-blue" />
                <div>
                  <span className="text-foreground font-medium">{label}</span>
                  {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
                </div>
              </button>
            ))}
            </div>
          </div>
        ))}

        <button
          onClick={handleLogout}
          className="paypal-surface w-full flex items-center gap-4 rounded-2xl px-3 py-3.5 transition hover:bg-red-50 text-destructive"
        >
          <LogOut className="h-5 w-5" />
          <span className="font-medium">Log Out</span>
        </button>
      </div>

      <BottomNav active="menu" />

      <Dialog open={showApkModal} onOpenChange={setShowApkModal}>
        <DialogContent className="rounded-3xl p-0 sm:max-w-2xl [&>button]:hidden">
          <div className="relative bg-white px-6 py-6 text-foreground">
            <button
              type="button"
              onClick={() => setShowApkModal(false)}
              className="absolute right-4 top-4 rounded-full p-1 text-foreground/70 hover:bg-black/5"
              aria-label="Close APK modal"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mx-auto flex max-w-md flex-col items-center text-center">
              <BrandLogo className="h-16 w-16 rounded-2xl" />
              <p className="mt-2 text-3xl font-bold">OpenPay</p>
              <p className="mt-6 text-xl text-foreground/85">
                Scan this QR to open OpenPay on your Android phone or tablet, then download and install the APK.
              </p>

              <div className="mt-5 rounded-2xl bg-white p-2">
                <QRCodeSVG
                  value={OPENPAY_APK_URL}
                  size={180}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  includeMargin
                />
              </div>

              <button
                type="button"
                onClick={() => void handleCopyApkLink()}
                className="mt-4 h-12 w-full rounded-xl bg-neutral-200 px-4 text-lg font-semibold hover:bg-neutral-300"
              >
                <span className="inline-flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  Copy download link
                </span>
              </button>

              <button
                type="button"
                onClick={() => void handleCopyMegaKey()}
                className="mt-3 h-12 w-full rounded-xl bg-neutral-200 px-4 text-lg font-semibold hover:bg-neutral-300"
              >
                <span className="inline-flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  If Mega asks key, copy Mega key
                </span>
              </button>

              <button
                type="button"
                onClick={handleDownloadApk}
                className="mt-6 h-12 w-full rounded-xl bg-neutral-200 px-4 text-lg font-semibold hover:bg-neutral-300"
              >
                <span className="inline-flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download Android Phone/Tablet APK
                </span>
              </button>

              <p className="mt-4 text-sm text-foreground/80">
                If download is blocked in Pi Browser, copy the link and open it in another browser on phone or tablet.
              </p>
              {canInstall && (
                <button
                  type="button"
                  onClick={() => void handleInstall()}
                  className="mt-3 h-11 w-full rounded-xl border border-neutral-300 px-4 text-base font-semibold hover:bg-neutral-100"
                >
                  Use browser install prompt
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MenuPage;
