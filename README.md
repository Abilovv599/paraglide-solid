# paraglide-solid

SolidJS + SolidStart integration for [`@inlang/paraglide-js`](https://inlang.com/m/gerre34r/library-inlang-paraglideJs).

`@inlang/paraglide-solidstart` is deprecated. This package replaces it with a clean, SSR-safe integration that works in both SolidJS SPAs and SolidStart apps.

## How it works

Paraglide message functions call `getLocale()` internally. This package overwrites `getLocale` to read from a SolidJS signal — so any JSX expression that calls a message function is automatically reactive and re-renders when the locale changes. No page reload needed.

There is a **single signal** for the entire app. `locale`, `setLocale`, `<I18nProvider>` and `useI18n()` all share it — no duplication, no sync issues.

---

## Installation

```bash
npm install paraglide-solid
# peer deps
npm install @inlang/paraglide-js solid-js
```

---

## Setup

### 1. Compile Paraglide messages

```bash
npx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/paraglide
```

Or add to `package.json`:

```json
{ "scripts": { "paraglide": "paraglide-js compile --project ./project.inlang" } }
```

With Vite, the plugin handles this automatically:

```ts
// vite.config.ts
import { paraglideVitePlugin } from "@inlang/paraglide-js";

export default defineConfig({
  plugins: [
    solid(),
    paraglideVitePlugin({ project: "./project.inlang", outdir: "./src/paraglide" }),
  ],
});
```

### 2. Create your i18n module

```ts
// src/i18n.ts
import { createI18n } from "paraglide-solid";
import * as runtime from "./paraglide/runtime";

const i18n = createI18n(runtime);
export const { locale, setLocale, I18nProvider, useI18n } = i18n;
```

### 3. Use in components

```tsx
import * as m from "./paraglide/messages";
import { locale, setLocale } from "./i18n";

export default function App() {
  return (
    <div>
      <h1>{m.title()}</h1>
      <button onClick={() => setLocale(locale() === "en" ? "de" : "en")}>
        {locale() === "en" ? "🇩🇪 Deutsch" : "🇬🇧 English"}
      </button>
    </div>
  );
}
```

Message functions are reactive — they re-render automatically when `setLocale` is called.

### Context (optional)

If you prefer not to import `locale`/`setLocale` as singletons, wrap your app in `I18nProvider` and call `useI18n()` inside any component. Both use the **same underlying signal**.

```tsx
// src/app.tsx
import { I18nProvider } from "./i18n";

export default function App() {
  return (
    <I18nProvider>
      <Router />
    </I18nProvider>
  );
}
```

```tsx
// Any component inside <I18nProvider>
import { useI18n } from "./i18n";

function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <button onClick={() => setLocale(locale() === "en" ? "de" : "en")}>
      {locale() === "en" ? "🇩🇪 Deutsch" : "🇬🇧 English"}
    </button>
  );
}
```

---

## Validation error translation

For reactive validation errors, import `createErrorTranslator` from `paraglide-solid/valibot`. For now works only with validation libraries like: Valibot and Yup.

### Setup

```ts
// src/i18n.ts
import { createI18n } from "paraglide-solid";
import { createErrorTranslator } from "paraglide-solid/valibot";
import * as runtime from "./paraglide/runtime";
import * as m from "./paraglide/messages";

const i18n = createI18n(runtime);
export const { locale, setLocale } = i18n;
export const translateError = createErrorTranslator(m);
```

### Supported error shapes

| Library | Error type | Supported           |
|---------|---|---------------------|
| Valibot | `string` | ✓                   |
| Yup     | `string` | ✓ (⚠️NOT TESTED!!!) |

### Schema — use keys instead of translated strings

**Valibot:**
```ts
import * as v from "valibot";

export const contactSchema = v.object({
  name: v.pipe(
    v.string("errNameRequired"),
    v.minLength(2, "errNameMin"),
  ),
  email: v.pipe(
    v.string(),
    v.nonEmpty("errEmailRequired"),
    v.email("errEmailInvalid"),
  ),
});
```

### Messages — add matching keys to your locale files

```json
// messages/en.json
{
  "errNameRequired": "Please enter your name.",
  "errNameMin": "Name must be at least 2 characters long.",
  "errEmailRequired": "Please enter your email address.",
  "errEmailInvalid": "Please enter a valid email address."
}
```

```json
// messages/de.json
{
  "errNameRequired": "Bitte gib deinen Namen ein.",
  "errNameMin": "Der Name muss mindestens 2 Zeichen lang sein.",
  "errEmailRequired": "Bitte gib deine E-Mail-Adresse ein.",
  "errEmailInvalid": "Bitte gib eine gültige E-Mail-Adresse ein."
}
```

Then recompile: `npm run paraglide`

### Component — use `translateError` when rendering errors

```tsx
import { translateError } from "../i18n";

// Valibot
<Show when={field.isTouched && field.errors}>
  <p class="error-msg">{translateError(field.errors![0])}</p>
</Show>
```

`translateError` looks up the key on the messages module at render time. If it matches a message key it calls that function reactively. Otherwise returns the string as-is.

---

## SolidStart (SSR)

### Middleware

Create `src/middleware.ts`:

```ts
import { createMiddleware } from "@solidjs/start/middleware";
import { createI18nMiddleware } from "paraglide-solid/middleware";
import * as runtime from "./paraglide/runtime";

export default createMiddleware({
  onRequest: createI18nMiddleware(runtime),
});
```

Register it in `app.config.ts`:

```ts
import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  middleware: "./src/middleware.ts",
});
```

### Server locale wiring

In your `src/i18n.ts`, additionally call `createServerI18n` so SSR message calls read from the request context:

```ts
// src/i18n.ts
import { createI18n } from "paraglide-solid";
import { createServerI18n } from "paraglide-solid/server";
import { createErrorTranslator } from "paraglide-solid/valibot";
import { getRequestEvent } from "@solidjs/start/server";
import * as runtime from "./paraglide/runtime";
import * as m from "./paraglide/messages";

export const i18n = createI18n(runtime);
export const { locale, setLocale } = i18n;
export const translateError = createErrorTranslator(m);

// Per-request locale resolution during SSR
createServerI18n(runtime, getRequestEvent);
```

---

## API

### `createI18n(runtime)` → `I18nInstance`

| Return         | Type | Description |
|----------------|---|---|
| `locale`       | `Accessor<Locale>` | Reactive locale signal |
| `setLocale`    | `(locale: Locale) => void` | Updates signal + writes cookie, no page reload |
| `I18nProvider` | `(props) => JSX.Element` | Context provider — same signal, no duplication |
| `useI18n`      | `() => { locale, setLocale }` | Hook for components inside `<I18nProvider>` |

### `createErrorTranslator(m)` → `(error) => string`

From `paraglide-solid/valibot`. Pass your compiled `* as m` messages module.

Accepts `string`, `{ message: string }`, `null`, or `undefined`. If the extracted string matches a message key it calls that function reactively. Otherwise returns the string as-is.

### `createServerI18n(runtime, getRequestEvent)`

From `paraglide-solid/server`. Overwrites Paraglide's `getLocale` to read from `event.locals` during SSR. Falls back gracefully on the client.

### `createI18nMiddleware(runtime, options?)`

From `paraglide-solid/middleware`. Returns a SolidStart `onRequest` handler.

| Option | Default | Description |
|---|---|---|
| `cookieName` | `"PARAGLIDE_LOCALE"` | Cookie name |
| `cookieMaxAge` | `34560000` | Cookie expiry in seconds |
| `refreshCookie` | `false` | Refresh cookie on every request |

---

## Migration from `@inlang/paraglide-solidstart`

| Old | New                                                           |
|---|---------------------------------------------------------------|
| `import { useI18n } from "@inlang/paraglide-solidstart"` | `import { createI18n } from "paraglide-solid"`           |
| `useI18n().locale` | `locale` (signal from `createI18n`)                              |
| `useI18n().setLocale("de")` | `setLocale("de")`                                             |
| Middleware from `@inlang/paraglide-solidstart/middleware` | `createI18nMiddleware` from `paraglide-solid/middleware` |

---

## License

MIT
