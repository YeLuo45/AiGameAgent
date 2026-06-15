// V2 GateCondition (Direction C 2/30, chatdev)
// JSON Schema validation for phase output gates

export type JsonType = "string" | "number" | "boolean" | "object" | "array" | "null";

export interface GateSchema {
  type: JsonType;
  required?: string[];
  properties?: Record<string, GateSchema>;
  items?: GateSchema;
  /** Min length for strings, min items for arrays, min properties for objects. */
  min?: number;
  /** Max length for strings. */
  max?: number;
  /** Pattern for strings. */
  pattern?: string;
  /** Enum constraint. */
  enum?: unknown[];
}

export interface GateResult {
  passed: boolean;
  errors: string[];
  missingFields: string[];
}

export function checkGate(schema: GateSchema, value: unknown): GateResult {
  const errors: string[] = [];
  const missingFields: string[] = [];
  // Type check
  if (!checkType(schema.type, value)) {
    errors.push(`expected type ${schema.type}, got ${jsonType(value)}`);
    return { passed: false, errors, missingFields };
  }
  if (schema.type === "object" && typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    if (schema.required) {
      for (const r of schema.required) {
        if (!(r in obj)) {
          missingFields.push(r);
          errors.push(`missing required field: ${r}`);
        }
      }
    }
    if (schema.properties) {
      for (const [k, sub] of Object.entries(schema.properties)) {
        if (k in obj) {
          const r = checkGate(sub, obj[k]);
          if (!r.passed) errors.push(...r.errors.map((e) => `${k}.${e}`));
        }
      }
    }
    if (schema.min !== undefined) {
      const propCount = Object.keys(obj).length;
      if (propCount < schema.min) errors.push(`object has ${propCount} props, need ≥${schema.min}`);
    }
  }
  if (schema.type === "array" && Array.isArray(value)) {
    if (schema.min !== undefined && value.length < schema.min) errors.push(`array has ${value.length} items, need ≥${schema.min}`);
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        const r = checkGate(schema.items, value[i]);
        if (!r.passed) errors.push(...r.errors.map((e) => `[${i}].${e}`));
      }
    }
  }
  if (schema.type === "string" && typeof value === "string") {
    if (schema.min !== undefined && value.length < schema.min) errors.push(`string length ${value.length} < ${schema.min}`);
    if (schema.max !== undefined && value.length > schema.max) errors.push(`string length ${value.length} > ${schema.max}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`pattern mismatch: ${schema.pattern}`);
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`value not in enum`);
  }
  return { passed: errors.length === 0, errors, missingFields };
}

function checkType(t: JsonType, v: unknown): boolean {
  if (t === "null") return v === null;
  if (t === "array") return Array.isArray(v);
  if (t === "object") return typeof v === "object" && v !== null && !Array.isArray(v);
  return typeof v === t;
}

function jsonType(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

/** Build common gate schemas. */
export function ideationGate(): GateSchema {
  return {
    type: "object",
    required: ["idea", "pitch"],
    properties: {
      idea: { type: "string", min: 10 },
      pitch: { type: "string", min: 20 },
    },
  };
}

export function architectureGate(): GateSchema {
  return {
    type: "object",
    required: ["engine", "platforms"],
    properties: {
      engine: { type: "string", enum: ["phaser", "cocos", "pixijs", "custom"] },
      platforms: { type: "array", items: { type: "string" }, min: 1 },
    },
  };
}

export function designGate(): GateSchema {
  return {
    type: "object",
    required: ["systems"],
    properties: {
      systems: { type: "array", items: { type: "object" }, min: 1 },
    },
  };
}

export function productionGate(): GateSchema {
  return {
    type: "object",
    required: ["artifacts"],
    properties: {
      artifacts: { type: "array", items: { type: "string" }, min: 1 },
    },
  };
}

export function polishGate(): GateSchema {
  return {
    type: "object",
    required: ["testReport"],
    properties: {
      testReport: { type: "object" },
    },
  };
}

export function releaseGate(): GateSchema {
  return {
    type: "object",
    required: ["version", "platforms"],
    properties: {
      version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" },
      platforms: { type: "array", items: { type: "string" }, min: 1 },
    },
  };
}

export function gateForPhase(phase: string): GateSchema | null {
  switch (phase) {
    case "ideation": return ideationGate();
    case "architecture": return architectureGate();
    case "design": return designGate();
    case "production": return productionGate();
    case "polish": return polishGate();
    case "release": return releaseGate();
    default: return null;
  }
}

/** Master metric: gate strictness 0-1. */
export function gateStrictness(schema: GateSchema): number {
  let score = 0.2; // base for type check
  if (schema.required && schema.required.length > 0) score += 0.2;
  if (schema.properties) score += 0.2;
  if (schema.enum) score += 0.2;
  if (schema.pattern) score += 0.1;
  if (schema.min !== undefined) score += 0.1;
  return Math.min(1, score);
}
