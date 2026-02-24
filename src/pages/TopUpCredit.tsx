import TopUpProviderPage from "@/components/TopUpProviderPage";

const MASTERCARD_LOGO_URL = "https://i.ibb.co/9kkZmFDq/Mastercard-2019-logo-svg.png";

const TopUpCredit = () => (
  <TopUpProviderPage providerName="Credit Card" providerLogoUrl={MASTERCARD_LOGO_URL} />
);

export default TopUpCredit;
