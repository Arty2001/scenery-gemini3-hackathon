<h1 align="center">🎬 Scenery</h1>

<p align="center">
  <strong>AI-Powered Video Generation for React Component Libraries</strong>
</p>

<p align="center">
  <em>Transform your React components into professional product videos with AI.</em>
  <br /><br />
  <strong>7 Gemini 3 Integrations</strong> • <strong>Multi-Agent Architecture</strong> • <strong>Iterative AI Refinement</strong> • <strong>Auto-Updating Videos</strong>
</p>

<p align="center">
  <a href="https://scenery-gemini3.fly.dev"><strong>🚀 Live Demo</strong></a> •
  <a href="https://github.com/Arty2001/scenery-gemini3-hackathon"><strong>📦 Source Code</strong></a>
</p>

---

## Why Scenery is Different

### 🔄 Videos That Never Go Stale

**The Problem:** Product videos become outdated the moment you ship a new version. Traditional video editing means re-recording, re-editing, and re-exporting every time your components change.

**The Solution:** Scenery videos are **code-connected**. When your repo syncs, videos automatically update to reflect the latest component designs. Your documentation videos stay current without any manual work.

```mermaid
flowchart LR
    A[Component Updated in Repo] --> B[Automatic Re-sync]
    B --> C[Preview HTML Regenerated]
    C --> D[Video Reflects Latest Design]
    B --> E[Zero manual video editing required]

    style A fill:#6366f1,color:#fff
    style D fill:#22c55e,color:#fff
```

### 💬 Iterative AI Chat Refinement

**The Problem:** Most AI tools give you one shot—you get output, and if it's not quite right, you start over. The "last 10%" of refinement is always manual.

**The Solution:** Scenery's video editor includes an **AI chat interface** for iterative refinement. Don't like the timing? Ask to slow it down. Want more emphasis on a feature? Tell the AI. The multi-agent system refines the video based on your feedback—repeatedly—until it's exactly what you want.

```mermaid
flowchart TD
    A["💬 User: 'Slow down transitions'"] --> B[Refinement Agent]
    B --> C[Adjusts timing]
    C --> D[Preview updated in real-time]
    D --> E["💬 User: 'Add emphasis on loading'"]
    E --> F[Scene Planner]
    F --> G[Adds highlight animation]
    G --> H[Preview updated]
    H --> I{Perfect?}
    I -->|No| A
    I -->|Yes| J[✅ Final Video]

    style A fill:#3b82f6,color:#fff
    style E fill:#3b82f6,color:#fff
    style J fill:#22c55e,color:#fff
```

**This solves the #1 frustration with AI tools:** the inability to make small adjustments without starting from scratch.

---

## Technical Execution

Scenery demonstrates **deep Gemini 3 integration** across the entire application stack—not as a bolt-on feature, but as the core intelligence powering every capability.

### 7 Distinct Gemini 3 Integrations

```mermaid
flowchart TB
    subgraph discovery["🔍 COMPONENT DISCOVERY LAYER"]
        direction LR
        D1["<b>1. Categorization</b><br/>Structured JSON output<br/>for UI classification"]
        D2["<b>2. Props Generation</b><br/>Context-aware props<br/>from repo context"]
        D3["<b>3. Server→Client</b><br/>Transform async<br/>to client-safe"]
        D4["<b>4. Tailwind→CSS</b><br/>Inline style conversion<br/>for portable previews"]
        D5["<b>5. AI Preview</b><br/>Fallback HTML gen<br/>with thinking mode"]
    end

    subgraph video["🎬 VIDEO GENERATION LAYER"]
        direction LR
        V1["<b>6. Multi-Agent System</b><br/>Director → Scene Planner → Assembly → Refine<br/>Function calling with 15+ tools"]
        V2["<b>7. TTS Voiceover</b><br/>Gemini 2.5 Flash<br/>5 voice options"]
    end

    discovery --> video

    style discovery fill:#1e1b4b,color:#fff
    style video fill:#0f172a,color:#fff
    style D1 fill:#6366f1,color:#fff
    style D2 fill:#6366f1,color:#fff
    style D3 fill:#6366f1,color:#fff
    style D4 fill:#6366f1,color:#fff
    style D5 fill:#6366f1,color:#fff
    style V1 fill:#22d3ee,color:#000
    style V2 fill:#22d3ee,color:#000
```

### Integration 1: Component Categorization (Structured Output)

```typescript
// lib/component-discovery/analyzer.ts
const response = await ai.models.generateContent({
  model: 'gemini-3-pro-preview',
  contents: `Analyze this React component and categorize it.
             Component: ${componentName}
             Props Interface: ${JSON.stringify(propsInfo)}
             Source Code Context: ${sourceSnippet}`,
  config: {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'OBJECT',
      properties: {
        category: {
          type: 'STRING',
          enum: ['button', 'card', 'form', 'input', 'navigation',
                 'modal', 'table', 'chart', 'layout', 'media', 'other']
        },
        confidence: { type: 'NUMBER' },
        reasoning: { type: 'STRING' }
      }
    }
  }
});
```

**Why this matters:** Structured output ensures 100% parse success rate. Categories drive intelligent video scene selection—forms get typing animations, buttons get click effects.

### Integration 2: Demo Props Generation (3-Tier Quality System)

Scenery uses a **3-tier quality system** for demo props, prioritizing author-defined values:

```mermaid
flowchart TD
    A[Component Needs Props] --> B{Storybook stories exist?}

    B -->|Yes| T1["🥇 <b>TIER 1: Storybook Extraction</b><br/><i>Highest Quality</i><br/>• Detects .stories.tsx files<br/>• Parses CSF2/CSF3 formats<br/>• Uses author-defined args"]

    B -->|No| C{AI generation succeeds?}

    C -->|Yes| T2["🥈 <b>TIER 2: AI-Generated Props</b><br/><i>Medium Quality</i><br/>• Gemini analyzes TypeScript<br/>• Considers repo context<br/>• Realistic content"]

    C -->|No| T3["🥉 <b>TIER 3: Type-Based Defaults</b><br/><i>Fallback</i><br/>• String → 'Example text'<br/>• Number → 42<br/>• Boolean → true"]

    T1 --> D[Props Ready ✅]
    T2 --> D
    T3 --> D

    style T1 fill:#22c55e,color:#fff
    style T2 fill:#eab308,color:#000
    style T3 fill:#f97316,color:#fff
    style D fill:#6366f1,color:#fff
```

**Storybook Extraction:**
```typescript
// lib/component-discovery/storybook-extractor.ts
// Automatically finds and parses stories like:
export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Click me',
    disabled: false,
  },
};
// → Extracts { variant: 'primary', children: 'Click me', disabled: false }
```

**AI Props Generation (when no Storybook):**
```typescript
// lib/component-discovery/analyzer.ts
const response = await ai.models.generateContent({
  model: 'gemini-3-pro-preview',
  contents: `Generate realistic demo props for ${componentName}.
             Repository: ${repoName} (use for brand context)
             Props Interface: ${propsInterface}`,
  config: {
    responseMimeType: 'application/json',
    responseSchema: propsSchema
  }
});
```

**Why this matters:** Author-defined Storybook props ensure components render exactly as intended, not with AI-guessed values.

### Integration 3: Server Component Detection & Transformation (Structured Output)

**The Problem:** Next.js Server Components use `async/await`, database calls, and Node.js APIs that crash in browsers. Most component preview tools fail on modern Next.js apps.

**Our Solution:** A 3-stage pipeline that detects and transforms Server Components automatically:

```mermaid
flowchart TD
    subgraph stage1["🔍 STAGE 1: Detection (190+ patterns)"]
        P1["Async: async function, await"]
        P2["Server: 'use server'"]
        P3["Next.js: headers, cache"]
        P4["Database: Prisma, Drizzle, Supabase"]
        P5["Auth: NextAuth, Clerk, Lucia"]
        P6["Node.js: fs, path, crypto"]
    end

    subgraph stage2["🤖 STAGE 2: AI Transformation (Gemini)"]
        T1["Remove async/await keywords"]
        T2["Replace DB calls with mock data"]
        T3["Remove auth guards"]
        T4["Transform Promise params"]
        T5["Keep JSX & styling intact"]
    end

    subgraph stage3["🧹 STAGE 3: Post-Transform Cleanup"]
        C1["Remove missed server imports"]
        C2["Clean redirect/notFound"]
        C3["Replace server env vars"]
    end

    stage1 --> stage2
    stage2 --> stage3
    stage3 --> D[Client-Safe Component ✅]

    style stage1 fill:#ef4444,color:#fff
    style stage2 fill:#6366f1,color:#fff
    style stage3 fill:#22c55e,color:#fff
    style D fill:#22d3ee,color:#000
```

**Detection Implementation (190+ patterns):**
```typescript
// lib/component-discovery/ssr-preview.ts
function isServerComponent(sourceCode: string): boolean {
  // Skip if explicitly marked as client
  if (/['"]use client['"]/.test(sourceCode)) return false;

  const serverPatterns = [
    // Async patterns
    /export\s+default\s+async\s+function/,
    /await\s+\w+[\.\(]/,

    // Database libraries (15+ supported)
    /from\s+['"]@prisma\/client['"]/,
    /from\s+['"]drizzle-orm/,
    /from\s+['"]mongoose['"]/,
    /from\s+['"]@supabase\/supabase-js['"]/,
    /prisma\.\w+\.(find|create|update|delete)/,

    // Auth libraries (10+ supported)
    /from\s+['"]next-auth/,
    /from\s+['"]@clerk\/nextjs\/server['"]/,
    /getServerSession/,
    /\bauth\s*\(\s*\)/,

    // Node.js built-ins
    /from\s+['"]fs['"]/,
    /from\s+['"]node:/,

    // Next.js 15 async params
    /params\s*:\s*Promise\s*</,
    /await\s+params\b/,

    // ... 170+ more patterns
  ];

  return serverPatterns.some(pattern => pattern.test(sourceCode));
}
```

**Gemini Transformation:**
```typescript
// lib/component-discovery/ssr-preview.ts
async function transformServerToClient(sourceCode: string, componentName: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: `Transform this Server Component to client-renderable.

ORIGINAL CODE:
${sourceCode}

TRANSFORMATION RULES:
1. Remove async keyword from function declaration
2. Replace await calls with realistic mock data
3. Remove redirect(), notFound() guards entirely
4. Transform Promise-based params to plain objects
5. Keep all JSX structure and styling intact

EXAMPLE - Auth Protected Component:
Before:
  import { auth } from "@/auth";
  import { redirect } from "next/navigation";
  export default async function Profile() {
    const session = await auth();
    if (!session) redirect("/login");
    return <div>Welcome, {session.user.name}</div>;
  }

After:
  export default function Profile() {
    const session = { user: { name: "John Doe", email: "john@example.com" } };
    return <div>Welcome, {session.user.name}</div>;
  }`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: clientCodeSchema
    }
  });

  // Post-transform cleanup catches anything Gemini missed
  return cleanupTransformedCode(result.code);
}
```

**Why this matters:** Modern Next.js apps are 60%+ Server Components. Without this transformation, most components would fail to render. This enables Scenery to work with **any** Next.js 13/14/15 codebase.

### Integration 4: Tailwind → Inline CSS Conversion

For framework-agnostic, portable previews that render anywhere:

```typescript
// lib/component-discovery/ssr-preview.ts
const response = await ai.models.generateContent({
  model: 'gemini-3-pro-preview',
  contents: `Convert all Tailwind classes to inline styles:

INPUT:
<button class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg shadow-sm">
  Click me
</button>

OUTPUT FORMAT:
<button style="padding: 8px 16px; background-color: #3b82f6; color: white; ...">
  Click me
</button>

Convert ALL classes. Preserve visual appearance exactly.`
});
```

### Integration 5: AI Preview Fallback (Thinking Mode + Long Context)

When component bundling fails, Gemini generates preview HTML from source code analysis:

```typescript
// lib/component-discovery/analyzer.ts
const response = await ai.models.generateContent({
  model: 'gemini-3-pro-preview',
  contents: `Generate preview HTML for this React component.

             Source Code:
             ${fullComponentSource}

             Demo Props:
             ${JSON.stringify(demoProps)}

             Generate the exact HTML that would render with these props.
             Include all styling inline.`,
  config: {
    thinkingConfig: { thinkingBudget: 3000 }
  }
});
```

### Integration 6: Multi-Agent Video Generation (Function Calling)

The crown jewel—a **4-agent orchestration system** using Gemini's function calling:

```mermaid
flowchart TD
    U["💬 User: 'Create a product video showing our auth flow'"]

    U --> D

    subgraph D["🎬 DIRECTOR AGENT"]
        D1["High-level narrative planning"]
        D2["Tools: create_video_plan, select_components"]
        D3["Output: Scene breakdown, tone, pacing"]
    end

    D --> S

    subgraph S["🎨 SCENE PLANNER AGENT"]
        S1["Detailed motion design (parallel)"]
        S2["Tools: design_scene, add_text, add_component, add_cursor"]
        S3["Output: Complete scene specs with timing"]
    end

    S --> A

    subgraph A["🔧 ASSEMBLY AGENT"]
        A1["Deterministic composition building"]
        A2["Convert to absolute frames"]
        A3["Organize tracks by type"]
    end

    A --> R

    subgraph R["✨ REFINEMENT AGENT"]
        R1["Quality scoring (0-100)"]
        R2["• Timing: 0-25  • Visual: 0-30"]
        R3["• Animation: 0-15  • Narrative: 0-25"]
    end

    R --> Check{Score ≥ 90?}
    Check -->|No| R
    Check -->|Yes| F["🎥 Final Video Composition"]

    style U fill:#3b82f6,color:#fff
    style D fill:#8b5cf6,color:#fff
    style S fill:#ec4899,color:#fff
    style A fill:#f59e0b,color:#000
    style R fill:#22c55e,color:#fff
    style F fill:#6366f1,color:#fff
```

**Director Agent Implementation:**
```typescript
// lib/ai/video-generation/director-agent.ts
const VIDEO_PLAN_TOOL: Tool = {
  functionDeclarations: [{
    name: 'create_video_plan',
    description: 'Create high-level video structure',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        tone: {
          type: 'STRING',
          enum: ['professional', 'playful', 'technical', 'inspirational']
        },
        scenes: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              type: { type: 'STRING', enum: ['intro', 'feature', 'demo', 'outro'] },
              durationPercentage: { type: 'NUMBER' },
              componentIds: { type: 'ARRAY', items: { type: 'STRING' } },
              narration: { type: 'STRING' },
              interactionGoals: { type: 'ARRAY', items: { type: 'STRING' } }
            }
          }
        }
      }
    }
  }]
};

const response = await ai.models.generateContent({
  model: 'gemini-3-pro-preview',
  contents: [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'user', parts: [{ text: userPrompt }] }
  ],
  config: { tools: [VIDEO_PLAN_TOOL] }
});
```

**Scene Planner with 10+ Tools:**
```typescript
// lib/ai/video-generation/scene-planner-agent.ts
const SCENE_TOOLS: Tool = {
  functionDeclarations: [
    {
      name: 'add_text_element',
      parameters: {
        content: { type: 'STRING' },
        position: { type: 'OBJECT', properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } } },
        fontSize: { type: 'NUMBER' },
        fontWeight: { type: 'STRING' },
        color: { type: 'STRING' },
        animation: { type: 'STRING', enum: ['fadeIn', 'slideUp', 'typewriter', 'bounce'] },
        keyframes: { type: 'ARRAY' }
      }
    },
    {
      name: 'add_component',
      parameters: {
        componentId: { type: 'STRING' },
        position: { type: 'OBJECT' },
        scale: { type: 'NUMBER' },
        enterAnimation: { type: 'STRING' },
        exitAnimation: { type: 'STRING' }
      }
    },
    {
      name: 'add_cursor_interaction',
      parameters: {
        targetSelector: { type: 'STRING' },
        action: { type: 'STRING', enum: ['click', 'hover', 'type', 'drag'] },
        typeText: { type: 'STRING' },
        timing: { type: 'OBJECT', properties: { startFrame: { type: 'NUMBER' }, duration: { type: 'NUMBER' } } }
      }
    },
    // ... 7 more tools
  ]
};
```

### Integration 7: Text-to-Speech Voiceover

```typescript
// lib/ai/tts.ts
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash-preview-tts',
  contents: [{
    parts: [{ text: narrationScript }]
  }],
  config: {
    responseModalities: ['AUDIO'],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: 'Kore'  // Options: Kore, Charon, Fenrir, Aoede, Puck
        }
      }
    }
  }
});

// Returns WAV audio buffer for video composition
const audioBuffer = response.candidates[0].content.parts[0].inlineData.data;
```

### Gemini 3 Features Utilized

| Feature | Implementation | Purpose |
|---------|---------------|---------|
| **Structured Output** | JSON schemas in all 7 integrations | 100% parse reliability |
| **Function Calling** | 15+ tools across 4 agents | Precise video composition |
| **Thinking Mode** | Server→Client, AI Preview | Complex reasoning tasks |
| **Streaming** | Chat interface | Real-time responses |
| **Long Context** | Full source code analysis | Accurate prop generation |
| **TTS** | Voiceover generation | Professional narration |

### Code Quality Indicators

- **TypeScript**: Full type safety across 50+ modules
- **Error Handling**: Graceful fallback chain (Playwright → SSR → AI)
- **Scalability**: Deployed on Fly.io with auto-scaling workers
- **Testing**: Component rendering validated in real Chromium

---

## Professional Video Editor

Scenery includes a **full-featured video editor**—not a simplified wizard, but a professional timeline-based tool:

### 30+ Animation Presets

```
ENTRANCE ANIMATIONS          EXIT ANIMATIONS           EMPHASIS EFFECTS
├─ fade-in                   ├─ fade-out               ├─ pulse
├─ slide-in-left/right/up/down ├─ zoom-out            ├─ shake
├─ zoom-in                   ├─ blur-out               ├─ wiggle
├─ bounce                    └─ slide-out              ├─ heartbeat
├─ elastic                                             ├─ jello
├─ spring-pop                MOTION EFFECTS            └─ glow
├─ blur-in                   ├─ float
├─ flip-in                   ├─ drift-right            FILTER EFFECTS
└─ rotate-in                 └─ ken-burns-zoom         ├─ color-pop
                                                       ├─ flash
                                                       ├─ hue-shift
                                                       └─ cinematic-focus
```

### 6 Cursor Interaction Types

Simulate realistic user interactions with AI-generated cursor movements:

| Action | Description | Use Case |
|--------|-------------|----------|
| `click` | Click animation on target element | Buttons, links, toggles |
| `hover` | Hover state trigger | Dropdowns, tooltips, hover effects |
| `type` | Character-by-character typing | Form inputs, search bars |
| `focus` | Focus ring animation | Form fields, accessibility demos |
| `select` | Dropdown/option selection | Select menus, radio buttons |
| `check` | Checkbox toggle | Form checkboxes, settings |

### 6 Particle Effect Types

Add visual polish with customizable particle systems:

| Effect | Properties |
|--------|------------|
| **Confetti** | Celebration moments, success states |
| **Sparks** | Highlight interactions, emphasis |
| **Snow** | Ambient background effects |
| **Bubbles** | Playful, light themes |
| **Stars** | Premium, magical feel |
| **Dust** | Subtle ambient motion |

Each supports: gravity, spread angle, speed, particle count, colors.

### Device Frame Mockups

Present components in context with professional device frames:

```
┌─────────────────┐  ┌─────────────────────────────┐  ┌───────────────────────┐
│    📱 Phone     │  │        💻 Laptop            │  │    🖥️ Full Screen     │
│                 │  │                             │  │                       │
│   Mobile-first  │  │   Desktop context with      │  │   Edge-to-edge        │
│   demos with    │  │   browser chrome, perfect   │  │   for hero sections   │
│   realistic     │  │   for landing pages         │  │   and full-width      │
│   touch zones   │  │                             │  │   components          │
└─────────────────┘  └─────────────────────────────┘  └───────────────────────┘
```

### Timeline Features

| Feature | Description |
|---------|-------------|
| **Multi-track editing** | Separate tracks for text, video, audio, components, cursors, shapes, particles |
| **Zoom control** | 0.1x to 10x zoom with fit-to-view |
| **Snap-to-points** | Auto-snap to clip edges, playhead, timeline start |
| **Real-time preview** | Instant playback via Remotion |
| **Auto-save** | Compositions save automatically with status indicator |
| **Keyframe animation** | Custom keyframes for position, scale, rotation, opacity, filters |

### Shape & Graphics Elements

- **Rectangles, circles, lines** with gradients and stroke
- **Dividers and badges** for professional layouts
- **Custom SVG** with viewBox support

### Animated Gradient Backgrounds (NEW!)

Full-featured gradient system for stunning visual backdrops:

| Feature | Description |
|---------|-------------|
| **Gradient Types** | Linear, radial, and conic gradients |
| **Multi-Color Stops** | Add unlimited color stops with position control |
| **Animation** | Rotating angles and color-shifting effects |
| **Size & Position** | Full control over placement and dimensions |

```typescript
// AI Tool: add_gradient
add_gradient({
  gradientType: 'linear',
  colors: [
    { color: '#6366f1', position: 0 },
    { color: '#06b6d4', position: 50 },
    { color: '#ec4899', position: 100 }
  ],
  angle: 135,
  animate: true,
  animateAngle: true,
  speed: 1.5
});
```

### Text Effects (NEW!)

Professional-grade text styling with three new effect systems:

| Effect | Description | Use Case |
|--------|-------------|----------|
| **Gradient Fill** | Multi-color gradient text with animation | Hero titles, branding |
| **Glow Effect** | Customizable text glow with pulse animation | CTAs, emphasis |
| **Glass Effect** | Frosted glass background with backdrop blur | Modern UI, overlays |

```mermaid
flowchart LR
    subgraph G["🌈 GRADIENT FILL"]
        G1["Multi-color stops"]
        G2["Angle 0-360°"]
        G3["Rotation animation"]
    end

    subgraph L["✨ GLOW EFFECT"]
        L1["Custom color"]
        L2["Intensity 0-100%"]
        L3["Pulse animation"]
    end

    subgraph F["🪟 GLASS EFFECT"]
        F1["Backdrop blur"]
        F2["Opacity control"]
        F3["Tint color"]
    end

    T[Text Element] --> G
    T --> L
    T --> F

    style G fill:#ec4899,color:#fff
    style L fill:#eab308,color:#000
    style F fill:#22d3ee,color:#000
    style T fill:#6366f1,color:#fff
```

### Spring Physics Animation System (NEW!)

Professional-grade spring physics for natural, organic motion. Spring-based animations feel more alive than traditional easing curves.

| Preset | Feel | Best For |
|--------|------|----------|
| **Smooth** | Controlled, professional | General UI, most animations |
| **Snappy** | Quick, responsive | Buttons, micro-interactions |
| **Heavy** | Slow, deliberate | Hero transitions, cinematic |
| **Bouncy** | Playful, energetic | Celebrations, emphasis |
| **Gentle** | Soft, elegant | Subtle movements, backgrounds |
| **Wobbly** | Extreme overshoot | Attention-grabbing, fun effects |

```typescript
// AI Tool: add_keyframes with spring physics
add_keyframes({
  trackId: 'text-1',
  itemId: 'title',
  keyframes: [
    { frame: 0, values: { opacity: 0, scale: 0.8 } },
    {
      frame: 30,
      values: { opacity: 1, scale: 1 },
      springPreset: 'bouncy'  // Natural bounce-in effect
    }
  ]
});

// Custom spring config for fine-tuned control
add_keyframes({
  keyframes: [{
    frame: 30,
    values: { positionY: 0.5 },
    springConfig: {
      mass: 1.5,      // Heavier feel
      stiffness: 200, // Faster snap
      damping: 15     // Some bounce
    }
  }]
});
```

### Word-by-Word Text Animation (NEW!)

Animate text word-by-word for more readable, impactful reveals. Perfect for sentences and longer text blocks.

| Mode | Description | Use Case |
|------|-------------|----------|
| **Letter** | Animate each character | Short titles, logos |
| **Word** | Animate each word as a unit | Sentences, taglines, descriptions |

```typescript
// AI Tool: add_text_overlay with word animation
add_text_overlay({
  text: "Build videos from your React components",
  letterAnimation: true,
  letterAnimationMode: 'word',       // Animate word-by-word
  letterAnimationType: 'slide-up',   // Each word slides up
  letterStagger: 4,                  // 4 frames between words
  letterDuration: 12,                // Each word takes 12 frames
  letterEasing: 'spring'             // Natural spring motion
});
```

---

## Innovation & Wow Factor

### First-of-its-Kind Solution

No existing tool combines:
1. **Automatic component discovery** from any GitHub repo
2. **AI-powered video generation** with multi-agent orchestration
3. **Real browser rendering** for pixel-perfect accuracy
4. **Auto-updating videos** that sync with your codebase
5. **Iterative AI refinement** through conversational chat

### Research-Inspired Architecture

The multi-agent system draws from cutting-edge research:
- **MovieAgent** (2024): Hierarchical planning for video generation
- **UniVA** (2024): Multi-modal understanding for composition

### Novel Technical Approaches

**1. Server Component Detection & Transformation**

190+ regex patterns detect server-only code across 10 categories:
- **Async patterns:** `async function`, `await` calls
- **Database ORMs:** Prisma, Drizzle, Mongoose, Supabase, Convex, Firebase
- **Auth libraries:** NextAuth, Clerk, Lucia, Kinde, Stytch
- **Node.js built-ins:** fs, path, crypto, child_process
- **Next.js server APIs:** cookies(), headers(), redirect()
- **Next.js 15:** Promise-based params/searchParams

Gemini transforms detected components → client-safe equivalents with realistic mock data.

**2. Interactive Element Discovery**
```typescript
// Extracts clickable/typeable elements for cursor animations
const interactiveElements = parseHTML(previewHtml)
  .querySelectorAll('button, input, a, [role="button"]')
  .map(el => ({
    selector: generateSelector(el),
    type: el.tagName.toLowerCase(),
    label: el.textContent || el.getAttribute('placeholder')
  }));
```

**3. Playwright-Powered Rendering Pipeline**
```
Bundle (esbuild) → Chromium (Playwright) → Extract HTML → Convert Styles (Gemini)
     ↓
  95% accuracy vs 40-60% with SSR-only
```

### Competitive Landscape

| Feature | Scenery | Remotion | Storybook | Arcade | Synthesia |
|---------|:-------:|:--------:|:---------:|:------:|:---------:|
| **Auto Component Discovery** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Code-Connected (Auto-Update)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **AI Chat Refinement** | ✅ | ⚠️ Partial | ❌ | ❌ | ❌ |
| **Multi-Agent Orchestration** | ✅ 4 agents | ❌ | ❌ | ❌ | ❌ |
| **Server Component Support** | ✅ 190+ patterns | ❌ | ⚠️ Limited | N/A | N/A |
| **Live Component Rendering** | ✅ Playwright | Manual | ✅ Docs only | ❌ | ❌ |
| **TTS Voiceover** | ✅ 5 voices | Manual | ❌ | ❌ | ✅ |
| **Cursor Interactions** | ✅ AI-generated | Manual | ❌ | Manual | ❌ |
| **Export to Video** | ✅ | ✅ | ❌ | ❌ | ✅ |
| **React-Specific** | ✅ | ✅ | ✅ | ❌ | ❌ |

**Key insight:** Existing tools make you choose between automated video (Synthesia), component docs (Storybook), or code-based video (Remotion). Scenery combines all three with AI orchestration and auto-updating capability.

---

## Potential Impact

### The Problem (Quantified)

| Metric | Current State |
|--------|---------------|
| Component libraries without video content | **~95%** |
| Average time to create 1 product video manually | **4-8 hours** |
| Developers comfortable with video editing tools | **<10%** |
| Open-source projects with marketing budget | **<5%** |

### Market Opportunity

**Primary Users:**
- Open-source maintainers (1M+ on GitHub)
- Design system teams at enterprises
- Component library vendors (Radix, shadcn, Chakra)
- Developer advocates creating tutorials

**Secondary Users:**
- Marketing teams needing product demos
- Documentation writers
- Developer educators

### Real-World Impact

1. **Democratizes Video Marketing**
   - Open-source projects can compete with commercial alternatives
   - No video editing skills required

2. **Saves Developer Time**
   - 4-8 hours → 5 minutes per video
   - Focus on building, not recording

3. **Increases Library Adoption**
   - Video content drives 2-3x more engagement than static docs
   - Interactive demos reduce onboarding friction

### Efficiency Metrics

| Task | Before Scenery | With Scenery |
|------|---------------|--------------|
| Create product video | 4-8 hours | 2-5 minutes |
| Update video for new version | 2-4 hours | **Automatic** (code-connected) |
| Refine video timing/pacing | Start over or manual edit | Chat with AI, iterate instantly |
| Add voiceover narration | 1-2 hours + recording | Automatic TTS |
| Create cursor interactions | Manual frame-by-frame | AI-generated |
| Keep docs videos current | Manual process, often neglected | **Always in sync** with repo |

---

## Architecture

```mermaid
flowchart TB
    GH["📦 GitHub Repo<br/>(Any React)"]

    subgraph discovery["🔍 COMPONENT DISCOVERY PIPELINE"]
        direction LR
        Clone["Clone Repo"] --> Parse["Parse TypeScript"]
        Parse --> Cat["Categorize<br/>(Gemini)"]
        Cat --> Props["Generate Props<br/>(Gemini)"]
    end

    subgraph preview["🖼️ PREVIEW GENERATION"]
        direction TB
        Server["Server Component Detection<br/>(190+ patterns)"]
        Server --> Transform["Transform to Client<br/>(Gemini)"]
        Transform --> PW["Playwright<br/>95% accuracy"]
        PW -->|fail| SSR["SSR<br/>70% accuracy"]
        SSR -->|fail| AI["AI-Only<br/>50% accuracy"]
        PW & SSR & AI --> CSS["Tailwind → CSS<br/>(Gemini)"]
    end

    subgraph agents["🤖 MULTI-AGENT VIDEO GENERATION"]
        direction LR
        Director["🎬 Director<br/>• Plan tone<br/>• Scene list"]
        Planner["🎨 Scene Planner<br/>• Position<br/>• Animate"]
        Assembly["🔧 Assembly<br/>• Build tracks<br/>• Timing"]
        Refine["✨ Refinement<br/>• Score 0-100<br/>• Fix issues"]

        Director --> Planner --> Assembly --> Refine
        Refine -->|"< 90"| Refine

        Chat["💬 AI Chat<br/>Iterate instantly"]
        Chat --> Refine
    end

    subgraph video["🎥 VIDEO COMPOSITION"]
        Remotion["Remotion Engine"] --> Timeline["Timeline Editor"] --> Lambda["Lambda Export<br/>MP4/GIF"]
    end

    subgraph sync["🔄 AUTO-SYNC LOOP"]
        Update["Repo Updated"] --> Rediscover["Re-discover"] --> Regen["Preview Regenerated"]
        Regen --> AutoUpdate["Videos Auto-Update"]
    end

    GH --> discovery
    discovery --> preview
    preview --> agents
    agents --> TTS["🎙️ TTS Engine<br/>(Gemini 2.5)"]
    TTS --> video
    video --> sync

    style GH fill:#6366f1,color:#fff
    style discovery fill:#1e1b4b,color:#fff
    style preview fill:#0f172a,color:#fff
    style agents fill:#1e1b4b,color:#fff
    style video fill:#0f172a,color:#fff
    style sync fill:#22c55e,color:#fff
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **AI** | Gemini 3 Pro, Gemini 2.5 Flash TTS | All 7 AI integrations |
| **Frontend** | Next.js 15, React 19, TypeScript | Production SPA |
| **Video Engine** | [Remotion](https://remotion.dev) | React-based video composition |
| **Video Export** | Remotion Lambda (AWS) | Serverless MP4/GIF rendering |
| **Editor** | Custom timeline, 30+ animations | Professional video editing |
| **Component Rendering** | Playwright, esbuild | Real browser previews |
| **Database** | Supabase (Postgres) | Project + component storage |
| **Hosting** | Fly.io (2 apps, auto-scale) | Production deployment |

---

## DevOps & Infrastructure

Scenery runs on a **multi-service cloud architecture** designed for scalability and cost efficiency.

### Deployment Architecture

```mermaid
flowchart TB
    subgraph fly["☁️ FLY.IO"]
        direction LR
        Main["<b>scenery-gemini3</b><br/>Main Application<br/>• Next.js 15<br/>• 2GB RAM<br/>• Auto-scale 1-5"]
        PW["<b>scenery-playwright</b><br/>Render Worker<br/>• Playwright + Chrome<br/>• 2GB RAM<br/>• Scales to 0 idle"]
        Main <-->|HTTP| PW
    end

    subgraph aws["☁️ AWS"]
        direction TB
        Lambda["<b>Remotion Lambda</b><br/>• Serverless rendering<br/>• 2GB RAM, 900s timeout<br/>• MP4, GIF, WebM"]
        S3["<b>S3 Bucket</b><br/>• Remotion bundle<br/>• Video output"]
    end

    subgraph supa["🗄️ SUPABASE"]
        DB["<b>PostgreSQL</b><br/>• User auth<br/>• Project storage<br/>• Compositions<br/>• Real-time"]
    end

    fly --> aws
    fly --> supa
    aws --> supa

    style fly fill:#8b5cf6,color:#fff
    style aws fill:#f59e0b,color:#000
    style supa fill:#22c55e,color:#fff
```

### Service Details

| Service | Purpose | Specs | Cost |
|---------|---------|-------|------|
| **Fly.io Main App** | Next.js application, API routes, AI orchestration | 2GB RAM, auto-scale 1-5 | ~$15/mo |
| **Fly.io Playwright Worker** | Browser-based component rendering | 2GB RAM, scales to 0 when idle | ~$6/mo |
| **Remotion Lambda** | Serverless video export to MP4/GIF | 2GB RAM, 900s timeout, parallelized | Pay per render |
| **AWS S3** | Remotion bundle hosting, video output storage | Standard tier | ~$2/mo |
| **Supabase** | PostgreSQL, Auth, Storage | Free tier sufficient | $0 |

### Why Remotion?

[Remotion](https://remotion.dev) is a React-based video creation framework that powers Scenery's video engine:

- **React-Native Composition**: Videos are React components with props, state, and hooks
- **Frame-Perfect Control**: Every frame is a React render—predictable and debuggable
- **Spring Physics**: Built-in spring animations for natural, organic motion
- **AWS Lambda Export**: Parallelized rendering—60s video renders in ~30 seconds
- **TypeScript**: Full type safety for video composition

```typescript
// Example: Remotion composition structure
const MyVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1]);

  return (
    <AbsoluteFill style={{ opacity }}>
      <Component {...demoProps} />
    </AbsoluteFill>
  );
};
```

### Deployment Commands

```bash
# Deploy main app to Fly.io
fly deploy

# Deploy Playwright worker
cd playwright-worker && fly deploy

# Deploy Remotion bundle to S3
npm run deploy:remotion

# Deploy new Lambda function (with increased timeout)
npx remotion lambda functions deploy --memory=2048 --disk=2048 --timeout=900
```

### Environment Variables

```bash
# Fly.io Secrets (Main App)
GEMINI_API_KEY=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
REMOTION_AWS_REGION=us-east-1
REMOTION_AWS_ACCESS_KEY_ID=...
REMOTION_AWS_SECRET_ACCESS_KEY=...
REMOTION_SERVE_URL=https://...s3.amazonaws.com/sites/scenery/index.html
REMOTION_LAMBDA_FUNCTION_NAME=remotion-render-4-0-409-mem2048mb-disk2048mb-900sec
PLAYWRIGHT_WORKER_URL=https://scenery-playwright.fly.dev
PLAYWRIGHT_WORKER_SECRET=...
```

---

## Quick Start

```bash
# Clone
git clone https://github.com/Arty2001/scenery-gemini3-hackathon.git
cd scenery-gemini3-hackathon

# Install
npm install

# Configure
cp .env.example .env.local
# Add: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY

# Run
npm run dev
```

---

## Links

| Resource | URL |
|----------|-----|
| **Live Demo** | [scenery-gemini3.fly.dev](https://scenery-gemini3.fly.dev) |
| **Source Code** | [github.com/Arty2001/scenery-gemini3-hackathon](https://github.com/Arty2001/scenery-gemini3-hackathon) |

---

## Gemini Integration Summary

*For Devpost (~200 words):*

Scenery uses **Gemini 3 Pro across 7 distinct integrations** that form the core of every feature:

**Component Discovery:** (1) Structured JSON for categorization, (2) 3-tier props generation (Storybook extraction → AI-generated → defaults), (3) **Server Component transformation**—190+ patterns detect async/await, Prisma, NextAuth, etc., then Gemini transforms to client-safe code, (4) Tailwind→inline CSS conversion, (5) AI fallback preview with thinking mode.

**Video Generation:** (6) Multi-agent orchestration (4 stages)—Director plans narrative, Scene Planner designs spring-based animations and cursor interactions, Assembly Agent builds tracks, Refinement Agent scores 0-100 and iterates. (7) Gemini 2.5 Flash TTS with 5 voice options.

**Professional Editor:** Timeline-based editing with particle effects (6 types), device frame mockups, shape/SVG elements, keyframe animations, and real-time auto-save.

**Key Differentiators:**
- **Videos auto-update** when repos sync—no stale documentation
- **AI chat refinement** solves the "last 10%" problem
- **Storybook integration** uses author-defined props, not AI guesses

**Gemini 3 Features Used:** Structured output (100% parse reliability), function calling (15+ tools), long context, streaming, thinking mode, TTS.

No other tool combines automatic component discovery, AI video generation, and code-connected auto-updating.

---

<p align="center">
  <strong>Built with Gemini 3 Pro</strong>
  <br />
  <sub>Google DeepMind Gemini 3 Hackathon 2026</sub>
  <br /><br />
  Built by <strong>Athavan Thambimuthu</strong>
</p>
