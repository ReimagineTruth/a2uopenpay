import TopUpProviderPage from "@/components/TopUpProviderPage";

const VENMO_LOGO_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Venmo_Logo.svg/1920px-Venmo_Logo.svg.png";

const TopUpVenmo = () => (
  <TopUpProviderPage providerName="Venmo" providerLogoUrl={VENMO_LOGO_URL} />
);

export default TopUpVenmo;
