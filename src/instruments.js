export const instruments = [
  { id: 'keys', name: 'Soft keys', family: 'WARM & WOODY', color: '#d9e7ac', description: 'A mellow electric piano. A good place to begin.' },
  { id: 'bass', name: 'Deep bass', family: 'LOW & ROUND', color: '#b7cbbb', description: 'Low notes with a soft, rounded pulse.' },
  { id: 'drums', name: 'Loose drums', family: 'DUSTY & CRISP', color: '#edba91', description: 'Eight little percussive personalities. Find a pocket.' },
  { id: 'sax', name: 'Night sax', family: 'REEDY & RICH', color: '#e9cf82', description: 'A breathy, reedy synth voice for late-night melodies.' },
  { id: 'vibes', name: 'Glass vibes', family: 'BRIGHT & BELL-LIKE', color: '#c9bde4', description: 'Shimmering bells that leave a little space between notes.' },
  { id: 'guitar', name: 'Jazz guitar', family: 'PLUCKED & SOFT', color: '#dcab93', description: 'Soft plucks, warm harmonics, a little swing.' },
  { id: 'synth', name: 'Cloud synth', family: 'WIDE & DREAMY', color: '#a4cbd4', description: 'A drifting, filtered chord of sound.' },
  { id: 'flute', name: 'Air flute', family: 'LIGHT & BREATHY', color: '#d3d7a7', description: 'A light, airy voice for finding the spaces.' },
];
export const instrumentIds = new Set(instruments.map(i => i.id));
export const scales = {
  blues: { name: 'C blues', midi: [48, 51, 53, 54, 55, 58, 60, 63], labels: ['C', 'E♭', 'F', 'G♭', 'G', 'B♭', 'C', 'E♭'] },
  minor: { name: 'D minor', midi: [50, 52, 53, 55, 57, 58, 60, 62], labels: ['D', 'E', 'F', 'G', 'A', 'B♭', 'C', 'D'] },
  pentatonic: { name: 'A pentatonic', midi: [57, 60, 62, 64, 67, 69, 72, 74], labels: ['A', 'C', 'D', 'E', 'G', 'A', 'C', 'D'] },
};
const drawings = {
  keys: '<rect x="17" y="29" width="106" height="49" rx="7" fill="#31433b"/><path d="M22 47h96v25H22z" fill="#faf4e5"/><path d="M36 48v24m14-24v24m14-24v24m14-24v24m14-24v24m14-24v24" stroke="#a0aa92"/><path d="M30 46v15h8V46m7 0v15h8V46m21 0v15h8V46m7 0v15h8V46m6 0v15h8V46" fill="#31433b"/><circle cx="109" cy="38" r="3" fill="#dcff8b"/><path d="M27 37h42" stroke="#c1ccaf"/>',
  bass: '<path d="M83 18l6 2-20 45-6-3z" fill="#735039"/><path d="M64 50c-12-6-16 4-13 11-15 1-17 20-5 26 12 8 32-5 27-19 8-6 5-16-9-18z" fill="#b87950" stroke="#594b3b" stroke-width="2"/><path d="M85 20L55 78m28-59L53 77" stroke="#f5e0ba"/><path d="M51 73l13 5" stroke="#384b3e" stroke-width="4"/><path d="M81 17l14 5" stroke="#384b3e" stroke-width="5"/>',
  drums: '<ellipse cx="65" cy="55" rx="30" ry="13" fill="#ebdcc0" stroke="#39483e" stroke-width="3"/><path d="M35 55v20c0 17 60 17 60 0V55" fill="#b86c50" stroke="#39483e" stroke-width="3"/><ellipse cx="65" cy="55" rx="30" ry="13" fill="#f6ecd5" stroke="#39483e" stroke-width="3"/><path d="M42 61v18m15-12v18m17-18v18m14-24v18" stroke="#ebdcc0" stroke-width="3"/><path d="M27 19l51 31m27-31L56 49" stroke="#735039" stroke-width="5" stroke-linecap="round"/>',
  sax: '<path d="M84 18H71v35c0 26-29 24-29 6h-9c-3 37 52 40 52-3V18z" fill="#d7a940" stroke="#665236" stroke-width="2"/><path d="M33 59l-8-17 29 3-12 14" fill="#d7a940" stroke="#665236" stroke-width="2"/><ellipse cx="38" cy="44" rx="14" ry="5" fill="#665236"/><path d="M71 18l-8-7-11 5" fill="none" stroke="#34483c" stroke-width="6"/><path d="M71 32h13m-13 10h13m-13 10h13" stroke="#f3e3a3" stroke-width="3"/>',
  vibes: '<path d="M28 74h83m-71 0l-6 15m66-15l6 15" fill="none" stroke="#384b3e" stroke-width="4"/><path d="M34 37h11v32H34zm15-5h11v37H49zm15-5h11v42H64zm15-5h11v47H79zm15-5h11v52H94z" fill="#9184b6" stroke="#574c72" stroke-width="1.5"/><path d="M29 15l40 36m40-34L69 49" stroke="#815940" stroke-width="3"/><circle cx="29" cy="15" r="6" fill="#d2c4e9"/><circle cx="109" cy="17" r="6" fill="#d2c4e9"/>',
  guitar: '<path d="M86 14l7 4-29 45-7-5z" fill="#775039"/><path d="M55 48c-12-2-16 4-14 12-16 2-19 22-6 29 16 10 36-5 29-19 10-8 5-19-9-22z" fill="#b87550" stroke="#5d4938" stroke-width="2"/><circle cx="50" cy="68" r="9" fill="#38463c"/><circle cx="50" cy="68" r="11" fill="none" stroke="#eed6ab"/><path d="M86 16L44 80m45-63L47 82" stroke="#eed6ab"/><path d="M37 79l15 7" stroke="#38463c" stroke-width="4"/>',
  synth: '<rect x="19" y="30" width="103" height="50" rx="7" fill="#475c62"/><rect x="27" y="37" width="27" height="15" rx="2" fill="#b1d8bd"/><path d="M29 46l4-4 4 6 4-7 4 5 6-3" fill="none" stroke="#4b7567"/><circle cx="68" cy="44" r="5" fill="#d9ae80"/><circle cx="85" cy="44" r="5" fill="#c4bad7"/><circle cx="103" cy="44" r="5" fill="#e9dcae"/><path d="M27 59h86v14H27z" fill="#ede8d5"/><path d="M37 59v9m11-9v9m22-9v9m11-9v9m22-9v9" stroke="#475c62" stroke-width="6"/>',
  flute: '<g transform="rotate(-25 70 48)"><rect x="17" y="41" width="106" height="12" rx="6" fill="#c2c8b5" stroke="#64755e" stroke-width="2"/><path d="M26 41v12m88-12v12" stroke="#64755e" stroke-width="2"/><circle cx="38" cy="47" r="3" fill="#50664f"/><circle cx="57" cy="47" r="3" fill="#50664f"/><circle cx="72" cy="47" r="3" fill="#50664f"/><circle cx="87" cy="47" r="3" fill="#50664f"/><circle cx="102" cy="47" r="3" fill="#50664f"/></g><path d="M45 21q-4-13 8-16m45 64q12 0 10-11" fill="none" stroke="#788b65" stroke-width="2"/>',
};
export function instrumentArt(id) {
  return `<svg viewBox="0 0 140 100" aria-hidden="true" focusable="false"><ellipse cx="70" cy="88" rx="43" ry="5" fill="#253e2b" opacity=".09"/>${drawings[id]}</svg>`;
}
export function icon(name) {
 const paths={sound:'<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15 8a6 6 0 010 8m3-11a10 10 0 010 14"/>',muted:'<path d="M11 5L6 9H3v6h3l5 4V5zM16 9l5 6m0-6l-5 6"/>',expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',share:'<path d="M12 15V3m-4 4l4-4 4 4M6 10H4v11h16V10h-2"/>',arrow:'<path d="M5 12h14m-6-6l6 6-6 6"/>',close:'<path d="M6 6l12 12M6 18L18 6"/>',chevron:'<path d="M6 9l6 6 6-6"/>',spark:'<path d="M4 9v6M9 5v14M15 2v20M20 7v10" stroke-width="3"/>'};
 return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.spark}</svg>`;
}

export function brandMark() {
  return '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" fill="currentColor"><rect x="2" y="10" width="5" height="12" rx="2.5"/><rect x="10" y="5" width="5" height="22" rx="2.5"/><rect x="18" y="1" width="5" height="30" rx="2.5"/><rect x="26" y="8" width="5" height="16" rx="2.5"/></svg>';
}
