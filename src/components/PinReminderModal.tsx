import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BrandLogo from "@/components/BrandLogo";

interface PinReminderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProceed: () => Promise<void> | void;
}

const PinReminderModal = ({ open, onOpenChange, onProceed }: PinReminderModalProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogTitle className="text-xl font-bold text-foreground">Enhance Security with PIN</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Set an OpenPay PIN to approve transactions securely. You can proceed now without a PIN, but we strongly recommend enabling it.
        </DialogDescription>
        <div className="mt-3 rounded-2xl border border-border p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-paypal-blue/10">
              <BrandLogo className="h-5 w-5 text-paypal-blue" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">OpenPay PIN</p>
              <p className="text-xs text-muted-foreground">Create a 4–8 digit PIN in Settings to confirm payments.</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-2xl"
            onClick={() => navigate("/settings")}
          >
            <Settings className="mr-2 h-4 w-4" />
            Open Settings
          </Button>
          <Button
            className="h-11 flex-1 rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
            onClick={async () => {
              await onProceed();
              onOpenChange(false);
            }}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Proceed Without PIN
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PinReminderModal;
