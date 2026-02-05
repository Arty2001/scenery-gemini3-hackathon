'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, Control, FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { jsonSchemaToZod } from './json-schema-to-zod';
import { cn } from '@/lib/utils';

/**
 * Deep equality check for props objects
 * Handles primitives, arrays, and nested objects
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);

  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bObj, key)) return false;
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }

  return true;
}

// Type for dynamic props form values
type PropsValues = Record<string, unknown>;

export interface PropsFormProps {
  /** JSON Schema from the database (props_schema field) */
  propsSchema: Record<string, unknown> | null | undefined;
  /** Current prop values */
  currentProps: Record<string, unknown>;
  /** Callback when props change */
  onPropsChange: (props: Record<string, unknown>) => void;
  /** Disable all form fields */
  disabled?: boolean;
  /** Additional class names for the form container */
  className?: string;
}

interface JsonSchemaProperty {
  type?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
}

/**
 * PropsForm - Dynamic form generated from JSON Schema
 *
 * Renders editable fields based on a component's props_schema from the database.
 * Supports string, number, boolean, and enum types.
 * Complex types (arrays, objects) show as read-only JSON.
 */
export function PropsForm({
  propsSchema,
  currentProps,
  onPropsChange,
  disabled = false,
  className,
}: PropsFormProps) {
  const [conversionError, setConversionError] = useState<string | null>(null);

  // Convert JSON schema to Zod for validation
  const zodSchema = useMemo(() => {
    try {
      setConversionError(null);
      // Cast to passthrough to allow extra fields
      return jsonSchemaToZod(propsSchema).passthrough();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setConversionError(message);
      return z.object({}).passthrough();
    }
  }, [propsSchema]);

  // Extract property definitions for rendering
  const properties = useMemo(() => {
    if (!propsSchema || typeof propsSchema !== 'object') {
      return {};
    }
    return (propsSchema.properties as Record<string, JsonSchemaProperty>) ?? {};
  }, [propsSchema]);

  const propertyNames = Object.keys(properties);
  const hasProperties = propertyNames.length > 0;

  // Track the last values we reported to parent to prevent infinite loops
  const lastReportedValues = useRef<Record<string, unknown>>(currentProps);

  // Initialize form with current props
  const form = useForm<PropsValues>({
    resolver: zodResolver(zodSchema) as never, // Type assertion needed for dynamic schema
    defaultValues: currentProps,
    mode: 'onChange',
  });

  // Sync external currentProps changes to form
  useEffect(() => {
    // Only reset if external props differ from what we last reported
    // This prevents reset loop when our own changes come back to us
    if (!deepEqual(currentProps, lastReportedValues.current)) {
      lastReportedValues.current = currentProps;
      form.reset(currentProps);
    }
  }, [currentProps, form]);

  // Watch all form values and notify parent on change
  useEffect(() => {
    const subscription = form.watch((values) => {
      const newValues = values as Record<string, unknown>;
      // Only call onPropsChange if values actually changed
      if (!deepEqual(newValues, lastReportedValues.current)) {
        lastReportedValues.current = newValues;
        onPropsChange(newValues);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, onPropsChange]);

  // Error state
  if (conversionError) {
    return (
      <div className={cn('rounded-md border border-destructive/50 bg-destructive/10 p-4', className)}>
        <p className="text-sm font-medium text-destructive">Unable to render props editor</p>
        <p className="mt-1 text-xs text-destructive/80">{conversionError}</p>
      </div>
    );
  }

  // Empty state
  if (!hasProperties) {
    return (
      <div className={cn('rounded-md border border-dashed p-6 text-center', className)}>
        <p className="text-sm text-muted-foreground">No configurable props</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This component has no editable properties defined in its schema.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form className={cn('space-y-4', className)}>
        {propertyNames.map((propName) => {
          const propDef = properties[propName];
          return (
            <DynamicField
              key={propName}
              name={propName}
              definition={propDef}
              disabled={disabled}
              control={form.control}
            />
          );
        })}
      </form>
    </Form>
  );
}

interface DynamicFieldProps {
  name: string;
  definition: JsonSchemaProperty;
  disabled: boolean;
  control: Control<FieldValues>;
}

/**
 * Renders the appropriate input based on JSON schema type
 */
function DynamicField({ name, definition, disabled, control }: DynamicFieldProps) {
  const { type, description, enum: enumValues } = definition;

  // Handle enums as select-like input
  if (enumValues && Array.isArray(enumValues) && enumValues.length > 0) {
    return (
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{formatLabel(name)}</FormLabel>
            <FormControl>
              <select
                {...field}
                value={field.value as string ?? ''}
                disabled={disabled}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select {formatLabel(name).toLowerCase()}...</option>
                {enumValues.map((val) => (
                  <option key={String(val)} value={String(val)}>
                    {String(val)}
                  </option>
                ))}
              </select>
            </FormControl>
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  switch (type) {
    case 'boolean':
      return (
        <FormField
          control={control}
          name={name}
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value as boolean ?? false}
                  onCheckedChange={field.onChange}
                  disabled={disabled}
                />
              </FormControl>
              <div className="space-y-0.5">
                <FormLabel className="cursor-pointer">{formatLabel(name)}</FormLabel>
                {description && (
                  <FormDescription className="text-xs">{description}</FormDescription>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      );

    case 'number':
    case 'integer':
      return (
        <FormField
          control={control}
          name={name}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{formatLabel(name)}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step={type === 'integer' ? '1' : 'any'}
                  {...field}
                  value={field.value as number ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    field.onChange(val === '' ? undefined : Number(val));
                  }}
                  disabled={disabled}
                  placeholder={`Enter ${formatLabel(name).toLowerCase()}...`}
                />
              </FormControl>
              {description && <FormDescription>{description}</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />
      );

    case 'array':
    case 'object':
      // Complex types rendered as read-only JSON
      return (
        <FormField
          control={control}
          name={name}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{formatLabel(name)}</FormLabel>
              <FormControl>
                <div className="rounded-md border bg-muted/50 p-2">
                  <pre className="text-xs text-muted-foreground overflow-auto max-h-24">
                    {JSON.stringify(field.value, null, 2) || 'null'}
                  </pre>
                </div>
              </FormControl>
              {description && <FormDescription>{description}</FormDescription>}
              <p className="text-xs text-muted-foreground italic">
                {type === 'array' ? 'Array' : 'Object'} editing not yet supported
              </p>
            </FormItem>
          )}
        />
      );

    case 'string':
    default:
      // Default to string input
      return (
        <FormField
          control={control}
          name={name}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{formatLabel(name)}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={(field.value as string) ?? ''}
                  disabled={disabled}
                  placeholder={`Enter ${formatLabel(name).toLowerCase()}...`}
                />
              </FormControl>
              {description && <FormDescription>{description}</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />
      );
  }
}

/**
 * Convert camelCase or snake_case prop names to readable labels
 */
function formatLabel(name: string): string {
  return name
    // Split on camelCase boundaries
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Split on underscores
    .replace(/_/g, ' ')
    // Capitalize first letter
    .replace(/^./, (c) => c.toUpperCase());
}
