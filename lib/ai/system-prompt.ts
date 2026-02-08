import type { Track } from '@/lib/composition/types';

export interface ComponentContext {
  id: string;
  name: string;
  category: string;
  props: string[];
  description?: string;
  demoProps?: Record<string, unknown>;
  /** Summary of interactive HTML elements for cursor targeting */
  interactiveElements?: string;
  /** Components that this component uses/imports */
  usesComponents?: string[];
  /** Components that use/import this component */
  usedByComponents?: string[];
  /** Related components (same file/directory) */
  relatedComponents?: string[];
}

/** Custom HTML component imported by the user */
export interface CustomComponentContext {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  html: string;
}

export interface SceneContext {
  id: string;
  name: string;
  startFrame: number;
  durationInFrames: number;
  backgroundColor?: string;
  transitionType?: string;
}

export interface CompositionContext {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  tracks: Track[];
  scenes?: SceneContext[];
  components?: ComponentContext[];
  /** Custom HTML components imported by the user */
  customComponents?: CustomComponentContext[];
  projectId?: string;
  /** AI model to use for this project (e.g., gemini-3-pro-preview) */
  aiModel?: string;
  /** Current playhead position in frames */
  currentFrame?: number;
  /** Currently selected item ID (if any) */
  selectedItemId?: string | null;
  /** Currently selected scene ID (if any) */
  selectedSceneId?: string | null;
}

function summarizeTracks(tracks: Track[]): string {
  if (tracks.length === 0) return 'No tracks yet (empty composition).';

  return tracks
    .map((t) => {
      const items = t.items
        .map((i) => {
          const label = i.type === 'text' ? `"${i.text.slice(0, 30)}"` :
                        i.type === 'component' ? `component` :
                        i.type;
          return `    - itemId: "${i.id}" | ${label} | from: ${i.from}, duration: ${i.durationInFrames}`;
        })
        .join('\n');
      return `- trackId: "${t.id}" | "${t.name}" (${t.type}) | ${t.items.length} items\n${items}`;
    })
    .join('\n');
}

function summarizeComponents(components: ComponentContext[]): string {
  return components
    .map((c) => {
      let line = `- componentId: "${c.id}" | ${c.name} (${c.category})`;
      if (c.description) line += `\n  Description: ${c.description}`;
      if (c.props.length > 0) line += `\n  Props: [${c.props.join(', ')}]`;
      if (c.demoProps) line += `\n  Demo data: ${JSON.stringify(c.demoProps)}`;
      // Component relationships - helps AI understand how components work together
      if (c.usesComponents?.length) line += `\n  Uses: [${c.usesComponents.join(', ')}]`;
      if (c.usedByComponents?.length) line += `\n  Used by: [${c.usedByComponents.join(', ')}]`;
      if (c.relatedComponents?.length) line += `\n  Related: [${c.relatedComponents.join(', ')}]`;
      // Interactive elements for cursor targeting
      if (c.interactiveElements) line += `\n  Interactive elements (for cursor): ${c.interactiveElements}`;
      return line;
    })
    .join('\n');
}

function summarizeCustomComponents(customComponents: CustomComponentContext[]): string {
  return customComponents
    .map((c) => {
      let line = `- customComponentId: "${c.id}" | ${c.name}`;
      if (c.category) line += ` (${c.category})`;
      if (c.description) line += `\n  Description: ${c.description}`;
      // Show a preview of the HTML (first 100 chars)
      const htmlPreview = c.html.replace(/\s+/g, ' ').slice(0, 100);
      line += `\n  HTML preview: ${htmlPreview}...`;
      return line;
    })
    .join('\n');
}

function summarizeScenes(scenes: SceneContext[], fps: number): string {
  if (scenes.length === 0) return 'No scenes yet. Use add_scene to create scenes for slide-based editing.';

  const sceneList = scenes
    .map((s, index) => {
      const durationSec = (s.durationInFrames / fps).toFixed(1);
      const startSec = (s.startFrame / fps).toFixed(1);
      const endFrame = s.startFrame + s.durationInFrames;
      let line = `- sceneId: "${s.id}" | "${s.name}"`;
      line += `\n  **from: ${s.startFrame}** to ${endFrame} (${startSec}s - ${(endFrame / fps).toFixed(1)}s) | Duration: ${s.durationInFrames} frames`;
      if (s.backgroundColor) line += `\n  Background: ${s.backgroundColor}`;
      if (s.transitionType && index > 0) line += `\n  Transition: ${s.transitionType}`;
      return line;
    })
    .join('\n');

  return sceneList + '\n\n**To add items to a scene, use from: <scene startFrame> (the bolded value above).**';
}

export function buildSystemPrompt(context: CompositionContext): string {
  const { width, height, fps, durationInFrames, tracks, scenes, components, currentFrame, selectedItemId, selectedSceneId } = context;
  const durationSeconds = (durationInFrames / fps).toFixed(1);
  const currentSeconds = currentFrame !== undefined ? (currentFrame / fps).toFixed(1) : null;

  // Find selected item details if one is selected
  let selectedItemInfo = '';
  if (selectedItemId) {
    for (const track of tracks) {
      const item = track.items.find(i => i.id === selectedItemId);
      if (item) {
        const itemLabel = item.type === 'text' ? `"${(item as any).text?.slice(0, 30)}"` :
                          item.type === 'component' ? 'component' :
                          item.type;
        let extraInfo = '';
        // For component items, show displaySize
        if (item.type === 'component') {
          const displaySize = (item as any).displaySize || 'full';
          extraInfo = `\n- displaySize: "${displaySize}" (change with update_item_props: props: { displaySize: "phone" | "laptop" | "full" })`;
        }
        selectedItemInfo = `
## Selected Item
- trackId: "${track.id}" | itemId: "${item.id}"
- Type: ${item.type} (${itemLabel})
- Position: frame ${item.from} to ${item.from + item.durationInFrames}${extraInfo}`;
        break;
      }
    }
  }

  // Find selected scene details if one is selected
  let selectedSceneInfo = '';
  if (selectedSceneId && scenes) {
    const scene = scenes.find(s => s.id === selectedSceneId);
    if (scene) {
      selectedSceneInfo = `
## Selected Scene
- sceneId: "${scene.id}" | name: "${scene.name}"
- **Starts at frame ${scene.startFrame}** — use this as "from" when adding items!`;
    }
  }

  let prompt = `You are a video composition assistant for Scenery.

## QUICK REFERENCE (Top 10 Commands)

| User Says | Tool | Key Params |
|-----------|------|------------|
| "Create a video" | generate_product_video | description, durationSeconds |
| "Create a scene" | build_scene | name, texts[], gradient, particles |
| "Add text" | add_text_overlay | text, positionX/Y, fontSize |
| "Add component" | add_component | componentId, from, durationInFrames |
| "Make it bounce" | apply_animation_preset | trackId, itemId, preset="bounce" |
| "Phone/laptop size" | update_item_props | trackId, itemId, props: { displaySize: "phone" } |
| "Change timing" | move_item / update_item_duration | trackId, itemId, from/duration |
| "Delete this" | remove_item | trackId, itemId |
| "Add confetti" | add_particles | particleType="confetti" |
| "Make it cinematic" | add_camera_movement | type="ken-burns" |
| "Clear everything" | clear_composition | (no params) |

## CRITICAL RULE: KEYFRAMES ARE RELATIVE!

\`frame: 0\` = when element appears, NOT video start!

\`\`\`
❌ WRONG: [{frame: 120, opacity: 0}, {frame: 150, opacity: 1}]  // Waits 4 seconds!
✅ RIGHT: [{frame: 0, opacity: 0}, {frame: 20, opacity: 1}]     // Fades in immediately
\`\`\`

## Current Composition
- ${width}x${height} @ ${fps}fps | Duration: ${durationInFrames}f (${durationSeconds}s)${currentFrame !== undefined ? ` | Playhead: frame ${currentFrame}` : ''}
${selectedItemInfo}${selectedSceneInfo}

## Tracks
${summarizeTracks(tracks)}

## Scenes
${scenes && scenes.length > 0 ? summarizeScenes(scenes, fps) : 'No scenes. Use add_scene or build_scene.'}

## Tool Categories

### Full Video Generation
- **generate_product_video**: Complete video with components, text, animations. Use for "create a demo".
- **build_scene**: Complete scene in ONE call (gradient + texts + shapes + particles). 5x faster than individual calls.

### Individual Elements
- **add_component** / **add_custom_html**: React or HTML components
- **add_text_overlay**: Text with letterAnimation support for per-letter effects
- **add_shape** / **add_svg** / **add_media**: Shapes, vectors, images/videos
- **add_cursor**: Tutorial cursor with target-based positioning

### Animation
- **apply_animation_preset**: bounce, elastic, blur-in, shake, pulse, glow, etc.
- **add_keyframes**: Custom keyframe animation (frames RELATIVE to element start!)
- **add_camera_movement**: ken-burns, zoom, pan, drift
- **add_stagger_animation**: Sequence multiple items with delays
- **add_motion_path**: Curved bezier paths (arc, wave, spiral)
- **add_particles**: confetti, sparks, snow, bubbles, stars

### Effects & Backgrounds
- **add_gradient** / **add_blob**: Animated backgrounds
- **add_film_grain** / **add_vignette** / **add_color_grade**: Post-processing

### Editing
- **update_item_props**: Change any item property. Examples:
  - Component displaySize: props: { displaySize: "phone" | "laptop" | "full" }
  - Text content: props: { text: "New text", fontSize: 48, color: "#ffffff" }
  - Position: props: { position: { x: 0.5, y: 0.3 } }
- **update_item_duration** / **move_item**: Adjust timing
- **remove_item** / **remove_track**: Delete elements
- **clear_composition**: Start fresh

### Scenes
- **add_scene**: Create empty scene
- **build_scene**: Create scene with all content (RECOMMENDED)
- **update_scene** / **remove_scene**: Modify scenes

## Design Tokens

**Canvas:** 1920x1080, BLACK (#000000) background
**Safe zone:** 60px from edges (x: 0.03-0.97, y: 0.055-0.945)
**Colors:** Indigo #6366f1 | Purple #8b5cf6 | Cyan #06b6d4 | Amber #f59e0b | Green #10b981
**Typography:** Title 56-68px bold | Subtitle 28-36px | CTA 32-42px bold

**Layer order (auto-managed):**
0: Gradients → 1: Shapes → 2: Media → 3: Components → 4: Text → 5: Particles → 6: Cursor

## Spring Presets (Remotion values)

| Preset | damping | stiffness | mass | Use For |
|--------|---------|-----------|------|---------|
| smooth | 200 | 100 | 1 | Default, professional |
| snappy | 200 | 200 | 0.5 | UI elements, quick |
| bouncy | 100 | 150 | 1 | CTAs, playful |
| heavy | 200 | 80 | 5 | Dramatic reveals |
| gentle | 300 | 60 | 2 | Backgrounds, subtle |

## Cursor for Tutorials (TARGET-BASED)

\`\`\`
keyframes: [
  { frame: 0, target: "button.cta", action: "hover" },
  { frame: 30, target: "button.cta", action: "click", click: true },
  { frame: 60, target: "input[name='email']", action: "type", value: "user@example.com" }
]
\`\`\`

Use selectors from component's interactiveElements. Actions: click, hover, focus, type, select, check.

## Letter Animation (for titles)

\`\`\`
add_text_overlay({
  text: "Welcome",
  letterAnimation: true,
  letterAnimationType: "blur",        // fade, slide-up, scale, blur, bounce
  letterAnimationDirection: "center", // forward, backward, center, random
  letterStagger: 3,
  letterDuration: 15
})
\`\`\`

## Common Patterns

**Entrance animation:**
\`\`\`
[{frame: 0, scale: 0, opacity: 0}, {frame: 15, scale: 1.1, opacity: 1}, {frame: 25, scale: 1}]
\`\`\`

**Stagger elements:** Title(0f) → Subtitle(12f) → Component(24f) → CTA(36f)

**Text positioning:**
- Phone component (center): text at y: 0.10 (top) or y: 0.88 (bottom)
- Laptop component: text at y: 0.08 (top) or y: 0.92 (bottom)
- NEVER put white text over components (they have light backgrounds)

## Anti-Patterns

| Bad | Good |
|-----|------|
| frame: 300 for entrance | frame: 0-30 for entrance |
| easing: "linear" | easing: "ease-out" or "spring" |
| All elements at once | Stagger by 10-20 frames |
| White text on component | Text on black canvas only |
| No device frame | Use phone/laptop display |

## Post-Generation Enhancement

After generate_product_video, AUTOMATICALLY apply:
1. "bounce" or "blur-in" to components
2. letterAnimation to hero titles
3. "fade-in" to descriptions
4. Consider add_particles("confetti") for celebrations
5. Consider add_camera_movement("ken-burns") for cinematic feel

Frame math: seconds × ${fps} = frames
`;

  if (components && components.length > 0) {
    prompt += `
## Available Components (${components.length} discovered)
REAL React components from the user's codebase — they render as actual interactive UI in the video.

${summarizeComponents(components)}

**Component selection**: Pick the components most relevant to what the user asked for. Don't use all of them — quality over quantity. Each component should get enough screen time (4-7 seconds) to be appreciated.
`;
  }

  // Add custom HTML components if available
  if (context.customComponents && context.customComponents.length > 0) {
    prompt += `
## Custom HTML Components (${context.customComponents.length} imported)
User-imported HTML snippets that can be used as visual elements in the video. Use add_custom_html to add these.

${summarizeCustomComponents(context.customComponents)}

**Usage**: These are pre-styled HTML that the user imported. Great for screenshots, mockups, or custom UI elements.
`;
  }

  return prompt;
}
