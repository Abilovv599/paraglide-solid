/**
 * paraglide-solid
 *
 * SolidJS + SolidStart integration for @inlang/paraglide-js.
 *
 * Bridges Paraglide's imperative locale system (getLocale / setLocale) to
 * SolidJS's reactive signal model so that message function calls inside JSX
 * automatically re-render when the locale changes — without a page reload.
 *
 * ## Usage
 *
 * ```tsx
 * // src/i18n.ts
 * import * as runtime from "./paraglide/runtime";
 * import { createI18n } from "paraglide-solid";
 *
 * export const { locale, setLocale } = createI18n(runtime);
 * ```
 */

import {
  createSignal,
  createContext,
  useContext,
  type Accessor,
  type JSX,
} from "solid-js";
import type { ParaglideRuntime } from "./types";

// ─── Core: createI18n ────────────────────────────────────────────────────────

export interface I18n<Locale extends string> {
  /**
   * Reactive accessor for the current locale.
   * Reading inside JSX / createMemo / createEffect establishes a reactive
   * dependency — the consumer re-runs automatically when the locale changes.
   */
  locale: Accessor<Locale>;

  /**
   * Set the locale. Updates the SolidJS signal AND writes through to
   * Paraglide's configured strategies (cookie, globalVariable, etc.)
   * without reloading the page.
   */
  setLocale: (newLocale: Locale) => void;

  /**
   * Hook-style accessor, identical to `locale`.
   * Provided for ergonomics in components that prefer hook conventions.
   */
  useLocale: () => Accessor<Locale>;
}

/**
 * Create the reactive i18n bridge for a Paraglide runtime.
 *
 * - Uses runtime.setLocale() for ALL cookie/strategy persistence (no DIY cookie code)
 * - Overwrites getLocale() so message functions are reactive in SolidJS JSX
 * - Keeps a separate currentLocale ref in sync with runtime so setLocale's
 *   internal guard always sees the correct previous value
 *
 * ```ts
 * // src/i18n.ts
 * import * as runtime from "./paraglide/runtime";
 * import { createI18n } from "paraglide-solid";
 *
 * export const { locale, setLocale } = createI18n(runtime);
 * ```
 */
export function createI18n<Locale extends string>(
  runtime: ParaglideRuntime<Locale>
): I18n<Locale> {
  // Initialize Paraglide first — sets internal _locale, writes initial cookie.
  const initialLocale = runtime.getLocale();

  // Keep a mutable ref that mirrors the runtime's internal _locale.
  // This is what our overwritten getLocale returns during setLocale calls,
  // so the runtime's guard check `newLocale !== currentLocale` works correctly.
  let currentLocale: Locale = initialLocale;

  const [_locale, _setLocale] = createSignal<Locale>(initialLocale);

  // Overwrite getLocale to return our tracked currentLocale.
  // Inside reactive JSX this reads from _locale() via the signal;
  // during setLocale's internal call it reads currentLocale directly.
  // Both paths return the same value — but the signal path is reactive.
  runtime.overwriteGetLocale(() => {
    // Reading _locale() here establishes reactive tracking in JSX contexts.
    // The return value equals currentLocale between setLocale calls.
    return _locale();
  });

  const setLocale = (newLocale: Locale): void => {
    if (newLocale === currentLocale) return;

    // Update our ref BEFORE calling runtime.setLocale so that when the runtime
    // calls getLocale() internally to get currentLocale, it gets newLocale back.
    // This means `newLocale !== currentLocale` inside the runtime evaluates to
    // false (they match), so the reload is skipped cleanly.
    // More importantly: the runtime still runs all strategy writers (cookie etc.)
    // BEFORE it reaches the reload check.
    currentLocale = newLocale;

    // runtime.setLocale handles ALL persistence: cookie, globalVariable, etc.
    // reload: false ensures no page reload.
    runtime.setLocale(newLocale, { reload: false });

    // Update signal → triggers reactive re-render of all message function calls.
    _setLocale(() => newLocale);
  };

  return {
    locale: _locale,
    setLocale,
    useLocale: () => _locale,
  };
}

// ─── Context API (SSR / SolidStart) ─────────────────────────────────────────

export interface LocaleContextValue<Locale extends string = string> {
  locale: Accessor<Locale>;
  setLocale: (locale: Locale) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LocaleContext = createContext<LocaleContextValue<any>>();

export interface LocaleProviderProps<Locale extends string> {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  children: JSX.Element;
}

/**
 * SSR-safe locale context for SolidStart.
 *
 * Wrap your root layout so any component can call `useLocaleContext()` to
 * read or update the locale without importing the singleton directly.
 *
 * ```tsx
 * // src/app.tsx
 * import { LocaleProvider } from "paraglide-solid";
 * import { locale, setLocale } from "./i18n";
 *
 * export default function App() {
 *   return (
 *     <LocaleProvider locale={locale()} setLocale={setLocale}>
 *       <Router />
 *     </LocaleProvider>
 *   );
 * }
 * ```
 */
export function LocaleProvider<Locale extends string>(
    props: LocaleProviderProps<Locale>
) {
  const [_locale, _setLocale] = createSignal<Locale>(props.locale);

  const value: LocaleContextValue<Locale> = {
    locale: _locale,
    setLocale: (newLocale: Locale) => {
      props.setLocale(newLocale);
      _setLocale(() => newLocale);
    },
  };

  return (
    <LocaleContext.Provider value={value}>
      {props.children}
    </LocaleContext.Provider>
  );
}

/**
 * Read locale and setLocale from the nearest `<LocaleProvider>`.
 *
 * Throws if called outside a provider — this makes missing providers an
 * obvious error rather than a silent wrong-locale bug.
 */
export function useLocaleContext<Locale extends string = string>(): LocaleContextValue<Locale> {
  const ctx = useContext(LocaleContext) as LocaleContextValue<Locale> | undefined;
  if (!ctx) {
    throw new Error(
      "[paraglide-solid] useLocaleContext() was called outside a <LocaleProvider>.\n" +
      "Wrap your app root with <LocaleProvider locale={locale()} setLocale={setLocale}>."
    );
  }
  return ctx;
}

export type { ParaglideRuntime } from "./types";
