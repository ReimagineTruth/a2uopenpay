import TopUpProviderPage from "@/components/TopUpProviderPage";

const VISA_LOGO_URL = "https://i.ibb.co/G3FGwngR/Visa-Inc-logo-2021-present-svg.png";

const TopUpDebit = () => (
  <TopUpProviderPage providerName="Debit Card" providerLogoUrl={VISA_LOGO_URL} />
);

export default TopUpDebit;
