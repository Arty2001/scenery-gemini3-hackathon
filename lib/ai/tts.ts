import { getAIClient } from './client';

/**
 * Generate voiceover audio from text using Gemini TTS.
 * Returns raw PCM audio data (24kHz, 16-bit, mono) as a Buffer.
 */
export async function generateVoiceover(
  text: string,
  voiceName: string = 'Kore'
): Promise<Buffer> {
  const ai = getAIClient();

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ role: 'user', parts: [{ text }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName,
          },
        },
      },
    },
  });

  // Search all parts for audio data (not always in part 0)
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  let audioData: string | undefined;
  for (const part of parts) {
    if (part.inlineData?.data) {
      audioData = part.inlineData.data;
      break;
    }
  }

  if (!audioData) {
    // Log full response structure for debugging
    const candidate = response.candidates?.[0];
    console.error('Gemini TTS: no audio in response.', JSON.stringify({
      finishReason: candidate?.finishReason,
      partsCount: parts.length,
      partTypes: parts.map(p => Object.keys(p)),
      hasContent: !!candidate?.content,
    }));
    throw new Error('No audio data returned from Gemini TTS');
  }

  return Buffer.from(audioData, 'base64');
}

/**
 * Build a WAV file buffer from raw PCM data.
 * Assumes 24kHz, 16-bit, mono PCM.
 */
export function createWavBuffer(pcmData: Buffer): Buffer {
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const headerSize = 44;

  const header = Buffer.alloc(headerSize);

  header.write('RIFF', 0);
  header.writeUInt32LE(dataSize + headerSize - 8, 4);
  header.write('WAVE', 8);

  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

/**
 * Calculate audio duration from PCM data length.
 * PCM: 24kHz, 16-bit (2 bytes per sample), mono.
 */
export function pcmDurationSeconds(pcmData: Buffer): number {
  return Math.max(0.1, pcmData.length / (24000 * 2));
}
