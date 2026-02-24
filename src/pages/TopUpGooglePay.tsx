import TopUpProviderPage from "@/components/TopUpProviderPage";

const GOOGLE_PAY_LOGO_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Google_Pay_Logo.svg/1920px-Google_Pay_Logo.svg.png";

const TopUpGooglePay = () => (
  <TopUpProviderPage providerName="Google Pay" providerLogoUrl={GOOGLE_PAY_LOGO_URL} />
);

export default TopUpGooglePay;
