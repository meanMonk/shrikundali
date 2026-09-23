# videogen — Faceless Ad Video Pipeline (HyperFrames → Jitter/CapCut → ffmpeg)

Implements the plan in `docs/ads/faceless-video-ads-plan.md`: render motion from our
existing static creatives via HeyGen's open-source **HyperFrames** (HTML/CSS → MP4,
headless Chrome + ffmpeg, $0 beyond compute), then layer voiceover + captions on top.
No paid AI video generation involved.

First two videos target the Money Kundali angle from `docs/ads/money-debt-sprint-copy.md`:

| Scene | Script variant | Base creative | Length | Landing page |
|---|---|---|---|---|
| `scenes/video1-anchor-offer.html` | V4 — Flagship Anchor Offer | `E1-anchor-book-cover.png` | ~18s | `/` |
| `scenes/video2-checklist.html` | V8 — WhatsApp-Speed Direct Match | `E2-premium-pdf-template.png` | ~15s | `/` |

## Pipeline

```
HTML/CSS scene (this dir)
   │  npx hyperframes render
   ▼
output/videoN-*-master.mp4   (1080x1920, silent, animated overlays baked in)
   │  + record voiceover, uncomment <audio> tag in the scene, re-render
   ▼
output/videoN-*-master.mp4   (now with voiceover muxed in by HyperFrames itself)
   │  add captions + polish in Jitter or CapCut (see "Captions" below)
   ▼
output/videoN-final.mp4
   │  ./export-formats.sh output/videoN-final.mp4
   ▼
output/videoN-final-{9x16,4x5,1x1,16x9}.mp4   → upload to Meta/Google
```

## 1. Setup

Requires Node 22+ (repo already pins `>=20`; `node -v` should read 22.x) and ffmpeg
(already on this machine at `/opt/homebrew/bin/ffmpeg`). No install step needed —
HyperFrames runs via `npx`, which pulls it on first use and caches it.

```bash
cd packages/tools/videogen
npx hyperframes preview scenes/video1-anchor-offer.html   # live-reload preview in browser
```

## 2. Voiceover

Record a Hindi/Hinglish voiceover reading the matching script below (15-20s each).
Record yourself, or brief a Fiverr voiceover artist (₹500-1500, one-time, reusable
across every video this sprint per the plan doc).

**Video 1 script (V4 — anchor offer):**
> आपकी कुंडली में जवाब पहले से मौजूद हैं — सिर्फ देखने का सही तरीका चाहिए।
> Money Kundali Report: Dhan yog, karz ka karan, aur agle 12 mahino ka financial
> outlook — ek clean PDF mein. सिर्फ १९९ रुपये में।

**Video 2 script (V8 — WhatsApp-speed checklist):**
> Apni Kundali jaane, apna paisa pehchane! Dhan aur karz ka yog, saving blocks,
> financial planning guidance — sab kuch ek instant PDF mein. Sirf ninety-nine
> rupees mein, abhi apna report lein.

Save the file as `audio/video1-voiceover.mp3` / `audio/video2-voiceover.mp3`, then
uncomment the `<audio>` tag at the bottom of the matching scene file — HyperFrames
mixes it straight into the render, no separate muxing step needed.

## 3. Render

```bash
npm run render:anchor-offer   # → output/video1-anchor-offer-master.mp4
npm run render:checklist      # → output/video2-checklist-master.mp4
```

Re-render after any scene or audio change — deterministic, so identical inputs
always produce the identical file (safe to diff/compare across iterations).

## 4. Captions (Jitter or CapCut)

HyperFrames renders the motion (price badge, checklist ticks, CTA pulse) and, once
the `<audio>` tag is enabled, the voiceover — but caption timing depends on the
actual recorded voice, which we don't have until step 2 is done. So captions are
added after the master render, not baked into the HTML:

1. Import `output/videoN-*-master.mp4` into **Jitter** (jitter.video, free tier) —
   good fit for these flat/line-art-style creatives; add auto-synced or manual
   Hindi caption text, matching the on-screen headline/checklist copy so captions
   don't compete with what's already animating.
2. Or use **CapCut**'s free built-in Hindi auto-captions if you want automatic
   speech-to-caption instead of manually typing lines.
3. Export the captioned result back to `output/videoN-final.mp4`.

## 5. Export ad formats

```bash
./export-formats.sh output/video1-final.mp4
./export-formats.sh output/video2-final.mp4
```

Produces `-9x16` (Reels/Story, matches the master), `-4x5` and `-1x1` (Meta feed,
center-cropped), and `-16x9` (Google PMax/YouTube, padded so nothing is cut off).

## Adding a third video later

Copy an existing scene file, swap the background image (any `E1`-`E4` /
`D1`-`D6` PNG from `docs/ads/money-debt-creatives/`), retime the overlay
`data-start`/`data-duration` values to match a different script variant from
`docs/ads/money-debt-sprint-copy.md`, and add a `render:<name>` script to
`package.json`. Keep testing 1-2 clips at a time — per the plan doc, video
variants should follow winning copy, not precede it.
