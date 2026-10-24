import { scales, instrumentIds } from './instruments.js';
let context, master, compressor, noiseBuffer, level = .65, muted = false;
const voices = new Set();
export async function unlock() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) throw new Error('This browser does not support Web Audio.');
  context ||= new Audio({ latencyHint: 'interactive' });
  if (!master) {
    master = context.createGain();
    compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -15;
    compressor.ratio.value = 8;
    master.gain.value = muted ? 0 : level;
    master.connect(compressor).connect(context.destination);
    noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (context.state !== 'running') await context.resume();
}
export function volume(value) {
  level = Math.max(0, Math.min(1, Number(value) || 0));
  if (master) master.gain.setTargetAtTime(muted ? 0 : level, context.currentTime, .015);
}
export function mute(value) {
  muted = value;
  if (master) master.gain.setTargetAtTime(muted ? 0 : level, context.currentTime, .015);
}
export function playNote(index, instrument = 'keys', scale = 'blues', octave = 0) {
  if (!context || context.state !== 'running' || !instrumentIds.has(instrument) || !Object.hasOwn(scales, scale)) return;
  if (!Number.isInteger(index) || index < 0 || index > 7 || ![-1, 0, 1].includes(octave)) return;
  // Bound polyphony so busy rooms do not accumulate oscillators on phones.
  if (voices.size >= 24) voices.values().next().value.finish();
  const now = context.currentTime;
  const frequency = 440 * 2 ** ((scales[scale].midi[index] + octave * 12 - 69) / 12);
  const output = context.createGain();
  output.connect(master);
  const nodes = [output], sources = [];
  let finished = false, timer;
  const voice = { finish() {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    sources.forEach(source => { try { source.stop(); } catch {} });
    nodes.forEach(node => node.disconnect());
    voices.delete(voice);
  } };
  voices.add(voice);
  function oscillator(type, hz, amplitude = 1, destination = output, detune = 0) {
    const osc = context.createOscillator(), gain = context.createGain();
    osc.type = type; osc.frequency.value = hz; osc.detune.value = detune; gain.gain.value = amplitude;
    osc.connect(gain).connect(destination); sources.push(osc); nodes.push(osc, gain); osc.start(now); return osc;
  }
  function filter(type, hz, q = .7) {
    const node = context.createBiquadFilter(); node.type = type; node.frequency.value = hz; node.Q.value = q;
    nodes.push(node); return node;
  }
  function noise(amplitude, destination) {
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = noiseBuffer; source.loop = true; gain.gain.value = amplitude;
    source.connect(gain).connect(destination); sources.push(source); nodes.push(source, gain); source.start(now);
  }
  let attack = .008, duration = 1.25, peak = .32;
  if (instrument === 'keys') {
    oscillator('sine', frequency); oscillator('sine', frequency * 2, .25); oscillator('triangle', frequency, .12);
  } else if (instrument === 'bass') {
    const low = filter('lowpass', 620); low.connect(output);
    oscillator('triangle', frequency / 2, .8, low); oscillator('sine', frequency / 2, .5, low);
    duration = .8; peak = .4;
  } else if (instrument === 'drums') {
    duration = [.45, .22, .08, .3, .5, .16, .35, .65][index]; peak = .45;
    if ([0, 4].includes(index)) {
      const kick = oscillator('sine', index ? 130 : 155);
      kick.frequency.exponentialRampToValueAtTime(40, now + .18);
    } else if ([1, 5].includes(index)) {
      const high = filter('highpass', index === 1 ? 1300 : 2000); high.connect(output); noise(.55, high);
      oscillator('triangle', 180, .18);
    } else if ([2, 3, 7].includes(index)) {
      const high = filter('highpass', 6500); high.connect(output); noise(.4, high);
    } else {
      oscillator('sine', 240); oscillator('sine', 360, .4); duration = .32;
    }
  } else if (instrument === 'sax') {
    const reed = filter('lowpass', frequency * 5, 1.2); reed.connect(output);
    const tone = oscillator('sawtooth', frequency, .45, reed);
    oscillator('sine', frequency, .4, reed);
    const breath = filter('bandpass', frequency * 3, 2); breath.connect(output); noise(.035, breath);
    oscillator('sine', 5, frequency * .008, tone.frequency);
    duration = .8; attack = .05; peak = .3;
  } else if (instrument === 'vibes') {
    oscillator('sine', frequency * 2, .7); oscillator('sine', frequency * 5.5, .15); oscillator('sine', frequency * 8, .035);
    duration = 2; peak = .32;
  } else if (instrument === 'guitar') {
    const body = filter('lowpass', frequency * 4); body.connect(output);
    oscillator('triangle', frequency, .7, body);
    oscillator('sine', frequency * 2, .28, body); oscillator('sine', frequency * 3, .12, body);
    duration = .9; attack = .003; peak = .38;
  } else if (instrument === 'synth') {
    const cloud = filter('lowpass', 1500); cloud.frequency.exponentialRampToValueAtTime(350, now + 1.8); cloud.connect(output);
    oscillator('sawtooth', frequency, .25, cloud, -8); oscillator('sawtooth', frequency, .25, cloud, 8);
    oscillator('sine', frequency * 2, .2, cloud); attack = .12; duration = 1.8; peak = .3;
  } else if (instrument === 'flute') {
    oscillator('sine', frequency * 2, .8); oscillator('sine', frequency * 4, .08);
    const air = filter('bandpass', frequency * 4, 1.5); air.connect(output); noise(.025, air);
    attack = .06; duration = .75; peak = .32;
  }
  output.gain.setValueAtTime(0, now);
  output.gain.linearRampToValueAtTime(peak, now + attack);
  output.gain.exponentialRampToValueAtTime(.0001, now + duration);
  sources.forEach(source => source.stop(now + duration + .04));
  timer = setTimeout(() => voice.finish(), (duration + .1) * 1000);
}
