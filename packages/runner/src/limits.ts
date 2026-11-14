/**
 * The deepest wake event the runner accepts. An event is refused when its `depth` exceeds this value, so depths 0
 * to 3 run and 4 or more end as `skipped`.
 *
 * The longest legitimate MVP chain is a root event (0), a bulb outcome re-emitted as an event (1) and a reaction to
 * it (2); 3 leaves one spare level. It is deliberately not configurable in `.bulb/config.yaml`: a loop guard the owner
 * can raise by accident is weaker.
 */
export const MAX_EVENT_DEPTH = 3;

/** Whether an event at `depth` is past the maximum and must be refused. */
export function exceedsMaxDepth(depth: number): boolean {
  return depth > MAX_EVENT_DEPTH;
}
