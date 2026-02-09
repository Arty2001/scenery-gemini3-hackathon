# DevPost Submission - Scenery

**DEADLINE: February 9, 2026 at 5:00 PM PT**

---

## Project Name (60 char max)

```
Scenery - AI Video Generation from GitHub Repos
```

---

## Elevator Pitch (200 char max)

```
Point Scenery at any GitHub repo. It discovers your React components, renders them in a real browser, and generates professional demo videos with a 4-agent Gemini system that self-corrects to 90+ quality.
```

---

## Built With

```
Gemini 3 Pro, Gemini 2.0 Flash, Gemini 2.5 Flash TTS, Next.js 15, React 19, TypeScript, Remotion, Playwright, esbuild, Supabase, AWS Lambda, Fly.io, Zustand, Zod, Tailwind CSS
```

---

## Required Links

| Field | Value |
|-------|-------|
| **Live Demo** | https://scenery-gemini3.fly.dev |
| **Source Code** | https://github.com/Arty2001/scenery-gemini3-hackathon |
| **Demo Video** | **[UPLOAD TO YOUTUBE BEFORE 5PM PT]** |

---

## Full Description (Copy to DevPost)

## What it does

Scenery is an AI-powered video generation platform for React component libraries. You sign in with GitHub, connect a repo, and Scenery:

1. **Clones and analyzes** your codebase to discover React components
2. **Renders live previews** in a real browser (Playwright) with 4-attempt recovery
3. **Generates professional product videos** using a 4-agent Gemini orchestration system
4. **Auto-updates videos** when your code changes (videos are code-connected)

**The core problem it solves:** Product videos go stale the moment you ship an update. Traditional video editing means re-recording and re-exporting every time your UI changes. Scenery keeps videos synchronized with your actual components.

---

## 8 Gemini Integrations

Every integration uses structured output with JSON schemas—no prompt-and-pray.

| # | Integration | Model | Purpose |
|---|-------------|-------|---------|
| 1 | Component Categorization | Gemini 3 Pro | Classifies components into 27 UI categories |
| 2 | Demo Props Generation | Gemini 3 Pro | Generates realistic props from TypeScript interfaces |
| 3 | Server→Client Transform | Gemini 3 Pro | Converts async Server Components to client-safe code |
| 4 | Tailwind→Inline CSS | Gemini 2.0 Flash | Converts Tailwind classes to inline styles |
| 5 | AI Preview Fallback | Gemini 3 Pro | Generates HTML when bundling fails (5000 thinking tokens) |
| 6 | Director Agent | Gemini 3 Pro | Plans video narrative with function calling |
| 7 | Scene Planner Agent | Gemini 3 Pro | Designs positions, animations, timing (parallel) |
| 8 | Refinement Agent | Gemini 3 Pro | Scores quality 0-100, iterates until ≥90 |
| 9 | TTS Voiceover | Gemini 2.5 Flash TTS | Generates audio with 5 voice options |

---

## Features

### GitHub Integration
- Sign in with GitHub OAuth
- Paste any public GitHub repo URL
- Auto-clones and parses TypeScript/JSX components
- Extracts props, types, and interactive elements
- Supports Next.js 13/14/15 with App Router
- Sync button to pull latest changes

### Component Discovery Pipeline
1. **Scanner** — Globs `.tsx/.jsx` files, ignores node_modules/tests/builds
2. **Parser** — react-docgen-typescript extracts props (regex fallback for async components)
3. **Analyzer** — Gemini categorizes into 27 UI categories with video showcase strategy
4. **Preview** — 3-tier rendering: Playwright (95%) → SSR (70%) → AI fallback (50%)

### Server Component Detection (263 regex patterns)

Detects and transforms Next.js Server Components across 15 categories:

| Category | Examples | Count |
|----------|----------|-------|
| Async | `export default async function`, `await` | 4 |
| Database ORMs | Prisma, Drizzle, Mongoose, Supabase, pg, mysql2 | 21 |
| Auth Libraries | next-auth, @clerk/nextjs/server, lucia | 8 |
| Node.js Built-ins | fs, path, crypto, child_process | 12 |
| Next.js Server | next/headers, cookies(), redirect() | 10 |
| File System | readFileSync, writeFile | 6 |
| And 9 more... | Email, payment, CMS, analytics, tRPC | ~200 |

When detected → Gemini transforms to client-safe code with mock data.

### Video Editor

**Track Types:** Text, Component, Video, Audio, Image, Cursor, Shape, Particles, Gradient, Film Grain, Vignette, Color Grade, Blob

**30+ Animation Presets:**
- Entrance: fade-in, slide-in-*, zoom-in, bounce, elastic, spring-pop, blur-in, flip-in, rotate-in
- Exit: fade-out, zoom-out, blur-out, slide-out-*
- Emphasis: pulse, shake, wiggle, heartbeat, jello, glow
- Motion: float, drift-right, ken-burns-zoom
- Filter: color-pop, flash, hue-shift, cinematic-focus

**Spring Physics (5 presets):**
| Preset | Damping | Stiffness | Mass | Use Case |
|--------|---------|-----------|------|----------|
| smooth | 200 | 100 | 1 | Professional |
| snappy | 200 | 200 | 0.5 | Quick, responsive |
| heavy | 200 | 80 | 5 | Slow, dramatic |
| bouncy | 100 | 150 | 1 | Playful |
| gentle | 300 | 60 | 2 | Soft, subtle |

**6 Particle Effects:** confetti, sparks, snow, bubbles, stars, dust

**6 Cursor Interactions:** click, hover, type, focus, select, check

**Text Effects:** Letter-by-letter animation, gradient fill, glow, glass backgrounds

**Device Frames:** phone, laptop, full display modes

### Voiceover
- Gemini 2.5 Flash TTS with `responseModalities: ['AUDIO']`
- 5 prebuilt voices: Kore, Charon, Fenrir, Aoede, Puck
- 24kHz WAV output synced to timeline

### Export
- Remotion Lambda (AWS) for serverless rendering
- MP4, GIF, WebM output formats
- Parallelized rendering (60s video → ~30s render)

---

## How we built it

### 4-Agent Gemini Orchestration System

```
User: "Create a product video for our auth components"
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  DIRECTOR AGENT (Gemini 3 Pro)                       │
│  Tool: create_video_plan                             │
│  • Plans narrative arc (Hook→Setup→Showcase→CTA)    │
│  • Frame budget: 15% hook, 15% setup,               │
│    55% showcase, 15% CTA                            │
│  • Outputs INTENTS ("dramatic", "professional")     │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  SCENE PLANNER AGENT (parallel per scene)            │
│  Tool: create_detailed_scene                         │
│  • Translates intents → spring animations            │
│  • Element positions (0-1 normalized)               │
│  • Keyframes (RELATIVE to element start)            │
│  • Cursor paths for tutorials                        │
│  • Narration scripts                                 │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  ASSEMBLY AGENT (deterministic, no LLM)              │
│  • Fixes keyframe timing mistakes (rescales >90)    │
│  • Normalizes keyframe format                        │
│  • Organizes tracks by z-order                       │
│  • Validates composition                             │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  REFINEMENT AGENT (Gemini 3 Pro)                     │
│  Tool: analyze_composition                           │
│                                                      │
│  Scoring Weights (0-100):                           │
│  • Visual Composition: 30%                          │
│  • Timing: 25%                                      │
│  • Narrative Flow: 25%                              │
│  • Animation Quality: 15%                           │
│  • Accessibility: 5%                                │
│                                                      │
│  Score < 40 → Regenerate from Director              │
│  Score 40-89 → Apply fixes, re-evaluate             │
│  Score ≥ 90 → Ship it                               │
│                                                      │
│  Max iterations: 5 (picks best version)             │
└─────────────────────────────────────────────────────┘
```

### Component Preview Pipeline (3-tier fallback with 4-attempt recovery)

```
TIER 1: Playwright Browser (95% accuracy)
  • Transform to pure React (Gemini removes external deps)
  • Bundle with esbuild (50+ library mocks)
  • Render in real Chromium on Fly.io worker
  • 4-attempt recovery with progressive simplification:
    - Attempt 1: fix-props (add missing definitions)
    - Attempt 2: simplify (flat structures, empty arrays)
    - Attempt 3: minimal (aggressive mocking)
    - Attempt 4: placeholder div
    - Attempt 5+: skip component
        │
        │ Fails?
        ▼
TIER 2: Server-Side Rendering (70% accuracy)
  • renderToStaticMarkup via esbuild
  • 5-second timeout
        │
        │ Fails?
        ▼
TIER 3: AI-Only Generation (50% accuracy)
  • Gemini generates HTML from source code
  • thinkingBudget: 5000 tokens for reasoning
```

### Tech Stack
- **Frontend:** Next.js 15, React 19, TypeScript
- **AI:** Gemini 3 Pro (agents), Gemini 2.0 Flash (quick ops), Gemini 2.5 Flash TTS
- **Video:** Remotion 4 + AWS Lambda
- **Component Rendering:** Playwright worker on Fly.io (separate app)
- **Bundling:** esbuild with 50+ virtual module mocks
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth with GitHub OAuth
- **Hosting:** Fly.io (2 apps: main + Playwright worker, auto-scale)
- **State:** Zustand + Zundo (undo/redo)
- **Validation:** Zod schemas for all AI outputs

---

## Gemini Features Used

| Feature | Implementation |
|---------|----------------|
| **Structured Output** | JSON schemas with Zod validation on ALL 8 integrations |
| **Function Calling** | `create_video_plan`, `create_detailed_scene`, `analyze_composition` |
| **Thinking Mode** | Preview generation fallback (5000 token budget) |
| **TTS** | `responseModalities: ['AUDIO']` with 5 voice options |
| **Streaming** | Real-time chat responses via Server-Sent Events |
| **Long Context** | Full source code analysis (900s timeout) |
| **Gemini 3 Pro** | All 4 agents, Server→Client transformation, categorization |
| **Gemini 2.0 Flash** | Tailwind→CSS conversion (speed optimized) |
| **Gemini 2.5 Flash TTS** | Voiceover generation |

---

## Challenges we ran into

**Server Component Detection:** Next.js 13+ Server Components crash in browsers. We built detection with **263 regex patterns** across 15 categories (Prisma, Drizzle, NextAuth, Clerk, Node builtins, etc.), then use Gemini to transform to client-safe code with mock data.

**Multi-Agent Coordination:** Director outputs *intents* ("dramatic entrance"), Scene Planner translates to *specifics* (spring configs, exact keyframes). Assembly is pure TypeScript to prevent AI error cascades.

**Relative vs Absolute Keyframes:** AI kept outputting absolute frames (frame 300 for a fade-in = 10 seconds!). We enforce relative keyframes where frame 0 = when THIS element appears, not video start. Assembly agent auto-fixes violations.

**Self-Correction Without Infinite Loops:** Weighted scoring with hard thresholds. Score < 40 = regenerate from scratch. Score 40-89 = patch. Score ≥90 = ship. Max 5 iterations, then pick the best version seen.

**Preview Verification:** Playwright sometimes captures loading states or skeletons. Gemini verifies if the HTML actually represents the component. If invalid, falls back to AI-only generation.

**Rate Limits:** Added fail-fast detection for 429/quota errors—no retries on rate limits, clear user messaging.

---

## Accomplishments we're proud of

- **8 distinct Gemini integrations** with structured output and function calling
- **4-agent orchestration** with self-correcting refinement loop (score ≥90 to ship)
- **263 Server Component patterns** making Scenery work with any Next.js codebase
- **3-tier preview system** with 4-attempt progressive recovery per component
- **30+ animation presets** with 5 spring physics configurations
- **Code-connected videos** that auto-update when repos change

---

## What we learned

**Structured output > free-form prompts.** JSON schemas with Zod validation = 100% parse success rate.

**Function calling > prompts for agents.** Explicit tools (`create_video_plan`) enforce exact output shapes.

**Intents > specifics for planning.** Director says "dramatic", Scene Planner decides "spring-bounce with bouncy preset".

**Deterministic steps prevent cascades.** Assembly Agent uses zero LLM—just TypeScript transforms and validation.

**Verification catches bad renders.** AI checking AI output catches loading states, empty renders, skeletons.

**Fail fast on rate limits.** Detect 429/quota errors immediately, don't waste retries.

---

## What's next for Scenery

- Vue/Svelte support (parser abstraction)
- Template marketplace (pre-built video styles)
- CI/CD integration for auto-generated videos on deploy
- Collaborative editing (multiplayer timeline)
- Version history for compositions

---

## Third-Party Integrations

| Library | License | Purpose |
|---------|---------|---------|
| Remotion | MIT | React video framework |
| Playwright | Apache 2.0 | Browser automation for component rendering |
| esbuild | MIT | Fast component bundling |
| Supabase | Apache 2.0 | Database, auth, and storage |
| AWS Lambda | — | Serverless video export |
| react-docgen-typescript | MIT | TypeScript prop extraction |
| Zustand | MIT | State management |
| Zod | MIT | Schema validation |

---

**For architecture diagrams, code examples, and full technical details: [GitHub README](https://github.com/Arty2001/scenery-gemini3-hackathon)**

---

## Tags

- Gemini
- AI/Machine Learning
- Developer Tools
- React
- Video
- Automation
- Multi-Agent Systems

---

## Submission Checklist

- [ ] Create DevPost account at run.devpost.com
- [ ] Upload demo video (max 3 min) to YouTube (unlisted OK)
- [ ] Fill out all required DevPost fields:
  - [ ] Project name
  - [ ] Elevator pitch
  - [ ] Built with
  - [ ] Full description (copy markdown above)
  - [ ] Demo link
  - [ ] GitHub repo link
  - [ ] Video link
- [ ] Attach README.pdf for judges
- [ ] Submit BEFORE 5:00 PM PT today
