/**
 * Sons du jeu, entièrement SYNTHÉTISÉS avec l'API Web Audio.
 *
 * Aucun fichier audio : rien à télécharger, rien à précacher, et le jeu reste
 * identique hors ligne. Les sons sont courts, discrets et coupés par défaut.
 *
 * Le contexte audio n'est créé qu'au premier son joué, donc toujours après une
 * action du joueur — les navigateurs refusent de démarrer l'audio autrement.
 */
export type SoundName = 'click' | 'buy' | 'achievement' | 'event';

type Voice = {
  /** Fréquences jouées à la suite, en hertz. */
  readonly notes: readonly number[];
  /** Durée de chaque note, en secondes. */
  readonly duration: number;
  readonly type: OscillatorType;
  readonly volume: number;
};

const VOICES: Record<SoundName, Voice> = {
  // Un « poc » sec et très court : il sera joué des milliers de fois.
  click: { notes: [220], duration: 0.05, type: 'triangle', volume: 0.1 },
  // Deux notes montantes : quelque chose a été acheté.
  buy: { notes: [392, 587], duration: 0.07, type: 'square', volume: 0.07 },
  // Petit arpège : haut fait ou défi relevé.
  achievement: { notes: [523, 659, 784], duration: 0.1, type: 'triangle', volume: 0.12 },
  // Scintillement : pizza d'or attrapée.
  event: { notes: [784, 1047], duration: 0.09, type: 'sine', volume: 0.12 },
};

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (context) return context;
  try {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
    return context;
  } catch {
    return null; // audio indisponible : le jeu continue en silence
  }
}

/**
 * Joue un son. `enabled` vient des réglages : on le passe en paramètre plutôt que
 * de lire le store ici, pour que ce module reste sans dépendance.
 */
export function playSound(name: SoundName, enabled: boolean): void {
  if (!enabled) return;
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();

  const voice = VOICES[name];
  voice.notes.forEach((frequency, i) => {
    const start = ctx.currentTime + i * voice.duration;
    const end = start + voice.duration;

    const oscillator = ctx.createOscillator();
    oscillator.type = voice.type;
    oscillator.frequency.setValueAtTime(frequency, start);

    // Enveloppe courte : attaque immédiate, extinction douce, zéro clic parasite.
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(voice.volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  });
}
