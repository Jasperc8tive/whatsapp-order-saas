export function requireEnvValue(
  value: string | undefined,
  name: string
): string {
  if (!value) {
    throw new Error(`Missing ${name} env var.`);
  }
  return value;
}

export function optionalEnvValue(
  value: string | undefined,
  fallback: string
): string {
  return value ?? fallback;
}
