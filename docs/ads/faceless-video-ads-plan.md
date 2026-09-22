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
