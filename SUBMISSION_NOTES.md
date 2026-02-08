# Scenery — Gemini 3 Hackathon Submission

## Gemini Integration Description

Scenery is an AI-powered video generation platform that transforms React component libraries into professional marketing videos. At its core, Scenery leverages **Gemini 3's structured output capabilities** across a multi-agent pipeline:

1. **Long Context for Component Analysis** — Gemini 3's extended context window allows us to analyze entire component source files (10,000+ tokens) alongside their dependencies, enabling accurate categorization, demo prop generation, and interactive element detection in a single pass.

2. **Native JSON Mode with Schema Validation** — All structured outputs use Gemini's `responseMimeType: "application/json"` with explicit `responseSchema` definitions, achieving near-zero malformed output rates compared to prompt-based JSON extraction.

3. **Multi-Agent Orchestration** — Four specialized agents (Director, Scene Planner, Refinement, Assembly) use Gemini's function calling for reliable tool execution. Each agent has a focused role, enabling iterative quality improvement through the Refinement Agent's scoring and fix system.

4. **Thinking Mode for Complex Reasoning** — Preview HTML generation uses Gemini's thinking budget feature for multi-step reasoning when converting React/Tailwind components to inline-styled HTML.

The result: developers can generate polished, 30-second product demo videos from their component libraries in under 60 seconds.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER INPUT                                         │
│  "Create a 30-second demo showcasing our LoginForm and Dashboard components" │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COMPONENT DISCOVERY                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Scanner   │→ │   Parser    │→ │  Analyzer   │→ │  Preview Generator  │ │
│  │ (find .tsx) │  │ (extract    │  │ (Gemini 3)  │  │ (Playwright + SSR)  │ │
│  │             │  │  props)     │  │ categorize  │  │                     │ │
│  └─────────────┘  └─────────────┘  │ demo props  │  └─────────────────────┘ │
│                                    │ interactive │                           │
│                                    │ elements    │                           │
│                                    └─────────────┘                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MULTI-AGENT VIDEO PIPELINE                              │
│                                                                              │
│  ┌─────────────────┐                                                        │
│  │ DIRECTOR AGENT  │  Creates high-level video plan                         │
│  │ (Gemini 3)      │  • Narrative arc (Hook → Setup → Showcase → CTA)       │
│  │                 │  • Scene breakdown with frame budgets                   │
│  │                 │  • Scene intents (not animation specifics)             │
│  └────────┬────────┘                                                        │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                        │
│  │ SCENE PLANNER   │  Translates intents → concrete compositions            │
│  │ (Gemini 3)      │  • Element positions (1920x1080 canvas math)           │
│  │ [PARALLEL]      │  • Spring animation configs (damping, stiffness)       │
│  │                 │  • Cursor tutorial flows with CSS selectors            │
│  └────────┬────────┘                                                        │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                        │
│  │ ASSEMBLY AGENT  │  Builds Remotion-compatible composition                │
│  │                 │  • Track ordering (z-index)                            │
│  │                 │  • Component → preview HTML mapping                    │
│  │                 │  • Keyframe normalization                              │
│  └────────┬────────┘                                                        │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                        │
│  │ REFINEMENT      │  Quality critic with fix recipes                       │
│  │ AGENT           │  • Scores 0-100 across 5 criteria                      │
│  │ (Gemini 3)      │  • Outputs specific patches (not vague suggestions)    │
│  │                 │  • Score < 40 → regenerate from Director               │
│  └────────┬────────┘                                                        │
│           │                                                                  │
│           ▼ (loop if score < threshold)                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REMOTION RENDER                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Spring    │  │  Device     │  │   Cursor    │  │    MP4 / WebM       │ │
│  │ Animations  │  │  Frames     │  │ Interactions│  │    Export           │ │
│  │ (physics)   │  │ (phone/     │  │ (tutorials) │  │                     │ │
│  │             │  │  laptop)    │  │             │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VIDEO OUTPUT                                       │
│              Professional 1080p marketing video with:                        │
│              • Spring-physics animations (Remotion Lambda style)             │
│              • Device frames (phone/laptop) for UI components               │
│              • Staggered element entrances                                   │
│              • Tutorial cursor interactions                                  │
│              • Optional AI voiceover                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Technical Decisions

### Why Remotion as Render Engine?

1. **React-native composition** — Video scenes are React components, matching the components we're showcasing. No impedance mismatch between source and output.

2. **Spring physics** — Remotion's `spring()` function produces natural, professional motion that matches the Remotion Lambda trailer aesthetic. Linear tweens look amateur; spring physics look polished.

3. **Frame-accurate rendering** — Unlike real-time screen recording, Remotion renders each frame deterministically. No dropped frames, no timing variance.

4. **Programmable exports** — MP4, WebM, GIF at any resolution. Serverless rendering via Remotion Lambda for production.

### Why Multi-Agent Pipeline?

1. **Separation of concerns** — Director focuses on narrative, Scene Planner on visual details, Refinement on quality. Each agent has a focused prompt under 2000 tokens.

2. **Iterative improvement** — The Refinement Agent can request regeneration or apply patches. This closed-loop approach catches issues that a single-pass system misses.

3. **Parallelization** — Scene Planner processes all scenes in parallel, reducing latency from O(n) to O(1) for n scenes.

4. **Debuggability** — Each agent outputs structured data. When something goes wrong, we can inspect the exact agent that failed and its inputs/outputs.

### Why Spring-Based Animations?

1. **Physics feel natural** — Human visual perception responds positively to acceleration and overshoot. Spring physics produce this automatically.

2. **Consistent identity** — All Scenery videos share the same motion language, creating brand consistency regardless of input components.

3. **Configurable presets** — `smooth`, `snappy`, `bouncy`, `heavy`, `gentle` — each maps to specific damping/stiffness/mass values, giving the AI simple vocabulary to express animation intent.

## Prompt Engineering Highlights

- **Shared Constants** — GLOSSARY, DESIGN_TOKENS, SPRING_CONFIGS defined once, interpolated into all agent prompts. No duplication, no drift.

- **Frame-First Timing** — All timing in frames (30fps), not seconds. Eliminates unit conversion errors. Formula: `seconds × 30 = frames`.

- **Intent vs. Implementation** — Director outputs "dramatic entrance" (intent), Scene Planner translates to "spring-bounce with bouncy preset" (implementation). Clean separation.

- **Fix Recipes** — Refinement Agent has 5 concrete failure patterns with exact JSON patch outputs. No vague "improve the timing" suggestions.

- **Relative Keyframes** — RULE #1 in Scene Planner: `frame: 0 = when element appears, NOT video start`. This single rule prevents 80% of animation bugs.

## Demo Checklist

- [ ] Show component library import (GitHub URL → discovered components)
- [ ] Show AI chat generating a video ("Create a 30-second demo...")
- [ ] Show real-time preview in editor
- [ ] Show cursor tutorial interaction working
- [ ] Show video export (MP4 download)
- [ ] Show iterative refinement ("Make it more energetic")

## Links

- **Live Demo**: [scenery-gemini3.fly.dev](https://scenery-gemini3.fly.dev)
- **GitHub**: [github.com/Arty2001/scenery-gemini3-hackathon](https://github.com/Arty2001/scenery-gemini3-hackathon)
