import type { TextItem, ShapeItem } from './types';

export type BaseElementId =
  | 'text'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'gradient'
  | 'divider'
  | 'badge'
  | 'image';

export interface BaseElement {
  id: BaseElementId;
  label: string;
  icon: string; // Lucide icon name
  category: 'basics' | 'shapes' | 'backgrounds' | 'decorative' | 'media';
  description: string;
}

export const BASE_ELEMENTS: BaseElement[] = [
  { id: 'text', label: 'Text', icon: 'Type', category: 'basics', description: 'Text overlay' },
  { id: 'rectangle', label: 'Rectangle', icon: 'Square', category: 'shapes', description: 'Solid or outlined rectangle' },
  { id: 'circle', label: 'Circle', icon: 'Circle', category: 'shapes', description: 'Solid or outlined circle' },
  { id: 'line', label: 'Line', icon: 'Minus', category: 'shapes', description: 'Horizontal line' },
  { id: 'gradient', label: 'Gradient', icon: 'Palette', category: 'backgrounds', description: 'Gradient background' },
  { id: 'divider', label: 'Divider', icon: 'SeparatorHorizontal', category: 'decorative', description: 'Section separator' },
  { id: 'badge', label: 'Badge', icon: 'Tag', category: 'decorative', description: 'Colored pill with text' },
  { id: 'image', label: 'Image', icon: 'Image', category: 'media', description: 'Image placeholder' },
];

type ItemDefaults = { trackType: 'text'; item: Omit<TextItem, 'id'> }
  | { trackType: 'shape'; item: Omit<ShapeItem, 'id'> }
  | { trackType: 'image'; item: Omit<import('./types').ImageItem, 'id'> };

export function createBaseElement(elementId: BaseElementId, currentFrame: number): { trackName: string } & ItemDefaults {
  switch (elementId) {
    case 'text':
      return {
        trackName: 'Text',
        trackType: 'text',
        item: {
          type: 'text',
          text: 'Your text here',
          fontSize: 48,
          fontFamily: 'Inter',
          color: '#ffffff',
          fontWeight: 400,
          position: { x: 0.5, y: 0.5 },
          from: currentFrame,
          durationInFrames: 90,
        },
      };

    case 'rectangle':
      return {
        trackName: 'Rectangle',
        trackType: 'shape',
        item: {
          type: 'shape',
          shapeType: 'rectangle',
          width: 0.4,
          height: 0.25,
          position: { x: 0.5, y: 0.5 },
          fill: '#6366f1',
          borderRadius: 12,
          opacity: 1,
          from: currentFrame,
          durationInFrames: 90,
        },
      };

    case 'circle':
      return {
        trackName: 'Circle',
        trackType: 'shape',
        item: {
          type: 'shape',
          shapeType: 'circle',
          width: 0.15,
          height: 0.15,
          position: { x: 0.5, y: 0.5 },
          fill: '#8b5cf6',
          opacity: 1,
          from: currentFrame,
          durationInFrames: 90,
        },
      };

    case 'line':
      return {
        trackName: 'Line',
        trackType: 'shape',
        item: {
          type: 'shape',
          shapeType: 'line',
          width: 0.6,
          height: 0.003,
          position: { x: 0.5, y: 0.5 },
          fill: '#ffffff',
          opacity: 0.5,
          from: currentFrame,
          durationInFrames: 90,
        },
      };

    case 'gradient':
      return {
        trackName: 'Gradient',
        trackType: 'shape',
        item: {
          type: 'shape',
          shapeType: 'gradient',
          width: 1,
          height: 1,
          position: { x: 0.5, y: 0.5 },
          gradientFrom: '#6366f1',
          gradientTo: '#06b6d4',
          gradientDirection: 135,
          opacity: 0.8,
          from: currentFrame,
          durationInFrames: 90,
        },
      };

    case 'divider':
      return {
        trackName: 'Divider',
        trackType: 'shape',
        item: {
          type: 'shape',
          shapeType: 'divider',
          width: 0.3,
          height: 0.004,
          position: { x: 0.5, y: 0.5 },
          fill: '#ffffff',
          opacity: 0.3,
          borderRadius: 2,
          from: currentFrame,
          durationInFrames: 90,
        },
      };

    case 'badge':
      return {
        trackName: 'Badge',
        trackType: 'shape',
        item: {
          type: 'shape',
          shapeType: 'badge',
          width: 0.12,
          height: 0.04,
          position: { x: 0.5, y: 0.5 },
          fill: '#6366f1',
          borderRadius: 999,
          text: 'NEW',
          fontSize: 14,
          color: '#ffffff',
          opacity: 1,
          from: currentFrame,
          durationInFrames: 90,
        },
      };

    case 'image':
      return {
        trackName: 'Image',
        trackType: 'image',
        item: {
          type: 'image',
          src: '',
          from: currentFrame,
          durationInFrames: 90,
        },
      };
  }
}
