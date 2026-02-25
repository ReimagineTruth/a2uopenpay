const GOOGLE_WALLET_SUCCESS_SOUND_URL =
  "https://www.myinstants.com/media/sounds/google-wallet-payment-successful.mp3";

let successSound: HTMLAudioElement | null = null;

export const playGoogleWalletSuccessSound = () => {
  if (typeof window === "undefined" || typeof Audio === "undefined") return;

  try {
    if (!successSound) {
      successSound = new Audio(GOOGLE_WALLET_SUCCESS_SOUND_URL);
      successSound.preload = "auto";
    }
    successSound.currentTime = 0;
    void successSound.play().catch(() => {});
  } catch {
    // no-op
  }
};

