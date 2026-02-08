'use client';

import { AbsoluteFill, useVideoConfig } from 'remotion';
import type { ShapeItem } from '@/lib/composition/types';
import { useItemAnimation } from '@/components/remotion/animation/use-item-animation';
import { useKeyframeAnimation } from '@/components/remotion/animation/use-keyframe-animation';
import { buildFilterStyle, buildSkewTransform, buildShadowStyle } from '@/components/remotion/animation/build-styles';

interface ShapeItemRendererProps {
  item: ShapeItem;
}

function getTranslatePercent(position: number): string {
  return `${-position * 100}%`;
}

export function ShapeItemRenderer({ item }: ShapeItemRendererProps) {
  const animStyle = useItemAnimation(item.enterAnimation, item.exitAnimation, item.durationInFrames);
  const kf = useKeyframeAnimation(item.keyframes);
  const { width: compWidth, height: compHeight } = useVideoConfig();

  const posX = kf.positionX ?? item.position?.x ?? 0.5;
  const posY = kf.positionY ?? item.position?.y ?? 0.5;
  const kfWidth = kf.width ?? item.width ?? 0.1;
  const kfHeight = kf.height ?? item.height ?? 0.1;
  const kfOpacity = kf.opacity ?? item.opacity ?? 1;
  const kfScale = kf.scale ?? 1;
  const kfRotation = kf.rotation ?? 0;
  const kfBorderRadius = kf.borderRadius ?? item.borderRadius ?? 0;
  const kfStrokeWidth = kf.strokeWidth ?? item.strokeWidth ?? 2;
  const w = kfWidth * compWidth;
  const h = kfHeight * compHeight;

  // Build advanced styles from keyframes
  const filterStyle = buildFilterStyle(kf);
  const skewTransform = buildSkewTransform(kf);
  const shadowStyle = buildShadowStyle(kf);

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${posX * 100}%`,
    top: `${posY * 100}%`,
    transform: [
      `translate(${getTranslatePercent(posX)}, ${getTranslatePercent(posY)})`,
      kfScale !== 1 ? `scale(${kfScale})` : '',
      kfRotation !== 0 ? `rotate(${kfRotation}deg)` : '',
      skewTransform,
    ].filter(Boolean).join(' '),
    width: w,
    height: h,
    opacity: kfOpacity * (animStyle.opacity ?? 1),
    filter: filterStyle !== 'none' ? filterStyle : undefined,
    boxShadow: shadowStyle,
  };

  switch (item.shapeType) {
    case 'rectangle':
      return (
        <AbsoluteFill>
          <div
            style={{
              ...baseStyle,
              backgroundColor: item.fill ?? '#ffffff',
              borderRadius: kfBorderRadius,
              border: item.stroke ? `${kfStrokeWidth}px solid ${item.stroke}` : undefined,
            }}
          />
        </AbsoluteFill>
      );

    case 'circle':
      return (
        <AbsoluteFill>
          <div
            style={{
              ...baseStyle,
              backgroundColor: item.fill ?? '#ffffff',
              borderRadius: '50%',
              border: item.stroke ? `${kfStrokeWidth}px solid ${item.stroke}` : undefined,
            }}
          />
        </AbsoluteFill>
      );

    case 'line':
    case 'divider':
      return (
        <AbsoluteFill>
          <div
            style={{
              ...baseStyle,
              backgroundColor: item.fill ?? '#ffffff',
              borderRadius: kfBorderRadius,
            }}
          />
        </AbsoluteFill>
      );

    case 'gradient':
      return (
        <AbsoluteFill>
          <div
            style={{
              ...baseStyle,
              background: `linear-gradient(${item.gradientDirection ?? 135}deg, ${item.gradientFrom ?? '#6366f1'}, ${item.gradientTo ?? '#06b6d4'})`,
              borderRadius: kfBorderRadius,
            }}
          />
        </AbsoluteFill>
      );

    case 'svg': {
      // progress keyframe (0-1) drives stroke-dashoffset for draw-on animation
      const progress = kf.progress ?? 1;
      // Very large dasharray — works for any path length up to 5000px
      const dashTotal = 5000;
      const dashOffset = dashTotal * (1 - progress);

      return (
        <AbsoluteFill>
          <div
            style={{
              ...baseStyle,
              overflow: 'visible',
            }}
          >
            <svg
              viewBox={item.viewBox ?? `0 0 ${w} ${h}`}
              width={w}
              height={h}
              style={{ overflow: 'visible' }}
              dangerouslySetInnerHTML={{
                __html: (item.svgContent ?? '').replace(
                  /(<(?:path|line|polyline|polygon|circle|ellipse|rect)\b)/gi,
                  `$1 stroke-dasharray="${dashTotal}" stroke-dashoffset="${dashOffset}"`
                ),
              }}
            />
          </div>
        </AbsoluteFill>
      );
    }

    case 'badge': {
      // Badges auto-size to text content — ignore width/height from AI to keep them compact
      const badgeFontSize = item.fontSize ?? 13;
      return (
        <AbsoluteFill>
          <div
            style={{
              position: 'absolute',
              left: `${posX * 100}%`,
              top: `${posY * 100}%`,
              transform: [
                `translate(${getTranslatePercent(posX)}, ${getTranslatePercent(posY)})`,
                kfScale !== 1 ? `scale(${kfScale})` : '',
                kfRotation !== 0 ? `rotate(${kfRotation}deg)` : '',
              ].filter(Boolean).join(' '),
              opacity: kfOpacity * (animStyle.opacity ?? 1),
              backgroundColor: item.fill ?? '#6366f1',
              borderRadius: item.borderRadius ?? 999,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: `${Math.round(badgeFontSize * 0.4)}px ${Math.round(badgeFontSize * 0.9)}px`,
              border: item.stroke ? `${item.strokeWidth ?? 1}px solid ${item.stroke}` : undefined,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              whiteSpace: 'nowrap',
            }}
          >
            {item.text && (
              <span
                style={{
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: badgeFontSize,
                  fontWeight: 700,
                  color: item.color ?? '#ffffff',
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  lineHeight: 1,
                }}
              >
                {item.text}
              </span>
            )}
          </div>
        </AbsoluteFill>
      );
    }

    default:
      return null;
  }
}
