import { Link } from "react-router-dom";

const AuthFooter = () => {
  return (
    <div className="mt-6 text-center text-xs text-muted-foreground space-y-2">
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
        <span>By continuing, you agree to our</span>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link to="/terms" className="text-paypal-blue font-medium hover:underline">
            Terms
          </Link>
          <span>and</span>
          <Link to="/privacy" className="text-paypal-blue font-medium hover:underline">
            Privacy Policy
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span>Learn more:</span>
        <Link to="/about-openpay" className="text-paypal-blue font-medium hover:underline">
          About OpenPay
        </Link>
        <span>-</span>
        <Link to="/legal" className="text-paypal-blue font-medium hover:underline">
          Legal
        </Link>
        <span>-</span>
        <Link to="/gdpr" className="text-paypal-blue font-medium hover:underline">
          GDPR
        </Link>
      </div>
      <div className="mt-2 text-center">
        <Link to="/whitepaper" className="text-paypal-blue font-medium hover:underline">
          Whitepaper
        </Link>
        <span className="mx-2">•</span>
        <Link to="/openpay-guide" className="text-paypal-blue font-medium hover:underline">
          User Guide
        </Link>
      </div>
    </div>
  );
};

export default AuthFooter;
