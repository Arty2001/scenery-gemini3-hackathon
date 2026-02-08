/**
 * Available Gemini AI Models
 *
 * This centralizes model configuration so it can be changed per-project.
 * Model names must match exactly what the Google GenAI API expects.
 */

export type GeminiModelId =
  | 'gemini-3-pro-preview'
  | 'gemini-3-flash-preview'
  | 'gemini-2.5-flash-preview-tts';

export interface GeminiModel {
  id: GeminiModelId;
  name: string;
  description: string;
  /** Best use cases for this model */
  bestFor: string[];
  /** Whether this model is recommended as default */
  isDefault?: boolean;
  /** Special capabilities */
  capabilities?: string[];
}

/**
 * Available models for video generation and chat
 * TTS model is separate and not selectable for general use
 */
export const AVAILABLE_MODELS: GeminiModel[] = [
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro',
    description: 'Most capable model for complex reasoning',
    bestFor: ['Complex video generation', 'Detailed scene planning', 'High-quality refinement'],
    isDefault: true,
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
    description: 'Fast, efficient model for most tasks',
    bestFor: ['Quick iterations', 'Component analysis', 'General chat'],
  },
];

/**
 * TTS-specific model (not user-selectable)
 */
export const TTS_MODEL: GeminiModelId = 'gemini-2.5-flash-preview-tts';

/**
 * Default model for new projects
 */
export const DEFAULT_MODEL: GeminiModelId = 'gemini-3-pro-preview';

/**
 * Get model info by ID
 */
export function getModelInfo(modelId: GeminiModelId): GeminiModel | undefined {
  return AVAILABLE_MODELS.find((m) => m.id === modelId);
}

/**
 * Validate that a model ID is valid
 */
export function isValidModelId(modelId: string): modelId is GeminiModelId {
  return AVAILABLE_MODELS.some((m) => m.id === modelId);
}

/**
 * Get model ID with fallback to default
 */
export function getModelIdOrDefault(modelId: string | null | undefined): GeminiModelId {
  if (modelId && isValidModelId(modelId)) {
    return modelId;
  }
  return DEFAULT_MODEL;
}
