/**
 * paraglide-solid/valibot
 *
 * Generic Valibot error translation for Paraglide.
 *
 * ## Pattern
 *
 * Pass message keys as Valibot error strings instead of translated strings.
 * Keys are resolved to the current locale's translation at render time,
 * making errors reactive to locale changes with no schema rebuilding.
 *
 * ## Setup (once per project)
 *
 * ```ts
 * // src/i18n.ts
 * import * as m from "./paraglide/messages";
 * import { createI18n } from "paraglide-solid";
 * import { createErrorTranslator } from "paraglide-solid/valibot";
 *
 * export const { locale, setLocale } = createI18n(runtime);
 * export const translateError = createErrorTranslator(m);
 * ```
 *
 * ## Schema
 *
 * ```ts
 * const schema = v.object({
 *   name: v.pipe(
 *     v.string("errNameRequired"),
 *     v.minLength(2, "errNameMin"),
 *   ),
 * });
 * ```
 *
 * ## Component
 *
 * ```tsx
 * import { translateError } from "../i18n";
 *
 * <p class="error-msg">{translateError(field.errors![0])}</p>
 * ```
 */

import type { MessageFunction } from "@inlang/paraglide-js";

/** Keep only keys whose values are MessageFunction */
type MessageKeys<T> = Extract<
  {
    [K in keyof T]: T[K] extends MessageFunction ? K : never;
  }[keyof T],
  string
>;

/**
 * Create a `translateError` function bound to your Paraglide messages module.
 *
 * Pass your entire `* as m` import — the translator will look up the error
 * string as a key on the module at call time, so it's always reactive and
 * requires no manual mapping.
 *
 * Strings that don't match any message key are returned as-is, so hardcoded
 * fallback error strings still work.
 *
 * @param messages - Your compiled `* as m` Paraglide messages module
 *
 * @example
 * ```ts
 * import * as m from "./paraglide/messages";
 *
 * export const translateError = createErrorTranslator(m);
 *
 * // In schema:
 * v.minLength(2, "errNameMin")
 *
 * // In component:
 * <p>{translateError(field.errors![0])}</p>
 * ```
 */
export function createErrorTranslator<T extends Record<string, unknown>>(messages: T) {
  type Keys = MessageKeys<T>;

  return (error: Keys | string): string => {
    const fn = messages[error as keyof T];

    if (typeof fn === "function") {
      return (fn as MessageFunction)();
    }

    return error;
  };
}
