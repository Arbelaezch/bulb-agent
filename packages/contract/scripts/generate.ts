// Generates src/generated/<name>.ts from src/schemas/<name>.schema.json for every entry in `schemaEntries`.
// Run with `npm run generate`; test/generated-types.test.ts fails when the committed output is stale.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'json-schema-to-typescript';
import { format, resolveConfig } from 'prettier';

type JsonObject = { [key: string]: unknown };
type CompileSchema = Parameters<typeof compile>[0];

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Returns a copy of `schema` where, in every object schema with `properties`, each property whose
 * subschema has a `default` is added to `required`. Recurses into `properties`, `items` and
 * object-valued `additionalProperties`. Does not mutate its input.
 */
export function withDefaultsRequired<T>(schema: T): T {
  if (!isObject(schema)) {
    return schema;
  }
  const result: JsonObject = { ...schema };

  if (isObject(schema.properties)) {
    const properties: JsonObject = {};
    const defaulted: string[] = [];
    for (const [key, subschema] of Object.entries(schema.properties)) {
      properties[key] = withDefaultsRequired(subschema);
      if (isObject(subschema) && 'default' in subschema) {
        defaulted.push(key);
      }
    }
    result.properties = properties;
    const required = Array.isArray(schema.required) ? [...(schema.required as unknown[])] : [];
    for (const key of defaulted) {
      if (!required.includes(key)) {
        required.push(key);
      }
    }
    if (required.length > 0) {
      result.required = required;
    }
  }

  if (isObject(schema.items)) {
    result.items = withDefaultsRequired(schema.items);
  }

  if (isObject(schema.additionalProperties)) {
    result.additionalProperties = withDefaultsRequired(schema.additionalProperties);
  }

  return result as T;
}

const compileOptions = {
  bannerComment: '',
  format: false,
  additionalProperties: false,
  unknownAny: true,
  // Emit bounded arrays as `T[]`, not a union of every tuple length; Ajv still enforces `maxItems`.
  maxItems: -1,
} as const;

export interface TypeTarget {
  title: string;
  description?: string;
  resolveDefaults: boolean;
}

export interface SchemaEntry {
  name: string;
  types: readonly TypeTarget[];
}

/** Every schema that gets generated types. To add one: add the schema file, add an entry here, run `npm run generate`. */
export const schemaEntries: readonly SchemaEntry[] = [
  {
    name: 'bulb-config',
    types: [
      {
        title: 'BulbConfigInput',
        description:
          'Bulb config as written in `.bulb/config.yaml`; keys with defaults are optional.',
        resolveDefaults: false,
      },
      {
        title: 'BulbConfig',
        description: 'Bulb config after loading: schema defaults applied.',
        resolveDefaults: true,
      },
    ],
  },
  { name: 'wake-event', types: [{ title: 'WakeEvent', resolveDefaults: false }] },
  { name: 'outcome', types: [{ title: 'Outcome', resolveDefaults: false }] },
  {
    name: 'lifecycle-notification',
    types: [{ title: 'LifecycleNotification', resolveDefaults: false }],
  },
  { name: 'task-state', types: [{ title: 'TaskState', resolveDefaults: false }] },
  {
    name: 'responsibility-scope',
    types: [{ title: 'ResponsibilityScope', resolveDefaults: false }],
  },
];

export function schemaPathFor(name: string): string {
  return fileURLToPath(new URL(`../src/schemas/${name}.schema.json`, import.meta.url));
}

export function generatedPathFor(name: string): string {
  return fileURLToPath(new URL(`../src/generated/${name}.ts`, import.meta.url));
}

/** Renders the generated TypeScript module for one schema entry as formatted text. */
export async function renderTypes(entry: SchemaEntry): Promise<string> {
  const schema = JSON.parse(await readFile(schemaPathFor(entry.name), 'utf8')) as JsonObject;

  const compiled: string[] = [];
  for (const target of entry.types) {
    const base = target.resolveDefaults
      ? withDefaultsRequired(structuredClone(schema))
      : structuredClone(schema);
    const targetSchema: JsonObject = { ...base, title: target.title };
    if (target.description !== undefined) {
      targetSchema.description = target.description;
    }
    compiled.push(await compile(targetSchema as CompileSchema, target.title, compileOptions));
  }

  const banner = `/* Generated from src/schemas/${entry.name}.schema.json by \`npm run generate\`. Do not edit by hand. */`;
  const text = `${banner}\n\n${compiled.join('\n')}`;
  return format(text, {
    ...(await resolveConfig(generatedPathFor(entry.name))),
    parser: 'typescript',
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const entry of schemaEntries) {
    const outputPath = generatedPathFor(entry.name);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, await renderTypes(entry));
    console.log(`Wrote ${outputPath}`);
  }
}
