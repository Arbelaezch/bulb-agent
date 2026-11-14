import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { renderBulbConfigTypes, withDefaultsRequired } from '../scripts/generate.js';
import bulbConfigSchema from '../src/schemas/bulb-config.schema.json' with { type: 'json' };
import type { BulbConfig, BulbConfigInput } from '../src/index.js';

const generatedPath = fileURLToPath(new URL('../src/generated/bulb-config.ts', import.meta.url));

describe('bulb config generated types', () => {
  it('generated types are current', async () => {
    const committed = await readFile(generatedPath, 'utf8');
    expect(await renderBulbConfigTypes(), 'Generated types are stale: run npm run generate').toBe(
      committed,
    );
  });

  it('schema compiles under Ajv 2020 strict mode', () => {
    const ajv = new Ajv2020({ strict: true, allErrors: true, useDefaults: true });
    expect(() => ajv.compile(bulbConfigSchema)).not.toThrow();
  });

  it('only the root has a title', () => {
    const problems: string[] = [];
    const walk = (node: unknown, path: string): void => {
      if (Array.isArray(node)) {
        node.forEach((item, index) => walk(item, `${path}[${index}]`));
        return;
      }
      if (typeof node !== 'object' || node === null) {
        return;
      }
      for (const [key, value] of Object.entries(node)) {
        if (key === '$defs' || key === '$id') {
          problems.push(`${path}.${key}`);
        }
        if (key === 'title' && path !== '' && typeof value === 'string') {
          problems.push(`${path}.title`);
        }
        walk(value, `${path}.${key}`);
      }
    };
    walk(bulbConfigSchema, '');
    expect(problems).toEqual([]);
    expect(bulbConfigSchema.title).toBe('BulbConfig');
  });

  it('withDefaultsRequired marks defaulted properties required without mutating input', () => {
    const input = {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
        flag: { type: 'boolean', default: false },
        note: { type: 'string' },
        nested: {
          type: 'object',
          default: {},
          properties: {
            limit: { type: 'integer', default: 3 },
            label: { type: 'string' },
          },
        },
        list: {
          type: 'array',
          items: { type: 'object', properties: { mode: { enum: ['a'], default: 'a' } } },
        },
        map: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: { on: { type: 'boolean', default: true } },
          },
        },
      },
    };
    const snapshot = structuredClone(input);

    const output = withDefaultsRequired(input);

    expect(output.required).toEqual(['id', 'flag', 'nested']);
    expect(output.properties.nested).toMatchObject({ required: ['limit'] });
    expect(output.properties.list.items).toMatchObject({ required: ['mode'] });
    expect(output.properties.map.additionalProperties).toMatchObject({ required: ['on'] });
    expect(output.properties.id).not.toHaveProperty('required');
    expect(input).toEqual(snapshot);
  });

  it('distinguishes the input type from the resolved type', () => {
    expectTypeOf<BulbConfig['merge']['auto_merge']>().toEqualTypeOf<boolean>();
    expectTypeOf<BulbConfig['verify']['timeout']>().toEqualTypeOf<string>();
    expectTypeOf<undefined>().toExtend<BulbConfigInput['merge']>();
    expectTypeOf<BulbConfig['merge']>().not.toBeNullable();
    expectTypeOf<undefined>().toExtend<BulbConfig['notify']['webhook']>();
  });
});
