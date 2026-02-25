import TopUpProviderPage from "@/components/TopUpProviderPage";

const USDT_LOGO_URL = "https://cryptologos.cc/logos/tether-usdt-logo.png";

const TopUpUSDT = () => (
  <TopUpProviderPage providerName="USDT" providerLogoUrl={USDT_LOGO_URL} />
);

export default TopUpUSDT;

