# CLAUDE.md

## What this repo is

`@vdaluz/astro-opt-in-newsletter`: the newsletter signup shared by the vdaluz.com-family sites. A fail-closed subscribe handler for Listmonk-style public subscription endpoints, plus the form behaviour; each site keeps its own markup. Consumed as an npm-registry semver pin by the sites in the README's Consumers section; tracked in Plane under the AST project. Created by AST-124 to replace six diverged per-site copies.

## Commands

```bash
npm run check   # astro check (typecheck)
npm test        # node --test
```

## Workflow

Shared preamble: `.claude/rules/git-workflow-direct-to-main.md`.

## Plane (AST project)

Project ID, state UUIDs, and label UUIDs: **`.claude/plane.yml`**.

## Conventions

Shared `@vdaluz/astro-*` conventions (raw source/no build step, per-path exports, `.ts` extensions on relative imports):
`.claude/rules/astro-package-conventions.md`. This package's exports map: `.`, `./handler`, `./client`.

- **Dependency-free.** Keep it that way; the handler and client are small enough not to need one.
- **No site data in this repo.** List UUIDs, subscription hosts, secrets and copy live in each consumer. Docs and tests use `example.com` values only.
- **The secret guard runs first.** `handleSubscribe` refuses with 503 before parsing the body or calling the provider when the secret is blank. Never move a provider call ahead of it.
- **Markup belongs to the consumer.** The client finds its elements by role and data attributes (see `initNewsletterSignup`'s doc comment). Don't ship a styled component unless a token contract covers every class it needs.
- **No dark patterns.** No popups, exit-intent triggers, scroll locks or pre-checked boxes, the same rule as `astro-opt-in-analytics`. Do not add options for them.
- **SSR-safe modules.** `src/lib/handler.ts` and `src/index.ts` must not touch `window` or `document`. Only `src/lib/client.ts` may assume a browser, and `src/index.ts` exports it as a type only.

## Release process

Same tag-then-npm-publish process shared by all `@vdaluz/*` component libraries, consumed via npm-registry semver pins. See the README's "Releasing" section for the concrete steps. The first publish of a new package can't use the tag workflow: the npm package must exist before a Trusted Publisher can be added, so 0.1.0 is published by hand by the maintainer.

## Consumers

The README's Consumers section is the single list. Update it when a repo adds or drops its `@vdaluz/astro-opt-in-newsletter` dependency (`grep -l '"@vdaluz/astro-opt-in-newsletter"' ~/Repos/*/package.json`).
