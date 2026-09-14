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

/** Nombre para PDF / export (misma regla que detalle: na_client con fallback lb_client). */
export function resolveClientNameForExport(
  naClient: string | null | undefined,
  lbClient: string | null | undefined
): string {
  return normalizeClientField(naClient) || normalizeClientField(lbClient);
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
