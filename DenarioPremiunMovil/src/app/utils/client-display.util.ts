function normalizeClientField(value: string | null | undefined): string {
  return (value ?? '').trim();
}

export function formatClientForList(
  coClient: string | null | undefined,
  naClient: string | null | undefined,
  fallbackName?: string | null | undefined
): string {
  const co = normalizeClientField(coClient);
  const name = normalizeClientField(naClient) || normalizeClientField(fallbackName);

  if (co && name) {
    return `${co} - ${name}`;
  }
  return co || name;
}

export function formatClientForTab(
  naClient: string | null | undefined,
  coClient: string | null | undefined,
  fallbackName?: string | null | undefined
): string {
  const co = normalizeClientField(coClient);
  const name = normalizeClientField(naClient) || normalizeClientField(fallbackName);

  if (name && co) {
    return `${name} (${co})`;
  }
  return name || co;
}
