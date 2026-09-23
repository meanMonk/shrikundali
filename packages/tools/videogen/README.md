# videogen — Faceless Ad Video Pipeline (HyperFrames → voiceover → Jitter/CapCut → ffmpeg)

Implements the plan in `docs/ads/faceless-video-ads-plan.md`: render motion from our
existing static ad creatives via HeyGen's open-source **HyperFrames** (HTML/CSS+GSAP →
MP4, headless Chrome + ffmpeg, $0 beyond compute), then layer voiceover + captions on
top. No paid AI video generation involved. Both compositions below are built, checked,
and render cleanly — see "Status" at the bottom.

Two Money Kundali videos, each its own HyperFrames project (`npx hyperframes init`
scaffold — this is the real project shape the CLI expects, not a single loose HTML
file):

| Project | Script variant | Base creative | Length | Landing page |
|---|---|---|---|---|
| `video1-anchor-offer/` | V4 — Flagship Anchor Offer | `E1-anchor-book-cover.png` | 18s | `/` |
| `video2-checklist/` | V8 — WhatsApp-Speed Direct Match | `E2-premium-pdf-template.png` | 15s | `/` |

## Key lesson from building these: don't re-narrate what the creative already says

`E1` and `E2` are `gpt-image-1` renders that already bake the headline, price badge,
checklist, and (for `E2`) the CTA button in as pixels — see
`docs/ads/money-debt-creatives/README.md`. The first pass at `video1` added a second
headline/price/subtext text layer on top and it looked cluttered and doubled-up (visible
in an early snapshot). **Both compositions here only add what the static image doesn't
already have**: `video1` adds a *new* checklist (info the image doesn't show) plus the
CTA button the image deliberately left blank at the bottom; `video2` adds motion only —
a slow zoom and a pulsing ring around the image's own existing CTA button — no new text
at all. If you add a third video from a different base image, check what's already
baked in before writing overlay copy.

## Pipeline

```
HyperFrames project (video1-anchor-offer/ or video2-checklist/)
   │  npm run check     (lint + runtime + layout + motion + contrast — fix before rendering)
   │  npm run render
   ▼
<project>/renders/<name>_<timestamp>.mp4   (1080x1920, silent, animation baked in)
   │  + record voiceover, add an <audio id="voiceover" data-start="0"
   │    data-duration="<len>" src="assets/voiceover.mp3"> to index.html, re-render
   ▼
<project>/renders/<name>_<timestamp>.mp4   (now with voiceover muxed in by HyperFrames)
   │  add captions + polish in Jitter or CapCut (see "Captions" below)
   ▼
<final>.mp4
   │  ./export-formats.sh <final>.mp4
   ▼
<final>-{9x16,4x5,1x1,16x9}.mp4   → upload to Meta/Google
```

## 1. Setup

Requires Node 22+ (`node -v`; repo pins `>=20`) and ffmpeg (already at
`/opt/homebrew/bin/ffmpeg` on this machine). No install step — HyperFrames runs via
`npx`, which resolves and caches the CLI on first use (confirmed working: `npx
hyperframes --version` → `0.8.62`). Running `npx hyperframes init` once also installs a
`hyperframes` Claude/Cursor/agent skill set into `~/.claude/skills` (and similar
directories for other agents) — a one-time global side effect of the tool itself, not
specific to this repo, and safe to leave in place; it's what makes the composition
contract available to an agent working on these files in a future session.

```bash
cd packages/tools/videogen/video1-anchor-offer   # or video2-checklist
npm run dev     # foreground live-reload preview (blocks until stopped)
npm run check   # lint + runtime + layout + motion + contrast in one pass — run after every edit
npm run render  # → renders/<name>_<timestamp>.mp4
```

Each project also ships `CLAUDE.md`/`AGENTS.md` (written by `hyperframes init`) with the
composition contract — read those before hand-editing `index.html` again; the short
version: one root `<div data-composition-id>` with `data-duration` set to the intended
render length, one `gsap.timeline({paused:true})` registered on
`window.__timelines["<id>"]`, and `class="clip"` on every timed element. Skipping the
timeline registration is what caused an early attempt at `video1` to silently render at
a truncated 7s instead of the intended 18s — `npm run check` catches most of this class
of mistake before it wastes a render.

## 2. Voiceover

Record a Hindi/Hinglish voiceover reading the matching script below (each is timed to
its composition's actual length — 18s / 15s). Record yourself, or brief a Fiverr
voiceover artist (₹500-1500, one-time, reusable across every video this sprint per the
plan doc).

**Video 1 script (V4 — anchor offer, ~18s):**
> आपकी कुंडली में जवाब पहले से मौजूद हैं — सिर्फ देखने का सही तरीका चाहिए।
> Money Kundali Report: Dhan yog, karz ka karan, aur agle 12 mahino ka financial
> outlook — ek clean PDF mein. सिर्फ १९९ रुपये में।

**Video 2 script (V8 — WhatsApp-speed checklist, ~15s):**
> Apni Kundali jaane, apna paisa pehchane! Dhan aur karz ka yog, saving blocks,
> financial planning guidance — sab kuch ek instant PDF mein. Sirf ninety-nine
> rupees mein, abhi apna report lein.

Save the file as `<project>/assets/voiceover.mp3`, then add this line inside the root
`<div>` in `index.html` (both files have a comment marking exactly where):

```html
<audio id="voiceover" data-start="0" data-duration="18" src="assets/voiceover.mp3"></audio>
```

(`data-duration="15"` for video2.) Run `npm run check` — it will error with
`audio_src_not_found` if the path is wrong — then `npm run render`. HyperFrames mixes
the audio straight into the render; no separate muxing step needed.

## 3. Captions (Jitter or CapCut)

Caption timing depends on the actual recorded voice, which doesn't exist until step 2
is done — so captions are added after the voiced render, not baked into the HTML:

1. Import the rendered MP4 into **Jitter** (jitter.video, free tier) — good fit for
   these flat/gold-line-art-style creatives; add auto-synced or manual Hindi caption
   text, matching the on-screen headline/checklist copy so captions don't compete with
   what's already on screen.
2. Or use **CapCut**'s free built-in Hindi auto-captions for automatic speech-to-caption
   instead of typing lines manually.
3. Export the captioned result as `<final>.mp4`.

## 4. Export ad formats

```bash
./export-formats.sh video1-anchor-offer/renders/<final>.mp4
./export-formats.sh video2-checklist/renders/<final>.mp4
```

Produces `-9x16` (Reels/Story, matches the master), `-4x5` and `-1x1` (Meta feed,
center-cropped), and `-16x9` (Google PMax/YouTube, padded so nothing is cut off). Tested
end-to-end on `video1`'s silent master render — all four variants encode cleanly.

## Adding a third video later

`npx hyperframes init packages/tools/videogen/video3-<name>` scaffolds a new project
with the same contract. Copy the `<img class="clip bg">` + timeline-registration
skeleton from one of the two existing `index.html` files, swap in a different `E1`-`E4`
/ `D1`-`D6` PNG from `docs/ads/money-debt-creatives/` as `assets/`, check what text is
already baked into that image before adding overlay copy (see the lesson above), and
retime against a different script variant from `docs/ads/money-debt-sprint-copy.md`.
Run `npm run check` before every render. Keep testing 1-2 clips at a time — per the plan
doc, video variants should follow winning copy, not precede it.

## Status

- [x] `video1-anchor-offer` — built, `npm run check` passes clean, renders to exactly
      18.0s, visually verified via `npx hyperframes snapshot`.
- [x] `video2-checklist` — built, `npm run check` passes clean, renders to exactly
      15.0s, visually verified.
- [x] `export-formats.sh` — tested against `video1`'s master render, all 4 formats
      produced successfully.
- [ ] Voiceover recording (needs a human decision: record it yourself or brief a
      freelancer — see step 2).
- [ ] Captioning pass in Jitter/CapCut (needs the voiced render from the step above).
- [ ] Both current renders are silent masters with baked-in motion only — not yet
      ad-ready until voiceover + captions are added.
