export function buildModuleSearchPlaceholder(moduleName: string): string {
  return moduleName ? `${moduleName}...` : '';
}
