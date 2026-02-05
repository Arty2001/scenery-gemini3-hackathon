import { generateVoiceover, createWavBuffer, pcmDurationSeconds } from './tts';
import { createClient } from '@/lib/supabase/server';

export interface SectionNarration {
  audioUrl: string;
  durationInSeconds: number;
}

/**
 * Generate TTS voiceover for each section and upload to Supabase storage.
 * Returns a Map keyed by section index for reliable lookup.
 * Skips sections where TTS fails (graceful degradation).
 */
export async function generateSectionNarrations(
  sections: Array<{ index: number; narrationScript: string }>,
  projectId: string,
  voiceName?: string,
  onProgress?: (current: number, total: number) => void,
): Promise<Map<number, SectionNarration>> {
  const results = new Map<number, SectionNarration>();
  const supabase = await createClient();

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    onProgress?.(i + 1, sections.length);

    try {
      // Generate PCM audio
      const pcmData = await generateVoiceover(
        section.narrationScript,
        voiceName ?? 'Kore',
      );

      // Create WAV and measure duration
      const wavBuffer = createWavBuffer(pcmData);
      const durationInSeconds = pcmDurationSeconds(pcmData);

      // Upload to Supabase storage
      const storagePath = `${projectId}/voiceover-${Date.now()}-${section.index}.wav`;
      const { error: uploadError } = await supabase.storage
        .from('project-assets')
        .upload(storagePath, wavBuffer, {
          contentType: 'audio/wav',
          upsert: false,
        });

      if (uploadError) {
        console.error(`Failed to upload narration for section ${section.index}:`, uploadError);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('project-assets')
        .getPublicUrl(storagePath);

      results.set(section.index, {
        audioUrl: urlData.publicUrl,
        durationInSeconds,
      });
    } catch (error) {
      console.error(`TTS failed for section ${section.index}:`, error);
      // Skip this section — video will use AI-suggested duration instead
    }
  }

  return results;
}
