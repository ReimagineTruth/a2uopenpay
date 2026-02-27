import { Link } from "react-router-dom";

const AuthFooter = () => {
  return (
    <div className="mt-6 text-center text-xs text-gray-600 space-y-3">
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4 sm:justify-center">
        <span className="text-gray-600">By continuing, you agree to our</span>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link to="/terms" className="text-blue-600 font-medium hover:underline hover:text-blue-800">
            Terms
          </Link>
          <span className="text-gray-600">and</span>
          <Link to="/privacy" className="text-blue-600 font-medium hover:underline hover:text-blue-800">
            Privacy Policy
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-gray-600">Learn more:</span>
        <Link to="/about-openpay" className="text-blue-600 font-medium hover:underline hover:text-blue-800">
          About OpenPay
        </Link>
        <span className="text-gray-600">-</span>
        <Link to="/legal" className="text-blue-600 font-medium hover:underline hover:text-blue-800">
          Legal
        </Link>
        <span className="text-gray-600">-</span>
        <Link to="/gdpr" className="text-blue-600 font-medium hover:underline hover:text-blue-800">
          GDPR
        </Link>
      </div>
      <div className="mt-2 text-center">
        <Link to="/whitepaper" className="text-blue-600 font-medium hover:underline hover:text-blue-800">
          Whitepaper
        </Link>
        <span className="mx-2 text-gray-600">•</span>
        <Link to="/openpay-guide" className="text-blue-600 font-medium hover:underline hover:text-blue-800">
          User Guide
        </Link>
      </div>
    </div>
  );
};

export default AuthFooter;
