import { useState, useEffect } from "react";
import { X, Cookie, Shield, BarChart3, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  loadCookieConsent,
  saveCookieConsent,
  hasAcceptedCookies,
  type CookieConsentOptions,
} from "@/lib/userPreferencesStorage";

interface CookieConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CookieConsentDialog = ({ open, onOpenChange }: CookieConsentDialogProps) => {
  const [consent, setConsent] = useState<CookieConsentOptions>({
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
  });
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (open) {
      setConsent(loadCookieConsent());
    }
  }, [open]);

  const handleAcceptAll = () => {
    const allAccepted = {
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true,
    };
    setConsent(allAccepted);
    saveCookieConsent(allAccepted);
    onOpenChange(false);
  };

  const handleAcceptSelected = () => {
    saveCookieConsent(consent);
    onOpenChange(false);
  };

  const handleRejectAll = () => {
    const minimalConsent = {
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
    };
    setConsent(minimalConsent);
    saveCookieConsent(minimalConsent);
    onOpenChange(false);
  };

  const updateConsentOption = (key: keyof CookieConsentOptions, value: boolean) => {
    setConsent(prev => ({ ...prev, [key]: value }));
  };

  const cookieCategories = [
    {
      key: 'necessary' as keyof CookieConsentOptions,
      title: 'Essential Cookies',
      description: 'Required for the app to function properly, including security and authentication.',
      icon: Shield,
      required: true,
    },
    {
      key: 'functional' as keyof CookieConsentOptions,
      title: 'Functional Cookies',
      description: 'Enable personalized features like themes, language preferences, and remember your settings.',
      icon: Cookie,
      required: false,
    },
    {
      key: 'analytics' as keyof CookieConsentOptions,
      title: 'Analytics Cookies',
      description: 'Help us improve the app by collecting anonymous usage data.',
      icon: BarChart3,
      required: false,
    },
    {
      key: 'marketing' as keyof CookieConsentOptions,
      title: 'Marketing Cookies',
      description: 'Allow us to show personalized promotions and relevant content.',
      icon: Megaphone,
      required: false,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <Cookie className="h-6 w-6 text-paypal-blue" />
            <DialogTitle className="text-xl font-bold">Cookie Preferences</DialogTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 rounded-full p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <DialogDescription className="text-base text-muted-foreground mb-6">
          We use cookies and similar technologies to enhance your experience, analyze usage, and provide personalized content. 
          You can choose which types of cookies to allow. Essential cookies are always required for the app to function.
        </DialogDescription>

        <div className="space-y-4">
          {cookieCategories.map((category) => {
            const Icon = category.icon;
            const isChecked = consent[category.key];
            const isDisabled = category.required;

            return (
              <div
                key={category.key}
                className="flex items-start gap-4 rounded-2xl border border-border p-4 transition-colors hover:bg-secondary/50"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-paypal-blue/10">
                  <Icon className="h-5 w-5 text-paypal-blue" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-foreground">{category.title}</h3>
                    <div className="flex items-center gap-2">
                      {category.required && (
                        <span className="text-xs font-medium text-paypal-blue">Required</span>
                      )}
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isDisabled}
                        onChange={(e) => updateConsentOption(category.key, e.target.checked)}
                        className="h-4 w-4 rounded border-border text-paypal-blue focus:ring-paypal-blue focus:ring-offset-0"
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {showDetails && (
          <div className="mt-6 rounded-2xl border border-border p-4">
            <h3 className="mb-3 font-semibold text-foreground">What these cookies do:</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <strong>Essential:</strong> Security, authentication, and core functionality
              </div>
              <div>
                <strong>Functional:</strong> Remember your preferences (theme, language, PIN setup status)
              </div>
              <div>
                <strong>Analytics:</strong> Anonymous usage statistics and performance improvements
              </div>
              <div>
                <strong>Marketing:</strong> Personalized promotions and relevant content
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full sm:w-auto"
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </Button>
          
          <div className="flex flex-1 gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={handleRejectAll}
              className="w-full sm:w-auto"
            >
              Reject All
            </Button>
            <Button
              variant="outline"
              onClick={handleAcceptSelected}
              className="w-full sm:w-auto"
            >
              Accept Selected
            </Button>
            <Button
              onClick={handleAcceptAll}
              className="w-full sm:w-auto bg-paypal-blue text-white hover:bg-[#004dc5]"
            >
              Accept All
            </Button>
          </div>
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          You can change these preferences anytime in Settings. Learn more in our Privacy Policy.
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CookieConsentDialog;
