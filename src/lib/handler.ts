const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SubscribeError =
  | 'not_configured'
  | 'forbidden'
  | 'invalid_body'
  | 'invalid_email'
  | 'subscription_failed';

export type SubscribeResult = { ok: true } | { ok: false; error: SubscribeError };

/** The parsed JSON request body, so a resolver can read fields such as `locale`. */
export type SubscribeBody = Record<string, unknown>;

export interface SubscribeOptions {
  /** Sent as `X-Subscription-Secret`. Blank or missing means the handler refuses with 503. */
  secret: string | undefined;
  /** The provider's public subscription endpoint, e.g. Listmonk's `/api/public/subscription`. */
  subscriptionUrl: string;
  /**
   * The list to subscribe to: a fixed UUID, or a function of the request body (for one list
   * per locale). Returning `undefined` answers 503 `not_configured`.
   */
  listUuid: string | ((body: SubscribeBody) => string | undefined);
  /**
   * The site's own origin (`url.origin` in an Astro endpoint). When given, requests that a
   * browser marks as cross-site get 403, so other sites' pages can't post the form.
   */
  origin?: string;
  fetchFn?: typeof fetch;
}

function isSameOrigin(request: Request, origin: string): boolean {
  const site = request.headers.get('Sec-Fetch-Site');
  if (site) return site === 'same-origin';
  return request.headers.get('Origin') === origin;
}

export async function handleSubscribe(
  request: Request,
  { secret, subscriptionUrl, listUuid, origin, fetchFn = fetch }: SubscribeOptions
): Promise<Response> {
  // Checked first: an unset secret would otherwise go out as the literal header value
  // "undefined", which a gate that isn't enforced on every network path would accept.
  if (!secret?.trim()) {
    console.error('newsletter-subscribe: the subscription secret is not set; refusing to subscribe');
    return jsonResponse({ ok: false, error: 'not_configured' }, 503);
  }

  if (origin !== undefined && !isSameOrigin(request, origin)) {
    return jsonResponse({ ok: false, error: 'forbidden' }, 403);
  }

  let body: SubscribeBody;
  try {
    const parsed: unknown = await request.json();
    body = parsed !== null && typeof parsed === 'object' ? (parsed as SubscribeBody) : {};
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_body' }, 400);
  }

  const { email } = body;
  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) {
    return jsonResponse({ ok: false, error: 'invalid_email' }, 400);
  }

  const list = typeof listUuid === 'function' ? listUuid(body) : listUuid;
  if (!list) {
    return jsonResponse({ ok: false, error: 'not_configured' }, 503);
  }

  const response = await fetchFn(subscriptionUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Subscription-Secret': secret },
    body: JSON.stringify({ email: email.trim(), list_uuids: [list] }),
  });

  if (!response.ok) {
    return jsonResponse({ ok: false, error: 'subscription_failed' }, 502);
  }

  return jsonResponse({ ok: true });
}

function jsonResponse(body: SubscribeResult, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
