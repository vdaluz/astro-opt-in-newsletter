# Changelog

All notable changes to this project are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [0.1.0] - 2026-11-13

### Added

- `handleSubscribe(request, options)` from `@vdaluz/astro-opt-in-newsletter/handler`: forwards a signup to a Listmonk-style public subscription endpoint with an `X-Subscription-Secret` header. Answers 503 `not_configured` without calling the provider when the secret is blank or no list resolves, 403 `forbidden` for cross-site browser requests when `origin` is given, 400 for a bad body or address, and 502 when the provider fails. `listUuid` takes a UUID or a function of the request body, for one list per locale.
- `initNewsletterSignup(root, options)` from `@vdaluz/astro-opt-in-newsletter/client`: the form behaviour, with `aria-invalid` only for a bad address, `aria-busy` instead of disabling the focused button, and focus moved to the confirmation on success.
