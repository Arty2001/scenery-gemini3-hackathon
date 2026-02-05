/**
 * File validation utilities for asset uploads.
 * Validates MIME types and file sizes before upload.
 */

// =============================================
// Allowed MIME Types
// =============================================

export const ALLOWED_VIDEO = ['video/mp4', 'video/webm'] as const;
export const ALLOWED_AUDIO = ['audio/mpeg', 'audio/wav', 'audio/ogg'] as const;
export const ALLOWED_IMAGE = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
] as const;

const ALL_ALLOWED = [
  ...ALLOWED_VIDEO,
  ...ALLOWED_AUDIO,
  ...ALLOWED_IMAGE,
] as const;

// =============================================
// Size Limits
// =============================================

/** Maximum file size: 100 MB */
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

// =============================================
// Validation
// =============================================

/**
 * Validate a file for upload.
 * Checks MIME type against allowed lists and enforces size limit.
 */
export function validateAssetFile(file: File): {
  valid: boolean;
  error?: string;
} {
  if (!ALL_ALLOWED.includes(file.type as (typeof ALL_ALLOWED)[number])) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.type || 'unknown'}. Allowed: MP4, WebM, MP3, WAV, OGG, PNG, JPEG, WebP, SVG.`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File too large (${sizeMB} MB). Maximum size is 100 MB.`,
    };
  }

  return { valid: true };
}

/**
 * Determine asset type from MIME type.
 * Returns 'video', 'audio', 'image', or null if unsupported.
 */
export function getAssetType(
  mimeType: string
): 'video' | 'audio' | 'image' | null {
  if (ALLOWED_VIDEO.includes(mimeType as (typeof ALLOWED_VIDEO)[number]))
    return 'video';
  if (ALLOWED_AUDIO.includes(mimeType as (typeof ALLOWED_AUDIO)[number]))
    return 'audio';
  if (ALLOWED_IMAGE.includes(mimeType as (typeof ALLOWED_IMAGE)[number]))
    return 'image';
  return null;
}
