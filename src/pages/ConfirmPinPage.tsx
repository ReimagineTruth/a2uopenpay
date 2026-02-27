import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { X, HelpCircle, ArrowLeft, Check, Delete, ShieldCheck, Keyboard, Fingerprint } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hashSecret, loadAppSecuritySettings, saveAppSecuritySettings, markPinSetupCompleted } from "@/lib/appSecurity";
import { upsertUserPreferences } from "@/lib/userPreferences";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const ConfirmPinPage = () => {
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Get return path and state from navigation
  const returnTo = (location.state as any)?.returnTo || "/dashboard";
  const actionData = (location.state as any)?.actionData || null;
  const title = (location.state as any)?.title || "Confirm your OpenPay PIN";

  useEffect(() => {
    const checkPinSet = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/signin");
        return;
      }
      const settings = loadAppSecuritySettings(user.id);
      if (!settings?.pinHash) {
        // If no PIN is set, user needs to set one up first
        // Don't navigate back - let user enter their PIN
        return;
      }
    };
    checkPinSet();
  }, [navigate, returnTo, actionData]);

  const handleNumberPress = (val: string) => {
    if (pin.length >= 8) return;
    setPin((prev) => prev + val);
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const verifyPin = async () => {
    if (pin.length < 4) {
      toast.error("PIN must be at least 4 digits");
      return;
    }

    setIsVerifying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      const settings = loadAppSecuritySettings(user.id);
      const hashed = await hashSecret(pin);
      
      if (!settings?.pinHash) {
        // PIN setup: User is setting up PIN for first time
        const updated = { ...settings, pinHash: hashed };
        saveAppSecuritySettings(user.id, updated);
        upsertUserPreferences(user.id, { security_settings: updated }).catch(() => undefined);
        markPinSetupCompleted(user.id);
        toast.success("PIN setup completed! Your account is now protected.");
        navigate(returnTo, { state: { pinVerified: true, actionData }, replace: true });
      } else if (hashed === settings.pinHash) {
        // PIN verification: User is verifying existing PIN
        toast.success("PIN verified successfully!");
        navigate(returnTo, { state: { pinVerified: true, actionData }, replace: true });
      } else {
        toast.error("Incorrect PIN. Please try again.");
        setPin("");
      }
    } catch (error) {
      toast.error("An error occurred during verification.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-paypal-blue">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 text-white">
        <button 
          onClick={() => navigate(returnTo, { replace: true })}
          className="hover:opacity-70 transition-opacity"
        >
          <ArrowLeft className="h-7 w-7" />
        </button>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              console.log('Question mark clicked - showing instructions');
              setShowInstructions(true);
            }}
            className="hover:opacity-70 active:scale-90 transition-all bg-white/10 p-2 rounded-full"
            title="PIN Instructions"
            aria-label="Show PIN instructions"
          >
            <HelpCircle className="h-7 w-7" />
          </button>
          <button 
            onClick={() => navigate(returnTo, { replace: true })}
            className="hover:opacity-70 active:scale-90 transition-all"
          >
            <X className="h-7 w-7" />
          </button>
        </div>
      </div>

      {/* PIN Display Area */}
      <div className="flex flex-1 flex-col items-center justify-start pt-12 text-white">
        <h2 className="text-2xl font-bold">{title}</h2>
        
        <div className="mt-12 flex justify-center gap-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
            <div
              key={index}
              className={`h-4 w-4 rounded-full transition-all duration-200 ${
                pin.length > index 
                  ? "bg-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.5)]" 
                  : "bg-white/30"
              }`}
            />
          ))}
        </div>
        <p className="mt-6 text-sm text-white/80">Enter your 4-8 digit PIN</p>
      </div>

      {/* Number Pad Area */}
      <div className="px-12 pb-16 text-white">
        <div className="grid grid-cols-3 gap-y-8 text-center">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleNumberPress(num.toString())}
              className="flex h-20 items-center justify-center text-3xl font-semibold active:bg-white/10 rounded-full transition-colors"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleBackspace}
            className="flex h-20 items-center justify-center active:bg-white/10 rounded-full transition-colors"
          >
            <Delete className="h-8 w-8" />
          </button>
          <button
            onClick={() => handleNumberPress("0")}
            className="flex h-20 items-center justify-center text-3xl font-semibold active:bg-white/10 rounded-full transition-colors"
          >
            0
          </button>
          <button
            onClick={verifyPin}
            disabled={isVerifying || pin.length < 4}
            className={`flex h-20 items-center justify-center rounded-full transition-all ${
              pin.length >= 4 
                ? "bg-white text-paypal-blue shadow-lg active:scale-95 shadow-black/20" 
                : "text-white/30"
            }`}
          >
            <Check className="h-10 w-10" />
          </button>
        </div>
      </div>

      <Dialog open={showInstructions} onOpenChange={(open) => {
        console.log('Instructions modal open:', open);
        setShowInstructions(open);
      }}>
        <DialogContent className="rounded-3xl border-none bg-white p-6 sm:max-w-md z-[200]">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-paypal-blue/10">
              <ShieldCheck className="h-8 w-8 text-paypal-blue" />
            </div>
            <DialogTitle className="text-center text-xl font-bold text-gray-900">How to Confirm your PIN</DialogTitle>
            <DialogDescription className="text-center text-gray-500">
              Follow these steps to securely authorize your transaction.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-6">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-600">
                <Keyboard className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">1. Enter your PIN</p>
                <p className="text-sm text-gray-500">Use the number pad to type your secret 4 to 8 digit PIN. The white dots will fill up as you enter each digit.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-600">
                <Check className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">2. Tap to Confirm</p>
                <p className="text-sm text-gray-500">After entering your complete PIN, tap the green checkmark (✓) button at the bottom right to authorize the transaction.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-600">
                <Delete className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">3. Correction</p>
                <p className="text-sm text-gray-500">Made a mistake? Use the backspace button at the bottom left to clear the last digit you entered.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-600">
                <Fingerprint className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">Security Note</p>
                <p className="text-sm text-gray-500 mb-2">Never share your PIN with anyone. OpenPay staff will never ask for your PIN.</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 rounded-lg text-xs font-medium border-paypal-blue/30 text-paypal-blue hover:bg-paypal-blue/5"
                  onClick={() => navigate("/settings")}
                >
                  Manage PIN in Settings
                </Button>
              </div>
            </div>
          </div>

          <Button 
            onClick={() => {
              console.log('Closing instructions modal');
              setShowInstructions(false);
            }}
            className="mt-8 h-12 w-full rounded-2xl bg-paypal-blue text-base font-bold text-white hover:bg-paypal-blue/90"
          >
            Got it, thanks!
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConfirmPinPage;
