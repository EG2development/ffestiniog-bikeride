# Remotion 4 packages and compatible JS/three.js libraries for a geographic cycling-route film (Blender + Remotion)

Research date: 2026-11-01. Package versions, licences, dates and peer dependencies were read straight from the npm registry (`npm view <pkg> version license time.modified peerDependencies`) on that date. Citations for those facts point to each package's npm page.

Project pins (from `package.json`): `remotion`, `@remotion/cli`, `@remotion/three`, `@remotion/bundler`, `@remotion/renderer`, `@remotion/eslint-config-flat` all at 4.0.539; `three` 0.186.1; `@react-three/fiber` 9.8.2. No other `@remotion/*` packages and no postprocessing or geospatial libraries are installed yet.

## 1. Official Remotion packages (4.0.539): which ones help this project, and what are the licence and renderer options?

### Takeaway
4.0.539 (published 2026-10-26) is the latest version, and every official package ships in lockstep at that version. The most useful packages for this film are `@remotion/media` (`<Video>`/`<Audio>`, the recommended way to embed Blender intermediates), `@remotion/captions`, `@remotion/google-fonts` or `@remotion/fonts`, `@remotion/transitions`, `@remotion/paths`, `@remotion/noise`, `@remotion/layout-utils`, `@remotion/sfx` and `@remotion/motion-blur`, plus the renderer's NVENC hardware acceleration (H.264/H.265 only) for fast local renders. `@remotion/lambda` and `@remotion/cloudrun` need AWS or GCP accounts and add nothing for one long local film. Remotion is free for individuals, non-profits and for-profits with up to 3 people. Larger organisations pay $25 per seat per month.

### Cited Findings
**Versions and release cadence**
- `remotion` latest is 4.0.539, published 2026-10-26T11:11Z. Earlier milestones: 4.0.400 on 2026-01-05, 4.0.450 on 2026-04-20, 4.0.484 on 2026-06-26, 4.0.500 on 2026-07-27, 4.0.530 on 2026-09-29. The project is on the newest release — [npm: remotion](https://www.npmjs.com/package/remotion)
- `@remotion/three` 4.0.539 declares the peer dependencies `three >=0.137.0`, `@react-three/fiber >=8.0.0`, `react >=16.8.0` and `remotion` pinned exactly to 4.0.539. So every `@remotion/*` package must be pinned to the same exact version as `remotion` — [npm: @remotion/three](https://www.npmjs.com/package/@remotion/three)

**Package shortlist.** Every package below is at 4.0.539 and was last modified 2026-10-26. Licence strings are taken from npm.

| Package | Licence (npm field) | Purpose and benefit for this film | Source |
|---|---|---|---|
| `@remotion/media` | (no licence field; depends on `mediabunny` 1.62.0 and `zod`) | `<Video>` is "the recommended component for embedding videos". It decodes the exact frame with Mediabunny and draws it to a `<canvas>`. It falls back to `<OffthreadVideo>` automatically. Props include `trimBefore`, `from`/`durationInFrames` (4.0.446), `playbackRate`, `objectFit` (4.0.442), crops, `premountFor`/`postmountFor`, `maxCanvasSinkFrameSize` (4.0.530, preview memory) and `headless` with `onVideoFrame` (for three.js textures). It cannot play in reverse, and CSS `object-fit` is unsupported. | [Remotion docs: Video](https://www.remotion.dev/docs/media/video), [npm](https://www.npmjs.com/package/@remotion/media) |
| `@remotion/media-parser` | "Remotion License" | Parses media metadata. `@remotion/media` now uses Mediabunny instead, so this is not needed here. | [npm](https://www.npmjs.com/package/@remotion/media-parser) |
| `@remotion/webcodecs` | "Remotion License" | Browser-side conversion. Not needed for a local CLI render. | [npm](https://www.npmjs.com/package/@remotion/webcodecs) |
| `@remotion/captions` | MIT | The `Caption` type plus converters from whisper.cpp (`@remotion/install-whisper-cpp`), whisper-webgpu, OpenAI Whisper and ElevenLabs transcripts. Available since 4.0.216. | [Docs](https://www.remotion.dev/docs/captions/api), [npm](https://www.npmjs.com/package/@remotion/captions) |
| `@remotion/transitions` | "UNLICENSED" (i.e. covered by the Remotion licence, not open source) | Fades and wipes between Blender shots and 3D or map scenes. | [npm](https://www.npmjs.com/package/@remotion/transitions) |
| `@remotion/paths` | MIT | SVG path utilities, e.g. drawing the route line progressively on 2D map overlays. | [npm](https://www.npmjs.com/package/@remotion/paths) |
| `@remotion/noise` | MIT | Deterministic noise for camera shake and organic motion. | [npm](https://www.npmjs.com/package/@remotion/noise) |
| `@remotion/shapes` | MIT | Simple shapes for overlays and markers. | [npm](https://www.npmjs.com/package/@remotion/shapes) |
| `@remotion/layout-utils` | MIT | Text measuring and fitting, useful for bilingual title cards of different lengths. | [npm](https://www.npmjs.com/package/@remotion/layout-utils) |
| `@remotion/google-fonts` | "SEE LICENSE IN LICENSE.md" | `loadFont(style, {weights, subsets})` blocks rendering until the font is ready. `subsets` accepts e.g. `latin-ext`. `weights` and `subsets` become required in v5.0. | [Docs](https://www.remotion.dev/docs/google-fonts/load-font), [npm](https://www.npmjs.com/package/@remotion/google-fonts) |
| `@remotion/fonts` | MIT | Loads self-hosted local font files, so renders need no network. | [npm](https://www.npmjs.com/package/@remotion/fonts) |
| `@remotion/lottie` | "SEE LICENSE IN LICENSE.md" | Lottie animations, e.g. animated icons. Optional. | [npm](https://www.npmjs.com/package/@remotion/lottie) |
| `@remotion/three` | MIT | Already installed. See Q4. | [npm](https://www.npmjs.com/package/@remotion/three) |
| `@remotion/gif` | "SEE LICENSE IN LICENSE.md" | GIF playback synced to frames. Low value here. | [npm](https://www.npmjs.com/package/@remotion/gif) |
| `@remotion/sfx` | MIT (each sound has its own licence) | Sound-effect URLs, peak-normalised to -3 dB, usable without attribution. Since 4.0.429. | [Docs](https://www.remotion.dev/docs/sfx) |
| `@remotion/motion-blur` | MIT | Camera motion blur on fast 2D/3D moves. | [npm](https://www.npmjs.com/package/@remotion/motion-blur) |
| `@remotion/light-leaks` | "Remotion License" | Light-leak transitions, a photo-look finish. | [npm](https://www.npmjs.com/package/@remotion/light-leaks) |
| `@remotion/rounded-text-box`, `@remotion/animation-utils`, `@remotion/media-utils`, `@remotion/preload` | MIT, or no licence field | Caption boxes, interpolation helpers, audio visualisation and duration helpers, preloading. | [npm: rounded-text-box](https://www.npmjs.com/package/@remotion/rounded-text-box), [npm: media-utils](https://www.npmjs.com/package/@remotion/media-utils) |
| `@remotion/install-whisper-cpp` | "SEE LICENSE IN LICENSE.md" | Local transcription to build caption timings. | [npm](https://www.npmjs.com/package/@remotion/install-whisper-cpp) |
| `@remotion/whisper-webgpu` | MIT | In-browser transcription. | [npm](https://www.npmjs.com/package/@remotion/whisper-webgpu) |
| `@remotion/openai-whisper`, `@remotion/elevenlabs` | MIT | Converters for paid cloud APIs. Each needs an account. | [npm: elevenlabs](https://www.npmjs.com/package/@remotion/elevenlabs) |
| `@remotion/lambda` | "SEE LICENSE IN LICENSE.md" | AWS distributed rendering. Needs an AWS account. | [npm](https://www.npmjs.com/package/@remotion/lambda) |
| `@remotion/cloudrun` | (no licence field) | GCP Cloud Run rendering. Needs a GCP account. | [npm](https://www.npmjs.com/package/@remotion/cloudrun) |
| `@remotion/web-renderer` | "SEE LICENSE IN LICENSE.md" | Client-side rendering. Not needed. | [npm](https://www.npmjs.com/package/@remotion/web-renderer) |
| `@remotion/licensing` | MIT | Usage reporting for company licences. | [npm](https://www.npmjs.com/package/@remotion/licensing) |

**Remotion licence**
- The Free License covers "an individual", "a for-profit organization with up to 3 employees", "a non-profit or not-for-profit organization", and anyone "evaluating whether Remotion is a good fit". Free use may be commercial or non-commercial "for the purpose of creating videos and images". Everyone else needs a Company License. The licence "will change slightly in Remotion 5.0" — [Remotion LICENSE.md](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)
- Company License pricing:
  - "Remotion for Creators": $25/mo per seat.
  - "Remotion for Automators": $0.01 per render with a $100/mo minimum.
  - Enterprise: "Starting at $500 per month".
  - The pricing page phrases the free tier as "individuals and companies up to three people" and the paid tier as "collaborations and companies of 4+ people". This wording differs slightly from LICENSE.md, which says "employees" and explicitly includes non-profits.
  - [remotion.pro/license](https://www.remotion.pro/license)

**Renderer options**
- Hardware acceleration:
  - Set with `hardwareAcceleration` in `renderMedia()`, `--hardware-acceleration` on the CLI, `Config.setHardwareAcceleration()`, or the Studio "Advanced" tab.
  - Values are `"disabled"` (the default), `"if-possible"` and `"required"`.
  - On Windows and Linux it uses NVENC from v4.0.484. NVENC supports only H.264 and H.265, and other codecs fall back to software. ProRes hardware encoding is macOS (VideoToolbox) only.
  - The bundled Windows x64 FFmpeg includes `h264_nvenc` and `hevc_nvenc`. NVIDIA driver 525+ is recommended.
  - Hardware-encoded files are larger by default. Use `--video-bitrate` (e.g. 8M for roughly software-quality H.264 at Full HD), because `crf` is not supported.
  - Lambda and Cloud Run do not support this option.
  - [Remotion docs: Hardware acceleration](https://www.remotion.dev/docs/hardware-acceleration)
- Concurrency: Remotion's map tutorial renders with `--gl=angle --concurrency=1` and recommends single concurrency for "WebGL-heavy map renders" — [Remotion docs: Maps](https://www.remotion.dev/docs/maps)
- OpenGL renderer for three.js: three.js "does not work with the default OpenGL renderer", so use `angle`. Set `Config.setChromiumOpenGlRenderer('angle')` in the config file, or pass `chromiumOptions: {gl: "angle"}` to `renderMedia()`/`renderFrames()`/`getCompositions()` for server-side rendering, because the config file does not apply there — [Remotion docs: @remotion/three](https://www.remotion.dev/docs/three)

**Map techniques**
- Remotion's official map recipe uses **MapLibre GL JS** with Turf.js (`npm i --save-exact maplibre-gl @turf/turf`):
  - Map options: `interactive: false`, `fadeDuration: 0`, and `canvasContextAttributes: {preserveDrawingBuffer: true}`.
  - Loading: call `delayRender` at mount and `continueRender` on the next `idle` event.
  - Per frame: take a `delayRender` handle and release it on `idle`, forcing `map.triggerRepaint()` even when the camera has not changed.
  - Do not call `map.remove()` in cleanup.
  - Keep Turf route slices non-empty, because zero-length slices can error.
  - [Remotion docs: Maps](https://www.remotion.dev/docs/maps)
- Map library versions:
  - `maplibre-gl` 6.16.0, BSD-3-Clause, updated 2026-10-25 — [npm](https://www.npmjs.com/package/maplibre-gl)
  - `@turf/turf` 7.4.0, MIT — [npm](https://www.npmjs.com/package/@turf/turf)
  - `mapbox-gl` 3.34.1 has the licence field "SEE LICENSE IN LICENSE.txt", i.e. it is not open source — [npm](https://www.npmjs.com/package/mapbox-gl)
  - `@deck.gl/core` 9.4.1, MIT, updated 2026-10-30; it brings its own `@luma.gl` 9.4 stack — [npm](https://www.npmjs.com/package/@deck.gl/core)

### Inferences
- The project almost certainly qualifies for the Free License if an individual or a community non-profit makes the film. If a company of 4+ people commissions or produces it, budget $25 per seat per month for each person who works on it.
- Add these packages, all pinned to exactly 4.0.539: `@remotion/media`, `@remotion/transitions`, `@remotion/captions`, `@remotion/fonts` (preferred over google-fonts so renders need no network), `@remotion/layout-utils`, `@remotion/noise` and `@remotion/paths`. Optionally add `@remotion/motion-blur`, `@remotion/light-leaks` and `@remotion/sfx`.
- Skip `media-parser`, `webcodecs`, `web-renderer`, `lambda`, `cloudrun` and `gif`.
- On the RTX 2060, render the final delivery as H.264 or H.265 with `--hardware-acceleration=if-possible --video-bitrate=...`. AV1 encode is unavailable on Turing, and NVENC does not do it in Remotion anyway.
- On Windows, ProRes masters are encoded in software, which is slower.
- Keep `--concurrency=1` (or low) for compositions that use WebGL or three.js. That limits throughput, so pre-rendering heavy 3D in Blender and compositing it as video is the faster path.
- MapLibre with open tiles (e.g. OpenStreetMap-derived or self-hosted PMTiles) avoids Mapbox's token and proprietary licence. deck.gl adds a second WebGL stack (luma.gl), which is redundant next to three.js.

### Gaps
- I could not fetch the rendered package index (`/docs/api`), so the official list above was assembled from npm queries. There may be official packages I did not query, e.g. `@remotion/rive` and `@remotion/skia`, which are irrelevant here.
- I did not find an official Remotion "remotion-maps" package. The maps page is a tutorial, not a package. Cesium and static-map approaches are not covered in Remotion's docs.
- The `@remotion/transitions` npm licence field "UNLICENSED" probably means it is governed by the Remotion licence. I did not confirm this on a docs page.

## 2. What is the best way to bring Blender output into Remotion?

### Takeaway
Two routes work:
- **Opaque shots:** render from Blender to an H.264 or ProRes intermediate (or a PNG sequence) and play it with `@remotion/media` `<Video>` inside a `<Sequence>`.
- **Overlays with alpha:** use PNG sequences, or ProRes 4444 (decoded through the `@mediabunny/prores` extension from 4.0.487), or WebM VP8/VP9 with alpha.

PNG sequences give the strongest frame accuracy, because each Remotion frame maps 1:1 to a file via `staticFile()` + `<Img>` + `useCurrentFrame()`. The cost is disk use in `public/`.

### Cited Findings
- **Image sequences:** put numbered files in `public/` and build the path from `useCurrentFrame()` inside an `<Img>`. Docs examples pad frame numbers with `padStart(3,"0")`. `staticFile()` handles URI-unsafe characters such as `#` since v4.0.0, so do not encode filenames yourself — [Remotion docs: staticFile()](https://www.remotion.dev/docs/staticfile)
- **Rendering Remotion's own frames:** `renderFrames()` defaults to JPEG, and PNG keeps alpha. `imageSequencePattern` (`--image-sequence-pattern`) supports `[frame]` and `[ext]` tokens and defaults to `element-[frame].[ext]` — [Remotion docs: Image Sequence Pattern](https://www.remotion.dev/docs/options/image-sequence-pattern)
- **Video embedding:** `@remotion/media` `<Video>` decodes the exact timeline frame and keeps sync with Remotion's timeline. If it cannot decode a file, it falls back to `<OffthreadVideo>`. Pass `disallowFallbackToOffthreadVideo` to make the render fail instead — [Remotion docs: Video](https://www.remotion.dev/docs/media/video)
- **Codec support and fallback:**
  - Matroska (`.mkv`, `.webm`) is supported.
  - **ProRes decoding requires `@mediabunny/prores`, from 4.0.487.**
  - Assets must come through `staticFile()` or be CORS-enabled.
  - Fallback to `<OffthreadVideo>` happens for an unsupported codec, missing CORS, or "an alpha channel without browser WebGL support".
  - For Matroska, extracting audio near the end of a long file is expensive, and non-Matroska files (MP4, MOV) are preferred for distributed rendering.
  - [Remotion docs: Media support](https://www.remotion.dev/docs/media/support)
- `@mediabunny/prores` 1.65.0 (MPL-2.0) is an "Apple ProRes decoder extension for Mediabunny, based on TurboRes". `mediabunny` itself is 1.65.0, MPL-2.0, while `@remotion/media` 4.0.539 bundles `mediabunny` 1.62.0 — [npm: @mediabunny/prores](https://www.npmjs.com/package/@mediabunny/prores), [npm: mediabunny](https://www.npmjs.com/package/mediabunny), [npm: @remotion/media](https://www.npmjs.com/package/@remotion/media)
- **Transparency:**
  - Remotion can render WebM with alpha (PNG frames, VP8/VP9, `yuva420p`) or ProRes 4444 (`prores`, profile `4444` or `4444-xq`, `yuva444p10le`, PNG frames).
  - Final Cut, Premiere and DaVinci Resolve support ProRes 4444.
  - When embedding, `<OffthreadVideo>` needs the `transparent` prop, which slows rendering slightly. `@remotion/media` `<Video>` needs no prop, and its fallback enables transparency by default.
  - On Lambda, WebM alpha can flicker at chunk boundaries.
  - [Remotion docs: Transparent videos](https://www.remotion.dev/docs/transparent-videos)
- **Preview performance:** `maxCanvasSinkFrameSize` (4.0.530) reduces preview frame size to save memory in Studio without affecting the final render. `premountFor` and `postmountFor` help with buffering — [Remotion docs: Video](https://www.remotion.dev/docs/media/video)

### Inferences
- **Recommended pipeline:**
  - Render the Blender beauty passes as 8-bit or 16-bit PNG sequences at the Remotion composition fps, so frame N of Blender equals frame N of the `<Sequence>`.
  - For long opaque shots, encode the sequence to an all-intra intermediate (ProRes 422 HQ with `@mediabunny/prores`) or to a high-bitrate H.264 MP4. That keeps `public/` small and Studio responsive.
  - Use PNG sequences, not WebM alpha, for overlays such as riders and labels with alpha. PNG avoids decoder questions and the "alpha without WebGL" fallback.
- **Frame-accurate sync:** match fps exactly between Blender's scene settings and Remotion's `<Composition fps>`. Offset each clip with `<Sequence from>` or `trimBefore`, not with `playbackRate`.
- **Colour:**
  - Blender's AgX (or Filmic/Standard) view transform is applied when saving display-referred formats (PNG/JPEG/MP4), but not to linear EXR. So save PNG or MOV with "Save as Render" or the view transform applied, in sRGB, and Remotion will show the same look.
  - Avoid EXR into Remotion: browsers cannot display it, and it would need a separate tone map.
  - Keep any later grade in one place, either Blender or the Remotion CSS/WebGL layer, to avoid doubled contrast.
  - This is general Blender colour-management knowledge, not confirmed in a fetched source.
- **Large files:** in Studio, prefer MP4/MOV intermediates or a downscaled proxy plus `maxCanvasSinkFrameSize` over tens of thousands of full-resolution PNGs.

### Gaps
- I did not fetch the ProRes embedding guide that the media-support page links to, so I could not confirm exact setup steps for `@mediabunny/prores` (e.g. how to register the decoder).
- I found no Remotion-specific documentation on colour management (sRGB vs AgX) or on Windows HEVC decode in `<Video>`.
- I found no source quantifying Remotion Studio's limits with very large image sequences.

## 3. Bilingual (Welsh/English) captions, subtitles, fonts and voiceover

### Takeaway
- **Captions:** `@remotion/captions` (MIT) is the standard caption data model, and the transcription packages feed it. Captions can be burned in, or exported separately as SRT/WebVTT for platform subtitles.
- **Welsh letters:** ŵ and ŷ are in Latin Extended-A, so load `latin-ext` subsets or self-host fonts with full Latin-Ext coverage.
- **Welsh voiceover:** a CC0 voice exists from Bangor University's Techiaith (Piper-based `cy_GB-bu_tts`). Microsoft Azure offers commercial cy-GB neural voices (Nia, Aled), which need a cloud account.

### Cited Findings
- The `Caption` type is "the central type" of `@remotion/captions` and normalises captions from different sources. The converters are:
  - `@remotion/install-whisper-cpp` `toCaptions()`
  - `@remotion/whisper-webgpu` `toCaptions()`
  - `@remotion/openai-whisper` `openAiWhisperApiToCaptions()`
  - `@remotion/elevenlabs` `elevenLabsTranscriptToCaptions()`

  The package is MIT and available since 4.0.216 — [Remotion docs: @remotion/captions](https://www.remotion.dev/docs/captions/api)
- **Fonts:**
  - `@remotion/google-fonts` `loadFont()` accepts `subsets` (examples include `latin-ext`) and `weights`. Narrowing them reduces file size and avoids render timeouts.
  - `loadFont()` blocks rendering until the font is ready, and `waitUntilDone()` (4.0.135) returns a promise.
  - Loading a font that makes more than 20 requests prints a warning, which `ignoreTooManyRequestsWarning` (4.0.283) silences.
  - [Remotion docs: loadFont()](https://www.remotion.dev/docs/google-fonts/load-font)
  - `@remotion/fonts` is MIT — [npm](https://www.npmjs.com/package/@remotion/fonts)
- **Welsh TTS (Techiaith):** Bangor University's `cy_GB-bu_tts` is a Welsh neural TTS built with Piper, released CC0-1.0 and trained on the bu-tts-cy-en dataset. The companion `techiaith-g2p` is also CC0-1.0, but its bundled pronunciation data is BSD-2-Clause. The package page warns not to feed this voice to stock piper. Sources name the model inconsistently ("cy_en_GB-bu_tts" vs "cy_GB-bu_tts") — [Hugging Face mirror: cy_GB-bu_tts](https://hface.pages.dev/techiaith/cy_GB-bu_tts), [PyPI: techiaith-g2p](https://pypi.org/project/techiaith-g2p/)
- **Welsh TTS (Azure):** Microsoft Azure Neural TTS includes Welsh (cy-GB) voices Nia and Aled — [Microsoft Tech Community](https://techcommunity.microsoft.com/t5/azure-ai/eleven-more-languages-are-generally-available-for-azure-neural/ba-p/2236871)

### Inferences
- **Fonts:** ŵ (U+0175) and ŷ (U+0177) sit in Unicode Latin Extended-A. Google Fonts' `latin-ext` subset covers that range, so always request `subsets: ['latin', 'latin-ext']`. Better still, self-host the font with `@remotion/fonts` and verify the glyphs, e.g. render a test card with "Ffestiniog, Blaenau, ŵ ŷ Ŵ Ŷ â ê î ô û".
- **Subtitles:**
  - Keep a single bilingual source file (e.g. JSON of `Caption` objects, or two SRTs, `cy` and `en`).
  - Burn in the on-screen bilingual titles.
  - Also export separate `.srt` or `.vtt` sidecars, so viewers can choose a language and screen readers and platform players get proper subtitles. Accessibility good practice is sidecar subtitles plus adequate contrast and duration.
  - Whisper-based transcription of Welsh speech is likely weaker than for English, so expect manual correction of timings and text.
- **Voiceover:** the Techiaith CC0 voice is the only fully free, offline, public-domain Welsh option found. Azure needs an Azure account and has paid usage terms (not verified here). ElevenLabs is also a paid cloud account.

### Gaps
- I did not verify the exact `@remotion/captions` function list for SRT parsing and serialising (`parseSrt`, `serializeSrt`) or WebVTT support, because the API index did not render.
- Azure cy-GB voice licence and usage terms were not found in the sources reviewed.
- I found no confirmed source on ElevenLabs Welsh support or its quality.
- I found no evaluation of Whisper's Welsh accuracy.

## 4. three.js ecosystem compatible with three 0.186.1 and R3F 9.8.2 (no drei), and determinism in Remotion

### Takeaway
Everything below is compatible with three 0.186.1, R3F 9.8.2 and React 19:
- `postprocessing` 6.39.5 (its peer range `<0.187.0` caps three upgrades)
- `@react-three/postprocessing` 3.2.2
- `three-mesh-bvh` 0.9.17
- `3d-tiles-renderer` 0.5.3
- `three-gpu-pathtracer` 0.0.27
- `meshoptimizer` 1.3.0
- the Takram `three-geospatial` family (atmosphere 0.19.1, clouds 0.7.6), where drei is only an optional peer

In Remotion, every animation must be driven from `useCurrentFrame()`, never from R3F's `useFrame()` or wall clocks.

### Cited Findings
**Determinism in `@remotion/three`**
- `<ThreeCanvas>` lets `useCurrentFrame()` work inside an R3F canvas. Animations are written "directly into the markup rather than inside `useFrame()`".
- `<ThreeWebGPUCanvas>` uses `WebGPURenderer` with TSL node materials.
- `useVideoTexture()` uses `<Html5Video>`. `useOffthreadVideoTexture()` provides the exact frame as an image texture during rendering.
- A `<Sequence>` inside a `<ThreeCanvas>` must use `layout="none"`.
- [Remotion docs: @remotion/three](https://www.remotion.dev/docs/three)
- `@remotion/media` `<Video headless onVideoFrame>` can feed frames to three.js textures without drawing a canvas — [Remotion docs: Video](https://www.remotion.dev/docs/media/video)

**Compatibility matrix** (npm data, 2026-11-01)

| Package | Version / last modified | Licence | Peer dependencies | Fit with project | Source |
|---|---|---|---|---|---|
| `postprocessing` (pmndrs) | 6.39.5 / 2026-09-09 | Zlib | `three >=0.168.0 <0.187.0` | Compatible with 0.186.1, but blocks a three 0.187 upgrade until it is bumped | [npm](https://www.npmjs.com/package/postprocessing) |
| `@react-three/postprocessing` | 3.2.2 / 2026-10-21 | MIT | `react ^19`, `three >=0.156`, `postprocessing ^6.36.0`, `@react-three/fiber >=9.7.0` | Compatible (R3F 9.8.2) | [npm](https://www.npmjs.com/package/@react-three/postprocessing) |
| `n8ao` (SSAO) | 2.0.1 / 2026-08-10 | ISC | `postprocessing >=6.30`, `three >=0.137` | Compatible | [npm](https://www.npmjs.com/package/n8ao) |
| `realism-effects` | 1.1.2 / 2023-05-12 | MIT | `postprocessing >=6.30.1`, `three >=0.148` | Stale (2023). Avoid. | [npm](https://www.npmjs.com/package/realism-effects) |
| `three-mesh-bvh` | 0.9.17 / 2026-10-28 | MIT | `three >=0.159` | Compatible. Fast raycasts, e.g. snapping riders and cameras to terrain. | [npm](https://www.npmjs.com/package/three-mesh-bvh) |
| `three-gpu-pathtracer` | 0.0.27 / 2026-10-08 | MIT | `three >=0.185`, `three-mesh-bvh >=0.9.15`, `xatlas-web ^0.1.0` | Compatible with 0.186.1 | [npm](https://www.npmjs.com/package/three-gpu-pathtracer) |
| `3d-tiles-renderer` (NASA-AMMOS) | 0.5.3 / 2026-09-18 | Apache-2.0 | `three >=0.167`, `@react-three/fiber ^8.17.9 \|\| ^9.0.0`, `react ^18.3.1 \|\| ^19` (all optional); deps `pmtiles`, `@mapbox/vector-tile` | Compatible. R3F bindings included, no drei. | [npm](https://www.npmjs.com/package/3d-tiles-renderer) |
| `@takram/three-geospatial` | 0.9.1 / 2026-05-06 | MIT | `three >=0.170`, `@react-three/fiber >=9.0.4`, `react >=19` | Compatible | [npm](https://www.npmjs.com/package/@takram/three-geospatial) |
| `@takram/three-atmosphere` | 0.19.1 / 2026-05-06 | MIT | `three >=0.170`, `postprocessing >=6.36.7`; `@react-three/drei >=10.0.2` is **optional** (as are fiber, r3f-postprocessing and react); dep `astronomy-engine` | Compatible without drei (vanilla or R3F path) | [npm](https://www.npmjs.com/package/@takram/three-atmosphere) |
| `@takram/three-clouds` | 0.7.6 / 2026-05-06 | MIT | Same as atmosphere; drei optional | Compatible | [npm](https://www.npmjs.com/package/@takram/three-clouds) |
| `@takram/three-geospatial-effects` | 0.6.4 / 2026-05-06 | MIT | `postprocessing >=6.36.4`, r3f-postprocessing, fiber | Compatible | [npm](https://www.npmjs.com/package/@takram/three-geospatial-effects) |
| `meshoptimizer` | 1.3.0 / 2026-09-25 | MIT | none | Decoder for `EXT_meshopt_compression` glTF from Blender or gltfpack | [npm](https://www.npmjs.com/package/meshoptimizer) |
| `three-custom-shader-material` | 6.4.0 / 2025-10-12 | MIT | `@react-three/fiber >=8`, `three >=0.159` | Compatible | [npm](https://www.npmjs.com/package/three-custom-shader-material) |
| `three-stdlib` | 2.36.1 / 2025-11-10 | MIT | `three >=0.128` | Not needed, since `three/examples/jsm` already has the loaders | [npm](https://www.npmjs.com/package/three-stdlib) |
| `@types/three` | 0.187.0 / 2026-10-30 | MIT | — | Latest types are ahead of three 0.186.1. Pin `@types/three` 0.186.x. | [npm](https://www.npmjs.com/package/@types/three) |

**Takram packages: status and caveats**
- In the three-geospatial monorepo status table, `@takram/three-clouds` and `@takram/three-atmosphere` are Beta, and clouds' WebGPU support is a work in progress.
- The clouds effect sits inside an `EffectComposer` before the atmosphere's `AerialPerspective`.
- A known limitation: local weather is tiled with cube-sphere UVs, which can show seams.
- [npm: @takram/three-clouds](https://www.npmjs.com/package/@takram/three-clouds), [jsDelivr README 0.7.4](https://cdn.jsdelivr.net/npm/@takram/three-clouds@0.7.4/README.md)
- Search results disagreed on the latest version (0.4.2 vs 0.7.4 vs 0.7.6). The npm registry queried directly reports **0.7.6** — [npm registry](https://www.npmjs.com/package/@takram/three-clouds)

### Inferences
- **Determinism rules for this project:**
  - Derive all time from `useCurrentFrame()` and `fps`.
  - Use Remotion's seeded `random()` instead of `Math.random()`.
  - Disable R3F's internal loop where possible (e.g. `frameloop="demand"` / `"never"` is managed by `ThreeCanvas`).
  - Avoid effects that accumulate across frames: TAA, temporal reprojection in Takram clouds, progressive path-tracer samples, auto-exposure. Each frame is rendered independently, possibly in parallel tabs, so those effects will flicker or differ between renders unless reset and converged within a single frame.
- **three-gpu-pathtracer** needs many samples per output frame, so it suits stills or very short shots in Remotion. Blender Cycles is the better tool for path-traced footage.
- **Takram atmosphere and sky** (physically-based sky, aerial perspective, sun position from date via `astronomy-engine`) are a strong fit for matching the Blender sky in the R3F scenes, using only the vanilla or R3F classes without drei. Clouds are higher risk (Beta, temporal upscaling).
- **3d-tiles-renderer** can stream Cesium ion or Google Photorealistic 3D Tiles, or self-hosted tiles. Google and Cesium ion need API keys or accounts (not verified here). Self-hosted tiles or the existing terrain avoid that.
- **Postprocessing:** `postprocessing` + `@react-three/postprocessing` (bloom, tone mapping, vignette, SMAA, n8ao) is the standard stack. Pin it, because its peer range caps three at <0.187.
- **glTF:** use `GLTFLoader`, `DRACOLoader`, `KTX2Loader` and `MeshoptDecoder` from `three/examples/jsm` (no extra package except optionally `meshoptimizer`). Host the decoder and transcoder files locally in `public/` so renders need no network.

### Gaps
- I did not check the GitHub issue trackers for known incompatibilities with three 0.186 specifically. The compatibility above rests on declared peer ranges only.
- I did not confirm whether `three-gpu-pathtracer`'s `xatlas-web` peer is optional.
- KTX2 transcoder licensing (Basis Universal, Apache-2.0) and Draco (Apache-2.0) are from memory and not sourced here.
- Google Photorealistic 3D Tiles terms and pricing were not researched.

## 5. Music and sound: royalty-free CC0 libraries usable in a public community video

### Takeaway
- **Freesound:** CC0 sounds can be used freely with no attribution. CC BY 4.0 needs a credit. Avoid CC BY-NC 4.0 and Sampling+ if the video might ever be monetised or used commercially.
- **Pixabay:** the Content License allows free use with no attribution and with modification. It forbids standalone redistribution and misleading or trademark use.
- **`@remotion/sfx`:** gives peak-normalised effects usable without attribution, though each sound carries its own licence.

### Cited Findings
- **Freesound licences:**
  - CC0: "you can do pretty much what you want with the sound", but "you can't claim you are the author".
  - CC BY 4.0: "always mention the original creators", e.g. a credit listing sound title, author, link and licence.
  - CC BY-NC 4.0: same attribution, plus "you can't earn any money with the piece of work you create!"
  - Sampling+ (legacy, retired by CC): roughly BY-NC, and in addition "you can't make commercial advertisement with the sound".
  - [Freesound FAQ](https://freesound.org/help/faq/#licenses)
- **Pixabay Content License:**
  - Allowed: free use without attribution (credit appreciated), and modification or adaptation.
  - Forbidden: selling or distributing content "on a standalone basis"; commercial use with recognisable trademarks or logos; use as a trade or business name; immoral, illegal or misleading use.
  - The user is responsible for third-party rights.
  - The summary says "only the full Content License is legally binding" and has no music-specific clauses or Content ID notes.
  - [Pixabay License Summary](https://pixabay.com/service/license-summary/)
- **`@remotion/sfx`:** sound effects normalised to -3 dB peaks, usable without attribution; the package is MIT, each sound has its own licence, and it is available since 4.0.429 — [Remotion docs: @remotion/sfx](https://www.remotion.dev/docs/sfx)

### Inferences
- For a public community video:
  - Filter Freesound to CC0, or CC0 + CC BY 4.0 with a credits roll.
  - Keep a register (e.g. alongside `data/source-register.md`) of every audio asset with its URL, author, licence and download date.
  - Pixabay Music is usable with no attribution, but YouTube Content ID claims on Pixabay tracks have historically been an issue for uploaders (not verified in the summary page), so keep the licence or download proof.
  - Ambient Welsh landscape sound (rivers, birds, slate quarry, railway) is best found on Freesound with the CC0 filter.

### Gaps
- I did not fetch Pixabay's full Terms or music-specific FAQ (Content ID, whitelisting).
- I did not survey other CC0 music libraries (e.g. Free Music Archive CC0 subsets, or Musopen for public-domain classical recordings) within the tool budget.
- I did not review the per-sound licences inside `@remotion/sfx`.
