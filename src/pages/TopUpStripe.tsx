import TopUpProviderPage from "@/components/TopUpProviderPage";

const STRIPE_LOGO_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Stripe_Logo%2C_revised_2016.svg/1920px-Stripe_Logo%2C_revised_2016.svg.png";

const TopUpStripe = () => (
  <TopUpProviderPage providerName="Stripe" providerLogoUrl={STRIPE_LOGO_URL} />
);

export default TopUpStripe;
