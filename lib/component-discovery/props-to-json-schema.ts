import type { PropInfo } from './types';

/**
 * Convert PropInfo[] (from discovery) to JSON Schema object for PropsForm.
 */
export function propsToJsonSchema(props: PropInfo[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const prop of props) {
    const propSchema = typeToJsonSchema(prop.type, prop.description, prop.defaultValue);
    properties[prop.name] = propSchema;

    if (prop.required) {
      required.push(prop.name);
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

/**
 * Map TypeScript type string to JSON Schema type.
 */
function typeToJsonSchema(
  tsType: string,
  description?: string,
  defaultValue?: string
): Record<string, unknown> {
  const schema: Record<string, unknown> = {};

  if (description) {
    schema.description = description;
  }

  if (defaultValue !== undefined && defaultValue !== '') {
    try {
      schema.default = JSON.parse(defaultValue);
    } catch {
      schema.default = defaultValue;
    }
  }

  const normalizedType = tsType.trim().toLowerCase();

  if (normalizedType === 'boolean' || normalizedType === 'true' || normalizedType === 'false') {
    return { ...schema, type: 'boolean' };
  }

  if (normalizedType === 'number') {
    return { ...schema, type: 'number' };
  }

  if (normalizedType === 'string') {
    return { ...schema, type: 'string' };
  }

  // Union of string literals (enum)
  const literalUnionMatch = tsType.match(/^["']([^"']+)["'](\s*\|\s*["'][^"']+["'])+$/);
  if (literalUnionMatch) {
    const enumValues = tsType
      .split('|')
      .map((v) => v.trim().replace(/^["']|["']$/g, ''));
    return { ...schema, type: 'string', enum: enumValues };
  }

  if (normalizedType.includes('reactnode') || normalizedType.includes('react.element')) {
    return { ...schema, type: 'string' };
  }

  if (normalizedType.includes('=>') || normalizedType.includes('function')) {
    return { ...schema, type: 'string', description: `${description ?? ''} (function)`.trim() };
  }

  if (normalizedType.endsWith('[]') || normalizedType.startsWith('array<')) {
    return { ...schema, type: 'array' };
  }

  if (
    normalizedType === 'object' ||
    normalizedType.startsWith('record<') ||
    normalizedType.startsWith('{')
  ) {
    return { ...schema, type: 'object' };
  }

  return { ...schema, type: 'string' };
}
