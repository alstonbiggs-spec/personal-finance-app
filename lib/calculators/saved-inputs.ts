// Saved Finance Calculator inputs (public.calculator_inputs.inputs). The stored JSON is
// untrusted: it may predate a newly added input, hold a removed option, or be junk. So
// it's never used as-is; restoreInputs copies over only the values that still fit.

type Allowed<T> = { [K in keyof T]?: readonly unknown[] };

// Starts from `defaults` and takes each saved value only if it has the same type as the
// default (finite, for numbers) and, where `allowed` lists options, is one of them.
// Keys that aren't in `defaults` are dropped.
export function restoreInputs<T extends object>(defaults: T, saved: unknown, allowed: Allowed<T> = {}): T {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return defaults;
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const value = (saved as Record<string, unknown>)[key as string];
    const fallback = defaults[key];
    const sameType = typeof value === typeof fallback && (typeof value !== 'number' || Number.isFinite(value));
    const options = allowed[key];
    if (sameType && (!options || options.includes(value))) result[key] = value as T[keyof T];
  }
  return result;
}
