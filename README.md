# paraglide-solid

SolidJS + SolidStart integration for [`@inlang/paraglide-js`](https://inlang.com/m/gerre34r/library-inlang-paraglideJs).

`@inlang/paraglide-solidstart` is deprecated. This package replaces it with a clean, SSR-safe integration that works in both SolidJS SPAs and SolidStart apps.

## How it works

Paraglide message functions call `getLocale()` internally. This package overwrites `getLocale` to read from a SolidJS signal — so any JSX expression that calls a message function is automatically reactive and re-renders when the locale changes. No page reload needed.

On the server (SolidStart SSR), locale is read from `event.locals` which is populated by the middleware once per request, preventing cross-request pollution.

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
  plugins: [solid(), paraglideVitePlugin({ project: "./project.inlang", outdir: "./src/paraglide" })],
});
```

### 2. Create your i18n module

```ts
// src/i18n.ts
import * as runtime from "./paraglide/runtime";
import { createI18n } from "paraglide-solid";

export const { locale, setLocale, useLocale } = createI18n(runtime);
```

### 3. Use in components

```tsx
import * as m from "./paraglide/messages";
import { locale, setLocale } from "./i18n";

export default function App() {
  return (
    <div>
      <h1>{m.title()}</h1>
      <p>{m["labelName"]()}</p>

      <button onClick={() => setLocale("de")}>
        {locale() === "en" ? "Switch to DE" : "Switch to EN"}
      </button>
    </div>
  );
}
```

Message functions are reactive — they re-render automatically when `setLocale` is called.

---

## SolidStart (SSR)

### Middleware

Create `src/middleware.ts`:

```ts
import { createMiddleware } from "@solidjs/start/middleware";
import { createParaglideMiddleware } from "paraglide-solid/middleware";
import * as runtime from "./paraglide/runtime";

export default createMiddleware({
  onRequest: createParaglideMiddleware(runtime),
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
import * as runtime from "./paraglide/runtime";
import { createI18n } from "paraglide-solid";
import { createServerI18n } from "paraglide-solid/server";
import { getRequestEvent } from "@solidjs/start/server";

// Client: reactive signal bridge
export const { locale, setLocale } = createI18n(runtime);

// Server: per-request locale from event.locals
createServerI18n(runtime, getRequestEvent);
```

### Root layout with LocaleProvider

For components that use `useLocaleContext()`:

```tsx
// src/app.tsx
import { LocaleProvider } from "paraglide-solid";
import { locale, setLocale } from "./i18n";

export default function App() {
  return (
    <LocaleProvider locale={locale()} setLocale={setLocale}>
      <Router />
    </LocaleProvider>
  );
}
```

### Reading locale in a component via context

```tsx
import { useLocaleContext } from "paraglide-solid";

function LocaleSwitcher() {
  const { locale, setLocale } = useLocaleContext<"en" | "de">();
  return (
    <button onClick={() => setLocale(locale() === "en" ? "de" : "en")}>
      {locale() === "en" ? "🇩🇪 Deutsch" : "🇬🇧 English"}
    </button>
  );
}
```

---

## API

### `createI18n(runtime)` → `{ locale, setLocale, useLocale }`

Creates the reactive bridge. Call once in `src/i18n.ts`.

| Return | Type | Description |
|---|---|---|
| `locale` | `Accessor<Locale>` | Reactive locale signal |
| `setLocale` | `(locale: Locale) => void` | Updates signal + Paraglide strategies (no page reload) |
| `useLocale` | `() => Accessor<Locale>` | Hook-style accessor, same as `locale` |

### `createServerI18n(runtime, getRequestEvent)`

Overwrites Paraglide's `getLocale` to read from `event.locals` during SSR.
Safe to call alongside `createI18n` — on the client `getRequestEvent` returns `undefined` and it falls back to the signal.

### `createParaglideMiddleware(runtime, options?)`

Returns a SolidStart `onRequest` handler. Options:

| Option | Default | Description |
|---|---|---|
| `cookieName` | `"PARAGLIDE_LOCALE"` | Cookie name |
| `cookieMaxAge` | `34560000` | Cookie expiry in seconds |
| `refreshCookie` | `false` | Refresh cookie on every request |

### `<LocaleProvider locale setLocale>`

Context provider for SSR-safe locale passing. Wraps your app root.

### `useLocaleContext<Locale>()`

Read locale and setLocale from the nearest `<LocaleProvider>`. Throws if no provider found.

---

## Reactive validation errors (Valibot + Formisch)

Valibot schema error strings are captured at schema construction time. To make them translate when the locale changes, wrap the schema in a function and use SolidJS's keyed `<Show>` to remount the form:

```tsx
import { Show, createSignal } from "solid-js";
import { createForm, Form, Field } from "@formisch/solid";
import * as v from "valibot";
import * as m from "./paraglide/messages";
import { locale } from "./i18n";

function buildSchema() {
  return v.object({
    name: v.pipe(v.string(m["errNameRequired"]()), v.minLength(2, m["errNameMin"]())),
  });
}

export default function App() {
  const [snapshot, setSnapshot] = createSignal({});

  return (
    // keyed remount when locale changes — buildSchema() re-runs with new locale
    <Show when={locale()} keyed>
      {() => {
        const form = createForm({ schema: buildSchema(), initialInput: snapshot() });
        return <Form of={form}>...</Form>;
      }}
    </Show>
  );
}
```

---

## Migration from `@inlang/paraglide-solidstart`

| Old | New |
|---|---|
| `import { useI18n } from "@inlang/paraglide-solidstart"` | `import { createI18n } from "paraglide-solid"` |
| `useI18n().locale` | `locale` (signal from `createI18n`) |
| `useI18n().setLocale("de")` | `setLocale("de")` |
| Middleware from `@inlang/paraglide-solidstart/middleware` | `createParaglideMiddleware` from `paraglide-solid/middleware` |

---

## License

MIT
