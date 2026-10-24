export const notes = [130.81,155.56,174.61,185,196,233.08,261.63,311.13];
let context, master;
export function unlock() { context ||= new AudioContext(); if (!master) { master=context.createGain(); master.gain.value=.65; master.connect(context.destination); } return context.resume(); }
export function volume(value) { if(master) master.gain.value=value; }
export function playNote(index, instrument='keys') {
 if(!context || context.state!=='running') return;
 const now=context.currentTime, gain=context.createGain(); gain.connect(master);
 if(instrument==='drums') { const buffer=context.createBuffer(1,context.sampleRate*.2,context.sampleRate); const data=buffer.getChannelData(0); for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*(1-i/data.length); const source=context.createBufferSource(); source.buffer=buffer; const filter=context.createBiquadFilter(); filter.type=index%2?'highpass':'lowpass'; filter.frequency.value=index%2?4000:250; source.connect(filter); filter.connect(gain); gain.gain.setValueAtTime(.6,now); gain.gain.exponentialRampToValueAtTime(.001,now+.2); source.start(); source.stop(now+.21); source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();}; return; }
 const osc=context.createOscillator(); osc.type=instrument==='bass'?'triangle':'sine'; osc.frequency.value=notes[index]*(instrument==='bass'?.5:1); osc.connect(gain); gain.gain.setValueAtTime(0,now); gain.gain.linearRampToValueAtTime(.45,now+.012); gain.gain.exponentialRampToValueAtTime(.001,now+1.2); osc.start(); osc.stop(now+1.25); osc.onended=()=>{osc.disconnect();gain.disconnect();};
}
