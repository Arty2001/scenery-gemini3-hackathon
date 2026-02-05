import { NextRequest, NextResponse } from 'next/server';
import { generateVoiceover, createWavBuffer, pcmDurationSeconds } from '@/lib/ai/tts';
import { createClient } from '@/lib/supabase/server';

interface TTSRequest {
  text: string;
  voiceName?: string;
  projectId: string;
  compositionId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TTSRequest;
    const { text, voiceName, projectId, compositionId } = body;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    // Check API key availability
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 }
      );
    }

    // Generate voiceover audio (raw PCM)
    const pcmData = await generateVoiceover(text, voiceName);

    // Create WAV file
    const wavBuffer = createWavBuffer(pcmData);

    const durationInSeconds = pcmDurationSeconds(pcmData);

    // Upload to Supabase Storage
    const supabase = await createClient();
    const timestamp = Date.now();
    const storagePath = `${projectId}/voiceover-${timestamp}.wav`;

    const { error: uploadError } = await supabase.storage
      .from('project-assets')
      .upload(storagePath, wavBuffer, {
        contentType: 'audio/wav',
        upsert: false,
      });

    if (uploadError) {
      console.error('Failed to upload voiceover:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload audio file' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('project-assets')
      .getPublicUrl(storagePath);

    return NextResponse.json({
      url: urlData.publicUrl,
      durationInSeconds,
    });
  } catch (error) {
    console.error('TTS generation failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate voiceover' },
      { status: 500 }
    );
  }
}
