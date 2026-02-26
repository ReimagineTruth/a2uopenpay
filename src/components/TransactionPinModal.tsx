import { useState, useEffect } from "react";
import { X, HelpCircle, ArrowLeft, Check, Delete } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hashSecret, loadAppSecuritySettings } from "@/lib/appSecurity";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface TransactionPinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  title?: string;
}

const TransactionPinModal = ({ open, onOpenChange, onSuccess, title = "Confirm your Cash PIN" }: TransactionPinModalProps) => {
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (open) {
      setPin("");
      setIsVerifying(false);
    }
  }, [open]);

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
      
      if (hashed === settings.pinHash) {
        onSuccess();
        onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden rounded-3xl border-none h-[90vh] sm:h-auto">
        <div className="flex flex-col bg-white h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6">
            <button 
              onClick={() => onOpenChange(false)}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-7 w-7" />
            </button>
            <div className="flex items-center gap-4">
              <button className="text-gray-600 hover:text-gray-900">
                <HelpCircle className="h-7 w-7" />
              </button>
              <button 
                onClick={() => onOpenChange(false)}
                className="text-gray-600 hover:text-gray-900"
              >
                <X className="h-7 w-7" />
              </button>
            </div>
          </div>

          {/* PIN Display Area */}
          <div className="flex flex-col items-center justify-start pt-12 pb-8">
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            
            {/* Dots representation - we show 8 dots max, and color them as they type */}
            <div className="mt-12 flex justify-center gap-3">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
                <div
                  key={index}
                  className={`h-4 w-4 rounded-full transition-all duration-200 ${
                    pin.length > index 
                      ? "bg-paypal-blue scale-110" 
                      : "bg-gray-200"
                  }`}
                />
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Enter your 4-8 digit PIN</p>
          </div>

          {/* Number Pad Area */}
          <div className="px-12 pb-16 mt-auto sm:mt-0">
            <div className="grid grid-cols-3 gap-y-6 text-center">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handleNumberPress(num.toString())}
                  className="flex h-20 items-center justify-center text-3xl font-semibold text-gray-900 active:bg-gray-100 rounded-full transition-colors"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={handleBackspace}
                className="flex h-20 items-center justify-center text-gray-900 active:bg-gray-100 rounded-full transition-colors"
              >
                <Delete className="h-8 w-8" />
              </button>
              <button
                onClick={() => handleNumberPress("0")}
                className="flex h-20 items-center justify-center text-3xl font-semibold text-gray-900 active:bg-gray-100 rounded-full transition-colors"
              >
                0
              </button>
              <button
                onClick={verifyPin}
                disabled={isVerifying || pin.length < 4}
                className={`flex h-20 items-center justify-center rounded-full transition-all ${
                  pin.length >= 4 
                    ? "bg-paypal-blue text-white shadow-lg active:scale-95" 
                    : "text-gray-300"
                }`}
              >
                <Check className="h-10 w-10" />
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionPinModal;
