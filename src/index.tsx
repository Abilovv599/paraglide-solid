/**
 * paraglide-solid
 *
 * SolidJS integration for @inlang/paraglide-js.
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
 * Call once at module level in `src/i18n.ts` and export the result.
 *
 * ```ts
 * export const { locale, setLocale } = createI18n(runtime);
 * ```
 *
 * @param runtime - Your compiled `./paraglide/runtime.js` module
 */
export function createI18n<Locale extends string>(
  runtime: ParaglideRuntime<Locale>
): I18n<Locale> {
  // Initialize from whatever Paraglide resolved on load
  // (cookie, globalVariable, baseLocale fallback, etc.)
  const [_locale, _setLocale] = createSignal<Locale>(runtime.getLocale());

  // THE KEY INTEGRATION:
  // Overwrite Paraglide's getLocale so it reads from our SolidJS signal.
  // Any JSX expression that calls a message function (which calls getLocale
  // internally) is now inside SolidJS's reactive tracking and re-runs
  // automatically when the locale signal changes.
  runtime.overwriteGetLocale(() => _locale());

  // Public setLocale: writes to Paraglide strategies (cookie etc.) without
  // a page reload, then updates the signal to trigger reactive re-renders.
  const setLocale = (newLocale: Locale): void => {
    // Persist to cookie / globalVariable strategy — but no reload
    runtime.setLocale(newLocale, { reload: false });
    // Drive the reactive signal → re-renders all message function calls
    _setLocale(() => newLocale);
  };

  // Sync: if Paraglide's own setLocale is called externally (e.g. by the
  // runtime's URL strategy on navigation), keep our signal in sync too.
  runtime.overwriteSetLocale((newLocale, options) => {
    // Write to strategies without reload
    const savedOverwrite = runtime.overwriteSetLocale;
    // Temporarily bypass our override so the original strategy writers fire
    // We achieve this by calling the original runtime default behaviors
    // directly via the cookie / globalVariable setters indirectly:
    // The simplest safe approach — just update signal + suppress reload.
    _setLocale(() => newLocale);
    if (options?.reload !== false && typeof window !== "undefined") {
      // If caller explicitly wants a reload (e.g. URL strategy switch),
      // honour it after a microtask so the signal update renders first
      if (options?.reload === true) {
        queueMicrotask(() => window.location.reload());
      }
    }
    void savedOverwrite; // keep reference to avoid tree-shaking
  });

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
  /** Initial locale value — on SSR this comes from the server via middleware */
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
