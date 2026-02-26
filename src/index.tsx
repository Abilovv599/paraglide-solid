/**
 * @inlang/paraglide-solid
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
 * import { createI18n } from "@inlang/paraglide-solid";
 *
 * export const { locale, setLocale } = createI18n(runtime);
 * ```
 */

import type { Runtime as ParaglideRuntime } from "@inlang/paraglide-js";
import { type Accessor, createContext, createSignal, type JSX, useContext } from "solid-js";
import type { I18nInstance } from "./types";

// ─── createI18n ──────────────────────────────────────────────────────────

/**
 * Create the reactive Paraglide bridge for SolidJS.
 *
 * Pass your compiled `runtime` module — one call, everything returned.
 *
 * ```ts
 * // src/i18n.ts
 * import { createI18n } from "@inlang/paraglide-solid";
 * import * as runtime from "./paraglide/runtime";
 *
 * export const i18n = createI18n(runtime);
 *
 * // Destructure what you need:
 * export const { locale, setLocale } = i18n;
 * ```
 */
export function createI18n<Locale extends string>(runtime: ParaglideRuntime): I18nInstance<Locale> {
  // Trigger Paraglide's one-time initialization before we overwrite anything.
  const initialLocale: Locale = runtime.getLocale();
  let currentLocale: Locale = initialLocale;

  // Single signal — shared by the returned accessors AND the context.
  const [_locale, _setLocale] = createSignal<Locale>(initialLocale);

  // Overwrite getLocale so message functions read our signal and become reactive.
  runtime.overwriteGetLocale(() => _locale());

  const setLocale = (newLocale: Locale): void => {
    if (newLocale === currentLocale) return;
    currentLocale = newLocale;
    runtime.setLocale(newLocale, { reload: false });
    _setLocale(() => newLocale);
  };

  // Context holds references to the SAME signal — not a copy.
  const I18nContext = createContext<{
    locale: Accessor<Locale>;
    setLocale: (locale: Locale) => void;
  }>();

  const I18nProvider = (props: { children: JSX.Element }) => (
    <I18nContext.Provider value={{ locale: _locale, setLocale }}>
      {props.children}
    </I18nContext.Provider>
  );

  const useI18n = () => {
    const ctx = useContext(I18nContext);
    if (!ctx)
      throw new Error(
        "[@inlang/paraglide-solid] useI18n() called outside <I18nProvider>.\n" +
          "Wrap your app root with <I18nProvider>.",
      );
    return ctx;
  };

  return { locale: _locale, setLocale, I18nProvider, useI18n };
}
