// src/components/alertes/sirene.ts
//
// Alarme sonore de la tablette du comptoir (propriétaire, 21/11/2026) : une
// commande approche de son échéance ou est en retard → bruit FORT, impossible
// à manquer derrière le comptoir. WebAudio, aucun fichier son à charger (réseau
// faible). Un navigateur n'autorise le son qu'après un geste de l'utilisateur :
// `deverrouillerAudio` s'accroche au premier toucher de la journée.

let contexte: AudioContext | null = null;

function obtenir(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!contexte) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    contexte = new Ctor();
  }
  return contexte;
}

/** À appeler au premier toucher : le son est ensuite permis pour toute la session. */
export function deverrouillerAudio(): void {
  const c = obtenir();
  if (c && c.state === 'suspended') void c.resume();
}

/**
 * Alarme : deux tons alternés, à plein volume. `urgente` (retard) : plus longue.
 * Vibre aussi si la tablette sait le faire.
 */
export function jouerAlarme(urgente: boolean): void {
  const c = obtenir();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const gain = c.createGain();
  gain.gain.value = 1;
  gain.connect(c.destination);
  const osc = c.createOscillator();
  osc.type = 'square';
  osc.connect(gain);
  const debut = c.currentTime + 0.05;
  const alternances = urgente ? 14 : 8;
  for (let i = 0; i < alternances; i++) osc.frequency.setValueAtTime(i % 2 === 0 ? 988 : 740, debut + i * 0.35);
  osc.start(debut);
  osc.stop(debut + alternances * 0.35);
  osc.onended = () => gain.disconnect();
  try {
    navigator.vibrate?.(urgente ? [400, 150, 400, 150, 800] : [300, 150, 300]);
  } catch {
    /* tablette sans vibration */
  }
}
