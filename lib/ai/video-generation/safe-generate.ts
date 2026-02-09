/**
 * Safe Generate Wrapper for Gemini API Calls
 *
 * Provides:
 * 1. Native JSON mode with Zod schema validation
 * 2. Automatic retry with error feedback
 * 3. Structured error handling
 * 4. Token usage tracking for analytics
 */

import { z } from 'zod';
import { getAIClient } from '../client';
import { toJsonSchema } from '@/lib/component-discovery/schemas';
import { DEFAULT_MODEL } from '../models';

export interface SafeGenerateOptions {
  /** Max retry attempts (default: 2, so 3 total attempts) */
  maxRetries?: number;
  /** Temperature for generation (default: 0.7) */
  temperature?: number;
  /** Model to use (default: gemini-3-pro-preview) */
  model?: string;
  /** Thinking budget for complex tasks */
  thinkingBudget?: number;
}

export interface SafeGenerateResult<T> {
  data: T;
  tokenUsage: {
    input: number;
    output: number;
  };
  attempts: number;
}

export class SafeGenerateError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: unknown,
    public readonly zodErrors?: z.ZodError,
    public readonly isRateLimitError?: boolean
  ) {
    super(message);
    this.name = 'SafeGenerateError';
  }
}

/**
 * Check if an error is a rate limit / quota exhaustion error from Gemini API.
 */
export function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('resourceexhausted')
  );
}

/**
 * Safely generate structured output from Gemini with automatic retry and validation.
 *
 * @param prompt - The prompt to send to Gemini
 * @param schema - Zod schema to validate the response
 * @param options - Generation options
 * @returns Validated data matching the schema
 * @throws SafeGenerateError if all retries fail
 */
export async function safeGenerate<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  options: SafeGenerateOptions = {}
): Promise<SafeGenerateResult<T>> {
  const {
    maxRetries = 2,
    temperature = 0.7,
    model = DEFAULT_MODEL,
    thinkingBudget,
  } = options;

  const ai = getAIClient();
  const jsonSchema = toJsonSchema(schema);

  let lastError: unknown;
  let zodErrors: z.ZodError | undefined;
  let attempts = 0;
  let currentPrompt = prompt;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts = attempt + 1;

    try {
      const config: Record<string, unknown> = {
        responseMimeType: 'application/json',
        responseSchema: jsonSchema as object,
        temperature,
      };

      if (thinkingBudget) {
        config.thinkingConfig = { thinkingBudget };
      }

      const response = await ai.models.generateContent({
        model,
        contents: currentPrompt,
        config,
      });

      const text = response.text?.trim();
      if (!text) {
        throw new Error('Empty response from Gemini');
      }

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (parseError) {
        throw new Error(`Invalid JSON response: ${text.slice(0, 200)}`);
      }

      // Validate with Zod
      const result = schema.safeParse(parsed);
      if (!result.success) {
        zodErrors = result.error;
        throw result.error;
      }

      // Extract token usage from response metadata
      const usageMetadata = response.usageMetadata;
      const tokenUsage = {
        input: usageMetadata?.promptTokenCount ?? 0,
        output: usageMetadata?.candidatesTokenCount ?? 0,
      };

      return {
        data: result.data,
        tokenUsage,
        attempts,
      };
    } catch (error) {
      lastError = error;

      // Check if we should retry
      const isNetworkErr =
        error instanceof Error &&
        (error.message.includes('fetch failed') ||
          error.message.includes('ECONNRESET') ||
          error.message.includes('timeout'));

      const isZodError = error instanceof z.ZodError;
      const isRateLimit = isRateLimitError(error);

      // Don't retry rate limit errors - fail fast with clear message
      if (isRateLimit) {
        console.error(`[safeGenerate] Rate limit hit on attempt ${attempt + 1}`);
        throw new SafeGenerateError(
          'AI rate limit exceeded. Please wait a moment and try again, or switch to a different model.',
          attempts,
          error,
          undefined,
          true
        );
      }

      if (attempt < maxRetries) {
        if (isZodError) {
          // Append validation error to prompt for next attempt
          const zodError = error as import('zod').ZodError;
          const errorMessage = zodError.issues
            .map((e) => `${String(e.path.join('.'))}: ${e.message}`)
            .join('\n');

          currentPrompt = `${prompt}

IMPORTANT: Your previous response failed validation. Fix these issues:
${errorMessage}

Generate a valid response that matches the schema exactly.`;

          console.log(
            `[safeGenerate] Attempt ${attempt + 1} failed Zod validation, retrying with feedback...`
          );
        } else if (isNetworkErr) {
          // Wait before retry with exponential backoff
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          console.log(
            `[safeGenerate] Attempt ${attempt + 1} network error, retrying...`
          );
        } else {
          // Unknown error, wait briefly and retry
          await new Promise((r) => setTimeout(r, 500));
          console.log(
            `[safeGenerate] Attempt ${attempt + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}, retrying...`
          );
        }
        continue;
      }
    }
  }

  // All attempts failed
  throw new SafeGenerateError(
    `Failed after ${attempts} attempts: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`,
    attempts,
    lastError,
    zodErrors,
    isRateLimitError(lastError)
  );
}

/**
 * Safe generate with function calling (tools).
 * For agents that use tool calls instead of raw JSON.
 */
export async function safeGenerateWithTools<T>(
  prompt: string,
  systemPrompt: string,
  tools: object[],
  extractFn: (response: unknown) => T | null,
  options: SafeGenerateOptions = {}
): Promise<SafeGenerateResult<T>> {
  const {
    maxRetries = 2,
    temperature = 0.7,
    model = DEFAULT_MODEL,
  } = options;

  const ai = getAIClient();

  let lastError: unknown;
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts = attempt + 1;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations: tools }],
          temperature,
        },
      });

      const data = extractFn(response);
      if (data === null) {
        throw new Error('Failed to extract data from tool response');
      }

      const usageMetadata = response.usageMetadata;
      const tokenUsage = {
        input: usageMetadata?.promptTokenCount ?? 0,
        output: usageMetadata?.candidatesTokenCount ?? 0,
      };

      return {
        data,
        tokenUsage,
        attempts,
      };
    } catch (error) {
      lastError = error;

      const isNetworkErr =
        error instanceof Error &&
        (error.message.includes('fetch failed') ||
          error.message.includes('ECONNRESET') ||
          error.message.includes('timeout'));

      const isRateLimit = isRateLimitError(error);

      // Don't retry rate limit errors - fail fast with clear message
      if (isRateLimit) {
        console.error(`[safeGenerateWithTools] Rate limit hit on attempt ${attempt + 1}`);
        throw new SafeGenerateError(
          'AI rate limit exceeded. Please wait a moment and try again, or switch to a different model.',
          attempts,
          error,
          undefined,
          true
        );
      }

      if (attempt < maxRetries && isNetworkErr) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        console.log(
          `[safeGenerateWithTools] Attempt ${attempt + 1} network error, retrying...`
        );
        continue;
      }
    }
  }

  throw new SafeGenerateError(
    `Failed after ${attempts} attempts: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`,
    attempts,
    lastError,
    undefined,
    isRateLimitError(lastError)
  );
}
