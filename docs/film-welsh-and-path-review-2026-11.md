# Welsh language and path-surface review of the community film (2026-11-08)

The brief "Improve North Wales Welsh Language and Walking/Cycling Path Realism": every Welsh line of the 3-minute film
and its social cuts reviewed against Welsh-language guidance, and the vegetation that grew through the proposed path
traced to its causes and fixed in the pipeline, then the film re-rendered and checked on the rendered frames. The
previous review is [film-enhancement-2026-11.md](film-enhancement-2026-11.md); the film's data is
`src/data/community-film.ts`, the social cuts' `src/data/social-cuts.ts`, the legend lines `src/data/reel-captions.ts`
and `src/three-core/props.ts`.

## 1. Sources

| Area | What was used | Source |
|---|---|---|
| Clear Welsh | Cen Williams's *Cymraeg Clir* handbook (short sentences, everyday words, natural order, no stiff calques) and Canolfan Bedwyr's 12 rules | [Llyfr Cymraeg Clir](https://www.bangor.ac.uk/canolfanbedwyr/cymraeg_clir_llyfr.php.en), [PDF](https://www.bangor.ac.uk/sites/default/files/2025-05/CymraegClir.pdf), [resources](https://bangor.ac.uk/canolfanbedwyr/adnoddau_cc.php.en) |
| Government style | The Welsh Government's *Arddulliadur* (its translators' style guide, Welsh only) and its terminology bank TermCymru | [Arddulliadur](https://www.gov.wales/bydtermcymru/about/arddulliadur), [TermCymru: llwybrau cyd-ddefnyddio](https://gov.wales/bydtermcymru/search/term/26017773) |
| Welsh first, equal treatment | The Commissioner's Bilingual Design Guide (Welsh placed to be read first, equally legible, one typeface, ŵ and ŷ) and its advice on bilingual drafting rather than literal translation | [Bilingual Design Guide](https://www.welshlanguagecommissioner.wales/media/niknstqs/bilingual-design-guide-eng.pdf), [Bilingual drafting](https://www.welshlanguagecommissioner.wales/media/d4lk3syy/cygdogfen-cyngorenglishsingle-pages.pdf) |
| North Wales forms | *efo* "with" is the North Wales preposition (GPC via Wiktionary, synonym *gyda*); *ydi*, *dydi*, *rŵan*, *lle* are the everyday northern forms | [Wiktionary: efo](https://en.wiktionary.com/wiki/efo), [Northern Welsh (Bangor)](https://research.bangor.ac.uk/en/publications/northern-welsh-illustrations-of-the-ipa/) |
| Units | *mya* (milltir yr awr) is the Welsh speed label on Conwy's traffic orders; statutory instruments spell it out | [Conwy TRO](https://www.conwy.gov.uk/en/Resident/Parking-Roads-and-Travel/Traffic-Regulation-Orders/Current-Traffic-Regulation-Orders/documents/Various-Roads-Speed-Limits/L04172317-A470-Conway-Road-Llandudno-40-to-30.pdf), [WSI 2018/533](https://legislation.gov.uk/wsi/2018/533/pdfs/wsi_20180533_we.pdf) |
| Terms in use | *llwybr di-draffig* (traffic-free path) is Sustrans Cymru's and the councils' usage; *storfeydd beiciau* is TfW's for cycle hangars | [Sustrans Cymru](https://www.sustrans.org.uk/media/13281/sustrans-cymru-cerdded-olwyno-a-ffynnu.pdf), [TfW](https://news.tfw.wales/news/40-new-cycle-hangars-successfully-installed-in-wales) |
| Credits | OS's Welsh copyright acknowledgement forms | [OS copyright acknowledgements](https://www.ordnancesurvey.co.uk/business-government/licensing-agreements/copyright-acknowledgements) |

Not found: a TermCymru entry for *cycle locker* or *viewpoint*; the OS page gives the Welsh notice for PSGA licences
rather than the OpenData one. See §2.4.

## 2. Language review

### 2.1 Principles applied

- Welsh first in every caption, note, title, sign and subtitle; the Welsh carries the message and the English is a
  concise British English equivalent of the same meaning (unchanged where it already was).
- Short, conversational sentences; everyday words over administrative ones (*trafod* for exploring an idea, not
  *archwilio*, which is to inspect or audit; *yma'n barod* for "existing", not the calque *yn bodoli*).
- North Wales forms where a fluent local speaker would use them in writing of this register: *efo'n gilydd*, *efo
  pawb* (the northern preposition; *gyda* is the southern and literary form), *ydi* / *dydi* in the conversational
  post text. Standard written forms are kept in the small-print legend and the credits, and no dialect spelling is
  forced into the captions (no *rŵan*, *hogia*, *sgynnoch*).
- Grammar checked line by line: mutations after *o*, *i*, *a*, *ar*, *i'w*; the aspirate after *a* (*a Thrawsfynydd*,
  *a phasio*); *ac* before a vowel; the h-prefix after *eu* (*i'w harchwilio* was right, *i'w trafod* needs none);
  apostrophes in *i'w*, *efo'n*, *yma'n*, *wedi'i*, *â'r*; the diacritics *ŵ* and *â*.
- One meaning in both languages, and consistent terms across the film, the cuts, the SRT files and the post text.

### 2.2 Changes

| Where | Before | After | Why |
|---|---|---|---|
| Badge (film and cuts) | Darlun cysyniadol — nid llwybr cymeradwy | Darlun cysyniadol — nid llwybr wedi'i gymeradwyo | *cymeradwy* reads as "commendable, acceptable" (GPC); "approved" is the participle *wedi'i gymeradwyo*. |
| "Idea" caption, end-card invitation, story title | syniad i'w archwilio gyda'n gilydd | syniad i'w drafod efo'n gilydd | *archwilio* is to inspect or audit; an idea is *trafod*-ed. *efo* is the North Wales "with". |
| School caption 2 | Beicio gyda'n gilydd ar lwybr di-draffig | Beicio efo'n gilydd ar lwybr di-draffig | northern *efo* |
| Everyday trips | Teithiau bob dydd: teuluoedd, beiciau cargo a chŵn | Teithiau bob dydd: teuluoedd, beiciau cargo a mynd â'r ci am dro | "dog walks" is *mynd â'r ci am dro*; *a chŵn* said "and dogs". Now two lines in Welsh. |
| Station note (film), bus-stop note (cuts) | Yn bodoli: gorsaf a safle bws | Yma'n barod: gorsaf a safle bws | *yn bodoli* is the dictionary calque of "existing"; *yma'n barod* ("already here") is how it is said. |
| Everyone | Croeso i bawb, beth bynnag fo'ch cyflymder | Croeso i bawb, yn eich amser eich hun | The subjunctive *fo'ch* is literary; *yn eich amser eich hun* is the natural idiom for "whatever your pace". |
| Heritage | i'w harchwilio gyda phawb | i'w trafod efo pawb | as above; *efo* takes no mutation |
| Post text | Nid yw'n llwybr cymeradwy: syniad i'w archwilio gyda'n gilydd yw hwn. | Dydi'r llwybr ddim wedi'i gymeradwyo: syniad i'w drafod efo'n gilydd ydi o. | conversational northern register for a social post; the approval wording as the badge |
| Legend: people and verges | Pobl er darlunio; ymylon wedi'u lefelu… | Pobl er enghraifft yn unig; ymylon wedi'u lefelu… | *er darlunio* ("for depicting") is not idiomatic; *er enghraifft yn unig* is. |
| Legend: the railway today | darlun, trac ar y llinell a fapiwyd | darlun bras, y trac ar y llinell a fapiwyd | *darlun* alone did not say "illustrative"; *bras* (rough) does, and the article was missing. |
| Legend: proposals | man gwylio | golygfan | *golygfan* is the word for a viewpoint; *man gwylio* is a watching place. |

### 2.3 Checked and kept

*Blaenau Ffestiniog, Llan Ffestiniog a Thrawsfynydd*; *Heddiw: rheilffordd segur ers y 1990au* (*segur*, dormant, is
how Welsh news writes of a mothballed line); *Taith fwy diogel a mwy annibynnol i'r ysgol*; *Lle i gerdded, rhedeg a
phasio'n ofalus*; *Beicio i'r orsaf, cloi'r beic, dal bws neu drên*; *Lle i orffwys a mwynhau'r olygfa*; *8.2 milltir o
Flaenau Ffestiniog i Drawsfynydd*; *Tua 49 munud ar 10 mya hamddenol*; *Cysylltu ysgolion, teuluoedd, cymdogion ac
ymwelwyr*; the closing *Mwy na llwybr. Cysylltiad i'n cymunedau.* (the brief's line, test-locked); every social line
(*Teithiau teulu bob dydd*, *Siopa lleol ar feic cargo*, *Llwybr i bawb*, …); the fingerpost arms (*Gorsaf a bysiau*);
the locker sign (*Loceri beiciau · Cycle lockers / Arfaethedig · Proposed*); the viewpoint board (*Llyn Trawsfynydd*);
the credits, whose OS line follows OS's Welsh form (*Hawlfraint y Goron a hawl cronfa ddata*).

Caption timing was re-checked by the tests after the edits: every caption still holds for at least 2.5 s and 15
characters a second of its longer language, each language within two lines of 51 characters (the 900 px panel).

### 2.4 For local review

These are judgement calls a fluent North Wales speaker should confirm before publication:

- *Darlun cysyniadol* (concept visualisation): the planning-document term, kept for consistency with the badge and the
  post; *argraff artist* or *darlun o'r syniad* would be plainer.
- *Loceri beiciau*: *locer* is in GPC as a borrowing and the sign reads naturally, but Transport for Wales writes
  *storfeydd beiciau* for its hangars; no TermCymru entry was found.
- *Dydi'r llwybr ddim … ydi o* in the post text: northern conversational forms, chosen for a social post; the formal
  *Nid yw … yw hwn* is available if the owner prefers one register throughout.
- *Yma'n barod* for "existing": natural, but a reviewer may prefer *Yn bodoli eisoes* in the legend register.
- The credits abbreviate *DTM*, *DSM*, *DEM*, *OGL*, *ODbL* as the licences do; *O'r DEM a mapiau, nid o safon arolwg* is
  terse small print.

## 3. The path surface

### 3.1 Defects found on the v9 frames

Contact sheets of every scene and full-resolution crops of the path region (made with Pillow from
`out/blender/frames/community-v9/`) showed:

1. Grass clumps standing on the path surface itself, often near its centre: the station lockers (frames 2160–2520,
   three clumps), the "now" view (537), the school hold and follow (900, 1125), the Blaenau ride (3480, several), the
   Manod wheel-height shot (3915, 4020), under the A470 (4080) and on the moor (4380, two). They stood up to 0.6 m tall
   in the first-person shots.
2. Blades and a clump growing through the bench's gravel slab at the viewpoint (3000).
3. A tan band 0.3–0.4 m wide along both edges of the path in every ground shot: the path material's "verge creep"
   used the raw grass texture, which is yellow-brown, against a sward that is tinted green by the land-cover data.

Nothing protruded through the ribbon from the terrain: the corridor is flattened to the profile and the nodes under
the ribbon are held at or below it (`flattenCorridor`, `groundScene` in `src/three-core/sections.ts`), and the blade
sward is deleted within 0.25 m of the trail faces (`scripts/blender/sward.py`). No z-fighting, gaps or misaligned
bridge approaches were seen.

### 3.2 Root causes and fixes

| Defect | Cause | Fix |
|---|---|---|
| Clumps on the path | `placeGrass` (`src/three-core/grass.ts`) measured the clearance to every *other* centreline sample, 4 m apart, not to the line: a clump midway between two samples was 2 m from each and passed the 2 m test while standing on the centreline. | The clearance is the lateral distance to the centreline's segments (`centrelineIndex`, `src/three-core/trail.ts`), and the default rises from 2.0 to 2.3 m from the centreline (0.8 m beyond the edge) so the largest clump (0.6 m across at full scale) never overhangs the ribbon. |
| Vegetation through the bench slab and the lockers' base | Street furniture was built after the vegetation, so neither the clumps nor the blade sward knew it was there. | `import_blockout.py` builds the props first; `trailfolk.off_props` drops every clump within 0.3 m of a prop's plan footprint, and the sward keeps 0.25 m clear of prop meshes as it does of the trail, roads and walls. |
| Tan band at the edges | `roadway.path_material` mixed the raw grass texture into the path's edge zone over 0.4 m. | Each dressed trail mesh carries the terrain's data colour under its vertices (a `land` colour attribute, as the clumps already do); the creep is that texture re-centred on the colour beside the path, as the terrain material is, over 0.3 m. |

The trees were checked for the same flaw: `placeTrees` keeps 5 m from every 2 m sample, so no tree can stand within
the ribbon. The barriers' gap test uses every sample too.

### 3.3 Results

Measured on the exported packages (`out/blender/exports/*/instances-grass.f32` against the trail ribbon's vertices):
the packages exported by the old code hold 100–216 clumps inside the 3 m ribbon each (0.6–1.4 % of their clumps,
the nearest on the centreline itself); the film's twelve ground packages re-exported by the fixed code hold none,
and no clump stands nearer than 2.30 m to the centreline.

Fifteen proof frames of the v10 master were rendered at the defect spots before the full render (frames 241, 538,
901, 1126, 1831, 2161, 2431, 2641, 3001, 3481, 3916, 4021, 4081, 4381 and 4975) and compared with the same v9
frames, path region at full resolution: no clump stands on the path in any of them, the bench slab is clear of
blades and clumps, the path's edge is a soft green fringe in the sward's own colour instead of a tan band, the
railway "then" view keeps its grass through the track (the sward is still free to grow there), and the clumps still
stand along both verges beyond the edge. The comparison crops are in `out/blender/compare-v10/proof/`.

## 4. Renders and checks

### 4.1 The full film

The v10 master (`out/blender/master/community-dressed-v10-render.blend`, built 2026-11-08 17:22 with
`npm run blender:reel -- --dressed --film community --samples 32 --percent 100`) was rendered in full with
`scripts/blender/render_film.py`: 5,400 frames at 1920 x 1080, Blender 5.2.4 EEVEE, 32 samples, from 17:26 on
2026-11-08 to 02:12 on 2026-11-09 (31,595 s). Frames are in `out/blender/frames/community-v10/`, the log is
`out/blender/reel/render-community-v10.log`.

The frames were encoded with the unchanged v9 soundtrack (`npm run film:encode -- --frames
out/blender/frames/community-v10 --audio out/blender/reel/community-v9.wav --out
out/blender/reel/community-1080p-v10.mp4`). The encoder's own probe of the result:

| Check | Result |
| --- | --- |
| Duration | 180.000 s, 5,400 frames at 30 fps (the brief's 180 s limit is met exactly) |
| Picture | H.264 High, 4:2:0, BT.709 tags, about 23.5 Mbit/s, 536 MB |
| Sound | AAC-LC, 48 kHz stereo; integrated loudness -13.9 LUFS, loudness range 7.2 LU, peak -1.5 dBFS |
| Frozen stretches (1 s or longer) | 0 |
| Black stretches (0.5 s or longer) | 0 |

### 4.2 Inspection of the video

`npm run film:compare` was run on the two encodes (`community-1080p-v9.mp4` against `community-1080p-v10.mp4`) into
`out/blender/compare-v10/`: one before/after sheet per moment at 0:03, 0:12, 0:17, 0:24, 0:31, 0:40, 0:50, 1:02,
1:15, 1:27, 1:34, 1:44, 1:51, 2:00, 2:20, 2:30, 2:40 and 2:55 (`compare-mm-ss.png`), and a contact sheet of each
cut at one frame every two seconds (`contact-community-1080p-v9.png`, `contact-community-1080p-v10.png`).

Every sheet was inspected. On the v10 video:

- no grass clump stands on the path in any moment; the clumps that sat on the ribbon in v9 at 0:17, 0:31, 0:40,
  1:15, 1:34, 1:51 and 2:00, and on the bench slab at 1:34 and 1:44, are gone, and the clumps still stand along
  both verges beyond the edge;
- the path's edge is a soft green fringe in the sward's own colour in every ground shot (0:24, 0:50, 1:02, 2:20,
  2:30 and elsewhere), where v9 showed a tan band;
- the bus bay's slab edge at 1:27 and the station forecourt at 1:15 are clear;
- the aerials (0:03, 2:55) and the mothballed-railway "then" shot (0:12) are unchanged in character, the latter
  keeping its grass through the sleepers as intended;
- every revised caption renders where its predecessor did, including the two-line *Teithiau bob dydd* and *Un hen
  reilffordd* titles and the two-line *Yma'n barod* note, with no overlap between the title, the badge and the
  legend panel;
- the contact sheets show a continuous grey ribbon in every shot of both cuts, and no missing, black or repeated
  frame.

### 4.3 Tests and static checks

Run on the working tree after the code changes (nothing changed in the code during or after the render):

| Check | Result |
| --- | --- |
| `npm run lint` (eslint over `src`, `scripts` and `tests`, then `tsc`) | clean |
| `npx vitest run` (with a numpy/Pillow venv on PATH as `python3`, as the Python self-tests need) | 56 files, 483 passed, 2 expected failures, 0 failed |
| `ruff check` on the three edited Blender scripts | no new findings; two import-order notes (I001) in `roadway.py` and `trailfolk.py` already exist at HEAD and were left as they were, since ruff is not one of the project's checks |
| Exported packages (`check_grass_export`) | 0 clumps within the 3 m ribbon in all twelve ground packages, nearest 2.30 m from the centreline |
| Visual baselines (`tests/baselines/`) | untouched; they cover the CyclingVision 2D frame hashes and the route checksum, which this work does not reach |

One vitest run made while the social plates were rendering showed a single failure that did not reproduce in two
further runs of the whole suite; the passing run's log was kept.

### 4.4 Social cuts

The five social cuts take their plates from the film's master, so they were re-rendered from the v10 master:
the plates first (`npm run social:plates -- --master out/blender/master/community-dressed-v10-render.blend`,
4,950 frames from 02:14 to 09:30 on 2026-11-09, log `out/social/plates-v10.log`), then the cuts
(`npm run social:render`, 17 min, log `out/social/render-v10.log`) and their QA (`npm run social:qa`, report
`out/social/qa/report.md`). The v9 plates, exports and QA were set aside unchanged in `out/social/plates-v9/`,
`out/social/exports-v9/` and `out/social/qa-v9/`.

One middle frame of each of the 47 plates was compared with its v9 counterpart
(`out/blender/compare-v10/social/plates-<format>.jpg`): the same result as the film, with the clumps gone from the
ribbon (the Blaenau and Manod point-of-view shots, the station forecourt, both bench slabs), a green verge, and the
framing and people otherwise identical.

The QA report passes every cut:

| Cut | Length | Picture and sound | Loudness | Sync | Freezes / blacks | Worst shot against its plate |
| --- | --- | --- | --- | --- | --- | --- |
| teaser, 1080 x 1920 | 15.019 s, 450 frames | H.264 High 4:2:0 BT.709, AAC 48 kHz stereo | -14 LUFS, -1.5 dBTP | 0 ms | 0 / 0 | SSIM 0.986, 42.6 dB |
| highlights, 1080 x 1920 | 30.016 s, 900 frames | as above | -13.9 LUFS, -1.5 dBTP | 0 ms | 0 / 0 | SSIM 0.971, 41.4 dB |
| story, 1080 x 1920 | 60.011 s, 1,800 frames | as above | -14 LUFS, -1.5 dBTP | 0 ms | 0 / 0 | SSIM 0.973, 41.7 dB |
| feed, 1440 x 1800 | 45.013 s, 1,350 frames | as above | -14 LUFS, -1.5 dBTP | 0 ms | 0 / 0 | SSIM 0.972, 41.4 dB |
| youtube, 1920 x 1080 | 60.011 s, 1,800 frames | as above | -14 LUFS, -1.5 dBTP | 0 ms | 0 / 0 | SSIM 0.972, 41.2 dB |

All five have Fast Start set and 317 kbit/s AAC. The QA contact sheets (`out/social/qa/<cut>/contact-sheet.png`)
were inspected: the badge, titles, notes and end card carry the revised Welsh (*Darlun cysyniadol · nid llwybr
wedi'i gymeradwyo*, *Yma'n barod: safle bws*, *Syniad i'w drafod efo'n gilydd*), the path is clean in every shot,
and the regenerated SRT files and post text hold the new wording with none of the old forms (searched for *gyda'n
gilydd*, *archwilio*, *Yn bodoli*, *chŵn* and *beth bynnag fo*).

The first render attempt failed with ENOSPC. Remotion's bundler copies the whole public folder, 16 GB of plates,
into a temp folder for every render, and `scripts/social/render-social.ts` never removed it, so eight orphaned
copies from earlier renders (about 90 GB) had filled the disk. They were deleted, the v9 plates were moved out of
the public folder so the bundler does not copy them, and the script now removes its bundle when the process ends
(a four-line change; lint and type-check clean). The second run left no bundle behind.

## 5. Deliverables and open items

| Deliverable | Where |
| --- | --- |
| 1. Revised captions, headings and messages | `src/data/community-film.ts`, `src/data/social-cuts.ts`, `src/data/reel-captions.ts`, `src/three-core/props.ts`; rendered in the v10 film |
| 2. Language report with references | §1 (sources) and §2 (principles, before/after table, checked and kept, items for local review) |
| 3. Path-defect summary and root causes | §3 |
| 4. Before/after screenshots | `out/blender/compare-v10/proof/` (full-resolution crops of the master at the defect spots), `out/blender/compare-v10/compare-*.png` (the two encodes at 18 moments) and the two contact sheets |
| 5. Updated full render | `out/blender/reel/community-1080p-v10.mp4`, 180.000 s |
| 5a. Social cuts from the same master | `out/social/exports/` (five cuts with Welsh, English and bilingual SRT files and post text), QA in `out/social/qa/report.md` |
| 6. Confirmation of checks | §4 |
| 7. Open items | below |

Open items for local review and for the owner's decision:

- **Welsh wording to confirm with a local speaker** (§2.4): *Darlun cysyniadol* as the badge's term for "concept
  visualisation"; *loceri beiciau* against *storfeydd beiciau*; the northern *dydi/ydi* register of the social post
  text; *Yma'n barod* for "existing"; and the terse credit lines.
- **Social cuts**: rendered and checked from the v10 master (§4.4); uploading them is the owner's call.
- **Nothing has been committed, pushed, published or uploaded.** The working tree holds the ten edited files (nine from the
  review and `scripts/social/render-social.ts` from §4.4) and this report; the commit, the release of the render and any upload of the social cuts are the owner's call. The
  approved visual baselines were not changed.
- **Kept for comparison**: v9's master, frames (17 GB), encode and social plates (16 GB), exports and QA
  (`community-dressed-v9-render.blend`, `out/blender/frames/community-v9/`, `community-1080p-v9.mp4`,
  `out/social/plates-v9/`, `out/social/exports-v9/`, `out/social/qa-v9/`). They can be removed once v10 is
  accepted; the disk had 86 GB free at the end of this work.
- **Not changed on purpose**: the two pre-existing ruff import-order notes in the Blender scripts, and the railway
  "then" shot, where the grass through the track is the point.
