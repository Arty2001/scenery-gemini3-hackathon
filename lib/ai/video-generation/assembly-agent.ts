/**
 * Assembly Agent - Composition Builder
 *
 * The Assembly Agent takes detailed scenes from the Scene Planner and
 * assembles them into a complete composition ready for the editor.
 *
 * It handles:
 * - Converting scene-relative timing to absolute frames
 * - Creating properly typed track items
 * - Organizing tracks by type (text, shapes, components, cursors, audio)
 * - Merging overlapping elements across scenes
 * - Generating unique IDs for all items
 *
 * This is a deterministic agent - no LLM calls, pure transformation logic.
 */

import type {
  VideoPlan,
  DetailedScene,
  GeneratedComposition,
  GeneratedTrack,
  GeneratedItem,
  AgentContext,
  ProgressCallback,
} from './types';
import type { Track, TimelineItem, PropertyKeyframe, EasingType } from '@/lib/composition/types';

// Simple ID generator (no uuid dependency)
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Fix keyframes where the AI mistakenly used absolute video frames instead of
 * relative element frames. If keyframe values seem too high (>90 frames for
 * entrance animations), rescale them to sensible ranges.
 */
function fixKeyframeTimings(keyframes: Record<string, unknown>[]): Record<string, unknown>[] {
  if (!keyframes || keyframes.length === 0) return keyframes;

  // Check if the AI made the common mistake of using absolute frames
  const maxFrame = Math.max(...keyframes.map(kf => (typeof kf.frame === 'number' ? kf.frame : 0)));

  // If max frame is > 90 (3 seconds), the AI likely used absolute video frames
  // Rescale to fit within a reasonable entrance animation duration (0-30 frames)
  if (maxFrame > 90) {
    console.warn(`[Assembly] Detected likely absolute frame values (max: ${maxFrame}), rescaling to relative frames`);

    // Find the min and max frame values
    const frames = keyframes.map(kf => (typeof kf.frame === 'number' ? kf.frame : 0));
    const minFrame = Math.min(...frames);
    const range = maxFrame - minFrame;

    // Rescale to 0-30 frames (1 second entrance animation)
    return keyframes.map(kf => {
      const oldFrame = typeof kf.frame === 'number' ? kf.frame : 0;
      const normalizedFrame = range > 0
        ? Math.round(((oldFrame - minFrame) / range) * 30)
        : 0;
      return { ...kf, frame: normalizedFrame };
    });
  }

  return keyframes;
}

/**
 * Convert flat keyframe format from AI (where properties are at top level)
 * to the values object format the editor expects.
 *
 * AI format: { frame: 10, opacity: 0, scale: 1, easing: 'ease-out' }
 * Editor format: { frame: 10, values: { opacity: 0, scale: 1 }, easing: 'ease-out' }
 *
 * IMPORTANT: Keyframe frames are RELATIVE to item start (frame 0 = when item appears).
 * DO NOT add scene/video offsets here!
 */
function normalizeKeyframe(kf: Record<string, unknown>): PropertyKeyframe {
  const { frame, easing, values, ...restProps } = kf;

  // If already has values object, use it (but handle undefined)
  const existingValues = values as Record<string, number> | undefined;

  // Extract animatable properties from top level
  const extractedValues: Record<string, number> = {};
  const animatableProps = ['opacity', 'scale', 'x', 'y', 'rotation', 'blur', 'brightness', 'contrast', 'positionX', 'positionY'];

  for (const prop of animatableProps) {
    if (prop in restProps && typeof restProps[prop] === 'number') {
      extractedValues[prop] = restProps[prop] as number;
    }
  }

  // Merge existing values with extracted values
  const finalValues = { ...existingValues, ...extractedValues };

  // If no values at all, provide empty object
  if (Object.keys(finalValues).length === 0) {
    finalValues.opacity = 1; // Default to visible
  }

  // Frame is RELATIVE to item start - DO NOT add offsets!
  return {
    frame: typeof frame === 'number' ? frame : 0,
    values: finalValues,
    easing: (typeof easing === 'string' ? easing : 'ease-out') as EasingType,
  };
}

/**
 * Assembly Agent - converts detailed scenes to a complete composition.
 */
export async function runAssemblyAgent(
  videoPlan: VideoPlan,
  detailedScenes: DetailedScene[],
  context: AgentContext,
  onProgress?: ProgressCallback
): Promise<GeneratedComposition> {
  onProgress?.('🔧 Assembly Agent: Building composition from detailed scenes...');

  const { composition } = context;

  // Initialize track collections
  const componentItems: GeneratedItem[] = [];
  const textItems: GeneratedItem[] = [];
  const shapeItems: GeneratedItem[] = [];
  const cursorItems: GeneratedItem[] = [];
  const audioItems: GeneratedItem[] = [];

  // Process each scene
  for (const scene of detailedScenes) {
    onProgress?.(`🔧 Assembly: Processing scene "${scene.sceneId}"...`);

    // Process component
    if (scene.component) {
      componentItems.push(
        createComponentItem(scene.component, scene.from, scene.durationInFrames, composition)
      );
    }

    // Process texts
    for (const text of scene.texts) {
      textItems.push(createTextItem(text, scene.from, scene.durationInFrames, composition));
    }

    // Process shapes
    for (const shape of scene.shapes) {
      shapeItems.push(createShapeItem(shape, scene.from, scene.durationInFrames, composition));
    }

    // Process cursor
    if (scene.cursor) {
      cursorItems.push(
        createCursorItem(scene.cursor, scene.from, scene.durationInFrames, composition)
      );
    }

    // Process narration (will be handled by TTS later)
    if (scene.narrationScript && context.includeVoiceover) {
      audioItems.push({
        id: generateId(),
        type: 'narration-placeholder',
        sceneId: scene.sceneId,
        script: scene.narrationScript,
        from: scene.from,
        durationInFrames: scene.durationInFrames,
      });
    }
  }

  // Build tracks - each item gets its own track for maximum flexibility
  // IMPORTANT: Track order determines z-index! Earlier tracks render BEHIND later tracks.
  // Correct order: Shapes (background) → Components → Text → Cursor (top)
  const tracks: GeneratedTrack[] = [];

  // 1. SHAPES FIRST (background layer - renders behind everything)
  for (let i = 0; i < shapeItems.length; i++) {
    const shape = shapeItems[i];
    const shapeText = typeof shape.text === 'string' ? shape.text : '';
    const shapeName = shape.shapeType === 'badge' && shapeText
      ? `Badge: ${shapeText.slice(0, 15)}`
      : `Shape ${i + 1}`;
    tracks.push({
      name: shapeName,
      type: 'shape',
      locked: false,
      visible: true,
      items: [shape],
    });
  }

  // 2. COMPONENTS (main content layer - renders on top of shapes)
  for (const compItem of componentItems) {
    const compName = context.components.find(c => c.id === compItem.componentId)?.name || 'Component';
    tracks.push({
      name: compName,
      type: 'component',
      locked: false,
      visible: true,
      items: [compItem],
    });
  }

  // 3. TEXT (overlay layer - renders on top of components)
  for (const textItem of textItems) {
    const textPreview = (textItem.text as string)?.slice(0, 20) || 'Text';
    tracks.push({
      name: textPreview,
      type: 'text',
      locked: false,
      visible: true,
      items: [textItem],
    });
  }

  // 4. CURSORS (top layer - always visible)
  for (let i = 0; i < cursorItems.length; i++) {
    tracks.push({
      name: `Cursor ${i + 1}`,
      type: 'cursor',
      locked: false,
      visible: true,
      items: [cursorItems[i]],
    });
  }

  // 5. Audio tracks (no visual, order doesn't matter)
  for (let i = 0; i < audioItems.length; i++) {
    tracks.push({
      name: `Narration ${i + 1}`,
      type: 'audio',
      locked: false,
      visible: true,
      items: [audioItems[i]],
    });
  }

  const generatedComposition: GeneratedComposition = {
    name: videoPlan.title,
    width: composition.width,
    height: composition.height,
    fps: composition.fps,
    durationInFrames: composition.durationInFrames,
    tracks,
  };

  onProgress?.(
    `✅ Assembly Agent: Created composition with ${tracks.length} tracks, ${
      componentItems.length + textItems.length + shapeItems.length + cursorItems.length
    } total items`
  );

  return generatedComposition;
}

// =============================================
// Item Creation Helpers
// =============================================

interface CompositionDims {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

function createComponentItem(
  comp: NonNullable<DetailedScene['component']>,
  sceneStart: number,
  sceneDuration: number,
  dims: CompositionDims
): GeneratedItem {
  // Fix keyframe timings if AI used absolute frames instead of relative
  const fixedKfs = fixKeyframeTimings((comp.keyframes || []) as unknown as Record<string, unknown>[]);

  // Convert keyframes - frames are RELATIVE to item start (frame 0 = when item appears)
  const keyframes: PropertyKeyframe[] = fixedKfs.map((kf) =>
    normalizeKeyframe(kf)
  );

  // Add default entrance animation if no keyframes
  // IMPORTANT: Frames are RELATIVE - frame 0 = when item appears, NOT video frame 0!
  if (keyframes.length === 0) {
    keyframes.push(
      { frame: 0, values: { opacity: 0, scale: 0.95 }, easing: 'ease-out' as EasingType },
      { frame: 20, values: { opacity: 1, scale: 1 }, easing: 'ease-out' as EasingType }
    );
  }

  return {
    id: generateId(),
    type: 'component',
    componentId: comp.componentId,
    from: sceneStart,
    durationInFrames: sceneDuration,
    displaySize: comp.displaySize,
    containerWidth: comp.containerWidth || getDefaultWidth(comp.displaySize),
    containerHeight: comp.containerHeight,
    objectPosition: comp.objectPosition || 'center',
    props: comp.props || {},
    keyframes,
    position: { x: 0.5, y: 0.5 }, // Centered by default
  };
}

function getDefaultWidth(displaySize: string): number {
  switch (displaySize) {
    case 'phone':
      return 375;
    case 'laptop':
      return 1280;
    default:
      return 800;
  }
}

function createTextItem(
  text: DetailedScene['texts'][0],
  sceneStart: number,
  sceneDuration: number,
  dims: CompositionDims
): GeneratedItem {
  const itemStart = sceneStart + (text.offsetFrames || 0);
  const itemDuration = text.durationInFrames || sceneDuration - (text.offsetFrames || 0);

  // Fix keyframe timings if AI used absolute frames instead of relative
  const fixedKfs = fixKeyframeTimings((text.keyframes || []) as unknown as Record<string, unknown>[]);

  // Convert keyframes - frames are RELATIVE to item start (frame 0 = when item appears)
  const keyframes: PropertyKeyframe[] = fixedKfs.map((kf) =>
    normalizeKeyframe(kf)
  );

  // Add default entrance animation based on role
  // IMPORTANT: Frames are RELATIVE - frame 0 = when item appears!
  if (keyframes.length === 0) {
    const entranceDuration = text.role === 'title' ? 25 : 20;
    keyframes.push(
      {
        frame: 0,
        values: { opacity: 0, positionY: text.position.y + 0.02 },
        easing: 'ease-out' as EasingType,
      },
      {
        frame: entranceDuration,
        values: { opacity: 1, positionY: text.position.y },
        easing: 'ease-out' as EasingType,
      }
    );
  }

  return {
    id: generateId(),
    type: 'text',
    text: text.text,
    from: itemStart,
    durationInFrames: itemDuration,
    fontSize: text.fontSize,
    fontWeight: text.fontWeight || getFontWeightForRole(text.role),
    color: text.color,
    backgroundColor: text.backgroundColor,
    position: text.position,
    keyframes,
    letterSpacing: text.letterSpacing,
    lineHeight: text.lineHeight,
    textAlign: text.textAlign || 'center',
    role: text.role,
  };
}

function getFontWeightForRole(role: string): number {
  switch (role) {
    case 'title':
      return 700;
    case 'subtitle':
      return 600;
    case 'cta':
      return 700;
    default:
      return 400;
  }
}

function createShapeItem(
  shape: DetailedScene['shapes'][0],
  sceneStart: number,
  sceneDuration: number,
  dims: CompositionDims
): GeneratedItem {
  const itemStart = sceneStart + (shape.offsetFrames || 0);
  const itemDuration = shape.durationInFrames || sceneDuration - (shape.offsetFrames || 0);

  // Fix keyframe timings if AI used absolute frames instead of relative
  const fixedKfs = fixKeyframeTimings((shape.keyframes || []) as unknown as Record<string, unknown>[]);

  // Convert keyframes - frames are RELATIVE to item start (frame 0 = when item appears)
  const keyframes: PropertyKeyframe[] = fixedKfs.map((kf) =>
    normalizeKeyframe(kf)
  );

  // Add default entrance for shapes
  // IMPORTANT: Frames are RELATIVE - frame 0 = when item appears!
  if (keyframes.length === 0 && shape.shapeType !== 'gradient') {
    keyframes.push(
      { frame: 0, values: { opacity: 0, scale: 0.9 }, easing: 'ease-out' as EasingType },
      { frame: 15, values: { opacity: shape.opacity ?? 1, scale: 1 }, easing: 'ease-out' as EasingType }
    );
  }

  return {
    id: generateId(),
    type: 'shape',
    shapeType: shape.shapeType,
    from: itemStart,
    durationInFrames: itemDuration,
    width: shape.width,
    height: shape.height,
    position: shape.position,
    fill: shape.fill,
    stroke: shape.stroke,
    strokeWidth: shape.strokeWidth,
    borderRadius: shape.borderRadius,
    opacity: shape.opacity ?? 1,
    gradientFrom: shape.gradientFrom,
    gradientTo: shape.gradientTo,
    gradientDirection: shape.gradientDirection,
    text: shape.text,
    fontSize: shape.fontSize,
    color: shape.color,
    svgContent: shape.svgContent,
    viewBox: shape.viewBox,
    keyframes,
  };
}

function createCursorItem(
  cursor: DetailedScene['cursor'],
  sceneStart: number,
  sceneDuration: number,
  dims: CompositionDims
): GeneratedItem {
  if (!cursor || !cursor.keyframes || cursor.keyframes.length === 0) {
    // Return cursor with default center position
    // IMPORTANT: Frames are RELATIVE - frame 0 = when cursor item appears!
    return {
      id: generateId(),
      type: 'cursor',
      from: sceneStart,
      durationInFrames: sceneDuration,
      cursorStyle: 'default',
      clickEffect: 'ripple',
      keyframes: [
        { frame: 0, x: dims.width / 2, y: dims.height / 2 },
      ],
    };
  }

  // Convert keyframes - frames are RELATIVE to item start (frame 0 = when cursor appears)
  const keyframes = cursor.keyframes.map((kf) => {
    // Get the frame number, default to 0 if not provided
    // IMPORTANT: This should already be relative - DO NOT add sceneStart!
    const frameNum = typeof kf.frame === 'number' ? kf.frame : 0;

    // Convert normalized 0-1 positions to pixels, with fallback to center
    let x: number | undefined;
    let y: number | undefined;

    if (kf.x !== undefined && typeof kf.x === 'number' && !isNaN(kf.x)) {
      // If value is 0-1, treat as normalized; if > 1, treat as pixels
      x = kf.x <= 1 ? kf.x * dims.width : kf.x;
    }
    if (kf.y !== undefined && typeof kf.y === 'number' && !isNaN(kf.y)) {
      y = kf.y <= 1 ? kf.y * dims.height : kf.y;
    }

    // If no target and no valid x/y, provide center as fallback
    if (!kf.target && (x === undefined || y === undefined)) {
      x = x ?? dims.width / 2;
      y = y ?? dims.height / 2;
    }

    return {
      frame: frameNum, // RELATIVE to cursor item start, NOT absolute video frame!
      target: kf.target,
      x,
      y,
      click: kf.click,
      action: kf.action,
      value: kf.value,
    };
  });

  return {
    id: generateId(),
    type: 'cursor',
    from: sceneStart,
    durationInFrames: sceneDuration,
    cursorStyle: cursor.cursorStyle || 'default',
    clickEffect: cursor.clickEffect || 'ripple',
    keyframes,
  };
}

// =============================================
// Composition Validation & Optimization
// =============================================

/**
 * Validate the assembled composition for common issues.
 */
export function validateComposition(
  composition: GeneratedComposition
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check for empty composition
  const totalItems = composition.tracks.reduce((sum, t) => sum + t.items.length, 0);
  if (totalItems === 0) {
    issues.push('Composition has no items');
  }

  // Check for items outside duration
  for (const track of composition.tracks) {
    for (const item of track.items) {
      const itemEnd = (item.from as number) + (item.durationInFrames as number);
      if (itemEnd > composition.durationInFrames) {
        issues.push(
          `Item "${item.id}" extends beyond composition (${itemEnd} > ${composition.durationInFrames})`
        );
      }
    }
  }

  // Check for missing component IDs
  for (const track of composition.tracks) {
    if (track.type === 'component') {
      for (const item of track.items) {
        if (!item.componentId) {
          issues.push(`Component item "${item.id}" has no componentId`);
        }
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Convert GeneratedComposition to editor-compatible Track[] format.
 */
export function toEditorTracks(composition: GeneratedComposition): Track[] {
  return composition.tracks.map((track) => ({
    id: generateId(),
    name: track.name,
    type: track.type as Track['type'],
    locked: track.locked,
    visible: track.visible,
    items: track.items.map((item) => ({
      ...item,
      id: item.id || generateId(),
    })) as TimelineItem[],
  }));
}
