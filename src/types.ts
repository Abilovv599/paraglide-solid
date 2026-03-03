import type { Runtime as ParaglideRuntime } from "@inlang/paraglide-js";
import type { Accessor, JSX } from "solid-js";

export type InferLocale<T extends ParaglideRuntime> = T["locales"][number];

/**
 * The full Paraglide bridge instance returned by `createI18n()`.
 * Contains everything you need to integrate Paraglide with SolidJS.
 */
export interface I18nInstance<T extends string> {
  /** Reactive accessor for the current locale. */
  locale: Accessor<T>;

  /** Set locale — writes cookie + updates signal, no page reload. */
  setLocale: (newLocale: T) => void;

  /**
   * Context provider — wraps a subtree so any component inside can call
   * `useI18n()` to access the same locale signal without prop drilling.
   *
   * Uses the same underlying signal as `locale` and `setLocale` — no
   * duplication, no sync issues.
   *
   * ```tsx
   * // src/app.tsx
   * import { I18nProvider } from "./i18n";
   *
   * export default function App() {
   *   return (
   *     <I18nProvider>
   *       <Router />
   *     </I18nProvider>
   *   );
   * }
   * ```
   */
  I18nProvider: (props: { children: JSX.Element }) => JSX.Element;

  /**
   * Hook to access locale and setLocale from any component inside `<I18nProvider>`.
   *
   * ```tsx
   * import { useI18n } from "./i18n";
   *
   * function LocaleSwitcher() {
   *   const { locale, setLocale } = useI18n();
   *
   *   return <button onClick={() => setLocale("de")}>{locale()}</button>;
   * }
   * ```
   */
  useI18n: () => {
    locale: Accessor<T>;
    setLocale: (locale: T) => void;
  };
}
