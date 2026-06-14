// V29 ToolMCPSchema (Direction B 29/30, orchestrator)
// JSON Schema validation for MCP tool parameters

export type JsonSchemaType = "string" | "number" | "integer" | "boolean" | "object" | "array" | "null";

export interface JsonSchema {
  type: JsonSchemaType;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateJsonSchema(schema: JsonSchema, value: unknown): ValidationResult {
  const errors: string[] = [];
  // Type check
  if (!checkType(schema.type, value)) {
    errors.push(`expected type ${schema.type}, got ${typeof value}`);
    return { valid: false, errors };
  }
  // Object constraints
  if (schema.type === "object" && typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    if (schema.required) {
      for (const r of schema.required) {
        if (!(r in obj)) errors.push(`missing required field: ${r}`);
      }
    }
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          const r = validateJsonSchema(propSchema, obj[key]);
          if (!r.valid) errors.push(...r.errors.map((e) => `${key}.${e}`));
        }
      }
    }
  }
  if (schema.type === "array" && Array.isArray(value) && schema.items) {
    for (let i = 0; i < value.length; i++) {
      const r = validateJsonSchema(schema.items, value[i]);
      if (!r.valid) errors.push(...r.errors.map((e) => `[${i}].${e}`));
    }
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`value not in enum: ${JSON.stringify(schema.enum)}`);
  }
  if (schema.type === "number" || schema.type === "integer") {
    const n = value as number;
    if (schema.minimum !== undefined && n < schema.minimum) errors.push(`below minimum: ${schema.minimum}`);
    if (schema.maximum !== undefined && n > schema.maximum) errors.push(`above maximum: ${schema.maximum}`);
  }
  if (schema.type === "string" && typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`below minLength: ${schema.minLength}`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`above maxLength: ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`doesn't match pattern: ${schema.pattern}`);
  }
  return { valid: errors.length === 0, errors };
}

function checkType(type: JsonSchemaType, value: unknown): boolean {
  switch (type) {
    case "string": return typeof value === "string";
    case "number": return typeof value === "number";
    case "integer": return typeof value === "number" && Number.isInteger(value);
    case "boolean": return typeof value === "boolean";
    case "object": return typeof value === "object" && value !== null && !Array.isArray(value);
    case "array": return Array.isArray(value);
    case "null": return value === null;
  }
}

export function buildStringSchema(opts: { minLength?: number; maxLength?: number; pattern?: string; enum?: string[] } = {}): JsonSchema {
  const s: JsonSchema = { type: "string" };
  if (opts.minLength !== undefined) s.minLength = opts.minLength;
  if (opts.maxLength !== undefined) s.maxLength = opts.maxLength;
  if (opts.pattern) s.pattern = opts.pattern;
  if (opts.enum) s.enum = opts.enum;
  return s;
}

/** Master metric: schema coverage 0-1. */
export function schemaCoverage(schema: JsonSchema, value: unknown): number {
  if (validateJsonSchema(schema, value).valid) return 1.0;
  return 0;
}
