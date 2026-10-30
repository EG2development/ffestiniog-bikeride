# Render check history

Earlier `npm run test:render` reports, moved from `docs/validation-3d.md` so that file stays under 500 lines. The newest report stays there. Each table is unchanged; the run at 21:43 is the t7 run whose two failures (black frames after cuts, a 1 px legend reading) are explained in the t7 record.

### Render checks 2026-10-25T13:59:20.612Z (darwin-arm64)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 36.1–82.2 |
| RN6 draw calls and triangles; H2a/H3/L2/G3 overlays visible | pass | f0: 63 calls, 1103965 tris; f45: 63 calls, 1103965 tris; f180: 63 calls, 1103965 tris; f210: 63 calls, 1103965 tris; f359: 63 calls, 1103965 tris |
| RN5b terrain drawn at frame 0 | pass | 384 distinct colour bins |

### Render checks 2026-10-25T14:31:36.182Z (darwin-arm64)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 36.1–82.2 |
| RN6 draw calls and triangles; H2a/H3/L2/G3 overlays visible | pass | f0: 63 calls, 1103965 tris; f45: 63 calls, 1103965 tris; f180: 63 calls, 1103965 tris; f210: 63 calls, 1103965 tris; f359: 63 calls, 1103965 tris |
| RN5b terrain drawn at frame 0 | pass | 384 distinct colour bins |

### Render checks 2026-10-25T14:35:29.953Z (darwin-arm64)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 36.1–82.2 |
| RN6 draw calls and triangles; H2a/H3/L2/G3 overlays visible | pass | f0: 63 calls, 1103965 tris; f45: 63 calls, 1103965 tris; f180: 63 calls, 1103965 tris; f210: 63 calls, 1103965 tris; f359: 63 calls, 1103965 tris |
| RN5b terrain drawn at frame 0 | pass | 384 distinct colour bins |

### Render checks 2026-10-25T14:44:37.957Z (darwin-arm64)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 36.1–82.2 |
| RN6 draw calls and triangles; H2a/H3/L2/G3 overlays visible | pass | f0: 63 calls, 1103965 tris; f45: 63 calls, 1103965 tris; f180: 63 calls, 1103965 tris; f210: 63 calls, 1103965 tris; f359: 63 calls, 1103965 tris |
| RN5b terrain drawn at frame 0 | pass | 384 distinct colour bins |
| RL1/RL24 reel format and speed | pass | 1920x1080 30fps h264 2700 frames in 33 s (0.0123 s/frame) |
| RL26/RL27 no blank canvas in the full reel | pass | 2700 frames, canvas-centre luma 36.1–180.6 |
| RL23 reel deterministic | pass | frames 0, 1349, 2699 identical |
| RL24 reel draw calls and triangles per scene and before each cut; RL17/RL22 overlays visible | pass | 20 frames measured (intro@100, heritage@350, overview@600, blaenau@900, vale-north@1200, vale-south@1500, maentwrog@1750, trawsfynydd@2050, closing@2600; cuts 239/479/779/1079/1349/1619/1919/2399); worst frame 2399: 62 calls, 1936811 tris; overlays visible |
| RL32 one preview still per scene in out/previews | pass | 9 stills in out/previews/ |

### Render checks 2026-10-25T17:52:58.882Z (darwin-arm64)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 36.1–82.2 |
| RN6 draw calls and triangles; H2a/H3/L2/G3 overlays visible | pass | f0: 63 calls, 1103965 tris; f45: 63 calls, 1103965 tris; f180: 63 calls, 1103965 tris; f210: 63 calls, 1103965 tris; f359: 63 calls, 1103965 tris |
| RN5b terrain drawn at frame 0 | pass | 384 distinct colour bins |
| RL1/RL24 reel format and speed | pass | 1920x1080 30fps h264 2700 frames in 38 s (0.0142 s/frame) |
| RL26/RL27 no blank canvas in the full reel | pass | 2700 frames, canvas-centre luma 36.1–180.6 |
| RL23 reel deterministic | pass | frames 0, 1349, 2699 identical |
| RL24 reel draw calls and triangles per scene and before each cut; RL17/RL22 overlays visible | pass | 20 frames measured (intro@100, heritage@350, overview@600, blaenau@900, vale-north@1200, vale-south@1500, maentwrog@1750, trawsfynydd@2050, closing@2600; cuts 239/479/779/1079/1349/1619/1919/2399); worst frame 2399: 62 calls, 1936811 tris; overlays visible |
| RL10 terrain drawn in every scene still | pass | colour bins in the lower half: intro 1334, heritage 1872, overview 1488, blaenau 405, vale-north 254, vale-south 478, maentwrog 425, trawsfynydd 305, closing 2171 |
| RL32 one preview still per scene in out/previews | pass | 9 stills in out/previews/ |

### Render checks 2026-10-25T18:01:31.660Z (darwin-arm64)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 36.1–82.2 |
| RN6 draw calls and triangles; H2a/H3/L2/G3 overlays visible | pass | f0: 63 calls, 1103965 tris; f45: 63 calls, 1103965 tris; f180: 63 calls, 1103965 tris; f210: 63 calls, 1103965 tris; f359: 63 calls, 1103965 tris |
| RN5b terrain drawn at frame 0 | pass | 384 distinct colour bins |
| RL1/RL24 reel format and speed | pass | 1920x1080 30fps h264 2700 frames in 39 s (0.0143 s/frame) |
| RL26/RL27 no blank canvas in the full reel | pass | 2700 frames, canvas-centre luma 36.1–180.6 |
| RL23 reel deterministic | pass | frames 0, 1349, 2699 identical |
| RL24 reel draw calls and triangles per scene and before each cut; RL17/RL22 overlays visible | pass | 20 stills, 19 distinct frames, measured (intro@100, heritage@350, overview@600, blaenau@900, vale-north@1200, vale-south@1500, maentwrog@1750, trawsfynydd@2050, closing@2600; cuts 239/479/779/1079/1349/1619/1919/2399); worst frame 2399: 62 calls, 1936811 tris; overlays visible |
| RL10 terrain drawn in every scene still | pass | colour bins in the lower half: intro 1334, heritage 1872, overview 1488, blaenau 405, vale-north 254, vale-south 478, maentwrog 425, trawsfynydd 305, closing 2171 |
| RL32 one preview still per scene in out/previews | pass | 9 stills in out/previews/ |

### Render checks 2026-10-25T21:43:34.939Z (darwin-arm64)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 42.5–82.5 |
| RN6 draw calls and triangles; H2a/H3/L2/G3 overlays visible | pass | f0: 65 calls, 1104586 tris; f45: 65 calls, 1104586 tris; f180: 65 calls, 1104586 tris; f210: 65 calls, 1104586 tris; f359: 65 calls, 1104586 tris |
| RN5b terrain drawn at frame 0 | pass | 273 distinct colour bins |
| RL1/RL24 reel format and speed | pass | 1920x1080 30fps h264 2700 frames in 38 s (0.0141 s/frame) |
| RL26/RL27 no blank canvas in the full reel | FAIL | blank canvas at frames 242, 243, 244, 245, 246, 480, 481, 482, 485, 784 |
| RL23 reel deterministic | pass | frames 0, 1349, 2699 identical |
| RL24/BL12 reel draw calls and triangles per scene and before each cut, buildings on; RL17/RL22 overlays visible | pass | 20 stills, 19 distinct frames, measured (intro@100, heritage@350, overview@600, blaenau@900, vale-north@1200, vale-south@1500, maentwrog@1750, trawsfynydd@2050, closing@2600; cuts 239/479/779/1079/1349/1619/1919/2399); worst frame 2399: 64 calls, 1938182 tris; overlays visible |
| RL10 terrain drawn in every scene still | pass | colour bins in the lower half: intro 1755, heritage 2109, overview 1426, blaenau 275, vale-north 231, vale-south 402, maentwrog 302, trawsfynydd 264, closing 2257 |
| RL32 one preview still per scene in out/previews | pass | 9 stills in out/previews/ |
| CL9/CL10 every overlay inside the title-safe area, at most 3 lines | FAIL | Poc3DMaentwrog@0 legend (1488,98,337x36, 1 lines); Poc3DMaentwrog@45 legend (1488,98,337x36, 1 lines); Poc3DMaentwrog@180 legend (1488,98,337x36, 1 lines) |
| RD6 no missing map tiles in the reel | pass | 37 MAP_DRAPE lines, all 0 missing |
| RD1/RD2 fresh-process stills: first, middle and last frame of every section, and after each cut | pass | 35 fresh stills (9 sections x 3, 8 cuts): centre luma >= 20, >= 4 colour bins |
| X1 CyclingVision full render decodes to the pre-3D md5 | pass | decoded md5 adfca9a7f31577885e4ec84c1aca3f53 |
| X2 visual baselines untouched | pass | git diff --quiet -- tests/baselines |
| CL1 before and after stills from one environment, after on this snapshot | pass | 139 after stills on ee4427e14dea; before b35021274ddf; 7 environment fields equal |
| WA6/WA7 water drawn where expected, lit, with no terrain specks at two adjacent frames | pass | WA6 trawsfynydd_60 100.0 %, trawsfynydd_200 100.0 %; WA7 specks <= 0.10 % at 3 frames |
| CL2/CL3 shade-side trees lifted 20 %, frame luma within 10 %, <= 1 % clipped | pass | CL2 x2.06-x3.84 (11 stills); CL3 max change 9.8 % (15 stills) |
| CL4 trail distinct from nearby roads and terrain (dE76 >= 20) | pass | min dE terrain 25.6, roads 42.0 (11 stills) |
| CL6 one look: aerial terrain hue and saturation within 15 % of the ground | pass | hue 84.8 vs 86.6 (2.1 %), saturation 0.404 vs 0.454 (11.2 %) |
| BL13 landmarks on screen >= 2 s and >= 40 px | pass | no landmark is listed in any section, so no shot names one |

### Render checks 2026-10-25T21:58:53.821Z (darwin-arm64; snapshot tree 7897cb587013, dirty, untracked df6cc849b6aa)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 42.5–82.5 |
| RN6 draw calls and triangles; H2a/H3/L2/G3 overlays visible | pass | f0: 65 calls, 1104586 tris; f45: 65 calls, 1104586 tris; f180: 65 calls, 1104586 tris; f210: 65 calls, 1104586 tris; f359: 65 calls, 1104586 tris |
| RN5b terrain drawn at frame 0 | pass | 273 distinct colour bins |
| RL1/RL24 reel format and speed | pass | 1920x1080 30fps h264 2700 frames in 40 s (0.0147 s/frame) |
| RL26/RL27 no blank canvas in the full reel | pass | 2700 frames, canvas-centre luma 42.5–168.3 |
| RL23 reel deterministic | pass | frames 0, 1349, 2699 identical |
| RL24/BL12 reel draw calls and triangles per scene and before each cut, buildings on; RL17/RL22 overlays visible | pass | 20 stills, 19 distinct frames, measured (intro@100, heritage@350, overview@600, blaenau@900, vale-north@1200, vale-south@1500, maentwrog@1750, trawsfynydd@2050, closing@2600; cuts 239/479/779/1079/1349/1619/1919/2399); worst frame 2399: 64 calls, 1938182 tris; overlays visible |
| RL10 terrain drawn in every scene still | pass | colour bins in the lower half: intro 1755, heritage 2109, overview 1426, blaenau 275, vale-north 231, vale-south 402, maentwrog 302, trawsfynydd 264, closing 2257 |
| RL32 one preview still per scene in out/previews | pass | 9 stills in out/previews/ |
| CL9/CL10 every overlay inside the title-safe area, at most 3 lines | pass | 89 boxes at 24 frames, max 2 lines |
| RD6 no missing map tiles in the reel | pass | 37 MAP_DRAPE lines, all 0 missing |
| RD1/RD2 fresh-process stills: first, middle and last frame of every section, and after each cut | pass | 35 fresh stills (9 sections x 3, 8 cuts): centre luma >= 20, >= 4 colour bins |
| X1 CyclingVision full render decodes to the pre-3D md5 | pass | decoded md5 adfca9a7f31577885e4ec84c1aca3f53 |
| X2 visual baselines untouched | pass | git diff --quiet -- tests/baselines |
| CL1 before and after stills from one environment, after on this snapshot | pass | 139 after stills on 7897cb587013; before b35021274ddf; 7 environment fields equal |
| WA6/WA7 water drawn where expected, lit, with no terrain specks at two adjacent frames | pass | WA6 trawsfynydd_60 100.0 %, trawsfynydd_200 100.0 %; WA7 specks <= 0.10 % at 3 frames |
| CL2/CL3 shade-side trees lifted 20 %, frame luma within 10 %, <= 1 % clipped | pass | CL2 x2.06-x3.84 (11 stills); CL3 max change 9.8 % (15 stills) |
| CL4 trail distinct from nearby roads and terrain (dE76 >= 20) | pass | min dE terrain 25.6, roads 42.0 (11 stills) |
| CL6 one look: aerial terrain hue and saturation within 15 % of the ground | pass | hue 84.8 vs 86.6 (2.1 %), saturation 0.404 vs 0.454 (11.2 %) |
| BL13 landmarks on screen >= 2 s and >= 40 px | pass | no landmark is listed in any section, so no shot names one |

### Render checks 2026-10-25T22:58:38.414Z (darwin-arm64; snapshot tree 013e37cd2bc0, dirty, untracked 7e5744d19dcf)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 42.5–82.5 |
| RN6 draw calls and triangles; H2a/H3/L2/G3 overlays visible | pass | f0: 65 calls, 1104586 tris; f45: 65 calls, 1104586 tris; f180: 65 calls, 1104586 tris; f210: 65 calls, 1104586 tris; f359: 65 calls, 1104586 tris |
| RN5b terrain drawn at frame 0 | pass | 273 distinct colour bins |
| RL1/RL24 reel format and speed | pass | 1920x1080 30fps h264 2700 frames in 35 s (0.0129 s/frame) |
| RL26/RL27 no blank canvas in the full reel | pass | 2700 frames, canvas-centre luma 42.5–168.3 |
| RL23 reel deterministic | pass | frames 0, 1349, 2699 identical |
| RL24/BL12 reel draw calls and triangles per scene and before each cut, buildings on; RL17/RL22 overlays visible | pass | 20 stills, 19 distinct frames, measured (intro@100, heritage@350, overview@600, blaenau@900, vale-north@1200, vale-south@1500, maentwrog@1750, trawsfynydd@2050, closing@2600; cuts 239/479/779/1079/1349/1619/1919/2399); worst frame 2399: 64 calls, 1938182 tris; overlays visible |
| RL10 terrain drawn in every scene still | pass | colour bins in the lower half: intro 1755, heritage 2109, overview 1426, blaenau 275, vale-north 231, vale-south 402, maentwrog 302, trawsfynydd 264, closing 2257 |
| RL32 one preview still per scene in out/previews | pass | 9 stills in out/previews/ |
| CL9/CL10 every overlay inside the title-safe area, at most 3 lines | pass | 89 boxes at 24 frames, max 2 lines |
| RD6 no missing map tiles in the reel | pass | 16 MAP_DRAPE lines, all 0 missing |
| RD1/RD2 fresh-process stills: first, middle and last frame of every section, and after each cut | pass | 35 fresh stills (9 sections x 3, 8 cuts): centre luma >= 20, >= 4 colour bins |
| X1 CyclingVision full render decodes to the pre-3D md5 | pass | decoded md5 adfca9a7f31577885e4ec84c1aca3f53 |
| X2 visual baselines untouched | pass | git diff --quiet -- tests/baselines |
| CL1 before and after stills from one environment, after on this snapshot | pass | 139 after stills on 013e37cd2bc0; before b35021274ddf; 7 environment fields equal |
| WA6/WA7 water drawn where expected, lit, with no terrain specks at two adjacent frames | pass | WA6 trawsfynydd_60 100.0 %, trawsfynydd_200 100.0 %; WA7 specks <= 0.10 % at 3 frames |
| CL2/CL3 shade-side trees lifted 20 %, frame luma within 10 %, <= 1 % clipped | pass | CL2 x2.06-x3.84 (11 stills); CL3 max change 9.8 % (15 stills) |
| CL4 trail distinct from nearby roads and terrain (dE76 >= 20) | pass | min dE terrain 25.6, roads 42.0 (11 stills) |
| CL6 one look: aerial terrain hue and saturation within 15 % of the ground | pass | hue 84.8 vs 86.6 (2.1 %), saturation 0.404 vs 0.454 (11.2 %) |
| BL13 landmarks on screen >= 2 s and >= 40 px | pass | no landmark is listed in any section, so no shot names one |

### Render checks 2026-10-25T23:53:17.484Z (darwin-arm64; snapshot tree f9afc5aa583c, dirty, untracked 770798f86890)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 46.5–82.5 |
| RN6 draw calls and triangles; H2a/H3/L2/G3 overlays visible | pass | f0: 65 calls, 1104318 tris; f45: 65 calls, 1104318 tris; f180: 65 calls, 1104318 tris; f210: 65 calls, 1104318 tris; f359: 65 calls, 1104318 tris |
| RN5b terrain drawn at frame 0 | pass | 259 distinct colour bins |
| RL1/RL24 reel format and speed | pass | 1920x1080 30fps h264 2700 frames in 36 s (0.0133 s/frame) |
| RL26/RL27 no blank canvas in the full reel | pass | 2700 frames, canvas-centre luma 46.5–168.3 |
| RL23 reel deterministic | pass | frames 0, 1349, 2699 identical |
| RL24/BL12 reel draw calls and triangles per scene and before each cut, buildings on; RL17/RL22 overlays visible | pass | 20 stills, 19 distinct frames, measured (intro@100, heritage@350, overview@600, blaenau@900, vale-north@1200, vale-south@1500, maentwrog@1750, trawsfynydd@2050, closing@2600; cuts 239/479/779/1079/1349/1619/1919/2399); worst frame 2399: 64 calls, 1937530 tris; overlays visible |
| RL10 terrain drawn in every scene still | pass | colour bins in the lower half: intro 1755, heritage 2109, overview 1426, blaenau 275, vale-north 231, vale-south 402, maentwrog 315, trawsfynydd 267, closing 2257 |
| RL32 one preview still per scene in out/previews | pass | 9 stills in out/previews/ |
| CL9/CL10 every overlay inside the title-safe area, at most 3 lines | pass | 80 boxes at 24 frames, max 2 lines |
| RD6 no missing map tiles in the reel | pass | 16 MAP_DRAPE lines, all 0 missing |
| RD1/RD2 fresh-process stills: first, middle and last frame of every section, and after each cut | pass | 43 fresh stills (9 sections x 3, 8 cuts x 2): centre luma >= 20, >= 4 colour bins |
| X1 CyclingVision full render decodes to the pre-3D md5 | pass | decoded md5 adfca9a7f31577885e4ec84c1aca3f53 |
| X2 visual baselines untouched | pass | git diff --quiet HEAD -- tests/baselines; no untracked file there |
| CL1 before and after stills from one environment, after on this snapshot | pass | 139 after stills on f9afc5aa583c; before b35021274ddf; 7 environment fields equal |
| WA6/WA7 water drawn where expected, lit, with no terrain specks at two adjacent frames | pass | WA6 trawsfynydd_60 100.0 %, trawsfynydd_200 100.0 %; WA7 specks <= 0.11 % at 3 frames |
| CL2/CL3 shade-side trees lifted 20 %, frame luma within 10 %, <= 1 % clipped | FAIL | maentwrog_150 luma 10.9 % clipped 0.00 % |
| CL4 trail distinct from nearby roads and terrain (dE76 >= 20) | pass | min dE terrain 25.6, roads 42.0 (11 stills) |
| CL6 one look: aerial terrain hue and saturation within 15 % of the ground | pass | hue 84.9 vs 86.6 (2.0 %), saturation 0.404 vs 0.453 (10.9 %) |
| BL13 landmarks on screen >= 2 s and >= 40 px | pass | no landmark is listed in any section, so no shot names one |

### Render checks 2026-10-26T00:06:04.263Z (darwin-arm64; snapshot tree b1fcabed32fe, dirty, untracked 770798f86890)

| Check | Result | Detail |
|---|---|---|
| RG1 CyclingVision unchanged | pass | 4 frames match |
| RN2 POC deterministic | pass | frames 0, 180, 359 identical |
| RN3/RN6 POC format and speed | pass | 1920x1080 30fps h264 360 frames, 0.02 s/frame |
| RN5b no blank canvas in the full POC render | pass | 360 frames, canvas-centre luma 45.9–82.4 |
| RN6 draw calls and triangles; H2a/H3/L2/G3 overlays visible | pass | f0: 65 calls, 1104318 tris; f45: 65 calls, 1104318 tris; f180: 65 calls, 1104318 tris; f210: 65 calls, 1104318 tris; f359: 65 calls, 1104318 tris |
| RN5b terrain drawn at frame 0 | pass | 257 distinct colour bins |
| RL1/RL24 reel format and speed | pass | 1920x1080 30fps h264 2700 frames in 32 s (0.0118 s/frame) |
| RL26/RL27 no blank canvas in the full reel | pass | 2700 frames, canvas-centre luma 45.9–168.3 |
| RL23 reel deterministic | pass | frames 0, 1349, 2699 identical |
| RL24/BL12 reel draw calls and triangles per scene and before each cut, buildings on; RL17/RL22 overlays visible | pass | 20 stills, 19 distinct frames, measured (intro@100, heritage@350, overview@600, blaenau@900, vale-north@1200, vale-south@1500, maentwrog@1750, trawsfynydd@2050, closing@2600; cuts 239/479/779/1079/1349/1619/1919/2399); worst frame 2399: 64 calls, 1937530 tris; overlays visible |
| RL10 terrain drawn in every scene still | pass | colour bins in the lower half: intro 1755, heritage 2109, overview 1426, blaenau 275, vale-north 231, vale-south 402, maentwrog 311, trawsfynydd 268, closing 2257 |
| RL32 one preview still per scene in out/previews | pass | 9 stills in out/previews/ |
| CL9/CL10 every overlay inside the title-safe area, at most 3 lines | pass | 80 boxes at 24 frames, max 2 lines |
| RD6 no missing map tiles in the reel | pass | 16 MAP_DRAPE lines, all 0 missing |
| RD1/RD2 fresh-process stills: first, middle and last frame of every section, and after each cut | pass | 43 fresh stills (9 sections x 3, 8 cuts x 2): centre luma >= 20, >= 4 colour bins |
| X1 CyclingVision full render decodes to the pre-3D md5 | pass | decoded md5 adfca9a7f31577885e4ec84c1aca3f53 |
| X2 visual baselines untouched | pass | git diff --quiet HEAD -- tests/baselines; no untracked file there |
| CL1 before and after stills from one environment, after on this snapshot | pass | 139 after stills on b1fcabed32fe; before b35021274ddf; 7 environment fields equal |
| WA6/WA7 water drawn where expected, lit, with no terrain specks at two adjacent frames | pass | WA6 trawsfynydd_60 100.0 %, trawsfynydd_200 100.0 %; WA7 specks <= 0.11 % at 3 frames |
| CL2/CL3 shade-side trees lifted 20 %, frame luma within 10 %, <= 1 % clipped | pass | CL2 x1.91-x3.72 (11 stills); CL3 max change 9.5 % (15 stills) |
| CL4 trail distinct from nearby roads and terrain (dE76 >= 20) | pass | min dE terrain 25.6, roads 42.0 (11 stills) |
| CL6 one look: aerial terrain hue and saturation within 15 % of the ground | pass | hue 84.9 vs 86.6 (2.0 %), saturation 0.404 vs 0.453 (10.9 %) |
| BL13 landmarks on screen >= 2 s and >= 40 px | pass | no landmark is listed in any section, so no shot names one |
