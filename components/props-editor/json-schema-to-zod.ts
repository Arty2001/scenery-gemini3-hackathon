import { z } from 'zod';

/**
 * Convert a JSON Schema object to a Zod schema.
 *
 * This is a simplified converter that handles common types:
 * - string, number, boolean, integer
 * - array (as z.array(z.unknown()))
 * - object (as z.record(z.string(), z.unknown()))
 *
 * Complex types (unions, tuples, nested objects with specific shapes)
 * fall back to z.unknown() for safety.
 *
 * @param jsonSchema - JSON Schema object (typically from props_schema in DB)
 * @returns Zod object schema
 */
export function jsonSchemaToZod(
  jsonSchema: Record<string, unknown> | null | undefined
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  // Handle null/undefined/empty schema
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    return z.object({});
  }

  const properties = jsonSchema.properties as Record<string, JsonSchemaProperty> | undefined;

  // Handle missing or empty properties
  if (!properties || typeof properties !== 'object' || Object.keys(properties).length === 0) {
    return z.object({});
  }

  const required = (jsonSchema.required as string[]) ?? [];
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(properties)) {
    if (!prop || typeof prop !== 'object') {
      shape[key] = z.unknown();
      continue;
    }

    let zodType = convertType(prop);

    // Add description if present
    if (prop.description && typeof prop.description === 'string') {
      zodType = zodType.describe(prop.description);
    }

    // Add default value if present
    if ('default' in prop && prop.default !== undefined) {
      zodType = zodType.default(prop.default);
    }

    // Mark as optional if not in required array
    if (!required.includes(key)) {
      zodType = zodType.optional();
    }

    shape[key] = zodType;
  }

  return z.object(shape);
}

interface JsonSchemaProperty {
  type?: string;
  description?: string;
  default?: unknown;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  enum?: unknown[];
}

/**
 * Convert a single JSON Schema property type to a Zod type
 */
function convertType(prop: JsonSchemaProperty): z.ZodTypeAny {
  switch (prop.type) {
    case 'string':
      // Handle enums
      if (prop.enum && Array.isArray(prop.enum) && prop.enum.length > 0) {
        const enumValues = prop.enum.filter((v): v is string => typeof v === 'string');
        if (enumValues.length > 0) {
          return z.enum(enumValues as [string, ...string[]]);
        }
      }
      return z.string();

    case 'number':
      return z.number();

    case 'integer':
      return z.number().int();

    case 'boolean':
      return z.boolean();

    case 'array':
      // For arrays, we use z.array(z.unknown()) as a safe default
      // More specific item types would require recursive conversion
      return z.array(z.unknown());

    case 'object':
      // For objects without specific properties, use record
      // Objects with properties would need recursive conversion
      return z.record(z.string(), z.unknown());

    case 'null':
      return z.null();

    default:
      // Handle missing type or unknown types
      return z.unknown();
  }
}
