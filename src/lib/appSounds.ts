const SOUND_URLS = {
  scan: "https://www.myinstants.com/media/sounds/store-scanner-beep-sound-effect.mp3",
  send: "https://www.myinstants.com/media/sounds/applepay.mp3",
  receive: "https://www.myinstants.com/media/sounds/notification-bell_VW6Rkj4.mp3",
} as const;

type SoundKind = keyof typeof SOUND_URLS;

const audioCache: Partial<Record<SoundKind, HTMLAudioElement>> = {};

const playFallbackTone = () => {
  if (typeof window === "undefined") return;
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  try {
    const audioContext = new AudioCtx();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, audioContext.currentTime);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.07, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.14);
    osc.onended = () => {
      void audioContext.close();
    };
  } catch {
    // no-op
  }
};

export const playUiSound = (kind: SoundKind) => {
  if (typeof window === "undefined") return;
  try {
    if (!audioCache[kind]) {
      const audio = new Audio(SOUND_URLS[kind]);
      audio.preload = "auto";
      audio.volume = 0.95;
      audioCache[kind] = audio;
    }
    const audio = audioCache[kind];
    if (!audio) return;
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      void playPromise.catch(() => {
        playFallbackTone();
      });
    }
  } catch {
    playFallbackTone();
  }
};

