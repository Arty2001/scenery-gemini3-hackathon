import { NextRequest, NextResponse } from 'next/server';
import { getAIClient } from '@/lib/ai/client';
import { buildSystemPrompt, type CompositionContext } from '@/lib/ai/system-prompt';
import { compositionTools } from '@/lib/ai/composition-tools';
import { Type } from '@google/genai';
import { generateVideo, type ComponentInfo } from '@/lib/ai/video-generation';

interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface ChatRequest {
  messages: ChatMessage[];
  compositionContext: CompositionContext;
}

// JSON schema for composition generation (second Gemini call)
const compositionJsonSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    width: { type: Type.NUMBER },
    height: { type: Type.NUMBER },
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
  required: ['name', 'tracks', 'durationInFrames', 'fps', 'width', 'height'],
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

    const stream = await ai.models.generateContentStream({
      model: 'gemini-3-pro-preview',
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
                const durationInSeconds = Math.max(30, rawDuration);

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'text', content: '🎬 Starting multi-agent video generation...\n' })}\n\n`
                  )
                );

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
                      minQualityScore: 90,
                      maxRefinementIterations: 5,
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
                    const compositionData = {
                      name: result.videoPlan?.title ?? 'Generated Video',
                      width: compositionContext.width,
                      height: compositionContext.height,
                      fps: compositionContext.fps,
                      durationInFrames: result.composition?.durationInFrames ?? Math.round(durationInSeconds * compositionContext.fps),
                      tracks: result.tracks,
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
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: 'text', content: `Failed to generate video: ${errMsg.slice(0, 200)}` })}\n\n`
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
                  model: 'gemini-3-pro-preview',
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
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', message: 'Stream interrupted' })}\n\n`
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
