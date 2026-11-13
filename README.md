# @vdaluz/astro-opt-in-newsletter

[![npm version](https://img.shields.io/npm/v/@vdaluz/astro-opt-in-newsletter.svg)](https://www.npmjs.com/package/@vdaluz/astro-opt-in-newsletter)
[![CI](https://github.com/vdaluz/astro-opt-in-newsletter/actions/workflows/ci.yml/badge.svg)](https://github.com/vdaluz/astro-opt-in-newsletter/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@vdaluz/astro-opt-in-newsletter.svg)](LICENSE)

An email newsletter signup for Astro sites on Cloudflare Workers, built the opt-in way: a plain form the visitor chooses to fill in, with no popup, no exit-intent prompt and no tracking. It has two parts:

- **`handleSubscribe`**, a server handler for your own subscribe endpoint. It forwards the address to a Listmonk-style public subscription API with a shared-secret header, and it fails closed: with no secret configured it answers 503 and never calls the provider.
- **`initNewsletterSignup`**, the form behaviour: validation, a busy state, an accessible status message and a confirmation that takes focus.

The markup stays yours, so the form uses your site's own design tokens. Ships raw `.ts`; the consuming app's Astro/Vite compiles it (no prebuild step). It is the newsletter sibling of [`@vdaluz/astro-opt-in-analytics`](https://github.com/vdaluz/astro-opt-in-analytics).

## Install

```
npm install @vdaluz/astro-opt-in-newsletter
```

Peer dependency: `astro` >= 6. No runtime dependencies.

## Usage

### 1. The endpoint

```ts
// src/pages/api/newsletter-subscribe.ts
import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { handleSubscribe } from '@vdaluz/astro-opt-in-newsletter/handler';

export const prerender = false;

export function POST({ request, url }: APIContext) {
  return handleSubscribe(request, {
    secret: env.LISTMONK_SUBSCRIPTION_SECRET,
    subscriptionUrl: 'https://lists.example.com/api/public/subscription',
    listUuid: 'your-list-uuid',
    origin: url.origin,
  });
}
```

Type the secret as optional (`LISTMONK_SUBSCRIPTION_SECRET?: string` in your `cloudflare:workers` declaration). A required `string` type hides the case where the Worker has no secret, and the handler's 503 is what covers it.

For one list per locale, pass a function of the request body instead of a UUID. Returning `undefined` answers 503 `not_configured`:

```ts
listUuid: (body) => LIST_BY_LOCALE[body.locale as Locale],
```

Responses are JSON: `{ "ok": true }` on success, otherwise `{ "ok": false, "error": <code> }`:

| Status | `error` | When |
|---|---|---|
| 503 | `not_configured` | The secret is blank or missing, or no list resolved. The provider is never called. |
| 403 | `forbidden` | `origin` was given and the browser marked the request cross-site (`Sec-Fetch-Site`, or `Origin` when that is absent). |
| 400 | `invalid_body` | The body isn't JSON. |
| 400 | `invalid_email` | `email` is missing or not an address. |
| 502 | `subscription_failed` | The provider answered with a non-2xx status. |

The `origin` check stops other sites' pages from posting your form. It does not stop a script that sets a matching `Origin` header itself, so keep the provider's own double opt-in on.

### 2. The form

Write the markup with your own classes. The behaviour looks for these elements inside the root you pass:

```astro
<section data-newsletter-signup>
  <form novalidate data-invalid-email-message="Enter a valid email address." data-error-message="Something went wrong. Try again in a moment.">
    <label for="newsletter-email">Email</label>
    <input id="newsletter-email" type="email" autocomplete="email" required aria-describedby="newsletter-status" />
    <button type="submit">Subscribe</button>
    <p id="newsletter-status" role="status" aria-live="polite"></p>
  </form>
  <div class="hidden" data-confirmation>
    <h3 tabindex="-1" data-confirmation-heading>Check your inbox</h3>
    <p>We sent a confirmation link to <strong data-confirmation-email></strong>.</p>
  </div>
</section>

<script>
  import { initNewsletterSignup } from '@vdaluz/astro-opt-in-newsletter/client';

  document
    .querySelectorAll<HTMLElement>('[data-newsletter-signup]')
    .forEach((root) => initNewsletterSignup(root, { endpoint: '/api/newsletter-subscribe' }));
</script>
```

What it does:

- An invalid address sets `aria-invalid="true"` on the input and shows the form's invalid message in the status element. `aria-invalid` is cleared for every other outcome, because a server error isn't the address's fault.
- While the request runs, the button gets `aria-busy="true"`. It is not disabled, since disabling the focused button drops focus to `<body>`.
- On success the form hides, the confirmation shows with the address filled in, and its heading takes focus.
- Errors toggle a class on the status element, `text-error` by default. Pass `errorClass` to use another.
- `extraFields` adds fields to the JSON body, for example `{ locale: 'pt' }` for a per-locale list.

### Content Security Policy

Astro may bundle the `<script>` into an external module or inline it, depending on its size. An external module needs only `script-src 'self'`. An inline one needs its hash or a nonce in `script-src`. Check what your build emits before relying on either.

## Contributing

Issues welcome. PRs by discussion: open an issue first for anything beyond a typo or docs fix.

### Releasing

Maintainer-only. Releases are tag-triggered and published to npm via GitHub Actions (Trusted Publishing / OIDC, no token secret):

1. Test before tagging: `npm pack`, install the tarball into a consumer, then run its `astro check`, `astro build` and full accessibility suite.
2. Bump the version with `npm version X.Y.Z --no-git-tag-version`, which updates `package.json` and `package-lock.json` together, then commit both.
3. Tag `vX.Y.Z` and push the tag. Pushing the tag runs `.github/workflows/publish.yml`, which type-checks, tests, verifies the tag matches `package.json`'s version, and only then runs `npm publish`.
4. Confirm the version is live: `npm view @vdaluz/astro-opt-in-newsletter version`.

## Consumers

- [freetoolbox.net](https://freetoolbox.net)
- [imperfectsystems.com](https://imperfectsystems.com)

## License

MIT
