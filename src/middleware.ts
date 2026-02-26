/**
 * paraglide-solid/middleware
 *
 * SolidStart middleware factory for Paraglide locale detection.
 *
 * ## Usage
 *
 * ```ts
 * // src/middleware.ts  (SolidStart entry point for server middleware)
 * import { createMiddleware } from "@solidjs/start/middleware";
 * import { createI18nMiddleware } from "paraglide-solid/middleware";
 * import * as runtime from "./paraglide/runtime";
 *
 * export default createMiddleware({
 *   onRequest: createI18nMiddleware(runtime),
 * });
 * ```
 *
 * The middleware:
 * 1. Extracts the locale from the request (cookie → Accept-Language → baseLocale)
 * 2. Stores it in `event.locals` so SSR message functions use the right locale
 * 3. Sets the `Set-Cookie` header on the response when the locale changes
 */

import type { Runtime as ParaglideRuntime } from "@inlang/paraglide-js";
import type { MiddlewareFn } from "@solidjs/start/middleware";
import type { FetchEvent as MiddlewareEvent } from "@solidjs/start/server";
import { LOCALE_KEY, setLocaleFromRequest } from "./server";

/**
 * Create a SolidStart `onRequest` middleware handler that detects and stores
 * the locale for every incoming SSR request.
 *
 * @param runtime - Your compiled `./paraglide/runtime.js` module
 * @param options  - Optional configuration
 */
export function createI18nMiddleware(
  runtime: ParaglideRuntime,
  options: {
    /**
     * Cookie name to read/write the locale preference.
     * @default "PARAGLIDE_LOCALE"
     */
    cookieName?: string;
    /**
     * Cookie max-age in seconds.
     * @default 34560000 (~400 days)
     */
    cookieMaxAge?: number;
    /**
     * If true, refreshes the locale cookie on every request so it stays fresh.
     * @default false
     */
    refreshCookie?: boolean;
  } = {},
): MiddlewareFn {
  const {
    cookieName = "PARAGLIDE_LOCALE",
    cookieMaxAge = 34_560_000,
    refreshCookie = false,
  } = options;

  return async (event: MiddlewareEvent) => {
    const locale = setLocaleFromRequest(event.request, event, runtime);

    // Optionally refresh the cookie on each request so it doesn't expire
    if (refreshCookie) {
      event.response.headers.append(
        "Set-Cookie",
        `${cookieName}=${locale}; Path=/; Max-Age=${cookieMaxAge}; SameSite=Lax`,
      );
    }

    // Store resolved locale in locals for downstream use
    event.locals[LOCALE_KEY] = locale;
  };
}
