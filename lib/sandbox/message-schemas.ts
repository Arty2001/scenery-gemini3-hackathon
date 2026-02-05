/**
 * Zod schemas for sandbox message validation
 *
 * These schemas provide runtime validation for postMessage payloads,
 * ensuring type safety when communicating between parent and iframe.
 *
 * Test: validateMessage({ type: 'READY', componentId: 'test' }) should return valid message
 * Test: validateMessage({ type: 'INVALID' }) should return null
 */

import { z } from 'zod';
import type {
  SandboxMessage,
  PropUpdateMessage,
  ThumbnailRequestMessage,
  ThumbnailResponseMessage,
  ReadyMessage,
  ErrorMessage,
  ThumbnailCaptureOptions,
} from './types';

// ============================================================================
// Individual Message Schemas
// ============================================================================

/**
 * Schema for thumbnail capture options
 */
export const thumbnailCaptureOptionsSchema = z.object({
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  pixelRatio: z.number().positive().max(4).optional(),
  format: z.enum(['png', 'jpeg', 'svg']).optional(),
  quality: z.number().min(0).max(1).optional(),
  cacheBust: z.boolean().optional(),
});

/**
 * Schema for prop update messages
 * Parent sends new props to iframe
 */
export const propUpdateSchema = z.object({
  type: z.literal('PROP_UPDATE'),
  props: z.record(z.string(), z.unknown()),
});

/**
 * Schema for thumbnail request messages
 * Parent requests thumbnail capture from iframe
 */
export const thumbnailRequestSchema = z.object({
  type: z.literal('THUMBNAIL_REQUEST'),
  requestId: z.string().min(1),
  options: thumbnailCaptureOptionsSchema.optional(),
});

/**
 * Schema for thumbnail response messages
 * Iframe returns captured thumbnail to parent
 */
export const thumbnailResponseSchema = z.object({
  type: z.literal('THUMBNAIL_RESPONSE'),
  requestId: z.string().min(1),
  dataUrl: z.string(),
  error: z.string().optional(),
});

/**
 * Schema for ready messages
 * Iframe signals component has rendered
 */
export const readySchema = z.object({
  type: z.literal('READY'),
  componentId: z.string().min(1),
});

/**
 * Schema for error messages
 * Iframe reports rendering errors
 */
export const errorSchema = z.object({
  type: z.literal('ERROR'),
  componentId: z.string().min(1),
  error: z.string(),
  stack: z.string().optional(),
});

// ============================================================================
// Combined Schema with Discriminated Union
// ============================================================================

/**
 * Combined schema for all sandbox messages
 * Uses discriminated union on 'type' field for efficient parsing
 */
export const sandboxMessageSchema = z.discriminatedUnion('type', [
  propUpdateSchema,
  thumbnailRequestSchema,
  thumbnailResponseSchema,
  readySchema,
  errorSchema,
]);

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type PropUpdateSchemaType = z.infer<typeof propUpdateSchema>;
export type ThumbnailRequestSchemaType = z.infer<typeof thumbnailRequestSchema>;
export type ThumbnailResponseSchemaType = z.infer<typeof thumbnailResponseSchema>;
export type ReadySchemaType = z.infer<typeof readySchema>;
export type ErrorSchemaType = z.infer<typeof errorSchema>;
export type SandboxMessageSchemaType = z.infer<typeof sandboxMessageSchema>;
export type ThumbnailCaptureOptionsSchemaType = z.infer<typeof thumbnailCaptureOptionsSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates an unknown message payload and returns typed message or null
 *
 * @param data - Unknown data to validate
 * @returns Validated SandboxMessage or null if invalid
 *
 * @example
 * const message = validateMessage(event.data);
 * if (message && message.type === 'PROP_UPDATE') {
 *   // TypeScript knows message.props exists
 *   updateProps(message.props);
 * }
 */
export function validateMessage(data: unknown): SandboxMessage | null {
  const result = sandboxMessageSchema.safeParse(data);
  if (result.success) {
    return result.data as SandboxMessage;
  }
  return null;
}

/**
 * Validates an unknown message and throws on failure
 *
 * @param data - Unknown data to validate
 * @returns Validated SandboxMessage
 * @throws ZodError if validation fails
 */
export function parseMessage(data: unknown): SandboxMessage {
  return sandboxMessageSchema.parse(data) as SandboxMessage;
}

/**
 * Checks if an origin is valid for message handling
 *
 * In development, all origins are allowed.
 * In production, validates against allowed origins list.
 *
 * @param origin - The origin to validate
 * @param allowedOrigins - List of allowed origins (empty = allow all in dev)
 * @returns Whether the origin is valid
 */
export function isValidOrigin(
  origin: string,
  allowedOrigins: string[] = []
): boolean {
  // In development, allow all origins for easier testing
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // If no allowed origins specified, only allow same origin
  if (allowedOrigins.length === 0) {
    return origin === window.location.origin;
  }

  // Check against allowed origins list
  return allowedOrigins.includes(origin);
}

/**
 * Type guard for PropUpdateMessage
 */
export function isPropUpdateMessage(
  message: SandboxMessage
): message is PropUpdateMessage {
  return message.type === 'PROP_UPDATE';
}

/**
 * Type guard for ThumbnailRequestMessage
 */
export function isThumbnailRequestMessage(
  message: SandboxMessage
): message is ThumbnailRequestMessage {
  return message.type === 'THUMBNAIL_REQUEST';
}

/**
 * Type guard for ThumbnailResponseMessage
 */
export function isThumbnailResponseMessage(
  message: SandboxMessage
): message is ThumbnailResponseMessage {
  return message.type === 'THUMBNAIL_RESPONSE';
}

/**
 * Type guard for ReadyMessage
 */
export function isReadyMessage(
  message: SandboxMessage
): message is ReadyMessage {
  return message.type === 'READY';
}

/**
 * Type guard for ErrorMessage
 */
export function isErrorMessage(
  message: SandboxMessage
): message is ErrorMessage {
  return message.type === 'ERROR';
}
