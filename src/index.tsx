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
import type { I18nInstance, ParaglideRuntime } from "./types";

// ─── createParaglide ──────────────────────────────────────────────────────────

/**
 * Create the reactive Paraglide bridge for SolidJS.
 *
 * Pass your compiled `runtime` module — one call, everything returned.
 *
 * ```ts
 * // src/i18n.ts
 * import { createParaglide } from "paraglide-solid";
 * import * as runtime from "./paraglide/runtime";
 *
 * export const i18n = createParaglide(runtime);
 *
 * // Destructure what you need:
 * export const { locale, setLocale } = i18n;
 * ```
 */
export function createParaglide<Locale extends string>(runtime: ParaglideRuntime<Locale>): I18nInstance<Locale> {
  // Trigger Paraglide's one-time initialization before we overwrite anything.
  const initialLocale = runtime.getLocale();
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
    if (!ctx) throw new Error(
        "[paraglide-solid] useI18n() called outside <I18nProvider>.\n" +
        "Wrap your app root with <I18nProvider>."
    );
    return ctx;
  };

  return { locale: _locale, setLocale, I18nProvider, useI18n };
}

export type { ParaglideRuntime } from "./types";
