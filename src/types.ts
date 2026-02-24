/**
 * Minimal shape of the Paraglide runtime module that this package depends on.
 * Users pass their compiled `./paraglide/runtime.js` as a generic parameter
 * so we stay decoupled from any specific project's locale union type.
 */
export interface ParaglideRuntime<Locale extends string = string> {
  getLocale: () => Locale;
  setLocale: (locale: Locale, options?: { reload?: boolean }) => void;
  overwriteGetLocale: (fn: () => Locale) => void;
  overwriteSetLocale: (fn: (locale: Locale, options?: { reload?: boolean }) => void) => void;
  baseLocale: Locale;
  locales: readonly Locale[];
}
