# Cinematic enhancement of the community film (review 2026-11-05)

Research, audit and changes for the 3-minute Trawsfynydd–Blaenau Ffestiniog community film and its social cuts, with
the results of the renders. Everything below was checked on rendered frames of the film, not on screenshots of the
viewport. Decisions are recorded in the design doc ([design-blender.md §5](design-blender.md)); the film's data is
`src/data/community-film.ts` and `src/three-core/community.ts`.

## 1. Research findings

Sources read in full (pages or PDFs), not search snippets. The findings that shaped the work:

| Area | Finding | Source |
|---|---|---|
| Colour management | AgX gives 16.5 stops and desaturates bright colours like film; Filmic is deprecated. Exposure, curves and white balance apply *before* the view transform; the manual routes grading to the compositor on scene-linear data. sRGB display shares Rec.709 primaries; there is no separate "Rec.709 video" preset. | [Blender 5.2: Displays and Views](https://docs.blender.org/manual/en/latest/render/color_management/displays_views.html), [Color Spaces](https://docs.blender.org/manual/en/latest/render/color_management/color_spaces.html) |
| EEVEE realism | Shadow jitter and pool size, screen-trace raytracing with the Fast GI fallback, volumes with a custom range for world haze, shutter in frames, DOF jitter cost, film filter size ("lower values give more crisp renders"), and sun extraction from a bright sky. | [Light Settings](https://docs.blender.org/manual/en/latest/render/eevee/light_settings.html), [Raytracing](https://docs.blender.org/manual/en/latest/render/eevee/render_settings/raytracing.html), [Motion Blur](https://docs.blender.org/manual/en/latest/render/eevee/render_settings/motion_blur.html), [Film](https://docs.blender.org/manual/en/latest/render/eevee/render_settings/film.html), [World Settings](https://docs.blender.org/manual/en/latest/render/eevee/world_settings.html) |
| Sky and sun | Sun strength: clear sky 1000 W/m², cloudy 500, overcast 200. The Sky Texture's Sun Disc is Cycles-only, so an HDRI with a real sun (extracted by EEVEE) stays the right tool for this EEVEE film. | [Light Objects](https://docs.blender.org/manual/en/latest/render/lights/light_object.html), [Sky Texture](https://docs.blender.org/manual/en/latest/render/shader_nodes/textures/sky.html) |
| Composition | Eye level as the neutral, "docu-style" perspective; 35–50 mm as the naturalistic normal lens; movement "deliberate and motivated"; the 180-degree rule keeps orientation. "If the camera moves it's got to be for a reason" (Deakins). | [StudioBinder: eye level](https://www.studiobinder.com/camera-shots/camera-angles/eye-level-shot/), [normal lens](https://www.studiobinder.com/camera-shots/camera-lenses/normal-lens-shot/), [180-degree rule](https://www.studiobinder.com/blog/what-is-the-180-degree-rule/), [Deakins, Hazlitt](https://hazlitt.net/feature/if-camera-moves-its-got-be-reason-interview-roger-deakins) |
| Grading | Normalise (blacks 5–10 % above 0, whites under 90 %), balance, match every angle to a wide hero shot, then the scene grade; prefer colour separation to added saturation; skin through the broadest tool first. | [Blackmagic Colorist Guide (Resolve 20)](https://documents.blackmagicdesign.com/UserManuals/DaVinci-Resolve-20-Colorist-Guide.pdf), [Cullen Kelly on skin](https://blog.frame.io/2020/10/05/skin-tones-in-davinci-resolve/), [Mixing Light on separation](https://mixinglight.com/color-grading-tutorials/three-strategies-for-increasing-color-separation/) |
| Pacing and text | BBC: 160–180 words a minute, at least 0.3 s a word, ≤ 37 characters a line, two lines (three at 9:16), text starting and ending on shot changes. Meta: hook within three seconds, build for sound off. | [BBC Subtitle Guidelines](https://www.bbc.co.uk/accessibility/forproducts/guides/subtitles/), [Meta tailored campaigns](https://www.facebook.com/business/ads/automation/tailored-campaigns) |
| Sound | EBU R 128: −23 LUFS, −1 dBTP for broadcast; streaming platforms play at −14 LUFS (Spotify states it; YouTube publishes encoding only). BBC Sound Effects is non-commercial (RemArc); Freesound is CC0/BY/BY-NC; Pixabay's licence allows commercial use without credit. | [EBU R 128](https://tech.ebu.ch/docs/r/r128.pdf), [R 128 s2](https://tech.ebu.ch/docs/r/r128s2.pdf), [Spotify loudness](https://support.spotify.com/artists/article/loudness-normalization/), [YouTube encoding](https://support.google.com/youtube/answer/1722171), [BBC RemArc](https://sound-effects.bbcrewind.co.uk/licensing), [Freesound FAQ](https://freesound.org/help/faq/), [Pixabay licence](https://pixabay.com/service/license-summary/) |
| Welsh first | Welsh "not treated less favourably" in font, size, colour, position and prominence, and placed to be read first; both languages equally legible, in one typeface, with the diacritics ŵ and ŷ. | [Welsh Government standards: communication and marketing](https://gov.wales/welsh-language-standards-communication-and-marketing-guidelines-html), [Commissioner's Bilingual Design Guide](https://www.welshlanguagecommissioner.wales/media/niknstqs/bilingual-design-guide-eng.pdf) |
| Route design | Shared-use paths 3.0 m minimum (4.5 m above 300 cyclists an hour), 5 % desirable and 8 % absolute gradients, seating every 50–100 m with wheelchair space beside it, design for an unaccompanied secondary-age child, a double buggy and an adapted cycle; "walking, wheeling and cycling". Inclusive imagery: Disabled riders on a range of cycles, in everyday use. | [Active Travel Act Guidance 2021](https://www.gov.wales/sites/default/files/publications/2022-01/active-travel-act-guidance.pdf), [Wheels for Wellbeing guide](https://wheelsforwellbeing.org.uk/campaigning/guide) |
| Honest visualisation | A visualisation must be "a fair representation of what would be likely to be seen", "not misleading"; present baseline and proposed views at the same size for direct comparison; label the type and state limitations. | [Landscape Institute TGN 06/19](https://landscapeinstitute.org/wp-content/uploads/2019/09/LI_TGN-06-19_Visual_Representation-1.pdf) |

Not found or not verified: a primary source against orange-and-teal grading (vendor blogs only); the Welsh
Government "Cymraeg" brand pages (404); a 2026 revision of the Active Travel Act Guidance (search results only).

## 2. Assessment of the v8 film

Measured on `out/blender/reel/community-1080p-v8.mp4` (one frame every two seconds, full frames at twenty moments,
frame-by-frame crops of the people) with ffmpeg's signalstats:

| Scene | 10th–90th percentile luma (of 255) | Mean chroma (SATAVG) |
|---|---|---|
| Opening aerial | 54–151 | 9.3 |
| School | 43–160 | 6.3 |
| Family | 47–150 | 7.6 |
| Bus | 38–149 | 6.1 |
| Welcome | 47–151 | 7.5 |
| Rides | 45–159 | 6.6–7.7 |
| Together | 42–180 | 5.4 |
| Closing aerial | 50–178 | 6.5 |

Findings, in order of weight:

1. **Flat, milky picture.** Every scene sits in a 100-level band with chroma under 10: the 38° partly cloudy HDRI gives
   a near-white sky and weak modelling, the haze (0.25 of the horizon colour) veils the middle distance, and the
   medium-high AgX look leaves the sward olive-grey. The brief's "rich but realistic greens" and "natural blue and
   overcast Welsh skies" are not there.
2. **Overlays read as a debug layer.** The sequencer's monospaced default font, a 2-line caption box, a six-line legend
   in the top right of every frame and four lines of credits across the bottom of all 5,400 frames. This is the
   single strongest "3D promotional animation" signal.
3. **Weak shots.** The two aerial orbits over rooftops open the film like a map (20 s); the bench scene's
   over-the-shoulder shot is two dark heads with a grey strip of lake; its third shot is an empty path with a far
   bench slab; the bus-stop shot aims at the path's end 110 m away and leaves the stop in a corner; the school's hold
   shot keeps the pupils 60 px tall.
4. **No "before".** The brief's device, the existing railway corridor becoming the path, is absent: the film shows only
   the proposal.
5. **No sound.** The master has no audio track.
6. **Repetition.** Four first-person rides of identical height and look-ahead run back to back for 40 s.

What works and was kept: the people (gait, dismount and lock-up, side-by-side walking, seated gestures all read in
the frame-by-frame crops), the family and walkers scenes, the lock-up story, the together scene, the Welsh-first
captions and their timing, the geography.

## 3. Recommendations, as implemented

| Priority | Change | Where |
|---|---|---|
| 1 | A sky with a real blue and cumulus and a 48° sun (chosen on renders of four frames under seven candidate CC0 skies); AgX Punchy; haze 0.14/0.10; a scene-linear grade (warm slope, cool offset, +0.12 EV, saturation ×1.05 on the ground). | `landscape.SKY_HDRI`, `finish.py` |
| 2 | Typography in Inter (OFL, shipped with Blender): Welsh 36 px over English 27 px on a translucent panel with an accent bar, measured with the font's metrics; credits as one 13 px line a language; the legend for a scene's first six seconds. | `build_reel.py` |
| 3 | A "then and now" opening: the mothballed railway's track on the line, dissolving into the same view as a path with neighbours on it; one low arc over Llan Ffestiniog before it. | `community-then`, `community-now`, `railway.py`, `ReelScene.dissolve` |
| 4 | Reframed shots: the bench from the uphill verge past the couple to the lake; the tricycle riding up and passing close; the bus stop as a medium shot; the school run low on the verge as the group comes through; a wheel-height follow at Manod. | `community.ts` |
| 5 | A soundtrack: the original score shaped to the chapters, a breeze, birdsong, tyres in the ride scenes, at −14 LUFS. | `scripts/film/make_audio.py` |
| 6 | A resumable frame render and a delivery encode with the social cuts' preset; before-and-after sheets. | `render_film.py`, `scripts/film/encode.mjs`, `scripts/film/compare.py` |

Not changed, on purpose: the animation systems (the crops showed natural motion), the route geography, the caption
wording and timing beyond the new opening, and the four-scene structure of the brief's table, which the film already
follows within a few seconds.

## 4. Storyboard and shot list (v9)

| Time | Scene (config) | Shots | Purpose |
|---|---|---|---|
| 0:00–0:06 | The vale from the air (`community-open`) | one 28° arc about Llan Ffestiniog at 170 m, 600 m out | recognition: the familiar landscape |
| 0:06–0:14 | The railway today (`community-then`) | hold on the uphill verge at 1.7 m, 42°, looking back along the line to the village over the rusted track | curiosity: what is there now |
| 0:13–0:20 | The same view as a path (`community-now`), dissolving in over 1 s | the same camera; two neighbours and their dog walking to the village, a commuter riding in | the idea, made visible |
| 0:20–0:45 | The school run (`community-school`) | crane down behind the pupils; low hold on the verge as they come through; follow | independence |
| 0:45–0:58 | Everyday trips (`community-family`) | hold behind the family as the commuter passes; follow | families, cargo bikes, dogs |
| 0:58–1:10 | Walking and running (`community-walkers`) | crane; follow | neighbours sharing the path |
| 1:10–1:30 | Bus and train (`community-bus`) | the lock-up over the cutting; a medium shot of the stop as the cyclist walks up | everyday usefulness |
| 1:30–1:55 | A place to rest (`community-welcome`) | from the verge past the couple to the lake; side-on with the tricycle; the tricycle riding up and passing close | inclusion, wellbeing |
| 1:55–2:35 | The ride (`community-ride-*`) | first person through Blaenau, Manod (then wheel height beside the back wheel), under the A470, and the moor | enjoyment |
| 2:35–2:47 | Together (`community-together`) | hold on the meeting by the benches | community |
| 2:47–3:00 | A shared vision (`community-close`) | pull-back over Trawsfynydd looking back along the line | pride; the closing line |

Captions (Welsh first, then English, `COMMUNITY_CAPTIONS`): the places (0:01–0:06), "Heddiw: rheilffordd segur ers y
1990au / Today: a railway mothballed since the 1990s" (0:07–0:13), the idea (0:14–0:20), then as before to the closing
"Mwy na llwybr. Cysylltiad i'n cymunedau." The concept badge runs throughout; each scene's legend names what is
proposed or illustrative for its first six seconds.

## 5. Colour and light

- **Light:** one HDRI sky, turned to the project's fixed sun azimuth (200°), its 48° sun extracted by EEVEE for the
  shadows. The choice came from the look-development sheets (`scratch: lookdev/sheet-*.png`): the 38° sky read flat;
  low-sun skies (8–11°) went orange with shadows across the whole path; a 28° clear sky gave a deep southern-hemisphere
  blue and hard shadows; 74° was a harsh midday.
- **Pipeline:** scene-linear Rec.709 working space → finish (haze on the land only, vignette) → grade (ASC-CDL slope
  1.04/1.0/0.95, offset −0.004/0/0.006, saturation, exposure) → AgX Punchy → sRGB (Rec.709 primaries) → the master
  in the Standard view (no second transform) → H.264 4:2:0 tagged BT.709. The social plates take the same finish.
- **Targets:** blacks kept off 0, skies unclipped (AgX's roll-off), skin unchanged in hue (the slope is 4 %), haze only
  past a kilometre.

## 6. People and interactions

Kept from v7/v8: the gait and idle systems, the lock-up story, dogs at heel, companions side by side, seated gestures
and gaze. Added: two neighbours with a collie and a commuter in the "now" view; the group of pupils passing a low
camera at 2.3 m; the tricycle riding up and passing the camera; the cyclist arriving at the stop in a medium shot.

## 7. Camera direction

Eye level (1.3–1.8 m) for every ground shot, with 32–42° vertical fields (about 35–45 mm) and one wide first-person
52°; two low shots at wheel height (0.85–0.95 m); one static matched pair for the dissolve; aerials at 170–320 m,
looking out, never in plan. Every shot passes the views test (pitch no steeper than −30°, a quarter of the frame past
60 m, benches facing open ground).

## 8. Before-and-after comparisons

`npm run film:compare -- out/blender/reel/community-1080p-v8.mp4 out/blender/reel/community-1080p-v9.mp4 out/blender/compare-v9`
writes `compare-mm-ss.png` sheets (v8 above v9, same frame) at eighteen moments and a contact sheet of each cut. The
look-development sheets that chose the sky and the grade are reproducible with the master and the candidate HDRIs
(the scratch scripts are described in [design-blender.md §5](design-blender.md)).

The sheets are in `out/blender/compare-v9/` (`compare-00-03.png` … `compare-02-55.png`, `contact-community-1080p-v8.png`,
`contact-community-1080p-v9.png`). Read side by side:

| Moment | v8 | v9 |
|---|---|---|
| 0:03 | Orbit over rooftops, monospaced two-language box, four-line credits | Wider orbit over the valley with the ridge and sky; Inter caption panel; one-line credits |
| 0:12 | Still the aerial, the "idea" caption over a map | Eye level on the mothballed railway, "Today: a railway mothballed since the 1990s" |
| 0:17 | Aerial | The same frame, now the path: the couple with the collie and a commuter, after a 1 s dissolve |
| 0:31 | School hold: pupils 60 px tall at the end of the path | Hold at child height, the group fills the path's width |
| 0:50 | Family cargo bike (kept) | The same shot, warmer light and a blue sky; the beige moor verge remains (upland grass, see §12) |
| 1:27 | Bus stop in a corner, four-line legend | The bus and shelter are the frame; windows read as glass; legend only where it changes |
| 1:34 | Two dark heads over a grey strip of lake | The couple on the bench from across the path, the lake across the full width behind them |
| 2:00 | First-person ride (kept) | Same, at 10 mph with an oncoming cargo bike |
| 2:55 | Closing aerial under a white sky | The same orbit under the partly cloudy sky, the lake blue, one centred caption |

Measured the same way as §2 (one frame every two seconds, ffmpeg signalstats), v8 → v9:

| Scene | 10th–90th percentile luma | Mean chroma (SATAVG) |
|---|---|---|
| Opening aerial | 54–151 → 88–184 | 9.3 → 12.5 |
| Then / now (new) | — → 46–196 / 47–197 | — → 7.0 / 6.7 |
| School | 43–160 → 63–155 | 6.3 → 7.8 |
| Family | 47–150 → 73–154 | 7.6 → 10.8 |
| Walkers | 47–141 → 74–154 | 8.5 → 10.8 |
| Bus | 38–149 → 54–163 | 6.1 → 8.4 |
| Welcome | 47–151 → 77–164 | 7.5 → 10.5 |
| Rides | 47–154 → 73–157 | 7.2 → 10.5 |
| Together | 42–180 → 56–181 | 5.4 → 9.8 |
| Closing aerial | 50–178 → 79–193 | 6.5 → 13.9 |

The minimum luma stays at 13–17 of 255 in every scene (nothing crushed) and the maximum at 246–254 (only the sun side
of clouds clips). Chroma rises by 25–60 % and stays under 14, which is the "richer but realistic" range: the sheets
show green sward and a blue sky, no orange-and-teal, no neon grass. The lows lift (the 10th percentile rises 15–30
levels) because the 48° sun fills shadows the 38° sun left dark; the woodland "then/now" scenes keep the deeper lows
of the v8 picture.

## 9–10. Deliverables

- The film: `out/blender/reel/community-1080p-v9.mp4` (1920 × 1080, 30 fps, 180 s, H.264 High with AAC), from
  `out/blender/master/community-dressed-v9-render.blend` and `out/blender/frames/community-v9/`.
- The social cuts, re-rendered from the v9 master so they share its light and grade: `out/social/exports/` (five
  MP4s with SRT subtitles and post text), QA in `out/social/qa/`.
- The v8 film and master are untouched (`community-1080p-v8.mp4`, `community-dressed-v8-render.blend`).

## 11. Render quality and performance

`out/blender/reel/community-1080p-v9.mp4`, probed with ffprobe and ffmpeg's ebur128, freezedetect and blackdetect
(`npm run film:encode` prints them; log in `out/blender/reel/encode-community-v9.log`):

| Property | Value |
|---|---|
| Picture | 1920 × 1080, 30 fps, 5,400 frames, 180.000 s |
| Video | H.264 High, level 5.0, 4:2:0 8-bit, CRF 16 (x264 slow), closed GOP 15 with two B-frames, 40 Mbit/s cap |
| Mean bitrate / size | 24.0 Mbit/s / 546 MB |
| Colour | BT.709 primaries, transfer and matrix, limited range, tagged at stream and frame level |
| Audio | AAC-LC 320 kbit/s, 48 kHz stereo |
| Loudness | −13.9 LUFS integrated, 7.2 LU range, −1.5 dBTP peak (target −14 LUFS / ≤ −1 dBTP) |
| Frozen stretches ≥ 1 s / black ≥ 0.5 s | 0 / 0 |

A note on the colour tags: the first encode came out tagged with an sRGB transfer, because this ffmpeg (9.0) lets the
PNGs' own tag override `-color_trc`. A decode test against the source frames showed the BT.709 matrix had been used
(mean error 1.7–2.3 levels against 1.9–2.6 for a BT.601 decode), so only the tag was wrong; the encoder now converts
and tags the frames explicitly (`scale=out_color_matrix=bt709` and `setparams`) and the re-encode probes BT.709
throughout.

Render performance (EEVEE, 32 samples, 1920 × 1080, one GPU, `scripts/blender/render_film.py`, log
`out/blender/reel/render-community-v9.log`):

| Stage | Time |
|---|---|
| Master build (`blender:reel --dressed --film community --samples 32`, fourteen dressed scenes) | 7 min 34 s |
| 5,400 frames | 31,424 s = 8 h 44 min, 5.8 s a frame on average |
| Aerials (open, closing) | about 1.7 s a frame |
| First-person rides and the woodland then/now | about 6–6.5 s a frame (the vegetation and motion blur) |
| Encode (x264 slow) + probes | 2 min 29 s |
| Social plates from the v9 master (17 + 13 + 17 plates, three formats) | about 8 h, running after the film |

The frames are kept (`out/blender/frames/community-v9/`, 15.7 GB), so a changed scene re-renders over its own range
with `--from/--to` and the film re-encodes in 2.5 min. Visual inspection of the render: per-scene contact sheets of
seven frames each (all fourteen scenes), four full-resolution frames (the dissolve mid-point, the school hold, the
bus stop, the tricycle pass), the eighteen before/after sheets and the two-second contact sheet of the whole film
were viewed; no placeholder, black or noisy frame, no caption overlap, and the people's timing matches the master
preview pass.

## 12. Improvements and outstanding limitations

Improvements: see §3. Limitations, stated so the film stays honest:

- **The railway "today" is illustrative.** Its track lies on the mapped alignment and its state (rusted rails, sleepers
  in ballast, grass through it) is a typical mothballed line, not a survey of this one; the legend says so on screen.
- **The music is a stand-in.** It is an original synthesised piece written so nothing needs clearing; it has not been
  listened to by a person. Swap in a licensed track (Pixabay's licence allows commercial use without credit; BBC Sound
  Effects does not) by replacing `out/blender/reel/community-v9.wav` and re-running `npm run film:encode`.
- **Welsh.** Every line was written to be natural, but a fluent speaker should check the captions and the new
  "Heddiw: rheilffordd segur ers y 1990au" before publication.
- **People.** The cast is MakeHuman's CC0 system assets: varied in age, build and dress, but with a limited range of
  faces and clothing; close-ups stay at medium distance for that reason.
- **Light.** One fixed sun (azimuth 200°, 48° high) for the whole film, as the project's lighting rule has always
  been; the Sun Position extension could set a real date and hour if a seasonal view is wanted later.
- **Not shown:** adapted cycles beyond the tricycles, people in wheelchairs on the path, and the Trawsfynydd lake loop
  connection, which the brief allows only where the route permits and a survey would confirm.
