/**
 * Remotion Lambda configuration module.
 *
 * Exports AWS Lambda configuration from environment variables
 * and quality presets for video export resolution scaling.
 */

import type { AwsRegion } from '@remotion/lambda/client';

// =============================================
// Types
// =============================================

export type QualityPreset = '720p' | '1080p' | '4K';

interface QualityPresetConfig {
  label: string;
  scale: number;
  description: string;
}

interface LambdaConfig {
  region: AwsRegion;
  functionName: string;
  serveUrl: string;
}

// =============================================
// Quality Presets
// =============================================

export const QUALITY_PRESETS: Record<QualityPreset, QualityPresetConfig> = {
  '720p': {
    label: '720p (HD)',
    scale: 0.667,
    description: 'Smaller file size, faster render',
  },
  '1080p': {
    label: '1080p (Full HD)',
    scale: 1.0,
    description: 'Recommended for most uses',
  },
  '4K': {
    label: '4K (Ultra HD)',
    scale: 2.0,
    description: 'Highest quality, larger file, slower render',
  },
} as const;

// =============================================
// Lambda Config
// =============================================

/**
 * Returns Remotion Lambda configuration from environment variables.
 *
 * Required env vars:
 * - REMOTION_AWS_REGION: AWS region (e.g., 'us-east-1')
 * - REMOTION_LAMBDA_FUNCTION_NAME: Deployed Lambda function name
 * - REMOTION_SERVE_URL: S3 URL of deployed Remotion bundle
 */
export function getLambdaConfig(): LambdaConfig {
  const region = process.env.REMOTION_AWS_REGION;
  const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
  const serveUrl = process.env.REMOTION_SERVE_URL;

  if (!region) {
    throw new Error('REMOTION_AWS_REGION environment variable is not set');
  }
  if (!functionName) {
    throw new Error(
      'REMOTION_LAMBDA_FUNCTION_NAME environment variable is not set'
    );
  }
  if (!serveUrl) {
    throw new Error('REMOTION_SERVE_URL environment variable is not set');
  }

  return {
    region: region as AwsRegion,
    functionName,
    serveUrl,
  };
}
