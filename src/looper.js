import { instrumentIds, scales } from './instruments.js';
import { audioTime, playNote, stopLoopVoices, playClick } from './music.js';

export const MAX_LAYERS = 6, MAX_NOTES = 96;
const lengths = [4, 8, 16];
const clone = value => structuredClone(value);
const mod = (n, divisor) => ((n % divisor) + divisor) % divisor;
export function validNote(note) {
  return !!note && typeof note.instrument === 'string' && typeof note.scale === 'string' && Number.isInteger(note.note) && note.note >= 0 && note.note <= 7 &&
    instrumentIds.has(note.instrument) && Object.hasOwn(scales, note.scale) && [-1, 0, 1].includes(note.octave);
}
export function validateState(state) {
  if (!state || typeof state.owner !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(state.owner) ||
      !Number.isSafeInteger(state.revision) || state.revision < 0 || !Array.isArray(state.layers) || state.layers.length > MAX_LAYERS) return null;
  const slots = new Set(), layers = [];
  for (const layer of state.layers) {
    if (!layer || !Number.isInteger(layer.slot) || layer.slot < 0 || layer.slot >= MAX_LAYERS || slots.has(layer.slot) ||
        !lengths.includes(layer.beats) || !Number.isInteger(layer.phase) || layer.phase < 0 || layer.phase >= layer.beats ||
        !Number.isInteger(layer.bpm) || layer.bpm < 60 || layer.bpm > 180 ||
        !Number.isFinite(layer.createdAt) || layer.createdAt < 0 || typeof layer.muted !== 'boolean' ||
        !Number.isFinite(layer.volume) || layer.volume < 0 || layer.volume > 1 ||
        !Array.isArray(layer.notes) || !layer.notes.length || layer.notes.length > MAX_NOTES) return null;
    const notes = [];
    for (const note of layer.notes) {
      if (!validNote(note) || !Number.isFinite(note.beat) || note.beat < 0 || note.beat >= layer.beats || !Number.isFinite(note.startsAt) || note.startsAt < 0) return null;
      notes.push({ note: note.note, instrument: note.instrument, scale: note.scale, octave: note.octave, beat: note.beat, startsAt: note.startsAt });
    }
    slots.add(layer.slot);
    layers.push({ slot: layer.slot, beats: layer.beats, phase: layer.phase, bpm: layer.bpm, createdAt: layer.createdAt,
      muted: layer.muted, volume: layer.volume, notes: notes.sort((a, b) => a.beat - b.beat) });
  }
  return { owner: state.owner, revision: state.revision, layers };
}

export class LiveLooper {
  constructor({ peerId, send = () => {}, onChange = () => {}, onTick = () => {}, onVisual = () => {}, onNotice = () => {},
    clock = () => Date.now(), timers = true, audio = { now: audioTime, play: playNote, stop: stopLoopVoices, click: playClick } }) {
    this.peerId = peerId; this.send = send; this.onChange = onChange; this.onTick = onTick;
    this.onVisual = onVisual; this.onNotice = onNotice; this.clock = clock; this.audio = audio; this.timers = timers;
    this.own = { owner: peerId, revision: 0, layers: [] }; this.states = new Map([[peerId, this.own]]);
    this.bpm = 100; this.beats = 8; this.quantize = 0; this.click = true; this.playing = true; this.ready = false;
    this.recording = null; this.history = []; this.scheduled = new Map(); this.visualTimers = new Set(); this.lastDisplay = 0;
  }
  get layers() {
    return [...this.states.values()].flatMap(state => state.layers.map(layer => ({ ...layer, owner: state.owner, key: `${state.owner}:${layer.slot}` })));
  }
  setReady() { this.ready = true; this.refresh(); }
  configure({ bpm = this.bpm, beats = this.beats, quantize = this.quantize, click = this.click }) {
    if (Number.isInteger(bpm) && bpm >= 60 && bpm <= 180 && !this.layers.length && !this.recording) this.bpm = bpm;
    if (lengths.includes(beats) && !this.recording) this.beats = beats;
    if ([0, .5, .25].includes(quantize) && !this.recording) this.quantize = quantize;
    this.click = !!click; this.refresh();
  }
  snapshot() {
    return { layers: this.layers, ownCount: this.own.layers.length, bpm: this.bpm, beats: this.beats, quantize: this.quantize,
      click: this.click, playing: this.playing, ready: this.ready, recording: this.recording, canUndo: this.history.length > 0 };
  }
  sync() {
    this.send({ kind: 'loop-request', from: this.peerId });
    this.send({ kind: 'loop-state', state: clone(this.own) });
  }
  receive(packet) {
    if (!packet || typeof packet !== 'object') return;
    if (packet.kind === 'loop-request' && typeof packet.from === 'string' && packet.from !== this.peerId) {
      // Relay the latest owner snapshots so newcomers also hear layers whose owner has left.
      for (const state of this.states.values()) this.send({ kind: 'loop-state', state: clone(state) });
    } else if (packet.kind === 'loop-state') {
      const next = validateState(packet.state);
      if (!next || next.owner === this.peerId || (this.states.get(next.owner)?.revision ?? -1) >= next.revision) return;
      if (!this.states.has(next.owner) && this.states.size >= 16) return;
      this.replaceState(next); this.refresh();
    }
  }
  replaceState(next) {
    const previous = this.states.get(next.owner);
    for (let slot = 0; slot < MAX_LAYERS; slot++) {
      const oldLayer = previous?.layers.find(layer => layer.slot === slot), newLayer = next.layers.find(layer => layer.slot === slot);
      if (JSON.stringify(oldLayer) !== JSON.stringify(newLayer)) {
        const key = `${next.owner}:${slot}`; this.audio.stop(`loop:${key}`); this.scheduled.delete(key);
      }
    }
    this.states.set(next.owner, next);
  }
  publish(layers, saveUndo = false) {
    if (saveUndo) { this.history.push(clone(this.own.layers)); if (this.history.length > 5) this.history.shift(); }
    const next = { owner: this.peerId, revision: this.own.revision + 1, layers: clone(layers) };
    this.replaceState(next); this.own = next;
    this.send({ kind: 'loop-state', state: clone(next) }); this.refresh();
  }
  refresh() {
    const anchor = this.layers.toSorted((a, b) => a.createdAt - b.createdAt || a.owner.localeCompare(b.owner) || a.slot - b.slot)[0];
    if (anchor && anchor.bpm !== this.bpm) {
      this.bpm = anchor.bpm; this.stopScheduled();
      if (this.recording) { this.recording = null; this.onNotice('The room tempo changed. Your take was canceled; try recording again.'); }
    }
    if (anchor && this.own.layers.some(layer => layer.bpm !== this.bpm)) {
      // Preserve the agreed room tempo even if the original anchor layer is removed.
      this.publish(this.own.layers.map(layer => ({ ...layer, bpm: this.bpm }))); return;
    }
    if (this.timers) {
      const active = this.ready && this.playing && (this.layers.length || this.recording);
      if (active && !this.timer) { this.timer = setInterval(() => this.tick(), 25); this.tick(); }
      if (!active && this.timer) { clearInterval(this.timer); this.timer = null; }
    }
    this.onChange(this.snapshot());
  }
  startRecording(slot = null) {
    if (!this.ready) return false;
    if (this.recording) return false;
    const previous = slot === null ? null : this.own.layers.find(layer => layer.slot === slot);
    if (slot !== null && !previous) return false;
    if (slot === null) slot = Array.from({ length: MAX_LAYERS }, (_, i) => i).find(i => !this.own.layers.some(layer => layer.slot === i));
    if (slot === undefined) { this.onNotice('Your six layers are full. Add notes to a layer, or remove one to make room.'); return false; }
    if (previous?.notes.length >= MAX_NOTES) { this.onNotice('This layer is full. Record a new layer instead.'); return false; }
    const startBeat = Math.ceil((this.clock() / (60000 / this.bpm) + 1) / 4) * 4;
    const beats = previous?.beats ?? this.beats;
    // Overdubs start at the original layer's phase, so their notes keep the same loop position.
    const alignedStart = previous ? startBeat + mod(previous.phase - startBeat, beats) : startBeat;
    this.playing = true;
    this.recording = { slot, startBeat: alignedStart, endBeat: alignedStart + beats, beats, bpm: this.bpm,
      phase: previous?.phase ?? mod(alignedStart, beats), notes: [], previous: previous ? clone(previous) : null,
      quantize: this.quantize, nextClick: Math.ceil(this.clock() / (60000 / this.bpm)) };
    this.lastDisplay = 0; this.refresh(); return true;
  }
  capture(event) {
    const take = this.recording;
    if (!take || !validNote(event)) return;
    const beat = this.clock() / (60000 / take.bpm) - take.startBeat;
    if (beat < 0 || beat >= take.beats) return;
    if (take.notes.length + (take.previous?.notes.length ?? 0) >= MAX_NOTES) return;
    const offset = take.quantize ? mod(Math.round(beat / take.quantize) * take.quantize, take.beats) : beat;
    take.notes.push({ note: event.note, instrument: event.instrument, scale: event.scale, octave: event.octave, beat: offset, startsAt: take.endBeat * (60000 / take.bpm) });
  }
  finishRecording() {
    const take = this.recording;
    if (!take) return;
    this.recording = null;
    if (this.clock() / (60000 / take.bpm) < take.startBeat || !take.notes.length) {
      this.onNotice(take.notes.length ? 'Take canceled.' : 'No notes captured. Tap Record loop and play after the count-in.'); this.refresh(); return;
    }
    const layer = { slot: take.slot, beats: take.beats, bpm: take.bpm, phase: take.phase,
      createdAt: take.previous?.createdAt ?? this.clock(), muted: false, volume: take.previous?.volume ?? .65,
      notes: [...(take.previous?.notes ?? []), ...take.notes].sort((a, b) => a.beat - b.beat) };
    this.publish([...this.own.layers.filter(item => item.slot !== take.slot), layer], true);
    this.onNotice(take.previous ? 'Notes added. The band keeps playing.' : 'Loop is playing. Pick another instrument and build your band.');
  }
  cancelRecording() { this.recording = null; this.refresh(); }
  toggleMute(slot) { this.publish(this.own.layers.map(layer => layer.slot === slot ? { ...layer, muted: !layer.muted } : layer)); }
  setVolume(slot, value) {
    if (!Number.isFinite(value) || value < 0 || value > 1) return;
    this.publish(this.own.layers.map(layer => layer.slot === slot ? { ...layer, volume: value } : layer));
  }
  remove(slot) {
    if (this.recording?.slot === slot) this.recording = null;
    this.publish(this.own.layers.filter(layer => layer.slot !== slot), true);
  }
  undo() { if (this.history.length) { this.recording = null; this.publish(this.history.pop()); } }
  setPlaying(playing) {
    this.playing = !!playing;
    if (!playing) { this.recording = null; this.stopScheduled(); }
    this.refresh();
  }
  stopScheduled() {
    for (const layer of this.layers) this.audio.stop(`loop:${layer.key}`);
    this.scheduled.clear(); for (const timer of this.visualTimers) clearTimeout(timer); this.visualTimers.clear();
  }
  tick() {
    if (!this.ready || !this.playing) return;
    const wall = this.clock(), beatMs = 60000 / this.bpm, horizon = wall + 100;
    const take = this.recording;
    if (take && wall / beatMs >= take.endBeat) this.finishRecording();
    for (const layer of this.layers) {
      if (layer.muted || layer.volume === 0) continue;
      const scheduled = this.scheduled.get(layer.key);
      const from = scheduled === undefined ? wall - 35 : Math.max(scheduled, wall - 15);
      for (const note of layer.notes) {
        const noteFrom = Math.max(from, note.startsAt);
        const cycle = Math.ceil((noteFrom / beatMs - layer.phase - note.beat) / layer.beats);
        const at = (layer.phase + note.beat + cycle * layer.beats) * beatMs;
        if (at < horizon && at >= noteFrom) {
          const delay = Math.max(0, at - wall);
          this.audio.play(note.note, note.instrument, note.scale, note.octave,
            { when: this.audio.now() + delay / 1000, gain: layer.volume, tag: `loop:${layer.key}` });
          if (this.timers) {
            const revision = this.states.get(layer.owner).revision;
            const timer = setTimeout(() => {
              this.visualTimers.delete(timer);
              if (this.playing && this.states.get(layer.owner)?.revision === revision) this.onVisual(note);
            }, delay);
            this.visualTimers.add(timer);
          } else this.onVisual(note);
        }
      }
      this.scheduled.set(layer.key, horizon);
    }
    if (this.recording && this.click) {
      const active = this.recording;
      active.nextClick = Math.max(active.nextClick, Math.ceil(wall / beatMs));
      while (active.nextClick * beatMs < horizon && active.nextClick < active.endBeat) {
        this.audio.click(this.audio.now() + Math.max(0, active.nextClick * beatMs - wall) / 1000, mod(active.nextClick, 4) === 0);
        active.nextClick++;
      }
    }
    if (wall - this.lastDisplay >= 100) {
      this.lastDisplay = wall;
      this.onTick({ beat: wall / beatMs, recording: this.recording, playing: this.playing });
    }
  }
  destroy() { clearInterval(this.timer); this.stopScheduled(); }
}
