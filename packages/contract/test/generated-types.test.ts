import { readFile } from 'node:fs/promises';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  generatedPathFor,
  renderTypes,
  schemaEntries,
  schemaPathFor,
  withDefaultsRequired,
} from '../scripts/generate.js';
import type {
  BulbConfig,
  BulbConfigInput,
  LifecycleNotification,
  Outcome,
  ResponsibilityScope,
  TaskState,
  WakeEvent,
} from '../src/index.js';

async function loadSchema(name: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(schemaPathFor(name), 'utf8')) as Record<string, unknown>;
}

function walkKeys(node: unknown, visit: (key: string, value: unknown, path: string) => void): void {
  const walk = (current: unknown, path: string): void => {
    if (Array.isArray(current)) {
      current.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (typeof current !== 'object' || current === null) {
      return;
    }
    for (const [key, value] of Object.entries(current)) {
      visit(key, value, path);
      walk(value, `${path}.${key}`);
    }
  };
  walk(node, '');
}

describe.each(schemaEntries.map((entry) => [entry.name, entry] as const))(
  '%s generated types',
  (name, entry) => {
    it('generated types are current', async () => {
      const committed = await readFile(generatedPathFor(name), 'utf8');
      expect(await renderTypes(entry), 'Generated types are stale: run npm run generate').toBe(
        committed,
      );
    });

    it('schema compiles under Ajv 2020 strict mode', async () => {
      const ajv = new Ajv2020({ strict: true, allErrors: true, useDefaults: true });
      const schema = await loadSchema(name);
      expect(() => ajv.compile(schema)).not.toThrow();
    });

    it('only the root has a title, and there is no $defs or $id', async () => {
      const schema = await loadSchema(name);
      const problems: string[] = [];
      walkKeys(schema, (key, value, path) => {
        if (key === '$defs' || key === '$id') {
          problems.push(`${path}.${key}`);
        }
        if (key === 'title' && path !== '' && typeof value === 'string') {
          problems.push(`${path}.title`);
        }
      });
      expect(problems).toEqual([]);
      expect(entry.types.map((t) => t.title)).toContain(schema.title);
    });

    it('single-type entries have no default keyword', async () => {
      if (entry.types.length !== 1) return;
      const schema = await loadSchema(name);
      const defaults: string[] = [];
      walkKeys(schema, (key, _value, path) => {
        if (key === 'default') defaults.push(path);
      });
      expect(defaults).toEqual([]);
    });
  },
);

describe('bulb config generated types', () => {
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

describe('document generated types', () => {
  it('generates plain interfaces with the expected literal unions', () => {
    expectTypeOf<Outcome['outcome']>().toEqualTypeOf<
      'done' | 'ready' | 'blocked' | 'error' | 'skipped'
    >();
    expectTypeOf<Outcome['decision_needed']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<WakeEvent['source']>().toEqualTypeOf<
      'github' | 'schedule' | 'dashboard' | 'bulb'
    >();
    expectTypeOf<LifecycleNotification['notification']>().toEqualTypeOf<'started'>();
  });

  it('generates task state and responsibility scope types', () => {
    expectTypeOf<TaskState['phase']>().toEqualTypeOf<
      'running' | 'waiting' | 'done' | 'ready' | 'blocked' | 'error' | 'skipped'
    >();
    expectTypeOf<TaskState['deadline']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<TaskState['version']>().toEqualTypeOf<1>();
    expectTypeOf<ResponsibilityScope['max_diff_lines']>().toEqualTypeOf<number | undefined>();
  });
});
