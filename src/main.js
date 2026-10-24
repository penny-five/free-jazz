import './style.css';
import { createClient } from '@supabase/supabase-js';
import { mountLoopStation } from './loop-ui.js';
import { unlock, playNote, volume, mute } from './music.js';
import { instruments, instrumentIds, scales, instrumentArt, icon, brandMark } from './instruments.js';

const $ = selector => document.querySelector(selector);
const configured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const room = new URLSearchParams(location.search).get('room')?.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 48) || 'the-green-room';
const id = crypto.randomUUID();
const keys = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k'];
const colors = ['#d9e7ac', '#c9bde4', '#edba91', '#a4cbd4'];
const drumLabels = ['Kick', 'Snare', 'Hi-hat', 'Open hat', 'Low kick', 'Clap', 'Tom', 'Cymbal'];
let instrument = 'keys', scale = 'blues', octave = 0, started = false, connected = false;
let channel, local, count = 0, isMuted = false, soundLevel = 65;
try { soundLevel = Math.min(100, Math.max(0, Number(localStorage.getItem('freeform-volume') ?? 65))); } catch {}
volume(soundLevel / 100);

document.querySelector('#app').innerHTML = `
<a class="skip-link" href="#studio">Skip to instruments</a>
<header class="site-header"><a class="brand" href="/" aria-label="Freeform home">freeform<span>${brandMark()}</span></a><span class="tagline">A LITTLE CHAOS. A LITTLE CONNECTION.</span><nav><button id="about" class="text-button">How to play ${icon('arrow')}</button><button id="focus" class="icon-button" aria-label="Enter focus mode" aria-pressed="false">${icon('expand')}</button></nav></header>
<main>
<section class="intro" aria-labelledby="page-title"><div class="intro-copy"><div class="eyebrow"><span class="tiny-dot"></span> THE INTERNET'S OPEN JAM SESSION</div><h1 id="page-title">Less rules.<br><em>More feeling.</em><span class="title-star">${brandMark()}</span></h1><p>A pocket-sized playground for beautiful noise.<br>Pick a sound. Bring a friend. See where it goes.</p><a class="intro-link" href="#studio">Find your sound ${icon('arrow')}</a></div><div class="intro-art"><img src="/art/jazz-club.svg" width="640" height="400" alt="An illustrated jazz cassette and a play-by-feel music poster" fetchpriority="high"><span class="art-caption">NO REHEARSAL REQUIRED. / VOL. 002</span></div></section>
<section class="studio" id="studio" aria-label="Your music studio">
<div class="room-bar"><button id="room-picker" class="room-picker" aria-label="Change room"><span class="live-dot"></span><span id="room-name"></span>${icon('chevron')}</button><span class="connection" id="connection">${configured ? 'CONNECTING' : 'LOCAL SESSION'}</span><button id="invite" class="invite-button">${icon('share')}<span>Invite a friend</span></button></div>
<div class="stage"><canvas id="score" aria-label="Live visual score"></canvas><div class="stage-top"><div class="avatars"><span class="avatar">YOU</span><span id="players">Just you. Room for more.</span></div><span class="stage-label">SOUND HAS NO STRAIGHT LINES <span>↗</span></span></div>
<div class="stage-center" id="stage-hint"><div class="stage-mark">${brandMark()}</div><h2>Your next good accident.</h2><p>Eight voices. Infinite ways to get a little lost.</p><button id="start" class="primary-button">Let's make some noise ${icon('arrow')}</button><small>Tap to turn on sound. Headphones recommended.</small></div>
<div id="playing-hint" class="playing-hint" hidden><span>GO ON. MAKE A MARK.</span><strong id="last-note">The room is listening.</strong></div>
<div class="stage-footer"><span><i></i><span id="status">${configured ? 'Joining the room…' : 'Local mode · shared across tabs'}</span></span><span id="note-count">000 NOTES INTO THE UNKNOWN</span></div></div>
<div class="instrument-heading"><div><span class="eyebrow">01 / PICK YOUR VOICE</span><h2>A small band, all yours.</h2></div><span class="swipe-hint">SWIPE TO EXPLORE ${icon('arrow')}</span><span class="desktop-hint">8 INSTRUMENTS · ALL SYNTHESIZED</span></div>
<div class="instruments" aria-label="Instruments">${instruments.map((item, index) => `<button class="instrument-card${index === 0 ? ' selected' : ''}" data-instrument="${item.id}" aria-pressed="${index === 0}" aria-label="${item.name}" style="--instrument-color:${item.color}"><span class="instrument-image">${instrumentArt(item.id)}</span><span class="instrument-name">${item.name}</span><span class="instrument-family">${item.family}</span><span class="selected-marker" aria-hidden="true">✓</span></button>`).join('')}</div>
<div class="performance"><div class="pad-toolbar"><div class="current-voice"><span class="voice-dot" id="voice-dot"></span><strong id="current-instrument">Soft keys</strong><span id="voice-family">WARM & WOODY</span></div><div class="tuning"><label class="scale-picker"><span class="sr-only">Scale</span><select id="scale" aria-label="Scale">${Object.entries(scales).map(([value, item]) => `<option value="${value}">${item.name}</option>`).join('')}</select>${icon('chevron')}</label><div class="octave-control" aria-label="Octave"><button id="octave-down" aria-label="Lower octave">−</button><span id="octave-value" aria-live="polite">OCT 0</span><button id="octave-up" aria-label="Raise octave">+</button></div></div></div>
<div class="keyboard" aria-label="Playable pads">${keys.map((key, i) => `<button class="pad" data-note="${i}" aria-label="Play ${scales.blues.labels[i]}, pad ${i + 1}" style="--pad-color:${colors[i % 4]}"><span class="pad-number">0${i + 1}</span><span class="note-name">${scales.blues.labels[i]}</span><span class="key-label">${key.toUpperCase()}</span><span class="pad-line"></span></button>`).join('')}</div>
<div class="playbar"><span class="play-tip"><span class="desktop-only">YOUR KEYBOARD IS AN INSTRUMENT. <kbd>A</kbd> — <kbd>K</kbd></span><span class="touch-only">TAP, HOLD & SLIDE. FIND YOUR FLOW.</span></span><div class="volume-control"><button id="mute" class="icon-button" aria-label="Mute sound" aria-pressed="false">${icon('sound')}</button><label for="volume" class="sr-only">Volume</label><input id="volume" type="range" min="0" max="100" value="${soundLevel}" aria-label="Volume"><output id="volume-value" for="volume">${soundLevel}%</output></div></div></div>
</section>
<section class="session-note"><span class="note-star">${brandMark()}</span><div><strong>A little less scrolling. A little more soul.</strong><p>There are no scores here. Just the sounds you make together.</p></div><span class="session-note-end">LISTEN. RESPOND.<br>SURPRISE YOURSELF.</span></section>
<section class="field-notes" aria-label="Ways to play"><div class="field-heading"><span class="eyebrow">A FEW NOTES BEFORE YOU GO</span><h2>Good things happen<br><em>when you play.</em></h2></div><article class="field-card"><span class="field-number">01</span><div class="field-illustration" style="--art-bg:#d9e7ac">${instrumentArt('keys')}</div><h3>Start with a feeling.</h3><p>Soft keys for a slow morning. A sax for the small hours. There’s a voice for wherever you are.</p></article><article class="field-card"><span class="field-number">02</span><div class="field-illustration" style="--art-bg:#c9bde4">${instrumentArt('vibes')}</div><h3>Leave a little space.</h3><p>Play a few notes. Let them linger. Sometimes the best part is what happens in between.</p></article><article class="field-card"><span class="field-number">03</span><div class="field-illustration" style="--art-bg:#edba91">${instrumentArt('sax')}</div><h3>Make room for someone.</h3><p>Share your room link. A friend can join from their phone. No account, no audition, just play.</p></article></section>
</main><footer><a class="brand" href="/">freeform<span>${brandMark()}</span></a><span>A SPACE FOR UNSCRIPTED SOUND.</span><span>STAY A LITTLE WEIRD ↗</span></footer>
<dialog id="help" aria-labelledby="help-title"><button id="close-help" class="dialog-close icon-button" aria-label="Close">${icon('close')}</button><div class="eyebrow">THERE'S NO WRONG WAY IN</div><h2 id="help-title">Follow your ears.</h2><p>Pick one of eight instruments, then tap the pads or press <strong>A S D F G H J K</strong>. On a phone, slide across the pads or use several fingers at once.</p><p>Try a different scale, shift the octave, or use <strong>focus mode</strong> in the top bar for more room to play. Drums have eight different hits.</p><p><strong>Build a band:</strong> tap Record loop above the pads, wait for the count-in, and play. Each take repeats automatically. Add up to six layers, or use + Notes in Your loop orchestra to overdub. Press R to record on a keyboard.</p><p>Invite a friend to your room. Everyone with the link can join; rooms are public. Loop takes are shared as note patterns while people are in the room. They are not saved as audio files. Sound starts with your first tap.</p><button id="help-done" class="primary-button">Got it. Let's play ${icon('arrow')}</button></dialog>
<dialog id="room-dialog" aria-labelledby="room-title"><button id="close-room" class="dialog-close icon-button" aria-label="Close room dialog">${icon('close')}</button><div class="eyebrow">FIND YOUR PEOPLE</div><h2 id="room-title">A room of your own.</h2><p>Choose a room name. Friends using the same name will play together.</p><form id="room-form"><label for="room-input">Room name</label><input id="room-input" name="room" type="text" maxlength="48" pattern="[a-zA-Z0-9-]+" required autocomplete="off" spellcheck="false"><small>Letters, numbers, and hyphens. Anyone with the link can join.</small><button class="primary-button" type="submit">Enter room ${icon('arrow')}</button></form></dialog><div id="toast" role="status" aria-live="polite"></div>`;

$('#room-name').textContent = room.replaceAll('-', ' ');
let toastTimer;
function toast(message) {
  $('#toast').textContent = message; $('#toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3200);
}
let beginPromise;
async function begin() {
  if (beginPromise) return beginPromise;
  beginPromise = (async () => {
    try {
      await unlock(); started = true; looper.setReady();
      $('#stage-hint').classList.add('hidden'); $('#playing-hint').hidden = false;
    } catch { toast('Sound could not start. Try tapping again in a supported browser.'); }
    finally { beginPromise = null; }
  })();
  return beginPromise;
}
$('#start').onclick = () => begin();
$('#focus').onclick = () => {
  const focus = document.body.classList.toggle('focus-mode');
  $('#focus').setAttribute('aria-pressed', String(focus));
  $('#focus').setAttribute('aria-label', focus ? 'Exit focus mode' : 'Enter focus mode');
  if (focus) window.scrollTo({ top: 0, behavior: 'instant' });
};
function updatePads() {
  const labels = instrument === 'drums' ? drumLabels : scales[scale].labels;
  document.querySelectorAll('[data-note]').forEach((pad, i) => {
    pad.querySelector('.note-name').textContent = labels[i];
    pad.setAttribute('aria-label', `Play ${labels[i]}, pad ${i + 1}`);
  });
  $('#scale').disabled = instrument === 'drums';
  $('#octave-down').disabled = instrument === 'drums' || octave === -1;
  $('#octave-up').disabled = instrument === 'drums' || octave === 1;
  $('#octave-value').textContent = `OCT ${octave > 0 ? '+' : ''}${octave}`;
}
document.querySelectorAll('[data-instrument]').forEach(button => button.onclick = () => {
  instrument = button.dataset.instrument;
  const selected = instruments.find(item => item.id === instrument);
  document.querySelectorAll('[data-instrument]').forEach(b => {
    b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button));
  });
  $('#current-instrument').textContent = selected.name;
  $('#voice-family').textContent = selected.family;
  $('#voice-dot').style.background = selected.color;
  updatePads();
});
$('#scale').onchange = event => { scale = event.target.value; updatePads(); };
$('#octave-down').onclick = () => { octave = Math.max(-1, octave - 1); updatePads(); };
$('#octave-up').onclick = () => { octave = Math.min(1, octave + 1); updatePads(); };
$('#volume').oninput = event => {
  soundLevel = Number(event.target.value); volume(soundLevel / 100); $('#volume-value').textContent = `${soundLevel}%`;
  try { localStorage.setItem('freeform-volume', String(soundLevel)); } catch {}
};
$('#mute').onclick = () => {
  isMuted = !isMuted; mute(isMuted);
  $('#mute').innerHTML = icon(isMuted ? 'muted' : 'sound');
  $('#mute').setAttribute('aria-label', isMuted ? 'Unmute sound' : 'Mute sound');
  $('#mute').setAttribute('aria-pressed', String(isMuted));
};
const help = $('#help');
$('#about').onclick = () => help.showModal();
$('#close-help').onclick = $('#help-done').onclick = () => help.close();
const roomDialog = $('#room-dialog');
$('#room-picker').onclick = () => { $('#room-input').value = room; roomDialog.showModal(); };
$('#close-room').onclick = () => roomDialog.close();
$('#room-form').onsubmit = event => {
  event.preventDefault(); const url = new URL(location.href); url.searchParams.set('room', $('#room-input').value.toLowerCase()); location.assign(url);
};
$('#invite').onclick = async () => {
  const url = new URL(location.href); url.searchParams.set('room', room);
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ title: 'Come make a little noise — Freeform', url: url.href }); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url.href); toast('Room link copied. Send it to your band.'); }
  catch { toast('Copy this room’s link from your address bar.'); }
};

const canvas = $('#score'), ctx = canvas.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let width = 0, height = 0, particles = [], frame = 0, previousTime = 0;
const pressedTimers = new Map();
function draw(time = performance.now()) {
  frame = 0;
  const delta = previousTime ? Math.min(40, time - previousTime) : 16; previousTime = time;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = '#d5ddc614'; ctx.lineWidth = 1;
  for (let row = 1; row < 6; row++) {
    ctx.beginPath(); ctx.moveTo(24, height * .18 + row * height * .115); ctx.lineTo(width - 24, height * .18 + row * height * .115); ctx.stroke();
  }
  for (const p of particles) {
    p.age += delta; ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
    ctx.fillStyle = p.color; ctx.beginPath();
    const growth = reducedMotion.matches ? 1 : 1 + p.age / 2500;
    ctx.ellipse(p.x + (reducedMotion.matches ? 0 : p.age * .013), p.y, p.r * growth, p.r * .62, -.45, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = p.color; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x + p.r * .7, p.y); ctx.lineTo(p.x + p.r * .7, p.y - 38); ctx.stroke();
  }
  ctx.globalAlpha = 1; particles = particles.filter(p => p.age < p.life);
  if (particles.length && !document.hidden) frame = requestAnimationFrame(draw);
  else previousTime = 0;
}
new ResizeObserver(() => {
  const rect = canvas.getBoundingClientRect(); width = rect.width; height = rect.height;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * ratio; canvas.height = height * ratio; ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  if (!frame) draw();
}).observe(canvas);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(frame); frame = 0; previousTime = 0; }
  else if (!frame) draw();
});
function receive(event, { audible = true } = {}) {
  if (!event || !Number.isInteger(event.note) || event.note < 0 || event.note > 7 || !instrumentIds.has(event.instrument)) return;
  const eventScale = event.scale ?? 'blues', eventOctave = event.octave ?? 0;
  if (typeof eventScale !== 'string' || !Object.hasOwn(scales, eventScale) || ![-1, 0, 1].includes(eventOctave)) return;
  if (audible) playNote(event.note, event.instrument, eventScale, eventOctave);
  count++;
  $('#note-count').textContent = `${String(count).padStart(3, '0')} NOTES INTO THE UNKNOWN`;
  const voice = instruments.find(item => item.id === event.instrument);
  $('#last-note').textContent = `${voice.name} / ${event.instrument === 'drums' ? drumLabels[event.note] : scales[eventScale].labels[event.note]}`;
  particles.push({ x: width * (.1 + Math.random() * .75), y: height * (.32 + (7 - event.note) * .055), r: 12 + Math.random() * 15, age: 0, life: reducedMotion.matches ? 600 : 2400, color: voice.color });
  if (particles.length > 64) particles.shift();
  if (!frame && !document.hidden) draw();
  const pad = $(`[data-note="${event.note}"]`);
  clearTimeout(pressedTimers.get(event.note)); pad.classList.add('pressed');
  pressedTimers.set(event.note, setTimeout(() => pad.classList.remove('pressed'), 170));
}
async function trigger(note) {
  // Snapshot the voice before the audio unlock promise resolves.
  const event = { note, instrument, scale, octave, id };
  looper.capture(event); // Capture the gesture before an audio-resume promise can delay it.
  if (!started) await begin();
  else { try { await unlock(); } catch { toast('Tap the sound button to resume audio.'); return; } }
  if (!started) return;
  receive(event);
  if (connected) channel.send({ type: 'broadcast', event: 'note', payload: event });
  else local?.postMessage(event);
}
const activePointers = new Map();
const keyboard = $('.keyboard');
keyboard.addEventListener('pointerdown', event => {
  const pad = event.target.closest('[data-note]'); if (!pad || (event.pointerType === 'mouse' && event.button !== 0)) return;
  event.preventDefault(); const note = Number(pad.dataset.note);
  activePointers.set(event.pointerId, note); keyboard.setPointerCapture(event.pointerId); trigger(note);
});
keyboard.addEventListener('pointermove', event => {
  if (!activePointers.has(event.pointerId)) return;
  const pad = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-note]');
  if (!pad || !keyboard.contains(pad)) { activePointers.set(event.pointerId, -1); return; }
  const note = Number(pad.dataset.note);
  if (activePointers.get(event.pointerId) !== note) { activePointers.set(event.pointerId, note); trigger(note); }
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) keyboard.addEventListener(type, event => activePointers.delete(event.pointerId));
window.addEventListener('blur', () => activePointers.clear());
document.querySelectorAll('[data-note]').forEach(pad => pad.addEventListener('click', event => {
  if (event.detail === 0) trigger(Number(pad.dataset.note)); // Keyboard and assistive-technology activation.
}));
window.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  const note = keys.indexOf(event.key.toLowerCase());
  if (note >= 0) { event.preventDefault(); trigger(note); }
});
const looper = mountLoopStation({
  peerId: id,
  send: packet => {
    if (connected) channel.send({ type: 'broadcast', event: 'loops', payload: packet });
    else if (!configured) local?.postMessage(packet);
  },
  ensureAudio: async () => { await begin(); return started; },
  onVisual: note => receive(note, { audible: false }),
  onNotice: toast,
});
if (configured) {
  const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  channel = supabase.channel(`freeform:${room}`, { config: { broadcast: { self: false }, presence: { key: id } } });
  channel.on('broadcast', { event: 'note' }, ({ payload }) => receive(payload))
    .on('broadcast', { event: 'loops' }, ({ payload }) => looper.receive(payload))
    .on('presence', { event: 'sync' }, () => {
      const total = Object.keys(channel.presenceState()).length;
      $('#players').textContent = total <= 1 ? 'Just you. Room for more.' : `${total} players finding their rhythm`;
    }).subscribe(async status => {
      connected = status === 'SUBSCRIBED';
      $('#connection').textContent = connected ? 'LIVE ROOM' : 'CONNECTING';
      $('#status').textContent = connected ? 'Connected · listening to each other' : 'Connecting · you can still play';
      $('.live-dot').classList.toggle('is-connected', connected);
      if (connected) { await channel.track({ joined_at: new Date().toISOString() }); looper.sync(); }
    });
  window.addEventListener('pagehide', () => supabase.removeAllChannels(), { once: true });
} else {
  local = new BroadcastChannel(`freeform:${room}`);
  local.onmessage = ({ data }) => data?.kind ? looper.receive(data) : receive(data);
  looper.sync();
  window.addEventListener('pagehide', () => local.close(), { once: true });
}
updatePads();
