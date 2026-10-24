import { LiveLooper, MAX_LAYERS } from './looper.js';
import { instruments, instrumentArt, icon } from './instruments.js';

export function mountLoopStation({ peerId, send, ensureAudio, onVisual, onNotice }) {
  document.querySelector('.keyboard').insertAdjacentHTML('beforebegin', `
    <div class="loop-bar" aria-label="Loop recording controls">
      <button id="record-loop" class="record-loop" aria-label="Record loop"><span class="record-dot"></span><span class="record-label">Record loop</span></button>
      <div class="loop-readout"><span id="loop-status">2-bar loop</span><span class="beat-lights" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div>
      <button id="loop-play" class="loop-icon-button" aria-label="Pause loops on this device" title="Pause loops on this device" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg></button>
      <button id="loop-settings" class="loop-icon-button" aria-label="Loop settings" title="Loop settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16M9 3v6m6 0v6m-6 0v6"/></svg></button>
      <span class="loop-progress" aria-hidden="true"></span>
    </div>`);
  document.querySelector('.studio').insertAdjacentHTML('beforeend', `
    <details class="loop-station" id="loop-station"><summary><span class="loop-section-label"><span class="layer-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M3 8l9-5 9 5-9 5-9-5zm0 5l9 5 9-5M3 18l9 5 9-5"/></svg></span> YOUR LOOP ORCHESTRA</span><span id="layer-count">0 layers</span>${icon('chevron')}</summary>
      <div class="loop-station-content"><div class="loop-intro"><div><h2>Two players. A whole orchestra.</h2><p>Record a part. Let it repeat. Pick another voice and keep building.</p></div><button id="undo-loop" class="undo-loop" disabled>Undo last take</button></div>
      <div id="loop-layers" class="loop-layers"></div><p class="loop-footnote">Six layers each. Your loops are shared with the room. Pause is just for you.</p></div>
    </details>`);
  document.body.insertAdjacentHTML('beforeend', `
    <dialog id="loop-dialog" aria-labelledby="loop-title"><button id="close-loop-settings" class="dialog-close icon-button" aria-label="Close loop settings">${icon('close')}</button><div class="eyebrow">A LITTLE RHYTHM TO BUILD ON</div><h2 id="loop-title">Set the room in motion.</h2>
      <form id="loop-settings-form"><label class="loop-setting"><span>Tempo <small id="tempo-hint">Shared once the first loop is recorded.</small></span><span class="tempo-input"><input id="loop-bpm" type="number" min="60" max="180" step="1" value="100" required aria-label="Tempo in BPM"><span>BPM</span></span></label>
      <label class="loop-setting"><span>New loop length</span><select id="loop-length" aria-label="Loop length"><option value="4">1 bar</option><option value="8" selected>2 bars</option><option value="16">4 bars</option></select></label>
      <label class="loop-setting"><span>Note timing <small>Keep your feel, or snap notes to the beat.</small></span><select id="loop-quantize" aria-label="Note timing"><option value="0">Free timing</option><option value="0.5">Eighth notes</option><option value="0.25">Sixteenth notes</option></select></label>
      <label class="loop-setting"><span>Count-in & recording click <small>Only you hear the click.</small></span><input id="loop-click" type="checkbox" checked></label>
      <p class="loop-dialog-note">A count-in gives you time to get ready. Recording stops automatically, then your part repeats. Use + Notes on a layer to overdub.</p><button class="primary-button" type="submit">Ready to play ${icon('arrow')}</button></form></dialog>
    <span id="loop-announcement" class="sr-only" role="status" aria-live="polite"></span>`);
  const $ = selector => document.querySelector(selector);
  let current, lastRecordingMode = '', lastLayerSignature = '';
  const engine = new LiveLooper({ peerId, send, onVisual, onNotice, onChange: render, onTick: updateClock });
  function setText(selector, text) { if ($(selector).textContent !== text) $(selector).textContent = text; }
  function render(snapshot) {
    current = snapshot;
    $('#loop-play').disabled = !snapshot.layers.length && !snapshot.recording;
    $('#loop-play').setAttribute('aria-label', snapshot.playing ? 'Pause loops on this device' : 'Resume loops on this device');
    $('#loop-play').setAttribute('title', snapshot.playing ? 'Pause loops on this device' : 'Resume loops on this device');
    $('#loop-play').innerHTML = snapshot.playing ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7V5z"/></svg>';
    $('#record-loop').disabled = !snapshot.recording && snapshot.ownCount >= MAX_LAYERS;
    $('#undo-loop').disabled = !snapshot.canUndo || !!snapshot.recording;
    setText('#layer-count', `${snapshot.layers.length} ${snapshot.layers.length === 1 ? 'layer' : 'layers'}`);
    $('.loop-bar').classList.toggle('has-loops', snapshot.layers.length > 0);
    const signature = JSON.stringify([snapshot.layers, !!snapshot.recording]);
    if (signature !== lastLayerSignature) { lastLayerSignature = signature; renderLayers(snapshot); }
    updateClock({ beat: Date.now() / (60000 / snapshot.bpm), recording: snapshot.recording, playing: snapshot.playing });
  }
  function renderLayers(snapshot) {
    const root = $('#loop-layers'); root.replaceChildren();
    if (!snapshot.layers.length) {
      const empty = document.createElement('div'); empty.className = 'loop-empty';
      empty.innerHTML = `<div>${instrumentArt('drums')}</div><div><strong>Your band starts with one loop.</strong><p>Try a drum groove first. Add a bass line. Then take a solo.</p><span>Record above the pads · ${snapshot.beats / 4} bars · ${snapshot.bpm} BPM</span></div>`;
      root.append(empty); return;
    }
    for (const layer of snapshot.layers.toSorted((a, b) => (b.owner === peerId) - (a.owner === peerId) || a.slot - b.slot || a.owner.localeCompare(b.owner))) {
      const own = layer.owner === peerId;
      const voices = [...new Set(layer.notes.map(note => note.instrument))];
      const voice = instruments.find(item => item.id === voices[0]);
      const name = voices.length > 1 ? 'Mixed voices' : voice.name;
      const card = document.createElement('article'); card.className = `loop-layer${layer.muted ? ' is-muted' : ''}`;
      card.dataset.loopKey = layer.key; card.dataset.owner = own ? 'you' : 'partner';
      const art = document.createElement('div'); art.className = 'loop-layer-art'; art.style.background = voice.color; art.innerHTML = instrumentArt(voice.id);
      const info = document.createElement('div'); info.className = 'loop-layer-info';
      const title = document.createElement('strong'); title.textContent = name;
      const detail = document.createElement('span'); detail.textContent = `${own ? 'YOU' : 'PARTNER'} / ${layer.beats / 4} ${layer.beats === 4 ? 'BAR' : 'BARS'} / ${layer.notes.length} NOTES`;
      info.append(title, detail);
      const controls = document.createElement('div'); controls.className = 'loop-layer-controls';
      if (own) {
        const mute = document.createElement('button'); mute.type = 'button'; mute.className = 'loop-layer-mute'; mute.innerHTML = icon(layer.muted ? 'muted' : 'sound');
        mute.setAttribute('aria-label', `${layer.muted ? 'Unmute' : 'Mute'} ${name} loop`); mute.setAttribute('aria-pressed', String(layer.muted));
        mute.onclick = () => engine.toggleMute(layer.slot);
        const overdub = document.createElement('button'); overdub.type = 'button'; overdub.className = 'loop-overdub'; overdub.textContent = '+ Notes';
        overdub.setAttribute('aria-label', `Overdub ${name} loop`); overdub.disabled = !!snapshot.recording;
        overdub.onclick = async () => { if (await ensureAudio()) engine.startRecording(layer.slot); };
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'loop-remove'; remove.innerHTML = icon('close');
        remove.setAttribute('aria-label', `Remove ${name} loop`); remove.onclick = () => engine.remove(layer.slot);
        const volume = document.createElement('input'); volume.type = 'range'; volume.min = '0'; volume.max = '100'; volume.value = String(Math.round(layer.volume * 100));
        volume.setAttribute('aria-label', `${name} loop volume`); volume.onchange = event => engine.setVolume(layer.slot, Number(event.target.value) / 100);
        controls.append(mute, overdub, remove, volume);
      } else {
        const status = document.createElement('span'); status.className = 'partner-loop-status'; status.textContent = layer.muted ? 'MUTED' : 'IN THE MIX'; controls.append(status);
      }
      card.append(art, info, controls); root.append(card);
    }
  }
  function updateClock({ beat, recording, playing }) {
    if (!current) return;
    const counting = recording && beat < recording.startBeat;
    const mode = recording ? counting ? 'counting' : 'recording' : 'idle';
    if (mode !== lastRecordingMode) {
      lastRecordingMode = mode;
      $('#record-loop').setAttribute('aria-label', mode === 'counting' ? 'Cancel count-in' : mode === 'recording' ? 'Finish recording' : 'Record loop');
      $('.record-label').textContent = mode === 'counting' ? 'Cancel' : mode === 'recording' ? 'Finish take' : 'Record loop';
      $('.loop-bar').classList.toggle('is-recording', mode === 'recording');
      $('.loop-bar').classList.toggle('is-counting', mode === 'counting');
      $('#loop-announcement').textContent = mode === 'counting' ? 'Count-in started. Play when the button says Finish take.' : mode === 'recording' ? 'Recording now. Play the pads.' : '';
    }
    const remaining = recording ? Math.max(0, Math.ceil(recording.endBeat - beat)) : 0;
    setText('#loop-status', counting ? `In ${Math.ceil(recording.startBeat - beat)}` : recording ? `${remaining} beats left` : !playing ? 'Paused here' : current.layers.length ? `${current.bpm} BPM · ${current.layers.length} layers` : `${current.beats / 4}-bar loop`);
    const phase = recording && !counting ? (beat - recording.startBeat) / recording.beats : (beat % current.beats) / current.beats;
    $('.loop-bar').style.setProperty('--loop-progress', `${playing && (recording || current.layers.length) ? phase * 100 : 0}%`);
    document.querySelectorAll('.beat-lights i').forEach((dot, i) => dot.classList.toggle('active', playing && i === Math.floor(beat) % 4 && !!(recording || current.layers.length)));
  }
  async function record() {
    if (engine.recording) {
      if (Date.now() / (60000 / engine.bpm) < engine.recording.startBeat) engine.cancelRecording();
      else engine.finishRecording();
    } else if (await ensureAudio()) engine.startRecording();
  }
  $('#record-loop').onclick = record;
  $('#loop-play').onclick = async () => {
    if (!engine.playing && !(await ensureAudio())) return;
    engine.setPlaying(!engine.playing);
  };
  $('#undo-loop').onclick = () => engine.undo();
  $('#loop-settings').onclick = () => {
    $('#loop-bpm').value = engine.bpm; $('#loop-bpm').disabled = engine.layers.length > 0 || !!engine.recording;
    $('#tempo-hint').textContent = engine.layers.length ? 'Tempo stays shared while the room has loops.' : 'Shared once the first loop is recorded.';
    $('#loop-length').value = String(engine.beats); $('#loop-length').disabled = !!engine.recording;
    $('#loop-quantize').value = String(engine.quantize); $('#loop-quantize').disabled = !!engine.recording;
    $('#loop-click').checked = engine.click; $('#loop-dialog').showModal();
  };
  $('#close-loop-settings').onclick = () => $('#loop-dialog').close();
  $('#loop-settings-form').onsubmit = event => {
    event.preventDefault(); engine.configure({ bpm: Number($('#loop-bpm').value), beats: Number($('#loop-length').value), quantize: Number($('#loop-quantize').value), click: $('#loop-click').checked }); $('#loop-dialog').close();
  };
  window.addEventListener('keydown', event => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (event.key.toLowerCase() === 'r') { event.preventDefault(); record(); }
    if (event.code === 'Space' && event.target === document.body && engine.layers.length) { event.preventDefault(); engine.setPlaying(!engine.playing); }
  });
  const resync = setInterval(() => { if (!document.hidden) engine.sync(); }, 15000);
  window.addEventListener('pagehide', () => { clearInterval(resync); engine.destroy(); }, { once: true });
  engine.refresh();
  return engine;
}
