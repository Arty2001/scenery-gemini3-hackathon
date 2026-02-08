/**
 * Custom scene transition presentations for Remotion.
 * Inspired by Remotion Lambda trailer patterns.
 *
 * - Curtain: Two panels slide apart to reveal content
 * - Wheel: Rotational swing effect
 * - Flip: 3D card flip between scenes
 */

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from 'remotion';
import type { TransitionPresentation, TransitionPresentationComponentProps } from '@remotion/transitions';

// =============================================
// Curtain Transition
// =============================================

interface CurtainProps {
  direction?: 'horizontal' | 'vertical';
  [key: string]: unknown;
}

const CurtainPresentation: React.FC<TransitionPresentationComponentProps<CurtainProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  const direction = passedProps?.direction ?? 'horizontal';
  const isHorizontal = direction === 'horizontal';
  const isEntering = presentationDirection === 'entering';

  // For exiting scene: curtain closes (panels come together)
  // For entering scene: curtain opens (panels slide apart)
  const progress = isEntering ? presentationProgress : 1 - presentationProgress;

  // Panels slide from center outward (or inward for exit)
  const panelOffset = interpolate(progress, [0, 1], [0, 50]);

  return (
    <AbsoluteFill>
      {/* Content underneath */}
      {children}

      {/* Curtain panels overlay (only for exiting scene) */}
      {!isEntering && (
        <>
          {/* Left/Top panel */}
          <AbsoluteFill
            style={{
              backgroundColor: '#000',
              transform: isHorizontal
                ? `translateX(${-50 + panelOffset}%)`
                : `translateY(${-50 + panelOffset}%)`,
              ...(isHorizontal ? { width: '50%' } : { height: '50%' }),
            }}
          />
          {/* Right/Bottom panel */}
          <AbsoluteFill
            style={{
              backgroundColor: '#000',
              transform: isHorizontal
                ? `translateX(${50 - panelOffset}%)`
                : `translateY(${50 - panelOffset}%)`,
              ...(isHorizontal
                ? { left: '50%', width: '50%' }
                : { top: '50%', height: '50%' }),
            }}
          />
        </>
      )}
    </AbsoluteFill>
  );
};

export const curtain = (props?: CurtainProps): TransitionPresentation<CurtainProps> => ({
  component: CurtainPresentation,
  props: props ?? { direction: 'horizontal' },
});

// =============================================
// Wheel Transition
// =============================================

interface WheelProps {
  direction?: 'clockwise' | 'counter-clockwise';
  [key: string]: unknown;
}

const WheelPresentation: React.FC<TransitionPresentationComponentProps<WheelProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  const direction = passedProps?.direction ?? 'clockwise';
  const isEntering = presentationDirection === 'entering';

  // Rotation amount (0 to 90 degrees)
  const rotationSign = direction === 'clockwise' ? 1 : -1;
  const rotation = isEntering
    ? interpolate(presentationProgress, [0, 1], [-90 * rotationSign, 0], {
        easing: Easing.out(Easing.cubic),
      })
    : interpolate(presentationProgress, [0, 1], [0, 90 * rotationSign], {
        easing: Easing.in(Easing.cubic),
      });

  // Scale slightly during rotation for depth effect
  const scale = interpolate(
    Math.abs(rotation),
    [0, 45, 90],
    [1, 0.9, 0.8]
  );

  // Opacity for smoother transition
  const opacity = interpolate(
    Math.abs(rotation),
    [0, 60, 90],
    [1, 0.8, 0]
  );

  return (
    <AbsoluteFill
      style={{
        transform: `rotate(${rotation}deg) scale(${scale})`,
        transformOrigin: 'center center',
        opacity,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const wheel = (props?: WheelProps): TransitionPresentation<WheelProps> => ({
  component: WheelPresentation,
  props: props ?? { direction: 'clockwise' },
});

// =============================================
// Flip Transition
// =============================================

interface FlipProps {
  direction?: 'horizontal' | 'vertical';
  [key: string]: unknown;
}

const FlipPresentation: React.FC<TransitionPresentationComponentProps<FlipProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  const direction = passedProps?.direction ?? 'horizontal';
  const isEntering = presentationDirection === 'entering';
  const isHorizontal = direction === 'horizontal';

  // Flip rotation (0 to 180 degrees)
  // Entering: start at -180, end at 0
  // Exiting: start at 0, end at 180
  const rotation = isEntering
    ? interpolate(presentationProgress, [0, 1], [-180, 0], {
        easing: Easing.inOut(Easing.cubic),
      })
    : interpolate(presentationProgress, [0, 1], [0, 180], {
        easing: Easing.inOut(Easing.cubic),
      });

  // Hide backface when rotated past 90 degrees
  const isVisible = Math.abs(rotation) < 90;

  // Scale down slightly at peak rotation for depth
  const scale = interpolate(
    Math.abs(rotation),
    [0, 90, 180],
    [1, 0.85, 1]
  );

  return (
    <AbsoluteFill
      style={{
        perspective: '1200px',
        perspectiveOrigin: 'center center',
      }}
    >
      <AbsoluteFill
        style={{
          transform: isHorizontal
            ? `rotateY(${rotation}deg) scale(${scale})`
            : `rotateX(${rotation}deg) scale(${scale})`,
          backfaceVisibility: 'hidden',
          opacity: isVisible ? 1 : 0,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const flip = (props?: FlipProps): TransitionPresentation<FlipProps> => ({
  component: FlipPresentation,
  props: props ?? { direction: 'horizontal' },
});

// =============================================
// Wipe Transition
// =============================================

interface WipeProps {
  direction?: 'left' | 'right' | 'up' | 'down';
  [key: string]: unknown;
}

const WipePresentation: React.FC<TransitionPresentationComponentProps<WipeProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  const direction = passedProps?.direction ?? 'left';
  const isEntering = presentationDirection === 'entering';

  // Wipe progress (0% to 100% reveal)
  const progress = isEntering ? presentationProgress : 1 - presentationProgress;

  // Calculate clip-path based on direction
  let clipPath: string;
  switch (direction) {
    case 'right':
      clipPath = `inset(0 ${(1 - progress) * 100}% 0 0)`;
      break;
    case 'left':
      clipPath = `inset(0 0 0 ${(1 - progress) * 100}%)`;
      break;
    case 'down':
      clipPath = `inset(0 0 ${(1 - progress) * 100}% 0)`;
      break;
    case 'up':
      clipPath = `inset(${(1 - progress) * 100}% 0 0 0)`;
      break;
    default:
      clipPath = 'none';
  }

  return (
    <AbsoluteFill
      style={{
        clipPath: isEntering ? clipPath : undefined,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const wipe = (props?: WipeProps): TransitionPresentation<WipeProps> => ({
  component: WipePresentation,
  props: props ?? { direction: 'left' },
});

// =============================================
// Zoom Transition
// =============================================

interface ZoomProps {
  direction?: 'in' | 'out';
  [key: string]: unknown;
}

const ZoomPresentation: React.FC<TransitionPresentationComponentProps<ZoomProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  const direction = passedProps?.direction ?? 'in';
  const isEntering = presentationDirection === 'entering';
  const isZoomIn = direction === 'in';

  // Zoom scale
  const startScale = isZoomIn ? 0.5 : 1.5;
  const endScale = 1;

  const scale = isEntering
    ? interpolate(presentationProgress, [0, 1], [startScale, endScale], {
        easing: Easing.out(Easing.cubic),
      })
    : interpolate(presentationProgress, [0, 1], [endScale, isZoomIn ? 1.5 : 0.5], {
        easing: Easing.in(Easing.cubic),
      });

  const opacity = isEntering
    ? interpolate(presentationProgress, [0, 0.3, 1], [0, 1, 1])
    : interpolate(presentationProgress, [0, 0.7, 1], [1, 1, 0]);

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        opacity,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const zoom = (props?: ZoomProps): TransitionPresentation<ZoomProps> => ({
  component: ZoomPresentation,
  props: props ?? { direction: 'in' },
});

// =============================================
// Motion Blur Transition
// =============================================

interface MotionBlurProps {
  direction?: 'left' | 'right' | 'up' | 'down';
  intensity?: number; // 1-3, default 2
  [key: string]: unknown;
}

const MotionBlurPresentation: React.FC<TransitionPresentationComponentProps<MotionBlurProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  const direction = passedProps?.direction ?? 'left';
  const intensity = passedProps?.intensity ?? 2;
  const isEntering = presentationDirection === 'entering';

  // Calculate blur amount - peaks in the middle of transition
  // Use a bell curve: blur is max at progress=0.5
  const blurPeak = intensity * 12; // 12px, 24px, or 36px max blur
  const blurAmount = interpolate(
    presentationProgress,
    [0, 0.3, 0.5, 0.7, 1],
    isEntering ? [blurPeak, blurPeak * 0.8, blurPeak * 0.4, blurPeak * 0.1, 0] : [0, blurPeak * 0.3, blurPeak * 0.6, blurPeak * 0.9, blurPeak],
    { easing: Easing.inOut(Easing.quad) }
  );

  // Directional offset - simulates motion in the direction
  const offsetDistance = intensity * 30; // 30px, 60px, or 90px offset
  let translateX = 0;
  let translateY = 0;

  const offsetProgress = isEntering
    ? interpolate(presentationProgress, [0, 1], [offsetDistance, 0], {
        easing: Easing.out(Easing.cubic),
      })
    : interpolate(presentationProgress, [0, 1], [0, -offsetDistance], {
        easing: Easing.in(Easing.cubic),
      });

  switch (direction) {
    case 'left':
      translateX = -offsetProgress;
      break;
    case 'right':
      translateX = offsetProgress;
      break;
    case 'up':
      translateY = -offsetProgress;
      break;
    case 'down':
      translateY = offsetProgress;
      break;
  }

  // Opacity fade for smoother transition
  const opacity = isEntering
    ? interpolate(presentationProgress, [0, 0.3, 1], [0, 0.8, 1])
    : interpolate(presentationProgress, [0, 0.7, 1], [1, 0.8, 0]);

  // Apply directional blur using SVG filter for better quality
  // CSS blur is omnidirectional, so we use a combination of blur + slight scale stretch
  const isHorizontal = direction === 'left' || direction === 'right';
  const scaleStretch = 1 + (blurAmount / 100) * 0.15; // Subtle stretch in motion direction

  return (
    <AbsoluteFill
      style={{
        transform: `translate(${translateX}px, ${translateY}px) ${
          isHorizontal
            ? `scaleX(${scaleStretch})`
            : `scaleY(${scaleStretch})`
        }`,
        transformOrigin: 'center center',
        filter: `blur(${blurAmount}px)`,
        opacity,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const motionBlur = (props?: MotionBlurProps): TransitionPresentation<MotionBlurProps> => ({
  component: MotionBlurPresentation,
  props: props ?? { direction: 'left', intensity: 2 },
});
