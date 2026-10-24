import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveLooper, validateState } from '../src/looper.js';
const note = { note: 0, instrument: 'bass', scale: 'blues', octave: 0 };
function setup(peerId = 'alice') {
  let time = 12000;
  const sent = [], played = [], stopped = [];
  const engine = new LiveLooper({ peerId, timers: false, clock: () => time, send: p => sent.push(p),
    audio: { now: () => 1, play: (...args) => played.push(args), stop: tag => stopped.push(tag), click: () => {} } });
  engine.setReady();
  return { engine, sent, played, stopped, setTime: n => time = n, time: () => time };
}
function record(fixture, notes = [note]) {
  const e = fixture.engine; e.startRecording();
  const start = e.recording.startBeat * 60000 / e.bpm;
  fixture.setTime(start + 30); notes.forEach(n => e.capture(n));
  fixture.setTime(e.recording.endBeat * 60000 / e.bpm + 5); e.tick();
  return e.own.layers.at(-1);
}
test('records a bounded loop and schedules repetitions without rebroadcasting notes', () => {
  const f = setup(); f.engine.configure({ beats: 4, bpm: 120 });
  const layer = record(f);
  assert.equal(layer.beats, 4); assert.equal(layer.notes.length, 1); assert.equal(layer.notes[0].instrument, 'bass');
  const before = f.played.length, sent = f.sent.length;
  const next = (Math.ceil(((f.time() + 100) / 500 - layer.phase - layer.notes[0].beat) / 4) * 4 + layer.phase + layer.notes[0].beat) * 500;
  f.setTime(next - 50); f.engine.tick(); f.engine.tick();
  assert.equal(f.played.length, before + 1); assert.equal(f.sent.length, sent);
  assert.ok(f.played.at(-1)[4].when >= 1); assert.equal(f.played.at(-1)[4].gain, .65);
});
test('overdubs preserve the original notes and undo restores the previous take', () => {
  const f = setup(); const layer = record(f);
  f.engine.startRecording(layer.slot); f.setTime(f.engine.recording.startBeat * 600 + 170);
  f.engine.capture({ ...note, note: 3, instrument: 'sax' });
  f.setTime(f.engine.recording.endBeat * 600 + 5); f.engine.tick();
  assert.equal(f.engine.own.layers[0].notes.length, 2);
  f.engine.undo(); assert.equal(f.engine.own.layers[0].notes.length, 1);
  f.engine.toggleMute(0); assert.equal(f.engine.own.layers[0].muted, true);
  assert.ok(f.stopped.includes('loop:alice:0'));
});
test('snapshots converge, stale revisions cannot resurrect removed loops, and late joiners receive the band', () => {
  const alice = setup(), bob = setup('bob'), newcomer = setup('carol'); record(alice);
  const old = alice.sent.at(-1); bob.engine.receive(old);
  assert.equal(bob.engine.layers.length, 1);
  alice.engine.remove(0); bob.engine.receive(alice.sent.at(-1)); bob.engine.receive(old);
  assert.equal(bob.engine.layers.length, 0);
  record(alice); bob.engine.receive(alice.sent.at(-1));
  bob.engine.receive({ kind: 'loop-request', from: 'carol' });
  bob.sent.forEach(packet => newcomer.engine.receive(packet));
  assert.equal(newcomer.engine.layers.length, 1);
  assert.equal(newcomer.engine.layers[0].owner, 'alice');
});
test('concurrent player layers merge, and both peers choose the same tempo', () => {
  const a = setup(), b = setup('bob'); a.engine.configure({ bpm: 120 }); b.engine.configure({ bpm: 90 });
  record(a); record(b); a.engine.receive(b.sent.at(-1)); b.engine.receive(a.sent.findLast(p => p.kind === 'loop-state'));
  assert.equal(a.engine.layers.length, 2); assert.equal(b.engine.layers.length, 2); assert.equal(a.engine.bpm, b.engine.bpm);
});
test('rejects malformed state, caps recording size, and keeps quantized notes inside the loop', () => {
  const f = setup(); f.engine.configure({ quantize: .25, beats: 4 }); f.engine.startRecording();
  const end = f.engine.recording.endBeat * 600; f.setTime(end - 10);
  for (let i = 0; i < 200; i++) f.engine.capture(note);
  f.setTime(end + 5); f.engine.tick();
  const state = structuredClone(f.engine.own); assert.equal(state.layers[0].notes.length, 96);
  assert.equal(state.layers[0].notes[0].beat, 0); assert.ok(validateState(state));
  state.layers[0].notes[0].scale = 'constructor'; assert.equal(validateState(state), null);
  state.layers[0].notes[0].scale = { toString: 1 }; assert.equal(validateState(state), null);
});
test('pause cancels the take, stops loop voices, and resume skips elapsed notes', () => {
  const f = setup(); record(f); f.engine.startRecording(); f.engine.setPlaying(false);
  assert.equal(f.engine.recording, null); assert.ok(f.stopped.includes('loop:alice:0'));
  const before = f.played.length; f.setTime(f.time() + 60000); f.engine.tick(); assert.equal(f.played.length, before);
  f.engine.setPlaying(true); f.engine.tick(); assert.ok(f.played.length - before <= 1);
});
test('two players keep twelve independent layers and the room tempo survives deleting its first part', () => {
  const a = setup(), b = setup('bob'); a.engine.configure({ bpm: 120 }); b.engine.configure({ bpm: 90 });
  for (let i = 0; i < 6; i++) record(a);
  b.engine.receive(a.sent.at(-1)); assert.equal(b.engine.bpm, 120);
  for (let i = 0; i < 6; i++) record(b);
  a.engine.receive(b.sent.at(-1)); assert.equal(a.engine.layers.length, 12);
  assert.equal(a.engine.startRecording(), false);
  for (let i = 0; i < 6; i++) a.engine.remove(i);
  b.engine.receive(a.sent.at(-1)); assert.equal(b.engine.bpm, 120); assert.equal(b.engine.layers.length, 6);
});
test('finishing early never replays the take until its first full loop boundary', () => {
  const f = setup(); f.engine.configure({ beats: 4 }); f.engine.startRecording();
  f.setTime(f.engine.recording.startBeat * 600 + 10); f.engine.capture(note); f.engine.finishRecording();
  f.engine.tick(); assert.equal(f.played.length, 0);
  assert.equal(f.engine.own.layers.length, 1);
});
