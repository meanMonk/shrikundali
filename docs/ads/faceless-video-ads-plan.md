# Faceless Video Ads — Proposal

## First: what "Hyperframe" actually is (you asked me to check)
There are two unrelated products with this name, and neither matches the "300 videos"
blueprint that got pasted around:

1. **[HyperFrames by HeyGen](https://github.com/heygen-com/hyperframes)** — free,
   open-source. It renders video from plain HTML/CSS/JS via a headless browser: you (or
   an AI) writes a webpage-like scene with CSS/GSAP animations, and it captures frames
   into an MP4. No per-video cost beyond your own compute — it's a rendering engine, not
   a generation service. This is genuinely useful for us: I can write the HTML/CSS for a
   price-tag flip or coin-drop animation using our existing static creatives as the
   background, and render it locally for free.
2. **[hyperframe.ai](https://hyperframe.ai/)** — a separate, unrelated paid "business
   video platform" that assembles videos from footage *you already have* — not an
   AI video generator from scratch.

Neither one is "Hyperframe for AI video/3D generation" the way the pasted blueprint
described it. That blueprint reads like generic scaling advice for a completely
different use case (top-of-funnel faceless content channels doing 300 short videos/month
— YouTube Shorts/TikTok creator playbook), not a paid-ads sprint for a single-SKU report
product. Some specific problems with applying it here:
- **300 videos is the wrong number for where we are.** We haven't finished a 2-week test
  of 5-10 *static* creatives yet. Video variants should follow winning copy, not precede
  it — burning production time on 300 videos before we know which 2-3 hooks convert is
  waste, not scale.
- The blueprint assumes a paid AI-video-generation step per clip (its "Hyperframe" step,
  as it describes it) at volume — that's exactly the credit-spend you said you want to
  avoid, and it's solving a problem (content-channel throughput) we don't have.

**My actual recommendation:** skip that blueprint entirely for this sprint. Use the free
HTML-render HyperFrames for the couple of hero animations we actually need.

## What "faceless" actually requires
Four separate jobs. Only one of them costs money if you do it right:

| Job | What it does | Free/cheap option | Paid option |
|---|---|---|---|
| **Motion from static art** | Turn `E1`-`E4` (or `D3`/`D4`) into a moving clip — price-tag flip, coin settle, page turn | **HeyGen's open-source HyperFrames** — I write the HTML/CSS animation, render locally, $0 beyond compute | fal.ai image-to-video (Kling/Luma) — real cost per clip, only worth it for a look no CSS animation can produce |
| **Voiceover (Hindi/Hinglish)** | Reads the ad copy over the footage | Record it yourself, or a ₹500-1500 Fiverr voiceover artist (one-time, reusable across every video this sprint) | ElevenLabs/similar TTS — needs a new API key + per-character cost |
| **Caption/motion-graphics assembly** | Animated captions, price callouts, brand type | **CapCut** (free, built-in Hindi auto-captions) or **Jitter** (free tier, good specifically for the flat line-art creatives like `D2`/`D6`) | — no paid tier needed at this volume |
| **Export formats** | 9:16 Reel/Story, 1:1 feed, 16:9 PMax | **ffmpeg** (local CLI, already available, $0) | — |

Net: with the free HTML-render path, the *only* real spend is an optional one-time
voiceover artist fee. No ongoing per-video generation credits at all.

## Recommended path for this sprint
1. I write a small HTML/CSS scene (using `E1-anchor-book-cover.png` or
   `E2-premium-pdf-template.png` as the static base) animating the one clearest beat —
   the ₹199 price badge scaling/pulsing in, or the book settling into frame — and render
   it with HyperFrames locally. Zero API cost, I can do this now if you want.
2. You (or a cheap freelancer) record a 15-20s Hindi/Hinglish voiceover reading V1 or V4
   from `money-debt-sprint-copy.md`.
3. Assemble in CapCut: HyperFrames clip as background → auto-captions synced to the
   voiceover → end card with price + CTA.
4. Export 9:16/1:1/16:9 via ffmpeg.

This gets one real test video running this week without touching fal.ai's paid video
models at all. If it performs, scale to 2-3 more variants the same way — still free.
Only reach for paid AI video generation later, and only for a specific shot that a CSS
animation genuinely can't produce (e.g., a realistic hand opening the book) — and even
then, test 1 clip before committing to more.

## What I need from you
1. **Say go** and I'll write and render the first HyperFrames test clip from `E1` or
   `E2` right now — this costs nothing, so no approval needed on spend, just on which
   base creative to animate.
2. **Voiceover** — your call: record it yourself, or point me to a freelancer budget and
   I'll draft the brief.
3. If you ever do want to test fal.ai's paid video models for a specific shot, tell me
   and I'll quote the per-clip cost before generating anything (rough range: $0.10-0.50
   for a few seconds, depending on model — small relative to the image costs we already
   spent, but real, and I won't spend it without a explicit go-ahead).

---

## Update — implementation done, verified against the real HyperFrames CLI

Built and rendered both test videos. The tool is genuinely free (npx-based, no API key,
no account needed to render locally) and it works, but its actual contract is stricter
than the summary above implied — worth recording here since it changes how a third
video should be built later.

### What HyperFrames actually requires (not just "write HTML/CSS")

It is not a generic "any seekable CSS animation" renderer. A composition needs, in this
exact shape (confirmed via `npx hyperframes init`, `check`, `render`, and `snapshot`
against real output):

- A project scaffold (`npx hyperframes init <dir>`) — not a loose HTML file. This gives
  `index.html`, `package.json` (`npm run dev/check/render`), `hyperframes.json`
  (asset paths), and `meta.json`.
- One root `<div data-composition-id="..." data-start="0" data-duration="<seconds>">`
  — **`data-duration` on the root is what actually sets the render length.** Omitting it
  (or getting the composition-id wrong) is exactly what made the first attempt silently
  render a 7-second clip instead of the intended 18s.
- **One `gsap.timeline({ paused: true })` registered on
  `window.__timelines["<composition-id>"]`.** Raw CSS `@keyframes` without this
  registration is not the supported path — the timeline is what the renderer seeks
  frame-by-frame.
- `class="clip"` on every timed visual element.
- `npm run check` — lints + validates layout/contrast/motion — before every render.
  This caught two real bugs worth naming because they're easy to repeat: (1) a CSS
  `inset: 0` shorthand on `.clip` silently stretched every absolutely-positioned text
  overlay's bounding box all the way to the bottom of the canvas even though only the
  `top` offset was overridden per element — this made a translucent scrim panel cover
  and occlude elements positioned below it that were never touched visually but were
  spatially inside that invisible stretched box; fixed by setting `bottom: auto; height:
  auto` on the overlay class. (2) named fonts (e.g. "Noto Sans Devanagari") need either a
  real `@font-face` or `src: local("...")`, or the linter fails the whole check.

### The two rendered videos

Live in `packages/tools/videogen/` — full pipeline, setup, and status in that package's
`README.md`. Summary:

| Project | Base creative | Script | Length | Status |
|---|---|---|---|---|
| `video1-anchor-offer/` | `E1-anchor-book-cover.png` | V4 (`money-debt-sprint-copy.md`) | 18.0s, verified | Silent master rendered, `check` passes clean |
| `video2-checklist/` | `E2-premium-pdf-template.png` | V8 (`money-debt-sprint-copy.md`) | 15.0s, verified | Silent master rendered, `check` passes clean |

**The one design lesson worth carrying forward:** `E1` and `E2` are `gpt-image-1`
renders that already bake their headline, price badge, and (for `E2`) full checklist +
CTA button in as pixels. The first draft of `video1` added a *second* headline/price
text layer on top of the image and it looked cluttered and doubled-up in a visual
snapshot check — caught before wasting a real render. The fix, now reflected in both
compositions: only animate what the static image *doesn't* already say. `video1` adds a
new checklist (real new info) and the CTA button into the image's own deliberately-empty
bottom bar; `video2` adds motion only — a slow zoom plus a pulsing ring around the
image's own existing CTA button, no new text.

### What's left before either video is ad-ready
1. **Voiceover** — not recorded yet. Scripts for both videos, timed to the actual
   rendered length, are in `packages/tools/videogen/README.md`. Same open question as
   before: record it yourself, or brief a Fiverr artist.
2. **Captions** — added after the voiceover exists (timing depends on the real spoken
   audio), via Jitter or CapCut as originally planned, then exported back into the
   project's `renders/` output.
3. **Format export** — `packages/tools/videogen/export-formats.sh` is written and
   tested (ran successfully against `video1`'s master render, producing 9:16/4:5/1:1/16:9
   variants via ffmpeg). Run it again on the final captioned file before upload.

No paid generation was used anywhere in this — HyperFrames rendering is 100% local
compute, same as planned.
