// Generates src/generated/bulb-config.ts from src/schemas/bulb-config.schema.json.
// Run with `npm run generate`; test/generated-types.test.ts fails when the committed output is stale.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'json-schema-to-typescript';
import { format, resolveConfig } from 'prettier';

type JsonObject = { [key: string]: unknown };
type CompileSchema = Parameters<typeof compile>[0];

const schemaPath = fileURLToPath(
  new URL('../src/schemas/bulb-config.schema.json', import.meta.url),
);
const outputPath = fileURLToPath(new URL('../src/generated/bulb-config.ts', import.meta.url));

const banner =
  '/* Generated from src/schemas/bulb-config.schema.json by `npm run generate`. Do not edit by hand. */';

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
} as const;

/** Renders the generated TypeScript module (both BulbConfigInput and BulbConfig) as formatted text. */
export async function renderBulbConfigTypes(): Promise<string> {
  const schema = JSON.parse(await readFile(schemaPath, 'utf8')) as JsonObject;

  const input: JsonObject = {
    ...structuredClone(schema),
    title: 'BulbConfigInput',
    description: 'Bulb config as written in `.bulb/config.yaml`; keys with defaults are optional.',
  };
  const resolved: JsonObject = {
    ...withDefaultsRequired(structuredClone(schema)),
    title: 'BulbConfig',
    description: 'Bulb config after loading: schema defaults applied.',
  };

  const inputTypes = await compile(input as CompileSchema, 'BulbConfigInput', compileOptions);
  const resolvedTypes = await compile(resolved as CompileSchema, 'BulbConfig', compileOptions);

  const text = `${banner}\n\n${inputTypes}\n${resolvedTypes}`;
  return format(text, { ...(await resolveConfig(outputPath)), parser: 'typescript' });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, await renderBulbConfigTypes());
  console.log(`Wrote ${outputPath}`);
}
