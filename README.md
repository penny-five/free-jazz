# Freeform ✳
A collaborative free jazz playground. Eight synthesized instruments, three scales, a living visual score, and shared rooms. No samples or audio service required.

## Development
Requires Node 22.12+ (validated with Node 24) and npm.

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
```

Open the dev server in a browser. Press A S D F G H J K or tap the pads. Audio starts after a gesture. Rooms are URL parameters, for example `?room=midnight-duet`. Without Supabase, local mode shares notes between tabs in the same browser; it does not connect remote users. Notes are ephemeral and never recorded.

## Playing on a phone

- Tap the expand icon in the top bar to enter focus mode. On shorter screens it shows the instruments and pads without the visualizer, keeping every pad within reach.
- Swipe the illustrated instrument strip to explore soft keys, bass, drums, sax, vibes, guitar, synth, and flute. These are synthesized interpretations, not recorded acoustic samples.
- Tap several pads at once, or keep a finger down and slide between them. Page scrolling stays available outside the pad grid.
- Choose C blues, D minor, or A pentatonic and shift one octave up or down. Drums provide eight separate percussion sounds.
- Volume is remembered on this device. Mute is local; other players still hear the notes you send. Use Invite a friend for the native share sheet on supported phones or a copied link elsewhere.

Instrument art is local SVG; there are no remote fonts or image requests. The visualizer caps display density and particles, pauses in the background, and respects reduced-motion preferences. Audio polyphony is bounded for busy rooms.

## Supabase
Create or select a Supabase project. Copy `.env.example` to `.env` and supply its project URL and **publishable** key (legacy anon keys also work):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Never use a service-role or secret API key in the frontend. Restart Vite after changing these variables. Supabase Realtime Broadcast and Presence use public channels named `freeform:<room>`; no database tables or migrations are needed. Ensure public Realtime channels are permitted in project settings. Everyone with the room link may join; rooms are not private or authenticated. Audio is synthesized independently on each client when notes arrive, so latency follows the network; this is expressive live play, not sample-accurate synchronization. Click the start button to hear others.

## Cloudflare Pages deployment
Set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` securely in the shell/environment settings. The token needs Cloudflare Pages edit permission for the selected account.

```sh
npx wrangler pages project create free-jazz --production-branch main
npm run deploy
```

Skip project creation if it already exists. Build uses Vite's Supabase variables from `.env` or process environment. For Git-integrated Pages use build command `npm run build`, output directory `dist`, and set both Vite variables in Pages build settings. The resulting browser bundle contains only the public project URL/key. No server-side secrets are required by the app. Local `.env` files are ignored by Git.

## Validation
`npm run build` builds production assets. `npm test` runs browser checks against `/usr/bin/chromium` in this cloud environment: all eight instruments, keyboard and audio controls, shared scales and room isolation, room switching, mobile fit at 320/390/768px, drag-to-play, and simultaneous touch/cancel behavior. Elsewhere install Chromium with Playwright and adjust its executable path. A live two-browser Supabase test remains required after configuring the real project: join the same room, enable audio in both, confirm player count and notes; join a different room to confirm isolation.

Deployment and live Supabase behavior require account access and are not implied by a successful local build.
