# Scenery Demo Script (2:30)

**Context:** First 30 seconds is the AI-generated hook. This picks up at 0:30.

---

## TRANSITION (0:30 - 0:38)

**VOICEOVER:**
"That intro you just watched—Scenery generated it. Text animations, spring physics, timing—all from one prompt. Let me show you how it works."

**SCREEN:**
- Cut to Scenery dashboard

---

## ARCHITECTURE OVERVIEW (0:38 - 0:58)

**VOICEOVER:**
"Here's what I built. Two pipelines: component discovery takes your GitHub repo, parses TypeScript, and uses Gemini to categorize and generate props. Video generation runs four agents in sequence—Director, Scene Planner, Assembly, Refinement—with a feedback loop that iterates until quality score hits 90."

**SCREEN:**
```
0:38-0:48
- Full-screen architecture diagram (animated in Scenery or pre-made in Eraser)
- Dark background, nodes light up as mentioned:

  ┌─────────────────────────────────────────────────────────────────────┐
  │  COMPONENT DISCOVERY              VIDEO GENERATION                  │
  │                                                                     │
  │  GitHub ─→ AST Parser             User Prompt                       │
  │       ↓                                ↓                            │
  │  [Gemini] Categorize              [Gemini] Director Agent           │
  │       ↓                                ↓                            │
  │  [Gemini] Props Gen               [Gemini] Scene Planner ←──┐       │
  │       ↓                                ↓                    │       │
  │  Server Component Detection        Assembly Agent           │       │
  │       ↓                                ↓                    │       │
  │  [Gemini] Transform               [Gemini] Refinement ──────┘       │
  │       ↓                            (score < 90? loop)               │
  │  Playwright Render                     ↓                            │
  │       ↓                            Remotion Export                  │
  │  [Gemini] Tailwind→CSS                                              │
  └─────────────────────────────────────────────────────────────────────┘

0:48-0:58
- Zoom into the refinement loop
- Animate: "82/100 → patches → 91/100 ✓"
- Brief pause, then transition to dashboard
```

---

## COMPONENT DISCOVERY (0:58 - 1:18)

**VOICEOVER:**
"I connect a GitHub repo. Scenery clones it, runs TypeScript AST parsing to extract component interfaces, then Gemini categorizes each one—button, form, modal—and generates realistic demo props. Three-tier system: Storybook args first, then AI-generated, then type-based defaults as fallback."

**SCREEN:**
```
0:58-1:08
- Click "Connect GitHub"
- Select repo
- Loading: "Discovering components..."

1:08-1:18
- Grid populates
- Click a component → show props table
- Hover "AI Generated" badge
```

---

## SERVER COMPONENT HANDLING (1:18 - 1:33)

**VOICEOVER:**
"The tricky part: Next.js Server Components. They use async/await, database calls, Node APIs—crashes in browser. So I built a detection pipeline with 190 patterns—Prisma, NextAuth, Drizzle, Clerk—then Gemini transforms them to client-safe versions. Removes await, mocks data, strips auth guards."

**SCREEN:**
```
- Show a Server Component in the list
- Click it → preview renders
- Maybe show code diff: async → sync
```

---

## PREVIEW RENDERING (1:33 - 1:48)

**VOICEOVER:**
"Previews render in actual Chromium via a Playwright worker on Fly.io. Not mocked HTML—real React, real hooks, real state. Falls back to SSR if bundling fails, then AI-generated HTML as last resort. After rendering, Gemini converts Tailwind classes to inline styles for portability."

**SCREEN:**
```
- Show live preview updating
- Maybe show the Playwright worker logs briefly
```

---

## VIDEO GENERATION (1:48 - 2:13)

**VOICEOVER:**
"Now video generation. I select components, describe what I want. Four agents coordinate: Director outputs a scene plan with narrative structure—intro, feature, outro. Scene Planner translates that into element positions, spring animations, cursor paths. Assembly converts to absolute frame timings. Refinement Agent scores 0 to 100 across five criteria—if it's below threshold, it patches and re-evaluates."

**SCREEN:**
```
1:48-1:58
- Select 3 components
- Type: "Create a demo of our auth flow"
- Click Generate

1:58-2:13
- Progress:
  → "Director: planning 3 scenes..."
  → "Scene Planner: designing animations..."
  → "Assembly: building timeline..."
  → "Refinement: 82/100 → applying patches → 91/100"
- Video preview appears
```

---

## ITERATIVE REFINEMENT (2:13 - 2:33)

**VOICEOVER:**
"The key insight: most AI tools are one-shot. You get output, if it's wrong, regenerate. Here I can just talk to it. 'Slow down transitions'—it adjusts timing. 'Add hover before click'—it modifies the cursor keyframes. No regeneration, just patches. That's the refinement loop exposed to the user."

**SCREEN:**
```
2:13-2:23
- Type: "Slow down the transitions"
- Video updates

2:23-2:33
- Type: "Add hover effect before the button click"
- Video updates with cursor hover
```

---

## AUTO-SYNC (2:33 - 2:48)

**VOICEOVER:**
"Last piece: code connectivity. Push to your repo, components re-sync, previews regenerate. Videos reference live components, so they update automatically. Documentation that doesn't rot."

**SCREEN:**
```
- Terminal: git push
- Dashboard: sync indicator
- Component preview updates
- Badge: "Last synced: just now"
```

---

## CLOSE (2:48 - 3:00)

**VOICEOVER:**
"Seven Gemini integrations. Four-agent orchestration. Playwright for rendering. Remotion for export. Code's on GitHub."

**SCREEN:**
```
2:48-2:54
- Architecture diagram returns (same as 0:38)
- All 7 Gemini nodes pulse/highlight simultaneously
- Text overlay: "7 Gemini Integrations"

2:54-3:00
- Fade to black
- Scenery logo centered
- "Built with Gemini 3 + Remotion"
- URL: scenery-gemini3.fly.dev
- Hold 3 seconds
```

---

## DIAGRAMS TO CREATE

**Option 1: Generate in Scenery itself**
Create this diagram as a video scene in Scenery—animated nodes that light up as you narrate. Use text overlays and shapes. Export as MP4 and splice into demo.

**Option 2: Eraser.io prompt**
```
Create a dark-themed system architecture diagram.

Two columns:
LEFT: "Component Discovery"
- GitHub icon → "AST Parser" → [Gemini] "Categorize" → [Gemini] "Props" → "Server Detection" → [Gemini] "Transform" → "Playwright" → [Gemini] "CSS"

RIGHT: "Video Generation"
- "Prompt" → [Gemini] "Director" → [Gemini] "Scene Planner" → "Assembly" → [Gemini] "Refinement"
- Loop arrow from Refinement back to Scene Planner with label "score < 90"
- Exit arrow with label "score ≥ 90" → "Remotion Export"

Highlight all [Gemini] nodes in purple/indigo.
Dark background (#0a0a0a), white text, minimal style.
```

**Architecture ASCII (for reference):**
```
COMPONENT DISCOVERY                    VIDEO GENERATION
─────────────────                      ────────────────
GitHub Repo                            User Prompt
    ↓                                      ↓
AST Parser                             ┌─────────────┐
    ↓                                  │  Director   │ ← Gemini
[Gemini] Categorize                    └──────┬──────┘
    ↓                                         ↓
[Gemini] Props Gen                     ┌─────────────┐
    ↓                                  │Scene Planner│ ← Gemini ←─┐
Server Detection (190 patterns)        └──────┬──────┘            │
    ↓                                         ↓                   │
[Gemini] Transform                     ┌─────────────┐            │
    ↓                                  │  Assembly   │            │
Playwright Render                      └──────┬──────┘            │
    ↓                                         ↓                   │
[Gemini] Tailwind→CSS                  ┌─────────────┐            │
    ↓                                  │ Refinement  │ ← Gemini ──┘
Component Previews                     └──────┬──────┘  (if <90)
                                              ↓
                                       Remotion → MP4
```

---

## HACKATHON JUDGING ALIGNMENT

**Technical Execution (40%)** — Hit these points:
- "7 Gemini integrations" (show the diagram)
- "Four-agent orchestration" (show progress UI with agent names)
- "190 patterns for Server Component detection" (specific number = credibility)
- "Playwright worker on Fly.io" (real infrastructure, not localhost demo)
- "Structured output, function calling, thinking mode" (name Gemini features)

**Innovation/Wow Factor (30%)** — Hit these points:
- "Iterative refinement loop" (most AI tools are one-shot)
- "Videos that auto-update when code changes" (unique differentiator)
- "Multi-agent system with quality scoring" (not just prompt→output)
- Show the Refinement Agent score: 82 → patches → 91 (visible iteration)

**Potential Impact (20%)** — Hit these points:
- "Documentation that doesn't rot" (solves real problem)
- Mention: Open source maintainers, design system teams, developer advocates
- Brief: "4-8 hours of video editing → 5 minutes"

**Presentation/Demo (10%)** — Hit these points:
- Architecture diagram shown twice (open and close)
- Clear Gemini integration callouts
- Working demo, not slides
- English, under 3 minutes

---

## TONE NOTES

- Engineer explaining to engineers
- "Here's how it works" not "Here's why you'll love it"
- Name the technologies (AST, Playwright, Remotion, Spring physics)
- Mention the hard problems solved (Server Components, real browser rendering)
- No superlatives, no "amazing" or "powerful"
- If something was hard to build, say so briefly

---

## TIMING SUMMARY

| Section | Duration | End Time |
|---------|----------|----------|
| AI-Generated Intro | 30s | 0:30 |
| Transition | 8s | 0:38 |
| Architecture Diagram | 20s | 0:58 |
| Component Discovery | 20s | 1:18 |
| Server Components | 15s | 1:33 |
| Preview Rendering | 15s | 1:48 |
| Video Generation | 25s | 2:13 |
| Iterative Refinement | 20s | 2:33 |
| Auto-Sync | 15s | 2:48 |
| Close | 12s | 3:00 |
| **Total** | **3:00** | — |

~160 words/minute for voiceover sections
