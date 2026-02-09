import { NextRequest, NextResponse } from 'next/server';
import { getAIClient } from '@/lib/ai/client';
import { buildSystemPrompt, type CompositionContext } from '@/lib/ai/system-prompt';
import { compositionTools } from '@/lib/ai/composition-tools';
import { Type } from '@google/genai';
import { generateVideo, type ComponentInfo, type AvailableAsset } from '@/lib/ai/video-generation';
import { listProjectAssets } from '@/lib/actions/assets';
import { DEFAULT_MODEL, type GeminiModelId } from '@/lib/ai/models';
import { isRateLimitError, SafeGenerateError } from '@/lib/ai/video-generation/safe-generate';

interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface ChatRequest {
  messages: ChatMessage[];
  compositionContext: CompositionContext;
}

// JSON schema for composition generation (second Gemini call)
// Note: width/height intentionally excluded - AI should not change canvas dimensions
const compositionJsonSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    // width and height excluded - canvas size is controlled by user
    fps: { type: Type.NUMBER },
    durationInFrames: { type: Type.NUMBER },
    tracks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          type: { type: Type.STRING, description: 'Track type: "text" only. Do NOT generate "video", "audio", "image", or "component" tracks.' },
          locked: { type: Type.BOOLEAN },
          visible: { type: Type.BOOLEAN },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, description: 'Item type: must be "text". Do NOT use "video", "audio", "image", or "component".' },
                from: { type: Type.NUMBER, description: 'Start frame (0-based)' },
                durationInFrames: { type: Type.NUMBER, description: 'Duration in frames' },
                text: { type: Type.STRING, description: 'The text content to display' },
                fontSize: { type: Type.NUMBER, description: 'Font size in pixels (e.g. 48 for titles, 24 for body)' },
                fontFamily: { type: Type.STRING, description: 'Font family name (e.g. "Inter", "Arial")' },
                color: { type: Type.STRING, description: 'Text color as hex (e.g. "#ffffff")' },
                position: {
                  type: Type.OBJECT,
                  description: 'Position as relative 0-1 coordinates. {x: 0.5, y: 0.5} = center.',
                  properties: {
                    x: { type: Type.NUMBER, description: '0=left, 0.5=center, 1=right' },
                    y: { type: Type.NUMBER, description: '0=top, 0.5=center, 1=bottom' },
                  },
                  required: ['x', 'y'],
                },
                fontWeight: { type: Type.NUMBER, description: 'Font weight (400=normal, 700=bold)' },
                textAlign: { type: Type.STRING, description: '"left", "center", or "right"' },
                backgroundColor: { type: Type.STRING, description: 'Background color as hex or "transparent"' },
              },
              required: ['type', 'from', 'durationInFrames', 'text', 'fontSize', 'fontFamily', 'color', 'position'],
            },
          },
        },
        required: ['name', 'type', 'items'],
      },
    },
  },
  required: ['name', 'tracks', 'durationInFrames', 'fps'],
};

export async function POST(request: NextRequest) {
  // Check API key early
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'AI service unavailable. GEMINI_API_KEY not configured.' },
      { status: 503 }
    );
  }

  try {
    const body: ChatRequest = await request.json();
    const { messages, compositionContext } = body;

    const ai = getAIClient();
    const systemPrompt = buildSystemPrompt(compositionContext);

    // Use project's AI model or fall back to default
    const modelId = (compositionContext.aiModel as GeminiModelId) || DEFAULT_MODEL;
    console.log(`[Chat API] Using model: ${modelId} (project setting: ${compositionContext.aiModel ?? 'not set'}, default: ${DEFAULT_MODEL})`);

    const stream = await ai.models.generateContentStream({
      model: modelId,
      contents: messages,
      config: {
        systemInstruction: systemPrompt,
        tools: compositionTools,
      },
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            // Check for function calls
            const functionCalls = chunk.candidates?.[0]?.content?.parts?.filter(
              (p) => p.functionCall
            );

            if (functionCalls && functionCalls.length > 0) {
              // Check for generate_product_video first (multi-agent system)
              const productVideoCall = functionCalls.find(
                (p) => p.functionCall?.name === 'generate_product_video'
              );

              if (productVideoCall && productVideoCall.functionCall) {
                const genArgs = productVideoCall.functionCall.args as Record<string, unknown>;
                const description = genArgs.description as string;
                const includeVoiceover = (genArgs.includeVoiceover as boolean) ?? false;
                const voiceName = (genArgs.voiceName as string) ?? 'Kore';
                const rawDuration = (genArgs.durationInSeconds as number) ?? 30;
                const durationInSeconds = Math.max(10, rawDuration); // Allow shorter hook videos (min 10s)

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'text', content: '🎬 Starting multi-agent video generation...\n' })}\n\n`
                  )
                );

                // Fetch available project assets for AI to reference
                let availableAssets: AvailableAsset[] = [];
                if (compositionContext.projectId) {
                  try {
                    const assets = await listProjectAssets(compositionContext.projectId);
                    availableAssets = assets.map((a) => ({
                      name: a.name,
                      url: a.url,
                      type: a.type,
                    }));
                    if (availableAssets.length > 0) {
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({ type: 'text', content: `📁 Found ${availableAssets.length} uploaded assets to use.\n` })}\n\n`
                        )
                      );
                    }
                  } catch (err) {
                    console.warn('Failed to list project assets:', err);
                  }
                }

                // Build component info for the multi-agent system
                const componentInfo: ComponentInfo[] = (compositionContext.components ?? []).map((c) => ({
                  id: c.id,
                  name: c.name,
                  category: c.category ?? 'unknown',
                  description: c.description,
                  props: c.props ?? [],
                  demoProps: c.demoProps,
                  interactiveElements: c.interactiveElements,
                  usesComponents: c.usesComponents,
                  usedByComponents: c.usedByComponents,
                  relatedComponents: c.relatedComponents,
                }));

                try {
                  const result = await generateVideo(
                    {
                      userRequest: description,
                      composition: {
                        width: compositionContext.width,
                        height: compositionContext.height,
                        fps: compositionContext.fps,
                        durationInFrames: Math.round(durationInSeconds * compositionContext.fps),
                        tracks: [],
                        components: compositionContext.components ?? [],
                      },
                      components: componentInfo,
                      includeVoiceover,
                      voiceName,
                      targetDurationSeconds: durationInSeconds,
                      projectId: compositionContext.projectId,
                      availableAssets,
                      minQualityScore: 90,
                      maxRefinementIterations: 5,
                      modelId,
                    },
                    (progressMessage) => {
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({ type: 'text', content: progressMessage + '\n' })}\n\n`
                        )
                      );
                    }
                  );

                  if (result.success && result.tracks) {
                    // Convert DetailedScene[] to editor Scene[] format
                    const scenes = result.scenes?.map((detailedScene, index) => {
                      const sceneOutline = result.videoPlan?.scenes.find(s => s.id === detailedScene.sceneId);
                      const sceneName = sceneOutline?.purpose || `Scene ${index + 1}`;

                      // Add transitions to all scenes except the first one
                      const transition = index > 0 ? {
                        type: 'fade' as const,
                        durationInFrames: Math.round(compositionContext.fps * 0.5), // 0.5s transition
                      } : undefined;

                      // Ensure durationInFrames is a number (AI sometimes returns objects)
                      let duration = detailedScene.durationInFrames;
                      if (typeof duration !== 'number') {
                        console.warn(`[Video Gen] Scene ${detailedScene.sceneId} has invalid durationInFrames:`, duration);
                        // Try to extract if it's wrapped in an object
                        if (duration && typeof duration === 'object' && 'durationInFrames' in duration) {
                          duration = (duration as { durationInFrames: number }).durationInFrames;
                        } else {
                          duration = Math.round(compositionContext.fps * 5); // Fallback: 5 seconds
                        }
                      }

                      return {
                        id: detailedScene.sceneId,
                        name: sceneName,
                        startFrame: typeof detailedScene.from === 'number' ? detailedScene.from : 0,
                        durationInFrames: duration,
                        transition,
                        backgroundColor: '#000000',
                      };
                    }) ?? [];

                    // Note: Do NOT include width/height here - they should remain unchanged
                    // The AI should only control content (tracks/scenes), not canvas dimensions
                    const compositionData = {
                      name: result.videoPlan?.title ?? 'Generated Video',
                      // width and height intentionally omitted - preserve user's canvas size
                      fps: compositionContext.fps,
                      durationInFrames: result.composition?.durationInFrames ?? Math.round(durationInSeconds * compositionContext.fps),
                      tracks: result.tracks,
                      scenes, // Include scenes in the composition
                    };

                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ type: 'composition', data: compositionData })}\n\n`
                      )
                    );

                    const quality = result.quality;
                    const qualityNote = quality ? ` (Quality score: ${quality.overallScore}/100)` : '';
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ type: 'text', content: `\n✨ Video generated with ${result.videoPlan?.scenes.length ?? 0} scenes${qualityNote}.` })}\n\n`
                      )
                    );
                  } else {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ type: 'text', content: `Failed to generate video: ${result.error ?? 'Unknown error'}` })}\n\n`
                      )
                    );
                  }
                } catch (err) {
                  const errMsg = err instanceof Error ? err.message : String(err);
                  console.error('[ProductVideo] Error:', errMsg);

                  // Check for rate limit error and show clear message
                  let displayMsg = errMsg.slice(0, 200);
                  if (isRateLimitError(err) || (err instanceof SafeGenerateError && err.isRateLimitError)) {
                    displayMsg = '⚠️ AI rate limit exceeded. Please wait a moment and try again, or switch to a different model in Project Settings.';
                  }

                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: 'text', content: `Failed to generate video: ${displayMsg}` })}\n\n`
                    )
                  );
                }
                continue;
              }

              // Check if any call is generate_composition
              const genCall = functionCalls.find(
                (p) => p.functionCall?.name === 'generate_composition'
              );

              if (genCall && genCall.functionCall) {
                // Make second Gemini call for structured composition JSON
                const genArgs = genCall.functionCall.args as Record<string, unknown>;
                const description = genArgs.description as string;
                const genWidth = (genArgs.width as number) ?? compositionContext.width;
                const genHeight = (genArgs.height as number) ?? compositionContext.height;
                const genFps = (genArgs.fps as number) ?? compositionContext.fps;
                const genDuration = (genArgs.durationInFrames as number) ?? compositionContext.durationInFrames;

                const compositionResponse = await ai.models.generateContent({
                  model: modelId,
                  contents: `Generate a video composition JSON for: "${description}".

Target: ${genWidth}x${genHeight}, ${genFps}fps, ${genDuration} frames.

STRICT RULES:
- ONLY use type "text" for tracks and items. Do NOT generate "video", "audio", "image", or "component" types.
- Every item MUST have ALL of these fields: type, from, durationInFrames, text, fontSize, fontFamily, color, position.
- position MUST be an object with x and y (0-1 range). Example: {"x": 0.5, "y": 0.3}
- Use realistic text content, varied font sizes (64 for titles, 32 for subtitles, 24 for body).
- Use "Inter" as default fontFamily.
- Use hex colors (e.g. "#ffffff", "#000000").
- Make timing feel natural with staggered entrances across tracks.
- Each track should have a descriptive name (e.g. "Title Card", "Subtitle Text").`,
                  config: {
                    responseMimeType: 'application/json',
                    responseSchema: compositionJsonSchema as object,
                  },
                });

                const compositionText = compositionResponse.text;
                if (compositionText) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  let compositionData: any;
                  try {
                    compositionData = JSON.parse(compositionText);
                  } catch {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ type: 'text', content: 'Sorry, I had trouble generating the composition. Please try again.' })}\n\n`
                      )
                    );
                    continue;
                  }
                  // Normalize: ensure all items have required fields with defaults
                  if (compositionData.tracks) {
                    compositionData.tracks = compositionData.tracks
                      .filter((t: Record<string, unknown>) => t.type === 'text')
                      .map((track: Record<string, unknown>) => ({
                        ...track,
                        type: 'text',
                        locked: track.locked ?? false,
                        visible: track.visible ?? true,
                        items: Array.isArray(track.items)
                          ? (track.items as Record<string, unknown>[]).map((item) => ({
                              ...item,
                              type: 'text',
                              text: item.text ?? '',
                              fontSize: item.fontSize ?? 32,
                              fontFamily: item.fontFamily ?? 'Inter',
                              color: item.color ?? '#ffffff',
                              position: item.position ?? { x: 0.5, y: 0.5 },
                            }))
                          : [],
                      }));
                  }
                  // Remove width/height - AI should not change canvas dimensions
                  delete compositionData.width;
                  delete compositionData.height;
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: 'composition', data: compositionData })}\n\n`
                    )
                  );
                }
              } else {
                // Regular function calls
                const calls = functionCalls
                  .filter((p) => p.functionCall)
                  .map((p) => ({
                    name: p.functionCall!.name,
                    args: p.functionCall!.args,
                  }));

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'function_call', calls })}\n\n`
                  )
                );
              }
            } else {
              // Only access chunk.text when no function calls present
              const text = chunk.text;
              if (text) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'text', content: text })}\n\n`
                  )
                );
              }
            }
          }

          // Signal completion
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
          );
          controller.close();
        } catch (streamError) {
          console.error('Stream error:', streamError);

          // Check for rate limit errors and surface with clear message
          let errorMessage = 'Stream interrupted';
          if (streamError instanceof SafeGenerateError && streamError.isRateLimitError) {
            errorMessage = '⚠️ AI rate limit exceeded. Please wait a moment and try again, or switch to a different model in Project Settings.';
          } else if (isRateLimitError(streamError)) {
            errorMessage = '⚠️ AI rate limit exceeded. Please wait a moment and try again, or switch to a different model in Project Settings.';
          } else if (streamError instanceof Error) {
            errorMessage = streamError.message;
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', message: errorMessage })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);

    // Check for rate limit errors
    if (isRateLimitError(error) || (error instanceof SafeGenerateError && error.isRateLimitError)) {
      return NextResponse.json(
        { error: 'AI rate limit exceeded. Please wait a moment and try again, or switch to a different model in Project Settings.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
