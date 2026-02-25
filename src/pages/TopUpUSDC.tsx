import TopUpProviderPage from "@/components/TopUpProviderPage";

const USDC_LOGO_URL = "https://cryptologos.cc/logos/usd-coin-usdc-logo.png";

const TopUpUSDC = () => (
  <TopUpProviderPage providerName="USDC" providerLogoUrl={USDC_LOGO_URL} />
);

export default TopUpUSDC;

