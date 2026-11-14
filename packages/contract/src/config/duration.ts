const UNIT_MS = { m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

/** Parses a config duration such as `30m`, `2h` or `7d` (`0d` means zero) into milliseconds. */
export function parseDurationMs(duration: string): number {
  const match = /^(0|[1-9][0-9]*)([mhd])$/.exec(duration);
  if (!match) {
    throw new RangeError(
      `Invalid duration "${duration}": expected <integer><unit> with unit m (minutes), h (hours) or d (days), e.g. "2h"`,
    );
  }
  return Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS];
}
