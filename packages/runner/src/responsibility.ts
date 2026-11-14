import type { StateStore } from './adapters.js';
import type { BulbConfig, Outcome, WakeEvent } from './contract.js';

/** A responsibility name, derived from the generated outcome type. */
export type ResponsibilityName = NonNullable<Outcome['responsibility']>;

/** What a responsibility receives when the runner routes an event to it. */
export interface RunContext {
  event: WakeEvent;
  config: BulbConfig;
  stateStore: StateStore;
}

/** A unit of upkeep work. `eventTypes` is static so overlapping routes are detected when the registry is built. */
export interface Responsibility {
  readonly name: ResponsibilityName;
  readonly eventTypes: readonly string[];
  run(context: RunContext): Promise<Outcome>;
}

/** Routes an event type to at most one responsibility. */
export interface ResponsibilityRegistry {
  forEventType(type: string): Responsibility | undefined;
  readonly responsibilities: readonly Responsibility[];
}

/**
 * Builds a registry. Throws when two responsibilities share a name or claim the same event type, so every event
 * routes to at most one responsibility and a run emits exactly one outcome.
 */
export function createRegistry(
  responsibilities: readonly Responsibility[],
): ResponsibilityRegistry {
  const names = new Set<string>();
  const byType = new Map<string, Responsibility>();
  for (const responsibility of responsibilities) {
    if (names.has(responsibility.name)) {
      throw new Error(`Duplicate responsibility name: ${responsibility.name}`);
    }
    names.add(responsibility.name);
    for (const type of responsibility.eventTypes) {
      const existing = byType.get(type);
      if (existing !== undefined) {
        throw new Error(
          `Event type ${type} is claimed by both ${existing.name} and ${responsibility.name}`,
        );
      }
      byType.set(type, responsibility);
    }
  }
  const list = Object.freeze([...responsibilities]);
  return {
    responsibilities: list,
    forEventType: (type) => byType.get(type),
  };
}
