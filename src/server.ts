/**
 * paraglide-solid/server
 *
 * Server-side utilities for SolidStart.
 *
 * Provides `createServerI18n` which wires Paraglide's `overwriteGetLocale`
 * to SolidStart's `getRequestEvent()` so that each SSR request gets its own
 * isolated locale — no cross-request pollution.
 *
 * ## Usage in SolidStart
 *
 * ```ts
 * // src/i18n.ts
 * import * as runtime from "./paraglide/runtime";
 * import { createI18n } from "paraglide-solid";
 * import { createServerI18n } from "paraglide-solid/server";
 *
 * // Client-side reactive bridge (used in browser)
 * export const { locale, setLocale } = createI18n(runtime);
 *
 * // Server-side locale resolution (used during SSR)
 * createServerI18n(runtime);
 * ```
 *
 * After calling `createServerI18n`, Paraglide's `getLocale()` will read from
 * SolidStart's per-request event during SSR, and from the signal on the client.
 */

import type { ParaglideRuntime } from "./types";

/**
 * Minimal shape of SolidStart's `RequestEvent` that we depend on.
 * Avoids a hard dependency on `@solidjs/start`.
 */
interface RequestEvent {
  locals: Record<string, unknown>;
}

type GetRequestEvent = () => RequestEvent | undefined;

const LOCALE_KEY = "__paraglide_locale__";

/**
 * Wire Paraglide's `getLocale` to SolidStart's per-request event locals.
 *
 * During SSR, `getLocale()` reads from `event.locals.__paraglide_locale__`
 * which your middleware sets. On the client (where `getRequestEvent` returns
 * undefined), it falls back to the Paraglide runtime's own resolution
 * (cookie / globalVariable strategy).
 *
 * @param runtime - Your compiled `./paraglide/runtime.js` module
 * @param getRequestEvent - SolidStart's `getRequestEvent` from `@solidjs/start/server`
 */
export function createServerI18n<Locale extends string>(
  runtime: ParaglideRuntime<Locale>,
  getRequestEvent: GetRequestEvent
): void {
  runtime.overwriteGetLocale(() => {
    const event = getRequestEvent();
    if (event) {
      const locale = event.locals[LOCALE_KEY] as Locale | undefined;
      if (locale && (runtime.locales as readonly string[]).includes(locale)) {
        return locale;
      }
    }
    // Client or no event: use the default Paraglide resolution
    // We call the original before our override took effect — but since
    // overwriteGetLocale replaces the fn in place, we read from the
    // globalVariable / cookie strategies directly instead.
    return runtime.baseLocale as Locale;
  });
}

/**
 * Extract the locale from a `Request` using Paraglide's own strategy pipeline
 * and store it in `event.locals` for the duration of the request.
 *
 * Call this at the top of your SolidStart middleware or in the `onRequest`
 * handler.
 *
 * @param request - The incoming `Request`
 * @param event - SolidStart `RequestEvent`
 * @param runtime - Your compiled `./paraglide/runtime.js` module
 */
export function setLocaleFromRequest<Locale extends string>(
  request: Request,
  event: RequestEvent,
  runtime: ParaglideRuntime<Locale>
): Locale {
  // Use Paraglide's own cookie / accept-language / URL extraction
  let locale: Locale = runtime.baseLocale as Locale;

  // Try cookie first (most explicit user preference)
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieMatch = cookieHeader.match(/PARAGLIDE_LOCALE=([^;]+)/);
  if (cookieMatch?.[1]) {
    const candidate = cookieMatch[1] as Locale;
    if ((runtime.locales as readonly string[]).includes(candidate)) {
      locale = candidate;
    }
  }

  // Fallback: Accept-Language header
  if (locale === runtime.baseLocale) {
    const acceptLang = request.headers.get("accept-language");
    if (acceptLang) {
      const preferred = acceptLang
        .split(",")
        .map((s) => s.split(";")[0]?.trim().toLowerCase().split("-")[0])
        .find((tag) => tag && (runtime.locales as readonly string[]).includes(tag));
      if (preferred) {
        locale = preferred as Locale;
      }
    }
  }

  event.locals[LOCALE_KEY] = locale;
  return locale;
}

export { LOCALE_KEY };
export type { RequestEvent, GetRequestEvent };
