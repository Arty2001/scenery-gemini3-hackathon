'use client';

import { AbsoluteFill, useVideoConfig, useCurrentFrame, random } from 'remotion';
import type { ParticleItem, ParticleType } from '@/lib/composition/types';
import { useMemo } from 'react';

interface ParticleItemRendererProps {
  item: ParticleItem;
}

interface Particle {
  id: number;
  startX: number;
  startY: number;
  velocityX: number;
  velocityY: number;
  size: number;
  color: string;
  rotationSpeed: number;
  delay: number; // Frame delay before particle appears
  lifespan: number; // Frames the particle lives
  shape: 'circle' | 'square' | 'triangle' | 'star';
}

/**
 * Get particle shape defaults based on type
 */
function getParticleDefaults(type: ParticleType) {
  switch (type) {
    case 'confetti':
      return {
        shapes: ['square', 'circle'] as const,
        baseSpeed: 3,
        baseGravity: 0.08,
        baseSize: 8,
        lifespanRange: [0.7, 1.0] as const,
      };
    case 'sparks':
      return {
        shapes: ['circle'] as const,
        baseSpeed: 6,
        baseGravity: 0.15,
        baseSize: 3,
        lifespanRange: [0.3, 0.6] as const,
      };
    case 'snow':
      return {
        shapes: ['circle'] as const,
        baseSpeed: 0.8,
        baseGravity: 0.02,
        baseSize: 4,
        lifespanRange: [0.8, 1.0] as const,
      };
    case 'bubbles':
      return {
        shapes: ['circle'] as const,
        baseSpeed: 1.5,
        baseGravity: -0.03, // Floats up
        baseSize: 10,
        lifespanRange: [0.6, 1.0] as const,
      };
    case 'stars':
      return {
        shapes: ['star'] as const,
        baseSpeed: 2,
        baseGravity: 0.01,
        baseSize: 6,
        lifespanRange: [0.5, 0.9] as const,
      };
    case 'dust':
      return {
        shapes: ['circle'] as const,
        baseSpeed: 0.5,
        baseGravity: 0.005,
        baseSize: 2,
        lifespanRange: [0.6, 1.0] as const,
      };
    default:
      return {
        shapes: ['circle'] as const,
        baseSpeed: 2,
        baseGravity: 0.05,
        baseSize: 5,
        lifespanRange: [0.5, 1.0] as const,
      };
  }
}

/**
 * Generate deterministic particles based on seed
 */
function generateParticles(
  item: ParticleItem,
  compWidth: number,
  compHeight: number,
  durationInFrames: number
): Particle[] {
  const {
    particleType,
    emitterPosition,
    emitterSize,
    particleCount,
    colors,
    speed,
    gravity,
    spread,
    particleSize = 1,
    rotation = true,
  } = item;

  const defaults = getParticleDefaults(particleType);
  const particles: Particle[] = [];

  const emitterX = emitterPosition.x * compWidth;
  const emitterY = emitterPosition.y * compHeight;
  const emitterW = (emitterSize?.width ?? 0) * compWidth;
  const emitterH = (emitterSize?.height ?? 0) * compHeight;

  const spreadRad = (spread / 2) * (Math.PI / 180);
  const baseAngle = -Math.PI / 2; // Upward by default

  for (let i = 0; i < particleCount; i++) {
    const seed = `particle-${item.id}-${i}`;

    // Randomize spawn position within emitter area
    const startX = emitterX + (random(seed + '-x') - 0.5) * emitterW;
    const startY = emitterY + (random(seed + '-y') - 0.5) * emitterH;

    // Random angle within spread
    const angle = baseAngle + (random(seed + '-angle') - 0.5) * 2 * spreadRad;

    // Random speed variation
    const speedMult = 0.5 + random(seed + '-speed') * 1;
    const actualSpeed = defaults.baseSpeed * speed * speedMult;

    // Velocity components
    const velocityX = Math.cos(angle) * actualSpeed;
    const velocityY = Math.sin(angle) * actualSpeed;

    // Random size variation
    const size = defaults.baseSize * particleSize * (0.5 + random(seed + '-size'));

    // Pick a color
    const color = colors[Math.floor(random(seed + '-color') * colors.length)];

    // Rotation speed
    const rotationSpeed = rotation ? (random(seed + '-rot') - 0.5) * 10 : 0;

    // Stagger spawn over first half of duration
    const delay = Math.floor(random(seed + '-delay') * durationInFrames * 0.5);

    // Lifespan as fraction of remaining duration
    const lifespanFrac = defaults.lifespanRange[0] +
      random(seed + '-life') * (defaults.lifespanRange[1] - defaults.lifespanRange[0]);
    const lifespan = Math.floor((durationInFrames - delay) * lifespanFrac);

    // Shape
    const shapeIndex = Math.floor(random(seed + '-shape') * defaults.shapes.length);
    const shape = defaults.shapes[shapeIndex] as Particle['shape'];

    particles.push({
      id: i,
      startX,
      startY,
      velocityX,
      velocityY,
      size,
      color,
      rotationSpeed,
      delay,
      lifespan,
      shape,
    });
  }

  return particles;
}

/**
 * Render a single particle shape
 */
function ParticleShape({ shape, size, color }: { shape: Particle['shape']; size: number; color: string }) {
  switch (shape) {
    case 'square':
      return (
        <div
          style={{
            width: size,
            height: size,
            backgroundColor: color,
            borderRadius: 1,
          }}
        />
      );
    case 'triangle':
      return (
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: `${size / 2}px solid transparent`,
            borderRight: `${size / 2}px solid transparent`,
            borderBottom: `${size}px solid ${color}`,
          }}
        />
      );
    case 'star':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <polygon points="12,2 15,9 22,9 17,14 19,22 12,18 5,22 7,14 2,9 9,9" />
        </svg>
      );
    case 'circle':
    default:
      return (
        <div
          style={{
            width: size,
            height: size,
            backgroundColor: color,
            borderRadius: '50%',
          }}
        />
      );
  }
}

export function ParticleItemRenderer({ item }: ParticleItemRendererProps) {
  const { width: compWidth, height: compHeight } = useVideoConfig();
  const frame = useCurrentFrame();

  const defaults = getParticleDefaults(item.particleType);
  const gravity = defaults.baseGravity * item.gravity;

  // Generate particles deterministically
  const particles = useMemo(
    () => generateParticles(item, compWidth, compHeight, item.durationInFrames),
    [item, compWidth, compHeight]
  );

  // Filter to only active particles first, then render
  const activeParticles = particles
    .map((p) => {
      const particleFrame = frame - p.delay;
      if (particleFrame < 0 || particleFrame > p.lifespan) {
        return null;
      }

      // Calculate progress (0 to 1)
      const progress = particleFrame / p.lifespan;

      // Physics simulation
      const x = p.startX + p.velocityX * particleFrame;
      const y = p.startY + p.velocityY * particleFrame + 0.5 * gravity * particleFrame * particleFrame;

      // Rotation
      const rotation = p.rotationSpeed * particleFrame;

      // Opacity fade out
      const opacity = item.fadeOut !== false
        ? 1 - Math.pow(progress, 2) // Quadratic fade
        : 1;

      // Scale variation (slight shrink for some effects)
      const scale = item.particleType === 'sparks'
        ? 1 - progress * 0.5
        : 1;

      return { p, x, y, rotation, opacity, scale };
    })
    .filter((data): data is NonNullable<typeof data> => data !== null);

  return (
    <AbsoluteFill>
      {activeParticles.map(({ p, x, y, rotation, opacity, scale }) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
            opacity,
            pointerEvents: 'none',
          }}
        >
          <ParticleShape shape={p.shape} size={p.size} color={p.color} />
        </div>
      ))}
    </AbsoluteFill>
  );
}
