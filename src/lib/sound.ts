// Sons synthétisés (Web Audio) : aucun fichier audio à embarquer.
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function knock(freq: number, gain: number, decay: number, delay = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  // bruit filtré = impact « bois »
  const len = Math.floor(a.sampleRate * 0.06);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const noise = a.createBufferSource();
  noise.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 1.4;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  noise.connect(bp).connect(g).connect(a.destination);
  noise.start(t);
  // corps tonal
  const osc = a.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq / 4, t);
  osc.frequency.exponentialRampToValueAtTime(freq / 7, t + decay);
  const og = a.createGain();
  og.gain.setValueAtTime(gain * 0.5, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  osc.connect(og).connect(a.destination);
  osc.start(t);
  osc.stop(t + decay + 0.02);
}

export function playMoveSound(kind: 'move' | 'capture' | 'check' | 'castle') {
  switch (kind) {
    case 'move':
      knock(1500, 0.5, 0.09);
      break;
    case 'capture':
      knock(1100, 0.75, 0.13);
      knock(1900, 0.35, 0.08, 0.025);
      break;
    case 'castle':
      knock(1500, 0.45, 0.08);
      knock(1350, 0.45, 0.08, 0.09);
      break;
    case 'check':
      knock(1700, 0.6, 0.1);
      knock(2300, 0.3, 0.12, 0.05);
      break;
  }
}

export function soundForSan(san: string): 'move' | 'capture' | 'check' | 'castle' {
  if (san.includes('+') || san.includes('#')) return 'check';
  if (san.startsWith('O-O')) return 'castle';
  if (san.includes('x')) return 'capture';
  return 'move';
}
