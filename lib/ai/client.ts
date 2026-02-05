import { GoogleGenAI } from '@google/genai';

// Lazy initialization of shared AI client
let aiClient: GoogleGenAI | null = null;

export function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: 900_000 }, // 15 minute timeout
    });
  }
  return aiClient;
}
