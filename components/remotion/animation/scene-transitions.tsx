/**
 * Scene transition components inspired by Remotion Lambda trailer.
 *
 * These components wrap content and provide smooth transitions:
 * - Curtain: Two panels slide apart to reveal content
 * - Wheel: Rotational swing effect
 * - Flip: 3D card flip transition
 *
 * @see https://github.com/remotion-dev/trailer-lambda
 */

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import type { SlideDirection, SpringPreset } from '@/lib/composition/types';
import { getSpringConfig } from './spring-presets';

// =============================================
// Curtain Transition
// =============================================

interface CurtainTransitionProps {
  children: React.ReactNode;
  type: 'in' | 'out';
  delay?: number;
  durationInFrames?: number;
  springPreset?: SpringPreset;
  color?: string;
}

/**
 * Curtain transition - two panels slide apart to reveal content.
 * Inspired by Remotion trailer's Curtain.tsx
 */
export function CurtainTransition({
  children,
  type,
  delay = 0,
  durationInFrames = 20,
  springPreset = 'smooth',
  color = '#4290f5', // Remotion brand blue
}: CurtainTransitionProps) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const springConfig = getSpringConfig(springPreset);

  const delayedFrame = Math.max(0, frame - delay);

  const progress = spring({
    frame: delayedFrame,
    fps: 30,
    durationInFrames,
    config: springConfig,
  });

  // For "in" transition: panels start covering, then slide apart
  // For "out" transition: panels start apart, then cover
  const finalProgress = type === 'in' ? progress : 1 - progress;

  const leftPanelX = interpolate(finalProgress, [0, 1], [0, -width / 2]);
  const rightPanelX = interpolate(finalProgress, [0, 1], [0, width / 2]);

  return (
    <AbsoluteFill>
      {children}
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', pointerEvents: 'none' }}>
        {/* Left panel */}
        <div
          style={{
            flex: 1,
            backgroundColor: color,
            transform: `translateX(${leftPanelX}px)`,
          }}
        />
        {/* Right panel */}
        <div
          style={{
            flex: 1,
            backgroundColor: color,
            transform: `translateX(${rightPanelX}px)`,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// =============================================
// Wheel Transition
// =============================================

interface WheelTransitionProps {
  children: React.ReactNode;
  type: 'in' | 'out';
  delay?: number;
  durationInFrames?: number;
  springPreset?: SpringPreset;
}

/**
 * Wheel transition - rotational swing effect.
 * Content swings in/out like it's attached to a wheel.
 * Inspired by Remotion trailer's WheelTransition.tsx
 */
export function WheelTransition({
  children,
  type,
  delay = 0,
  durationInFrames = 25,
  springPreset = 'smooth',
}: WheelTransitionProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const springConfig = getSpringConfig(springPreset);

  const delayedFrame = Math.max(0, frame - delay);

  const progress = spring({
    frame: delayedFrame,
    fps: 30,
    durationInFrames,
    config: springConfig,
  });

  // Wheel parameters (content swings on a large arc)
  const RADIUS = width * 2;
  const CENTER_POINT = { x: width / 2, y: height / 2 + RADIUS };

  const CENTER_ANGLE = Math.PI; // Pointing up
  const END_ANGLE = CENTER_ANGLE + Math.PI * 0.2 * (type === 'in' ? 1 : -1);

  const angle = interpolate(
    progress,
    [0, 1],
    type === 'in' ? [END_ANGLE, CENTER_ANGLE] : [CENTER_ANGLE, END_ANGLE]
  );

  const xOffset = Math.sin(angle) * RADIUS;
  const yOffset = Math.cos(angle) * RADIUS;
  const rotationDegrees = (angle - CENTER_ANGLE) * (180 / Math.PI);

  return (
    <AbsoluteFill
      style={{
        transform: `translateX(${xOffset}px) translateY(${yOffset}px) rotate(${-rotationDegrees}deg)`,
        transformOrigin: `${CENTER_POINT.x}px ${CENTER_POINT.y}px`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

// =============================================
// Flip Transition
// =============================================

interface FlipTransitionProps {
  front: React.ReactNode;
  back: React.ReactNode;
  delay?: number;
  durationInFrames?: number;
  springPreset?: SpringPreset;
  direction?: 'horizontal' | 'vertical';
}

/**
 * 3D flip transition - card flip between two pieces of content.
 * Inspired by Remotion trailer's WriteInReact.tsx flip animation.
 */
export function FlipTransition({
  front,
  back,
  delay = 0,
  durationInFrames = 20,
  springPreset = 'smooth',
  direction = 'horizontal',
}: FlipTransitionProps) {
  const frame = useCurrentFrame();
  const springConfig = getSpringConfig(springPreset);

  const delayedFrame = Math.max(0, frame - delay);

  const progress = spring({
    frame: delayedFrame,
    fps: 30,
    durationInFrames,
    config: springConfig,
  });

  const rotateAxis = direction === 'horizontal' ? 'Y' : 'X';

  // Front: visible at 0, hidden at 0.5+
  const frontRotation = interpolate(progress, [0, 1], [0, -Math.PI]);
  const frontOpacity = progress < 0.5 ? 1 : 0;

  // Back: hidden at 0-0.5, visible at 0.5+
  const backRotation = interpolate(progress, [0, 1], [Math.PI, 0]);
  const backOpacity = progress >= 0.5 ? 1 : 0;

  return (
    <AbsoluteFill style={{ perspective: 1000 }}>
      {/* Front side */}
      <AbsoluteFill
        style={{
          transform: `rotate${rotateAxis}(${frontRotation}rad)`,
          backfaceVisibility: 'hidden',
          opacity: frontOpacity,
        }}
      >
        {front}
      </AbsoluteFill>

      {/* Back side */}
      <AbsoluteFill
        style={{
          transform: `rotate${rotateAxis}(${backRotation}rad)`,
          backfaceVisibility: 'hidden',
          opacity: backOpacity,
        }}
      >
        {back}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// =============================================
// Slide Transition
// =============================================

interface SlideTransitionProps {
  children: React.ReactNode;
  type: 'in' | 'out';
  direction?: SlideDirection;
  delay?: number;
  durationInFrames?: number;
  springPreset?: SpringPreset;
}

/**
 * Slide transition - content slides in from an edge.
 */
export function SlideTransition({
  children,
  type,
  direction = 'left',
  delay = 0,
  durationInFrames = 15,
  springPreset = 'smooth',
}: SlideTransitionProps) {
  const frame = useCurrentFrame();
  const springConfig = getSpringConfig(springPreset);

  const delayedFrame = Math.max(0, frame - delay);

  const progress = spring({
    frame: delayedFrame,
    fps: 30,
    durationInFrames,
    config: springConfig,
  });

  const finalProgress = type === 'in' ? progress : 1 - progress;

  const distance = 100; // percentage
  const axis = direction === 'left' || direction === 'right' ? 'X' : 'Y';
  const sign = direction === 'right' || direction === 'bottom' ? 1 : -1;

  const offset = interpolate(finalProgress, [0, 1], [sign * distance, 0]);

  return (
    <AbsoluteFill style={{ transform: `translate${axis}(${offset}%)` }}>
      {children}
    </AbsoluteFill>
  );
}

// =============================================
// Fade Transition
// =============================================

interface FadeTransitionProps {
  children: React.ReactNode;
  type: 'in' | 'out';
  delay?: number;
  durationInFrames?: number;
}

/**
 * Simple fade transition.
 */
export function FadeTransition({
  children,
  type,
  delay = 0,
  durationInFrames = 15,
}: FadeTransitionProps) {
  const frame = useCurrentFrame();

  const delayedFrame = Math.max(0, frame - delay);

  const progress = interpolate(delayedFrame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = type === 'in' ? progress : 1 - progress;

  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

// =============================================
// Scene Transition Wrapper
// =============================================

interface SceneTransitionProps {
  children: React.ReactNode;
  type: 'in' | 'out';
  transition: 'fade' | 'slide' | 'curtain' | 'wheel';
  direction?: SlideDirection;
  delay?: number;
  durationInFrames?: number;
  springPreset?: SpringPreset;
  curtainColor?: string;
}

/**
 * Unified scene transition component.
 * Use this for easy switching between transition types.
 */
export function SceneTransition({
  children,
  type,
  transition,
  direction,
  delay,
  durationInFrames,
  springPreset,
  curtainColor,
}: SceneTransitionProps) {
  switch (transition) {
    case 'curtain':
      return (
        <CurtainTransition
          type={type}
          delay={delay}
          durationInFrames={durationInFrames}
          springPreset={springPreset}
          color={curtainColor}
        >
          {children}
        </CurtainTransition>
      );

    case 'wheel':
      return (
        <WheelTransition
          type={type}
          delay={delay}
          durationInFrames={durationInFrames}
          springPreset={springPreset}
        >
          {children}
        </WheelTransition>
      );

    case 'slide':
      return (
        <SlideTransition
          type={type}
          direction={direction}
          delay={delay}
          durationInFrames={durationInFrames}
          springPreset={springPreset}
        >
          {children}
        </SlideTransition>
      );

    case 'fade':
    default:
      return (
        <FadeTransition type={type} delay={delay} durationInFrames={durationInFrames}>
          {children}
        </FadeTransition>
      );
  }
}
