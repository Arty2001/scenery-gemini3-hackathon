/**
 * Style builders for advanced motion graphics
 * These utilities build CSS strings from keyframe values for filters, transforms, and shadows
 */

/**
 * Build CSS filter string from keyframe values
 * Supports: blur, brightness, contrast, saturate, hueRotate
 */
export function buildFilterStyle(kf: Record<string, number>): string {
  const filters: string[] = [];

  if (kf.blur != null && kf.blur !== 0) {
    filters.push(`blur(${kf.blur}px)`);
  }
  if (kf.brightness != null && kf.brightness !== 1) {
    filters.push(`brightness(${kf.brightness})`);
  }
  if (kf.contrast != null && kf.contrast !== 1) {
    filters.push(`contrast(${kf.contrast})`);
  }
  if (kf.saturate != null && kf.saturate !== 1) {
    filters.push(`saturate(${kf.saturate})`);
  }
  if (kf.hueRotate != null && kf.hueRotate !== 0) {
    filters.push(`hue-rotate(${kf.hueRotate}deg)`);
  }

  return filters.length > 0 ? filters.join(' ') : 'none';
}

/**
 * Build additional transform string from keyframe values
 * Supports: skewX, skewY (to be appended to existing transforms)
 */
export function buildSkewTransform(kf: Record<string, number>): string {
  const transforms: string[] = [];

  if (kf.skewX != null && kf.skewX !== 0) {
    transforms.push(`skewX(${kf.skewX}deg)`);
  }
  if (kf.skewY != null && kf.skewY !== 0) {
    transforms.push(`skewY(${kf.skewY}deg)`);
  }

  return transforms.join(' ');
}

/**
 * Build CSS box-shadow string from keyframe values
 * Supports: shadowBlur, shadowOffsetX, shadowOffsetY, shadowOpacity
 */
export function buildShadowStyle(
  kf: Record<string, number>,
  defaultColor: string = 'rgba(0,0,0,0.5)'
): string | undefined {
  // Only build shadow if at least one shadow property is set
  if (
    kf.shadowBlur == null &&
    kf.shadowOffsetX == null &&
    kf.shadowOffsetY == null &&
    kf.shadowOpacity == null
  ) {
    return undefined;
  }

  const blur = kf.shadowBlur ?? 10;
  const x = kf.shadowOffsetX ?? 0;
  const y = kf.shadowOffsetY ?? 4;
  const opacity = kf.shadowOpacity ?? 0.5;

  return `${x}px ${y}px ${blur}px rgba(0,0,0,${opacity})`;
}

/**
 * Build text-specific styles from keyframe values
 * Supports: letterSpacing, wordSpacing
 */
export function buildTextStyles(kf: Record<string, number>): React.CSSProperties {
  const styles: React.CSSProperties = {};

  if (kf.letterSpacing != null) {
    styles.letterSpacing = `${kf.letterSpacing}px`;
  }
  if (kf.wordSpacing != null) {
    styles.wordSpacing = `${kf.wordSpacing}px`;
  }

  return styles;
}

/**
 * Combine all style builders into a single style object
 * Useful for applying all effects at once
 */
export function buildAllStyles(
  kf: Record<string, number>,
  baseTransform: string = ''
): {
  filter: string;
  transform: string;
  boxShadow: string | undefined;
  textStyles: React.CSSProperties;
} {
  const filterStyle = buildFilterStyle(kf);
  const skewTransform = buildSkewTransform(kf);
  const shadowStyle = buildShadowStyle(kf);
  const textStyles = buildTextStyles(kf);

  // Combine base transform with skew
  const transforms = [baseTransform, skewTransform].filter(Boolean).join(' ');

  return {
    filter: filterStyle,
    transform: transforms || 'none',
    boxShadow: shadowStyle,
    textStyles,
  };
}

/**
 * Check if any filter effects are applied
 */
export function hasFilterEffects(kf: Record<string, number>): boolean {
  return (
    (kf.blur != null && kf.blur !== 0) ||
    (kf.brightness != null && kf.brightness !== 1) ||
    (kf.contrast != null && kf.contrast !== 1) ||
    (kf.saturate != null && kf.saturate !== 1) ||
    (kf.hueRotate != null && kf.hueRotate !== 0)
  );
}

/**
 * Check if any shadow effects are applied
 */
export function hasShadowEffects(kf: Record<string, number>): boolean {
  return (
    kf.shadowBlur != null ||
    kf.shadowOffsetX != null ||
    kf.shadowOffsetY != null ||
    kf.shadowOpacity != null
  );
}
