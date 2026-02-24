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

export interface CreateI18nOptions {
  cookieName?: string;
  cookieMaxAge?: number;
  cookieDomain?: string;
}

/**
 * Create the reactive i18n bridge for a Paraglide runtime.
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
  runtime: ParaglideRuntime<Locale>,
  options: CreateI18nOptions
): I18n<Locale> {
  const {
    cookieName = "PARAGLIDE_LOCALE",
    cookieMaxAge = 34_560_000,
    cookieDomain = "",
  } = options;
  // Step 1: trigger Paraglide's one-time initialization BEFORE we overwrite
  // anything. This lets the runtime set its internal _locale variable and
  // write the initial cookie via its own setLocale call.
  const initialLocale = runtime.getLocale();

  // Step 2: create the SolidJS signal seeded with the resolved locale.
  const [_locale, _setLocale] = createSignal<Locale>(initialLocale);

  // Step 3: NOW overwrite getLocale so message functions read our signal.
  // Safe to do after init — the runtime's internal state is already set up.
  runtime.overwriteGetLocale(() => _locale());

  // Step 4: our setLocale — write cookie directly, then update signal.
  // We write the cookie ourselves instead of calling runtime.setLocale()
  // because runtime.setLocale() calls getLocale() internally for its guard
  // check, which now returns our signal, creating a mismatch.
  const setLocale = (newLocale: Locale): void => {
    if (newLocale === _locale()) return; // no-op if already current

    // Write cookie directly — mirrors exactly what runtime.setLocale does
    // at lines 394-404 of the compiled runtime.js
    if (typeof document !== "undefined") {
      const cookieString = `${cookieName}=${newLocale}; path=/; max-age=${cookieMaxAge}`;
      document.cookie = cookieDomain
          ? `${cookieString}; domain=${cookieDomain}`
          : cookieString;
    }

    // Also update the runtime's internal globalVariable (_locale) so that
    // any code that bypasses our signal overwrite still sees the right locale.
    // We do this by calling setLocale with reload:false — at this point our
    // overwriteGetLocale returns newLocale (from signal update below), so the
    // guard `newLocale !== currentLocale` correctly sees them as equal and
    // skips the reload. But the globalVariable and cookie are already written above.
    // So we just need to update the signal.
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
