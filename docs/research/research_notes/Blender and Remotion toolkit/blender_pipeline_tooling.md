# Tooling for a Headless Blender 5.2 Pipeline (automation, testing, optimisation, AI assistance)

Context: Blender 5.2.4 LTS (release candidate build at `C:/blender/blender.exe`) on Windows 11, RTX 2060 6 GB (Turing), ffmpeg 9.0.2, Claude Code driving Blender headless and through the `mcp-for-blender` MCP server. Research date: 2026-11-01. Some facts below come from running the local Blender binary. Those are cited as "local `blender --help`" or "local probe", and the exact commands are given so they can be re-run.

## Python development: bpy from pip, type stubs, testing, command line, BAT

### Takeaway
Blender 5.2 embeds Python 3.13.13. PyPI `bpy` 5.2.3 (22 Oct 2026) ships Windows x64 wheels for CPython 3.13 only, and there is no 5.2.4 wheel yet. `fake-bpy-module` (MIT, published almost daily) gives editors and linters 5.2 stubs. pytest-blender exists but its tested versions are years old, so the safest test harness is plain pytest that runs `blender -b --factory-startup --python-exit-code 1 -P script.py` as a subprocess. BAT 2.x needs Blender 5.1 or later and Python 3.13.

### Cited Findings
**bpy as a pip module**
- `bpy` releases on PyPI: 5.2.3 (22 Oct 2026), 5.2.2 (15 Sep 2026), 5.2.1 (25 Aug 2026), 5.2.0 (14 Jul 2026), 5.1.x, 5.0.x, and 4.5.15 (22 Oct 2026, the older LTS). — [PyPI bpy](https://pypi.org/project/bpy/)
- bpy 5.2.3 requires `Python ==3.13.*`. Its wheels cover Windows x86-64, Windows ARM64, Linux glibc 2.28+ x86-64 and macOS 11+ ARM64, with no sdist. PyPI says "Each Blender release supports one Python version, and the package is only compatible with that version." — [PyPI bpy](https://pypi.org/project/bpy/)
- Wheels are 210–403 MB (1.2 GB per release in total). Versions outside the current LTS window are removed from PyPI and must be installed from download.blender.org with `--extra-index-url`. The 5.2.3 files carry no provenance attestations and were not uploaded with Trusted Publishing. — [PyPI bpy](https://pypi.org/project/bpy/)
- The installed Blender reports `3.13.13 (main, May 8 2026) [MSC v.1944 64 bit (AMD64)]` and `5.2.4 LTS Release Candidate`. — local probe: `blender -b --factory-startup --python-expr "import sys,bpy;print(sys.version, bpy.app.version_string)"`
- Blender 5.2 LTS was released on 14 July 2026 and "will be maintained until July 2028". Python API breakages in 5.2: `paint.eraser_brush` and `paint.eraser_brush_asset_reference` were removed, the Geometry Nodes modifier-property API changed, and socket identifiers of the Compare and Random Value nodes changed. — [Blender 5.2 release notes](https://developer.blender.org/docs/release_notes/5.2/)

**Type stubs**
- `fake-bpy-module`: latest 20261031 (31 Oct 2026), MIT licence, one maintainer (nutti). It has version-specific packages from 2.78 to 5.2 (`pip install fake-bpy-module-<ver>`, e.g. `fake-bpy-module-5.2`), and `fake-bpy-module` / `fake-bpy-module-latest` track Blender main. It needs Python 3.8 or later. Releases came almost daily from Aug to Oct 2026. PyCharm needs `idea.max.intellisense.filesize` raised above 2600. — [PyPI fake-bpy-module](https://pypi.org/project/fake-bpy-module/)

**Testing**
- pytest-blender (BSD-3-Clause) "Executes your pytest testsuite with Blender in headless mode using its builtin Python interpreter". The test dependencies must be installed into Blender's bundled Python. Its CI matrix tests Blender 3.1.2, 2.93.9 and 2.83.9, and GitHub shows no releases. — [GitHub mondeja/pytest-blender](https://github.com/mondeja/pytest-blender)

**Command line (verified on 5.2.4 RC)**
- `-b/--background`, `-a/--render-anim`, `-f/--render-frame <frame>` (accepts comma lists and `a..b` ranges), `-s/-e/-j` for frame start, end and step, `-S/--scene`, and `-o/--render-output`. `-o` supports `#` padding and path templating such as `{blend_name}`, and appends `####` if no `#` is present. Also `-E/--engine` (`-E help` lists engines), `-t/--threads`, `-F/--render-format` (PNG, OPEN_EXR, OPEN_EXR_MULTILAYER, FFMPEG and others) and `-x/--use-extension`. — local `blender --help` (5.2.4 LTS RC)
- Cycles flags go after `--`: `-- --cycles-device OPTIX` (append `+CPU` for hybrid) and `--cycles-print-stats`, which logs render memory and time. — local `blender --help`
- Python flags: `-P/--python`, `--python-expr` (may be a complete multi-line script, limited only by the OS argument length), `--python-text`, and `--python-exit-code <0..255>`, which sets the exit code when a command-line script raises. `-y`/`-Y` toggle autoexec, and `-Y` (disabled) is the default. `--python-use-system-env` and `--python-use-user-env` break isolation. `--addons a,b` enables extra add-ons. — local `blender --help`
- Network flags: `--online-mode` and `--offline-mode` override the preference. Logging: `--log "render,cycles"`, `--log-level`, `--log-show-memory`, `--log-file <path>` and `--log-list-categories`. Also `-q/--quiet`. — local `blender --help`
- GPU flags: `--gpu-backend opengl|vulkan`, `--gpu-device`, `--debug-gpu`, `--debug-gpu-force-workarounds` and `--debug-gpu-compile-shaders`. `-X/--factory-startup` skips the user's `startup.blend`. — local `blender --help`
- `blender -c help` lists exactly three commands: `asset_listing`, `extension` and `maketx`. There is no `render` command under `-c`. Even `-c help` still printed MPFB add-on init logs, so user extensions load in command mode. — local `blender -c help`
- An extension can be installed from the command line, for example `blender --online-mode -c extension install -s --enable mpfb`. Under `--factory-startup`, headless scripts can still enable an installed extension with `addon_utils.enable("bl_ext.blender_org.mpfb")`. — [local memory note blender-setup.md](file:///C:/Users/erayg/.claude/projects/C--Users-erayg-ffestiniog-bikeride/memory/blender-setup.md)

**Blender Asset Tracer (BAT)**
- BAT 2.2.1 (8 Oct 2026): GPL-3.0-or-later, Python `==3.13.*`, author Sybren A. Stüvel, maintainers fsiddi and sybrenstuvel. It parses .blend files, reports their dependencies and packs them into a self-contained directory (CLI: `bat`). — [PyPI blender-asset-tracer](https://pypi.org/project/blender-asset-tracer/)
- BAT v2 requires Blender 5.1 or later. Known gaps it inherits: legacy particle caches are reported incorrectly (fixed in Blender 5.1.1), Alembic sequences are reported incorrectly, and Geometry Nodes simulation caches are not reported or packed. The 2.2.1 upload has no provenance attestation. — [PyPI blender-asset-tracer](https://pypi.org/project/blender-asset-tracer/)

### Inferences
- Running `pip install bpy` in the repo's own Python 3.13 venv would let vitest/pytest import Blender without launching `blender.exe`. But 5.2.3 ≠ 5.2.4, and the wheels are 200–400 MB. For a pipeline that already calls `blender.exe`, a subprocess harness is closer to production. Use `-b --factory-startup --python-exit-code 1 -P script.py -- args`, plus `--offline-mode` and `-q`. Pin the add-ons explicitly, because `-c help` showed that user extensions such as MPFB load anyway.
- `--python-exit-code 1` matters for CI and for Claude Code: without it, a Python exception in a headless script can still exit 0.
- The `fake-bpy-module-5.2` stubs plus pyright/mypy in the repo's Python environment give Claude Code static checks on `scripts/blender/*.py` before any slow Blender launch.
- BAT is useful mainly for packing a .blend and its textures for a farm or archive. For a single-PC pipeline whose .blend files are rebuilt from scene packages, it is optional.

### Gaps
- The current pytest-blender version, its last commit date and whether it supports Blender 5.x could not be read (PyPI page failed to load, and GitHub showed no releases).
- Whether a bpy 5.2.4 wheel will be published was not found. The latest wheel is 5.2.3.
- BAT's Windows support is not stated on PyPI.

## MCP servers and AI tooling for Blender

### Takeaway
Two incompatible add-on/server pairs both use localhost:9876. One is the official Blender Lab "MCP" extension (v1.0.3, Blender 5.1+). The other is the community `ahujasid/mcp-for-blender` (MIT, about 32.9k stars, formerly the `blender-mcp` PyPI package), which this project uses. Both run arbitrary LLM-written Python in Blender, and the community socket has no authentication. Running one at a time, binding to localhost only, pinning versions and turning off telemetry are the main controls.

### Cited Findings
- Blender Lab MCP Server: add-on v1.0.3 (`mcp-1.0.3.zip`), needs Blender 5.1+. It installs by drag-and-drop in two steps (add the Blender Lab repo, then the add-on, which enables update notifications) or "Install from Disk". The server ships as an MCP Bundle (`.mcpb`) or from source. Its examples are scene performance analysis, renaming data-blocks, finding which objects use a material, finding the highest-poly object, and documenting Geometry Nodes setups. — [blender.org/lab/mcp-server](https://www.blender.org/lab/mcp-server/)
- The Lab page warns that the server runs LLM-generated code in Blender "without any guards in place", so it could delete data or send it elsewhere. It recommends a virtual machine or a system without sensitive data. The page states no licence and does not mention Claude Code or telemetry. — [blender.org/lab/mcp-server](https://www.blender.org/lab/mcp-server/)
- The Lab extension's source repo is projects.blender.org/lab/blender_mcp, and it listens on localhost port 9876. Secondary sources disagree on the release timeline: v1.0.0 on 27 Apr 2026, and v1.0.2 or v1.0.3 in Sept 2026. — [StraySpark comparison](https://www.strayspark.studio/blog/official-blender-mcp-server-comparison-2026); [Zenn setup guide](https://zenn.dev/shintama/articles/blender-official-mcp-claude?locale=en); [Voyager](https://voyager.so/blog/blender-mcp)
- MCP for Blender (`ahujasid/mcp-for-blender`): MIT licence, about 32.9k stars and 3.0k forks, not affiliated with the Blender Foundation. Its PyPI package was renamed from `blender-mcp` to `mcp-for-blender`. It has nine tools: `execute_blender_code`, `look` (viewport, camera, multi-angle, animation or render), `get_scene_info`, `generate_3d`, `search_assets`, `import_asset`, `get_addon_status`, `disable_telemetry` and `record_trajectory_feedback`. Documented clients include Claude Code, Claude Desktop, Cursor, VS Code and Codex. GitHub lists no releases. — [GitHub ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp)
- Integrations in MCP for Blender:
  - Poly Haven: CC0, no API key needed.
  - Sketchfab: API key stored in the add-on's preferences.
  - Hyper3D Rodin: API key.
  - Hunyuan3D: through Tencent Cloud, with separate services for mainland and international accounts.
  - Poly Pizza: API key.
  - Meshy and Tripo: also supported. "Premium users" can generate without their own keys.

  — [GitHub ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp)
- MCP for Blender security: `execute_blender_code` runs arbitrary Python. The add-on's socket server "has no authentication or encryption", so anyone who can reach the port can run Python in Blender. The project recommends keeping it on localhost and using an SSH tunnel for remote access. An optional safe mode blocks direct file access, subprocesses and network access. — [GitHub ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp)
- MCP for Blender telemetry: content collection (prompts, code, screenshots, scene data) is opt-in and off by default. A minimal anonymous usage record (tool names, success, timing, version) is collected by default, and `DISABLE_TELEMETRY=true` turns all of it off. — [GitHub ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp)
- On this machine, `uvx blender-mcp` timed out against the Lab extension because the two speak different protocols and both want port 9876. The working pair is `uvx mcp-for-blender`, its add-on installed with `uvx mcp-for-blender install-addon`, and the Lab extension disabled. — [local memory note blender-setup.md](file:///C:/Users/erayg/.claude/projects/C--Users-erayg-ffestiniog-bikeride/memory/blender-setup.md)
- Other Blender MCP projects exist: a `blenderstudiomcp` PyPI package, the Griptape Nodes Blender MCP server, and a "blender-lab-mcp-client" on Glama. — [PyPI blenderstudiomcp](https://pypi.org/project/blenderstudiomcp/); [Griptape docs](https://docs.griptapenodes.com/en/stable/guides/mcp/servers/blender/); [Glama](https://glama.ai/mcp/servers/A-to-PC/blender-lab-mcp-client)

**Local text/image-to-3D on 6 GB**
- Hunyuan3D-2mini (0.6B): VRAM estimates for shape-only generation range from about 3 GB to about 6 GB. The official README runs it with `--low_vram_mode`. Shape plus texture with the standard model needs about 12–16 GB. The Hunyuan3D-2GP fork (MMGP offloading) runs shape generation on 4–6 GB. — [Tencent/Hunyuan3D-2](https://github.com/Tencent/Hunyuan3D-2); [DeepWiki getting started](https://deepwiki.com/Tencent/Hunyuan3D-2/2-getting-started); [Hunyuan3D-2GP](https://openi.pcl.ac.cn/NewestAI/Hunyuan3D-2GP); [Codersera Windows guide](https://codersera.com/blog/set-up-hunyuan3d-2-on-windows-a-step-by-step-guide/amp/)
- TRELLIS.2 (4B): VRAM requirements conflict between sources. Claims include 24 GB+ with Windows not officially supported, 16 GB minimum at 512³, and about 4 GB peak in a community quantised low-VRAM build (8 GB minimum GPU). — [BrightCoding](https://converter.brightcoding.dev/blog/trellis2-microsofts-4b-powerhouse-for-instant-3d-generation); [CodeSOTA](https://www.codesota.com/news/trellis-2-3d-generation); [HF trellis2-quantized-v3](https://huggingface.co/Lifec-321/trellis2-quantized-v3)
- Comfy3D-WinPortable has a Hunyuan3D-2 Windows portable release. — [GitHub Comfy3D-WinPortable r8](https://github.com/YanWenKun/Comfy3D-WinPortable/releases/tag/r8-hunyuan3d2)

### Inferences
- Security risk: any local process, or a web page reaching localhost through DNS rebinding or a browser bug, can talk to the unauthenticated 9876 socket and run Python with the user's privileges. The add-on server should run only while it is needed ("Start MCP Server" by hand). Turn on safe mode when no file or network access is needed.
- Supply chain: `uvx mcp-for-blender` without a version pin resolves the latest PyPI release on every launch. Pin it (`uvx mcp-for-blender==X.Y.Z`) and set `DISABLE_TELEMETRY=true` in the MCP server env block in `~/.claude.json`.
- Cloud generators (Rodin, Hunyuan3D via Tencent Cloud, Meshy, Tripo, Sketchfab) send prompts and images to third parties and may cost credits or need paid plans. Only Poly Haven is keyless and CC0. Check each provider's licence before using generated models in a published reel.
- For headless rendering, MCP adds nothing. It is most useful for interactive scene inspection (`look` and `get_scene_info`) while the deterministic build stays in `scripts/blender/*.py`.
- Locally on a 6 GB card, only Hunyuan3D-2mini shape-only generation looks realistic. Texturing and TRELLIS.2 need bigger GPUs or the cloud.

### Gaps
- The Lab MCP extension's licence and full tool list were not confirmed (not on blender.org/lab).
- No version number or release date was found for mcp-for-blender (GitHub shows no releases, and PyPI was not checked).
- No CVEs or third-party security audits of either Blender MCP server were found.
- Dedicated standalone MCP servers for Poly Haven, Meshy or TRELLIS were not researched.

## Rendering performance on an RTX 2060 6 GB; render queues and farms

### Takeaway
The RTX 2060 (compute capability 7.5) meets the Cycles requirements for CUDA and OptiX (CC ≥ 5.0 and driver ≥ 575 for OptiX) and for GPU OpenImageDenoise (CC ≥ 7.0). EEVEE in 5.2 adds up to 2x faster instancing, lower VRAM use and 1.5/2 GB shadow-pool options. Cycles 5.2 adds a texture cache, tile-based texture loading and a Simplify texture-resolution slider, all aimed at VRAM limits. Flamenco 3.9.3 (GPL-3) can run manager and worker on one PC, but on a single machine it mainly adds queueing and resumability.

### Cited Findings
**EEVEE 5.2**
- EEVEE now uses the Workbench/Overlay instancing optimisations. "Instancing-heavy scenes (CPU bottlenecked) can be up to twice as fast." — [5.2 EEVEE notes](https://developer.blender.org/docs/release_notes/5.2/eevee/)
- Memory: 1.5 GB and 2 GB shadow-pool sizes were added, EEVEE "now uses slightly less video memory during rendering", and the limit of 8 object attributes per material was removed. — [5.2 EEVEE notes](https://developer.blender.org/docs/release_notes/5.2/eevee/)
- Screen-space raytracing had a major cleanup with breaking changes. Thickness may need retuning, and some scenes may render darker because of energy-conservation fixes. Fast GI's Far Thickness parameter was removed. A scene-level anisotropic filtering setting was added, and mipmap generation is now consistent between backends. — [5.2 EEVEE notes](https://developer.blender.org/docs/release_notes/5.2/eevee/)
- Project measurement: dressed ground frames take about 5 s each at 960×540 with 24 EEVEE samples on this RTX 2060. — [local memory note blender-setup.md](file:///C:/Users/erayg/.claude/projects/C--Users-erayg-ffestiniog-bikeride/memory/blender-setup.md)

**Cycles 5.2 and GPU requirements**
- CUDA needs compute capability 5.0 or higher. OptiX needs CC 5.0 or higher and "a driver version of at least 575", and uses hardware ray tracing on RTX cards. GPU OIDN needs CC 7.0 or higher, "which includes all NVIDIA RTX cards." — [Blender 5.2 manual, GPU Rendering](https://docs.blender.org/manual/en/latest/render/cycles/gpu_rendering.html)
- When GPU memory is full, CUDA, OptiX, HIP and Metal fall back to system memory, which is slower but often still faster than CPU. Texture memory is roughly 256 MB for 8k, 64 MB for 4k, 16 MB for 2k and 4 MB for 1k. — [Blender 5.2 manual, GPU Rendering](https://docs.blender.org/manual/en/latest/render/cycles/gpu_rendering.html)
- Cycles 5.2 added a texture cache (Performance > Texture Cache) that writes `.tx` files to `blender_tx/` next to the images, cutting memory and startup time at a small speed cost. Tile Size under Performance > Memory loads only the textures each tile needs. Simplify gains a Texture Resolution percentage, and geometry memory is now shared with Blender. The minimum OptiX driver is 575. — [5.2 Cycles notes](https://developer.blender.org/docs/release_notes/5.2/cycles/)
- `--cycles-print-stats` logs render memory and time, and `--log-show-memory` adds memory usage to every log line. — local `blender --help`
- `blender -c maketx` exists as a command-line command, presumably to pre-generate `.tx` files. — local `blender -c help`

**Render queues and farms**
- Flamenco: the latest stable release is 3.9.3, with 3.10-beta1 marked experimental. Each download includes Manager and Worker for Windows amd64, Linux and macOS. FFmpeg is bundled except on macOS arm64. The Blender add-on is downloaded from the Manager web UI. — [flamenco.blender.org/download](https://flamenco.blender.org/download/)
- Flamenco is GPL-3.0, self-hosted and built with Go and SQLite. Job types are written in JavaScript. — [flamenco.blender.org](https://flamenco.blender.org/)
- The Flamenco Manager "can run on one of the worker computers". Shared storage must be "available at the same path on each computer", and Blender "should be in the same place everywhere." — [Flamenco quickstart](https://flamenco.blender.org/usage/quickstart/)
- Flamenco 3 was released in Sept 2022, designed for farms of up to 100 computers and up to 10 artists. It operates on a trust basis, which makes it less suited to commercially sensitive projects. — [Blender Studio blog](https://studio.blender.org/blog/announcing-flamenco-3-release); [CGChannel](https://www.cgchannel.com/?p=139783)

### Inferences
- For a 90 s reel at 1080p (2,160 frames at 24 fps, or 2,700 at 30 fps), per-frame time dominates. Scaling the local 5 s/frame at 960×540 by about 4x pixels suggests roughly 3–6 hours for EEVEE at 1080p. This is a rough estimate that needs measuring.
- EEVEE settings worth A/B-testing on 6 GB: shadow pool 512 MB–1 GB rather than 1.5/2 GB (leaves VRAM for textures), fewer samples plus a motion-blur check, and Simplify (max subdivision, texture limit). Note that the texture-resolution percentage in Simplify is documented for Cycles. Also run `--log-show-memory` on a heavy frame.
- Cycles on this card: OptiX plus GPU OIDN, adaptive sampling, persistent data for animations, the texture cache and Simplify texture % are the levers for 6 GB. Expect Cycles to be several times slower than EEVEE per frame.
- Single PC: a thin Python or Node render queue (render chunks with `-s/-e`, skip frames that already exist using the `#` padding) gives the same resumability as Flamenco without a manager or shared-storage setup. Flamenco becomes worthwhile only when a second machine is added.
- SheepIt and other public farms upload .blend files to volunteers' machines. That is a data-sharing concern, and the volunteers' GPU mix makes EEVEE output less deterministic.

### Gaps
- No primary sources were retrieved for CrowdRender, the SheepIt terms of service, B-Renderon, render-queue add-ons, or GPU memory profilers (NVIDIA Nsight Systems/Graphics, GPU-Z, nvidia-smi logging). These must be verified before recommending them.
- Exact defaults and recommendations for EEVEE "persistent data", adaptive sampling and the light tree in 5.2 were not confirmed from the manual.
- No 5.2-specific benchmark numbers for RTX 2060 were found.

## Output and colour: image sequences, colour management, ffmpeg NVENC, intermediates for Remotion

### Takeaway
Render image sequences, not video files directly. `-F PNG|OPEN_EXR|OPEN_EXR_MULTILAYER` with `#` padding makes renders resumable and frame-accurate, and 5.2 writes half-float EXR faster. Encode with ffmpeg afterwards. The RTX 2060's 7th-gen Turing NVENC does H.264 and HEVC (including HEVC 10-bit, 4:4:4 and lossless) but not AV1. ProRes and DNxHR intermediates for Remotion are software encodes in ffmpeg (not NVENC).

### Cited Findings
- Render formats include PNG, TIFF, JPEG, HDR, and (if compiled in) OPEN_EXR, OPEN_EXR_MULTILAYER, FFMPEG, DPX and WEBP. `-o` replaces `#` with zero-padded frame numbers ('test-######.png' becomes 'test-000001.png'). — local `blender --help`
- 5.2 Pipeline & I/O: writing half-precision (FP16) EXR is faster. Stereoscopic and equirectangular metadata are now exported in movies. No FFmpeg-specific changes are listed. — [5.2 Pipeline & I/O notes](https://developer.blender.org/docs/release_notes/5.2/pipeline_io/)
- USD import and export now handle colour spaces: colours convert to the blend file's working space on import, and primitives and textures are tagged on export. — [5.2 Pipeline & I/O notes](https://developer.blender.org/docs/release_notes/5.2/pipeline_io/)
- RTX 2060 NVENC: Turing, 7th gen, 1 engine, up to 12 concurrent sessions.
  - H.264: 4:2:0, 4:4:4 and lossless are supported. 4:2:2 is not.
  - HEVC: 4:2:0, 4:4:4, lossless, 10-bit, B-frames and 8K are supported. 4:2:2 is not.
  - AV1: not supported.

  — [NVIDIA Video Encode and Decode GPU Support Matrix](https://developer.nvidia.com/video-encode-and-decode-gpu-support-matrix-new)

### Inferences
- Recommended handoff: Blender writes `frame_######.png` (8-bit sRGB/AgX display-referred, small) or EXR half (if Remotion or ffmpeg will grade). ffmpeg then builds either a lossless or near-lossless intermediate (`prores_ks` profile 3, or `dnxhd` with `-profile:v dnxhr_hq`, both CPU encodes) or delivers directly with `hevc_nvenc` / `h264_nvenc`. Use `-framerate N -start_number 1` on input to keep frame counts exact, and check the output with `ffprobe -count_frames`.
- Because Turing NVENC lacks 4:2:2, use 4:2:0 or 4:4:4 for NVENC intermediates. AV1 delivery must use software encoders (libsvtav1 or libaom).
- Since EEVEE output is display-referred, AgX (Blender's default view transform since 4.0) with the "Standard" look keeps the PNGs matching what is seen in the viewport. EXR is worth using only if a later grade is planned.

### Gaps
- The 5.2 manual's colour-management page (AgX, ACES 2.0 / OCIO 2.x configs, working-space options added in 5.x) was not retrieved, so specific 5.x colour-management changes are unverified.
- ffmpeg 9.0.2 encoder specifics (`prores_ks` / `dnxhd` options, NVENC presets) were not checked against ffmpeg documentation, and the Remotion-side requirements are covered elsewhere.
- Blender's built-in FFmpeg version in 5.2 was not confirmed.

## Version control and pipeline management for .blend files and assets

### Takeaway
Blender Studio's own tooling is Kitsu plus the Blender Kitsu add-on and the Studio Tools add-ons (Asset Pipeline, Anim Cupboard, Blender SVN, Blender Log), and it targets multi-artist productions. For a one-developer repo whose .blend files are generated, the main tasks are keeping generated .blend files and renders out of git and using BAT or a manifest to record dependencies. No 2026-dated sources were found for Git LFS or DVC with Blender specifically.

### Cited Findings
- Blender Studio's add-on overview lists Blender Kitsu (connects Blender to the Kitsu production tracker and has non-Kitsu pipeline features), Asset Pipeline, Anim Cupboard, Blender SVN and Blender Log. — [studio.blender.org pipeline add-ons](https://studio.blender.org/pipeline/addons/overview)
- In Blender Kitsu, sequence-editor tools link strips to Kitsu shots so that frame-range changes made in Blender flow back to Kitsu. — [Blender Kitsu docs](https://studio.blender.org/tools/addons/blender_kitsu)
- The `blender-studio-pipeline` repo holds setup scripts and docs covering folder structure, local add-on packaging and Kitsu preferences. — [projects.blender.org project-tools-setup](https://projects.blender.org/TinyNick/blender-studio-pipeline/src/tag/latest/docs/td-guide/project-tools-setup.md)
- OpenStudioHub (a community project, Aug 2026) integrates Kitsu with Blender Studio Tools for smaller studios. It is unverified beyond a forum post. — [Blender Artists thread](https://blenderartists.org/t/simplifying-blender-studio-tools-kitsu-and-blender-pipeline-meet-openstudiohub/1650327.md)
- BAT lists and packs .blend dependencies (GPL-3.0, Blender 5.1+). — [PyPI blender-asset-tracer](https://pypi.org/project/blender-asset-tracer/)
- The project already keeps CC0 vendor assets in a git-ignored `out/blender/vendor/`, fetched with `npm run blender:assets`. — [local memory note blender-setup.md](file:///C:/Users/erayg/.claude/projects/C--Users-erayg-ffestiniog-bikeride/memory/blender-setup.md)

### Inferences
- Kitsu and Gazu (Kitsu's Python client) solve multi-person shot tracking and are overkill for one PC and one AI assistant. A JSON shot list in the repo (sections and frame ranges) does the same job and is diff-able.
- Since the .blend files are rebuilt from scene packages, treat .blend files and renders as build outputs (git-ignored, reproducible). Version only the scripts, the scene-package exports and a manifest of fetched assets (URL, licence, hash). Git LFS or DVC is only needed if hand-authored .blend files or large source textures must be versioned. LFS works with GitHub, which has storage and bandwidth quotas. DVC can point at local or cloud storage.
- Blender's asset libraries (a folder registered under Preferences > File Paths > Asset Libraries, readable via `blender -c asset_listing`) can serve the vendor assets to both headless scripts and the MCP `import_asset` flow.

### Gaps
- No primary source was retrieved for Git LFS or DVC pricing, quotas or Blender-specific guidance in 2026, for Gazu's current version, or for the Blender Studio Tools release versions.
- What `blender -c asset_listing` outputs was not tested.
