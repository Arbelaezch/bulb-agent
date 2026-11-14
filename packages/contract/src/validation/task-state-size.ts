/** Largest task state, in UTF-8 bytes of compact `JSON.stringify` output, that fits the hidden PR comment. */
export const TASK_STATE_MAX_BYTES = 10_240;

/** Returns the UTF-8 byte length of `state` serialised as compact JSON. */
export function taskStateByteLength(state: unknown): number {
  return new TextEncoder().encode(JSON.stringify(state)).length;
}

/** Throws a `RangeError` when `state` serialises to more than `TASK_STATE_MAX_BYTES`; the message never includes state content. */
export function assertTaskStateSize(state: unknown): void {
  const bytes = taskStateByteLength(state);
  if (bytes > TASK_STATE_MAX_BYTES) {
    throw new RangeError(
      `Task state is ${bytes} bytes serialised; the limit is ${TASK_STATE_MAX_BYTES} bytes`,
    );
  }
}
