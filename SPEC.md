# CONTESTED // OV-1 — Project Spec & Source of Truth

> **Working name.** 3D interactive DoDAF OV-1 for cyber risk modeling of Boeing uncrewed systems in contested environments.
> **Course:** Cyber Risk Modeling — Group Project, Scenario 3 (*Cyber Risk in Defense Operations*)
> **Team:** Jared Giesen · Phillip Steiger · Ella Park
> **Final deliverable due:** 24 Nov 2026. Presentations in the last three class sessions.
> **Status:** v0.3, initial commit scaffolded. This file is canonical. If code, issues, or agent output disagree with it, this file wins until someone changes it by PR.
> **v0.3.1:** `packages/catalog/src/schema.ts` and `packages/sim/src/events.ts` were reformatted by Biome 2.6 (whitespace and key quoting only); no contract shape changes.
> **v0.4:** Added the animation layer (§3.6, ADR-0006): every time-varying thing in the scene is a declarative Timeline played by one clock. No contract changes.
> **v0.5 (contract):** Added node kind `receiver` to `packages/catalog/src/schema.ts`, plus `N-RCV` (receiver aircraft) and `L-RCV` (tanker–receiver coordination datalink) to the catalog, for the baseline refuel mission (§5.6). Added the optional `steps` channel to the Timeline format and the Mission Steps panel (§3.6, §7).

---

## 1. What we're building

A browser-based **3D operational concept graphic (DoDAF 2.02 OV-1)** of a Boeing UAV mission. You can degrade, deny, or spoof each link and component, watch how the aircraft and its operators respond, and see the result **quantified as risk** with FAIR, so a cyber event becomes a dollar and mission-impact figure.

Three layers, strictly separated:

| Layer | Question it answers | Output |
|---|---|---|
| **Scene** (OV-1) | What does the operation look like, and what's connected to what? | 3D diorama: nodes, links, threat volumes |
| **Simulation** | When X is attacked under controls Y, what does the UAV actually do? | Deterministic, seeded event timeline: link states, nav error, lost-link behavior, mission outcome |
| **Risk** | How likely is a loss, how large is it, and is the fix worth paying for? | FAIR Monte Carlo: ALE, loss exceedance curves, control ROI |

**The core idea:** the sim isn't decoration. Run headless over many trials, it produces an empirical estimate of **Vulnerability** (P(threat event → loss event | controls)) for each scenario, and that estimate feeds the FAIR model directly. The animation and the numbers come from the same engine.

### Why this clears the "A-grade" bar
- The course requires ≥ 2 methodologies. We use **STRIDE + FAIR** as primary, with **STIX 2.1**, **attack trees**, **MITRE ATT&CK for ICS / EMB3D / SPARTA** mappings, and **NIST SP 800-30** framing as supporting work.
- It extends Milestone 1 directly: same asset table, same threat paths, same STRIDE mapping, and the proposed **~$4M/yr UAV security team** is modeled as a control so we can show its ROI quantitatively.
- The guidance says deliverables are open-ended. A live, reproducible tool beats a slide deck.

---

## 2. Scope

### In scope (v1, by 24 Nov)
- Stylized 3D OV-1 scene with all Milestone 1 key assets
- 6 scenario presets (§5) with per-link and per-threat toggles
- Control toggles that change sim behavior and FAIR inputs
- Truth vs. perceived state (ghost track) for spoofing and telemetry injection
- Headless Monte Carlo → Vuln estimates → FAIR → ALE and loss exceedance curves
- Before/after control comparison, plus ROSI for the proposed team
- Event log with replay, and a shareable scenario URL (config + seed)
- Written report and threat model docs generated from the same catalog

### Out of scope
- High-fidelity flight dynamics or 6-DOF aero (we use a kinematic point-mass model)
- Real RF propagation tools (we use free-space path loss + J/S only)
- Geospatial accuracy or real terrain. The OV-1 is a concept graphic, not a map.
- Any real Boeing internal, CUI, or export-controlled data (§10)

---

## 3. Tech stack

Pin exact versions at scaffold time (latest stable) and record them in `package.json` / `pyproject.toml`. Don't upgrade majors mid-project without an ADR.

### 3.1 Frontend / 3D
| Concern | Choice | Why |
|---|---|---|
| Build | **Vite** + **TypeScript (strict)** | Fast HMR, static output, deploys anywhere |
| UI framework | **React** | R3F ecosystem; agents are fluent in it |
| 3D | **three.js** via **React Three Fiber** + **@react-three/drei** | Declarative scene graph; drei gives cameras, lines, text, environment |
| Post-FX | **@react-three/postprocessing** (minimal) | Edge outlines and selection highlight only, to keep the flat OV-1 illustration look (§8) |
| Labels / callouts | drei `<Html>` + `<Text>` / `<Billboard>` | OV-1 callout boxes, link labels, legend |
| Mil symbology (optional) | **milsymbol** | MIL-STD-2525 frames on nodes (ADR-0005) |
| State | **zustand** | Small, works outside React (the sim bridge needs that) |
| Sim bridge | **Web Worker** + **comlink** | Sim runs off the main thread, so Monte Carlo doesn't drop frames |
| Charts | **Observable Plot** or **visx** (pick one in ADR-0004) | Loss exceedance curves, histograms, heat maps |
| Styling | CSS variables + **Tailwind v4** | OV-1 tokens in one file (§8): affiliation colors, link-type colors, state patterns |
| Dev tuning | **leva** (dev builds only) | Live-tweak sim and visual params; stripped from prod |
| Validation | **zod** | Runtime-validates catalog and scenario configs, infers TS types |

**Rejected:** CesiumJS. Real-globe accuracy is wrong for an OV-1, which is a stylized concept view, and it adds a lot of bundle weight and complexity. Babylon.js is capable, but the team and agent fluency is in R3F. Decision recorded in ADR-0001.

### 3.2 Simulation engine (`packages/sim`)
- Pure TypeScript, **zero DOM/three.js imports**. Runs identically in a browser worker and in Node (Vitest + CLI).
- **Fixed timestep** (default 20 Hz). The renderer interpolates between ticks (via the animation layer, §3.6).
- **Seeded PRNG**: xoshiro128\*\* seeded via splitmix32, in `packages/core/src/rng.ts` (frozen), with order-independent `fork(label)` so Monte Carlo trials can run in parallel workers. The same `(config, seed)` always gives the same timeline.
- **Append-only event log** (`{t, type, source, payload}`). Drives the UI timeline, replay, and repudiation discussion, and is the sim's only output contract.
- SI units internally. The render layer applies a visual scale transform, because the diorama compresses distances.

### 3.3 Risk engine (`packages/risk`)
- TypeScript FAIR Monte Carlo, runs in a worker so it's live in the app.
- Distributions: **Beta-PERT** (min / most-likely / max, γ = 4 default) and **lognormal** for heavy-tailed loss.
- Output: ALE distribution, percentiles (P10/P50/P90/P99), loss exceedance curve, per-scenario contribution.

### 3.4 Analysis / validation (`analysis/`, Python)
- **uv** for env management, **ruff**, **pytest**, **numpy/scipy/pandas**, **matplotlib** for report figures.
- **pyfair** (or a hand-rolled numpy reference) as an **independent cross-check** of the TS risk engine.
- **Golden vectors:** Python generates `fixtures/risk/*.json` (inputs, seed-independent summary stats). TS tests must match within tolerance. This catches agent-introduced math drift.
- Jupyter notebooks only for exploration. Anything in the report comes from scripts, not notebook state.

### 3.5 Tooling, CI, deploy
| Concern | Choice |
|---|---|
| Package manager | **pnpm** workspaces |
| Lint/format (TS) | **Biome** (one tool, fast) |
| Unit tests | **Vitest** (sim, risk, catalog schema) |
| E2E / visual smoke | **Playwright**: app loads, each preset runs, screenshot per preset |
| CI | **GitHub Actions**: lint → typecheck → test (TS + Python golden) → build |
| Hosting | **Cloudflare Pages**: static SPA, preview deploy per PR (link goes in the PR for reviewers) |
| Docs | Markdown in `docs/`; Mermaid for attack trees and data-flow diagrams (renders natively on GitHub) |

### 3.6 Animation layer (`apps/web/src/anim`)
Decision record: ADR-0006. Agent guide: `docs/animation/` (README → authoring → extending).

- **One format.** Everything that changes over time in the scene is a **Timeline**: plain data with actor motion segments (`hold`, `flyTo`, `orbit`, `path`, `samples`), link-state keys, threat keys, and text cues (captions, node status lines), in diorama units and seconds.
- **One interpreter.** `evaluate(timeline, t) → Frame` is a pure function, so play, pause, scrub, speed, loop, and replay are exact. Heading, bank, and pitch are derived from motion, never authored.
- **One clock.** A single framework-free playback controller (`playback`) owns time. Scene components read the current frame inside `useFrame` and write to refs. DOM panels read a throttled snapshot (`usePlayback`).
- **Two producers, one renderer.** Hand-authored timelines (`anim/timelines/`) cover idle/ambient motion, presentation choreography, and labeled **storyboards** until the sim exists. Sim runs are converted with `timelineFromSim()` (event log + snapshots, mapped SI → diorama in `apps/web`). Per §1, *behavior under attack* comes from the sim once `sim-runner` lands. Storyboards must be labeled `(storyboard)` until then.
- **Mission steps.** A Timeline may carry `steps`: a written procedure (number, title, description, parameters to watch) keyed to playback time. The Mission Steps panel highlights the active step and seeks the shared clock when a step is clicked. Steps narrate; they never move anything.
- **One wiring point.** Timelines are registered in `anim/timelines/registry.ts` (idle, baseline missions, per-scenario keyed by catalog scenario ID, dev-only references). CI validates every registered timeline against the catalog.
- **Default view:** the idle timeline, with the UAV in a holding orbit, "LOITER · AWAITING TASKING". Playback starts paused under `prefers-reduced-motion`.
- The Timeline format is local to `apps/web`, **not** a frozen contract. Changes stay backward compatible (new fields optional) and update `docs/animation/`.

---

## 4. Repo layout

```
contested-ov1/
├── SPEC.md                    ← this file (source of truth)
├── AGENTS.md                  ← the ONE agent rules file (§9)
├── CLAUDE.md                  ← "@AGENTS.md" (pointer)
├── CONTRIBUTING.md            ← human workflow, labels, repo settings
├── README.md                  ← quickstart, first-time setup, what every file does
├── apps/
│   └── web/                   ← Vite + R3F app
│       ├── e2e/               ← Playwright smoke tests
│       └── src/
│           ├── anim/          ← animation layer (§3.6): Timeline format, interpreter, playback clock, timelines/
│           ├── scene/         ← OV-1 layout, platforms, links, threat volumes, camera rigs
│           ├── panels/        ← scenario, controls, telemetry, event log, risk drawer
│           ├── components/    ← banner, title block, legend, panel chrome
│           ├── bridge/        ← comlink worker wrappers for sim + risk
│           └── theme/         ← tokens.css (only place colors/fonts live) + tokens.ts reader
├── packages/
│   ├── core/                  ← seeded PRNG (frozen), units. No DOM.
│   ├── catalog/               ← THE contract: assets, links, threats, controls, adversaries, scenarios
│   │   ├── data/*.json        ← data rows (editing data ≠ contract change)
│   │   ├── stix/              ← STIX 2.1 bundle
│   │   └── src/schema.ts      ← zod schemas + referential integrity (frozen)
│   ├── sim/                   ← deterministic engine; src/events.ts is frozen. No DOM.
│   └── risk/                  ← FAIR Monte Carlo engine. No DOM.
├── analysis/                  ← Python (uv): independent cross-checks, golden vectors, figures
├── fixtures/                  ← generated golden vectors
├── scripts/                   ← CI guards (determinism, contract) + task seeding
├── tasks/backlog.yaml         ← seed for GitHub Issues (Issues are the live to-do list)
├── docs/
│   ├── adr/                   ← architecture decision records
│   ├── animation/             ← how to animate the OV-1 (§3.6): architecture, authoring, extending
│   ├── threat-model/          ← STRIDE tables, attack trees, DFDs (generated from catalog)
│   ├── fair/                  ← source + rationale for every estimate
│   ├── design/ov1-refs/       ← public OV-1 visual reference set
│   └── report/                ← final written deliverable + presentation plan
├── .github/                   ← CI, CODEOWNERS, issue/PR templates, copilot pointer
├── .claude/settings.json      ← shared Claude Code permissions
├── .cursor/rules/             ← Cursor pointer to AGENTS.md
└── .devcontainer/             ← identical env for humans + cloud agents
```

**Rule:** `packages/catalog` is the single source of truth for every asset, link, threat, and control ID. The sim, risk engine, UI, and docs all import from it. Nobody hardcodes a threat name in a component.

---

## 5. Domain model

### 5.1 OV-1 nodes (from Milestone 1 key assets)
| ID | Node | Notes |
|---|---|---|
| `N-UAV` | UAV airframe (generic MQ-25-class, carrier-based) | Onboard: flight computer, autonomy, GNSS rx, INS, crypto module, black box |
| `N-GCS` | Ground / ship control station | Operator console, mission planning |
| `N-C2` | C2 servers + mission data store | Shore-side ops center |
| `N-SAT` | SATCOM relay | BLOS C2 path |
| `N-GNSS` | GNSS constellation | Positioning source |
| `N-SUP` | Software / firmware supply chain | Build → sign → deliver → deploy pipeline |
| `N-MX` | Maintenance terminal | Credentialed access to the aircraft and GCS |
| `N-RCV` | Receiver aircraft (notional combat UAV), kind `receiver` | Refuels from `N-UAV` in the baseline mission (§5.6) |
| `N-ADV-*` | Adversary emitters | Jammer (ground/airborne), GNSS spoofer, cyber operator |

**Asset licensing:** use CC0 / CC-BY models or procedural geometry only, and keep attribution in `apps/web/public/models/CREDITS.md`. No ripped or branded Boeing models.

### 5.2 Links
| ID | Link | States |
|---|---|---|
| `L-LOS` | LOS C2 datalink (GCS ↔ UAV) | `nominal · degraded · denied · spoofed` |
| `L-BLOS` | SATCOM C2 (C2 ↔ SAT ↔ UAV) | same |
| `L-GNSS` | GNSS downlink (SAT ↔ UAV) | `nominal · degraded · denied · spoofed` |
| `L-TLM` | Telemetry downlink (UAV → GCS/C2) | `nominal · degraded · denied · injected` |
| `L-UPD` | Firmware/software update path (SUP → MX → UAV) | `trusted · compromised` |
| `L-GCS-C2` | Terrestrial network (GCS ↔ C2) | `nominal · denied (ransomware)` |
| `L-RCV` | Tanker–receiver coordination datalink (UAV ↔ RCV) | `nominal · degraded · denied · spoofed` |

### 5.3 Scenario presets (from Milestone 1 threat table)
| ID | Scenario | STRIDE | Candidate external mapping *(verify before citing)* |
|---|---|---|---|
| `S1` | Jamming of LOS + BLOS C2 → lost-link | D | ATT&CK for ICS T0814 (Denial of Service); SPARTA for SATCOM |
| `S2` | GNSS spoofing → nav drift / route deviation | S, T | ATT&CK for ICS T0856 (Spoof Reporting Message) |
| `S3` | False telemetry injection at GCS (data poisoning) | S, T | ATT&CK for ICS T0832 (Manipulation of View) |
| `S4` | Malware in flight control software via compromised signed update | T, E | ATT&CK for ICS T0862 (Supply Chain Compromise), T0839 (Module Firmware); MITRE EMB3D |
| `S5` | Stolen maintenance credential | S, E, I | ATT&CK for ICS T0859 (Valid Accounts) |
| `S6` | Ransomware on GCS / C2 servers | D, R | ATT&CK Enterprise impact techniques |

Scenarios can be combined, e.g. S1 + S2 together is the realistic EW package.

### 5.4 Controls (toggleable)
Each control has an ID, a cost estimate (annual $), and declared effects on **sim parameters** and/or **FAIR factors**.

Initial set: frequency hopping / anti-jam waveform · nulling antenna · multi-constellation GNSS + spoof detection · INS fallback / dead reckoning · independent sensor cross-check (the Milestone 1 "variability limits") · link encryption + authentication · secure boot + signed firmware with independent verification · just-in-time / short-lived maintenance privileges · GCS network segmentation + immutable backups · **dedicated UAV security team (~$4M/yr, the Milestone 1 proposal)**, modeled as a bundle that improves detection and response.

Lost-link procedure is a **config**, not a control: `RTB · loiter-then-RTB · continue-mission · land-immediate`. Comparing procedures under S1 is a headline result.

### 5.5 Adversary profiles (STIX 2.1)
Notional actors modeled on public reporting, stored as a STIX 2.1 bundle (`threat-actor`, `intrusion-set`, `attack-pattern`, `course-of-action`, `relationship`). Each profile carries FAIR inputs: **Threat Event Frequency** and **Threat Capability** ranges.
- `ADV-1` Nation-state EW unit (S1, S2)
- `ADV-2` Nation-state cyber operator / APT (S3, S4, S5)
- `ADV-3` Criminal ransomware affiliate (S6; LockBit 2023 incident as the reference case)

---

### 5.6 Baseline mission: refuel op
The mission the scenarios attack: an MQ-25-class tanker (`N-UAV`) launches from the carrier, transits to a tanker anchor in contested airspace, identifies and joins with a receiver (`N-RCV`), transfers fuel, separates, and recovers to the carrier. The 18-step procedure and the parameter/tolerance table come from the team's mission analysis. It plays as the `refuel-op` timeline (`apps/web/src/anim/timelines/refuel-op.ts`), hand-authored and labeled `(storyboard)` until the sim drives it. Each step's "watch" list is the parameter table's "Effected Activities" column.

---

## 6. Models (math)

### 6.1 Link model (`packages/sim`)
Free-space path loss, with $d$ in meters and $f$ in Hz:

$$
\mathrm{FSPL}_{\mathrm{dB}} = 20\log_{10}(d) + 20\log_{10}(f) - 147.55
$$

Jam-to-signal ratio at the UAV receiver (all terms in dB / dBW / dBi):

$$
\frac{J}{S} = (P_J + G_{J\to R} + G_{R\to J}) - (P_S + G_{S\to R} + G_{R\to S}) + 20\log_{10}\!\left(\frac{d_S}{d_J}\right)
$$

Link state comes from margin thresholds: $\frac{J}{S} < \theta_{\text{deg}} \Rightarrow$ nominal, $\theta_{\text{deg}} \le \frac{J}{S} < \theta_{\text{deny}} \Rightarrow$ degraded, otherwise denied. Anti-jam controls add processing gain $G_p$ to the signal side.

### 6.2 Navigation model
True position $\mathbf{x}(t)$ vs. perceived $\hat{\mathbf{x}}(t)$. Under GNSS denial the INS error grows; we use a tunable placeholder:

$$
\lVert \hat{\mathbf{x}}(t) - \mathbf{x}(t) \rVert \approx e_0 + k\,(t - t_{\text{loss}})^2
$$

Under spoofing, $\hat{\mathbf{x}}$ is pulled by an adversary-chosen offset vector at a capped drift rate, staying below the detector threshold unless cross-check controls are on. This divergence is what the ghost track renders.

### 6.3 Sim → FAIR bridge
For scenario $s$ under control set $C$, run $N$ seeded trials and define a loss event as the scenario's failure condition (airframe loss, mission abort, data exfil, etc.):

$$
\widehat{\mathrm{Vuln}}_{s,C} = \frac{1}{N}\sum_{i=1}^{N} \mathbb{1}[\text{loss event in trial } i]
$$

Report a confidence interval. Wilson score is fine; at $N = 1000$ it's tight enough.

### 6.4 FAIR model (`packages/risk`)

$$
\mathrm{LEF}_s = \mathrm{TEF}_s \times \widehat{\mathrm{Vuln}}_{s,C}
\qquad
\mathrm{LM}_s = \mathrm{PL}_s + \mathrm{SLEF}_s \times \mathrm{SLM}_s
$$

$$
\mathrm{ALE} = \sum_{s} \mathbb{E}\!\left[\mathrm{LEF}_s \times \mathrm{LM}_s\right]
$$

| Factor | Defense-context forms |
|---|---|
| Primary: Replacement | Airframe loss (CRS ~$209M/unit MQ-25A, from Milestone 1), payload, GCS hardware |
| Primary: Response | IR, forensics, DFARS 72-hour reporting, fleet grounding / re-cert |
| Primary: Productivity | Mission days lost, sortie cancellations |
| Secondary: Fines & judgments | Contract penalties, breach-of-contract claims |
| Secondary: Competitive advantage | Lost or delayed future awards, recompete risk |
| Secondary: Reputation | Public/congressional trust, share price (cite the Commercial segment precedent) |

**Strategic / geopolitical impact** doesn't monetize honestly, so we track it on a separate **ordinal Mission Impact scale (1–5)** and plot it alongside dollars instead of inventing a number. Call this out in the report as a known limitation of FAIR in defense contexts.

Every estimate (min / ML / max) needs a source or a written rationale in `docs/fair/`. No unsourced numbers.

### 6.5 Control economics

$$
\mathrm{ROSI} = \frac{\mathrm{ALE}_{\text{before}} - \mathrm{ALE}_{\text{after}} - C_{\text{control}}}{C_{\text{control}}}
$$

The headline chart overlays the loss exceedance curves with and without the proposed $4M/yr team and shows the ROSI distribution, not just a point estimate.

---

## 7. App UX (v1)

- **Viewport:** OV-1 diorama in briefing-graphic style (§8). The default camera is the classic **OV-1 three-quarter "slide" view**. Orbit is allowed, plus presets (overview, UAV chase, GCS view) and a one-click "reset to slide" for the presentation. Links are lightning-bolt lines encoded by type and state; threats are red translucent volumes. Click a node to open its callout.
- **Left panel, Scenario:** preset picker (clicking a scenario plays its timeline; clicking again returns to idle), adversary profile, seed, and playback: timeline picker, play / pause / restart, scrub, speed, `T+mm:ss.s` clock (§3.6).
- **Right panel, Mission Steps:** the written procedure for the playing timeline (e.g. the 18-step refuel op). The active step is highlighted with its description and the parameters to watch; Prev / Next and clicking a step seek the playback clock.
- **Right panel, Controls:** link matrix (force any link state), threat toggles with intensity sliders, control toggles with cost, lost-link procedure.
- **Bottom, Telemetry + Event log:** truth vs. perceived readouts side by side (position error, link margin, mode), plus a timestamped event stream. Clicking an event seeks to it.
- **Risk drawer:** run Monte Carlo for the current config, then show Vuln with CI, ALE percentiles, the loss exceedance curve, and a before/after comparison.
- **Share:** the full config + seed serialized to the URL hash, so the presentation can deep-link to exact runs.

---

## 8. Design language: OV-1 briefing graphic

The app should read as a **DoDAF OV-1 that came to life**: the familiar briefing-chart concept drawing, now 3D and interactive. When in doubt, ask "would this look at home on an OV-1 slide?" Not a game, not a sci-fi HUD, not photoreal.

### 8.1 Scene
- **Illustrative, not photoreal.** Flat or lightly shaded low-poly platforms, clean silhouettes, dark outline edges (drei `<Edges>` / `<Outlines>`). They should read like the clip-art platform icons on a real OV-1.
- **Backdrop:** light sky gradient over a simple stylized surface (ocean for the carrier, terrain band for shore and C2). An optional curved-earth horizon sells the BLOS / SATCOM geometry.
- **Exaggerated scale and spacing**, like a real OV-1: platforms oversized, distances compressed, with satellites just above the frame.
- **Lighting:** a soft key light and hemisphere fill. Little or no bloom. Post-FX is limited to edge outlines and selection highlight.

### 8.2 Links
- RF links use the classic **zig-zag "lightning bolt"** or arcing line. Wired / terrestrial links use straight solid lines. Every link gets a **text label** at its midpoint (e.g. "LOS C2", "SATCOM C2", "GNSS", "TLM", "SW UPDATE").
- **Color = link type** (a fixed, distinct color per `L-*` ID, never red). **Line pattern = state:**
  - `nominal`: solid, with animated directional dashes showing flow
  - `degraded`: sparse dashes, reduced opacity
  - `denied`: broken line with a red ✕ glyph at the break
  - `spoofed / injected / compromised`: line turns **hostile red** with a ⚠ glyph, and a red dashed false path appears (the ghost track)

### 8.3 Affiliation colors (MIL-STD-2525 convention)
| Affiliation | Color | Used for |
|---|---|---|
| Friendly | blue / cyan | UAV, GCS, C2, SAT, friendly networks |
| Hostile | red | Jammers, spoofers, cyber operator, threat volumes, all adversary effects |
| Neutral | green | Civilian / third-party infrastructure (GNSS constellation, commercial cloud) |
| Unknown | yellow | Unattributed anomalies (e.g. a suspect firmware build before vetting) |

- Threat volumes (jamming footprint, spoofing radius) are translucent red domes or cones with a labeled edge.
- **Optional:** MIL-STD-2525 frame symbols floating above each node via **milsymbol** (JS library), next to the plain-English label. Decide in ADR-0005.

### 8.4 Annotation chrome (the parts that make it an OV-1)
- **Callout boxes** with leader lines to nodes (drei `<Html>`): short title plus 1–2 lines, e.g. "MQ-25-class UAV · lost-link: RTB".
- A **legend box** in the corner that lists link types, line patterns, and affiliation colors. It updates live as scenarios add threats.
- A **title block** with the operation name, scenario ID, and seed.
- A **classification-style banner** at top and bottom reading `UNCLASSIFIED // NOTIONAL — ACADEMIC USE`, green, in the standard banner position. This signals the open-source-only rule (§10) and completes the look.

### 8.5 Panels & typography
- Panels look like **briefing-slide elements**: white or very light gray, thin dark borders, square corners, small bold section headers. They are not dark-mode dashboards.
- Type: **Arimo** (open-licensed, metric-compatible with Arial, the de facto OV-1 font). Use a monospace (JetBrains Mono) **only** for numeric telemetry and the event log.
- Charts in the risk drawer follow the same palette: friendly-blue "with controls" vs. hostile-red "baseline" on the loss exceedance curve.
- All tokens (affiliation colors, link-type colors, state patterns, type scale) live in `apps/web/src/theme/tokens.css` and `packages/catalog` link metadata, so scene, legend, and charts can't disagree.

*Team can override. Change this section by PR if so.*

---

## 9. Working with agents

The group plus coding agents share one repo, so rules matter more than usual.

1. **Contracts first.** Three files are frozen: `packages/catalog/src/schema.ts`, `packages/sim/src/events.ts`, `packages/core/src/rng.ts`. Changing one needs a `contract`-labeled issue and a PR that also touches SPEC.md (enforced by `contract-guard`), plus code-owner approval.
2. **One issue = one agent task.** GitHub Issues are the shared to-do list, seeded from `tasks/backlog.yaml`. Use the Task issue template: goal, files in scope, acceptance criteria, tests required, out-of-scope list. Claim by assigning yourself and adding `in-progress`.
3. **Branch per task** (`agent/<issue#>-slug`), PR into `main`, **one human approval required**, CI green, Cloudflare preview link in the PR.
4. **Sim and risk code must ship with tests.** Visual and scene code can be vibecoded, but it never touches sim or risk logic.
5. **No new dependencies** without a line in the PR explaining why.
6. **Determinism is non-negotiable.** No `Math.random()` or `Date.now()` inside `packages/sim` or `packages/risk`. Enforce with a lint rule.
7. **Animation goes through the animation layer (§3.6).** Nothing in the scene animates itself with its own timer. A scenario animation is one timeline file plus one registry line, following `docs/animation/authoring.md`. Hand-written behavior under attack is labeled `(storyboard)` until the sim drives it.
8. `AGENTS.md` mirrors these rules in a form agents load automatically. Keep it in sync with this section.

---

## 10. Data handling & ethics

- **Open-source information only.** All parameters are notional or drawn from public sources (CRS, GAO, NIST, SEC filings, Boeing public pages, SP5 supplement). Cite them in `docs/fair/`.
- **No CUI, no ITAR/EAR technical data, no employer data.** If anyone has real program knowledge, it stays out of the repo.
- Keep the repo **private until the final presentation**, then decide as a group whether to make it public.
- Adversary profiles are notional composites. Don't attribute specific operations to named real-world actors beyond what's publicly reported.

---

## 11. Milestones

Dates assume the 24 Nov due date. Adjust once presentation slots are posted.

| Week of | Milestone | Exit criteria |
|---|---|---|
| **Nov 2** | **M0, Foundations** | Repo scaffolded, CI green, catalog schema + all S1–S6 entries, static OV-1 scene with every node and link, ADR-0001 through 0005, OV-1 reference set collected |
| **Nov 9** | **M1, Living OV-1** | Sim engine with link + nav models, presets S1–S3 animate end to end, link toggles and lost-link procedures work, event log + replay |
| **Nov 16** | **M2, Quantified** | S4–S6 in, headless Monte Carlo → Vuln, FAIR engine passing Python golden tests, risk drawer with LEC + ROSI, controls wired |
| **Nov 23** | **M3, Ship** | Visual polish, URL deep-links for the demo, report in `docs/report/`, presentation deck + recorded backup demo, every member's speaking section mapped to a part of the app |

---

## 12. Open decisions

- [ ] Final project name
- [ ] Chart lib: Observable Plot vs. visx (ADR-0004)
- [ ] MIL-STD-2525 symbols on nodes (milsymbol) or plain labels only (ADR-0005)
- [ ] Collect 3–5 public OV-1 examples into `docs/design/ov1-refs/` as the visual reference set (sources cited)
- [ ] Ownership split across Scene / Sim / Risk + Docs (one owner each, three of us)
- [ ] Whether the Mission Impact scale feeds the risk heat map or stays a separate axis
- [ ] Repo visibility after the presentation
- [ ] Monte Carlo trial counts (sim $N$, FAIR iterations) vs. in-browser runtime budget

---

## 13. References

Carried over from Milestone 1. Add new sources here with what they back.

- DoD CIO, *DoDAF v2.02*: OV-1 definition
- NIST (2024), *Cybersecurity and AI Risk Management for Uncrewed Systems*
- GAO-19-128, *Weapon Systems Cybersecurity*
- Congressional Research Service: MQ-25A unit cost
- Boeing 2025 Annual Report & Form 10-K; 2023 Form 10-K (LockBit incident)
- Boeing SP5 *Terms of Use and Cybersecurity Supplement* (Aug 2025)
- The Open Group, *Open FAIR (O-RT / O-RA)*
- OASIS, *STIX 2.1*
- MITRE ATT&CK for ICS · MITRE EMB3D · Aerospace Corp. SPARTA
- NIST SP 800-30 Rev. 1, *Guide for Conducting Risk Assessments*
