import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { handleSubscribe, type SubscribeOptions } from '../src/lib/handler.ts';

const ORIGIN = 'https://example.com';
const SUBSCRIPTION_URL = 'https://lists.example.com/api/public/subscription';
const LIST = '00000000-0000-4000-8000-000000000001';

function post(body: string, headers: Record<string, string> = { 'Sec-Fetch-Site': 'same-origin' }) {
  return new Request(`${ORIGIN}/api/newsletter-subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  });
}

function fakeFetch(status = 200) {
  return mock.fn<typeof fetch>(async () => new Response('{}', { status }));
}

function options(overrides: Partial<SubscribeOptions> = {}): SubscribeOptions {
  return {
    secret: 's',
    subscriptionUrl: SUBSCRIPTION_URL,
    listUuid: LIST,
    origin: ORIGIN,
    fetchFn: fakeFetch(),
    ...overrides,
  };
}

async function read(response: Response) {
  return { status: response.status, body: await response.json() };
}

const validBody = JSON.stringify({ email: 'reader@example.com' });

describe('handleSubscribe', () => {
  afterEach(() => mock.restoreAll());

  for (const secret of [undefined, '', '   ']) {
    it(`refuses with 503 not_configured and never calls the provider when the secret is ${JSON.stringify(secret)}`, async () => {
      mock.method(console, 'error', () => {});
      const fetchFn = fakeFetch();
      const result = await read(await handleSubscribe(post(validBody), options({ secret, fetchFn })));
      assert.deepEqual(result, { status: 503, body: { ok: false, error: 'not_configured' } });
      assert.equal(fetchFn.mock.callCount(), 0);
    });
  }

  it('rejects a cross-site request with 403 forbidden', async () => {
    const fetchFn = fakeFetch();
    const request = post(validBody, { 'Sec-Fetch-Site': 'cross-site' });
    const result = await read(await handleSubscribe(request, options({ fetchFn })));
    assert.deepEqual(result, { status: 403, body: { ok: false, error: 'forbidden' } });
    assert.equal(fetchFn.mock.callCount(), 0);
  });

  it('accepts a matching Origin header when Sec-Fetch-Site is absent', async () => {
    const result = await read(await handleSubscribe(post(validBody, { Origin: ORIGIN }), options()));
    assert.deepEqual(result, { status: 200, body: { ok: true } });
  });

  it('skips the same-origin check when no origin is given', async () => {
    const request = post(validBody, { 'Sec-Fetch-Site': 'cross-site' });
    const result = await read(await handleSubscribe(request, options({ origin: undefined })));
    assert.deepEqual(result, { status: 200, body: { ok: true } });
  });

  it('rejects a body that is not JSON with 400 invalid_body', async () => {
    const fetchFn = fakeFetch();
    const result = await read(await handleSubscribe(post('not json'), options({ fetchFn })));
    assert.deepEqual(result, { status: 400, body: { ok: false, error: 'invalid_body' } });
    assert.equal(fetchFn.mock.callCount(), 0);
  });

  for (const body of [
    JSON.stringify({ email: 'not-an-email' }),
    JSON.stringify({}),
    JSON.stringify(null),
    JSON.stringify({ email: 42 }),
  ]) {
    it(`rejects ${body} with 400 invalid_email`, async () => {
      const fetchFn = fakeFetch();
      const result = await read(await handleSubscribe(post(body), options({ fetchFn })));
      assert.deepEqual(result, { status: 400, body: { ok: false, error: 'invalid_email' } });
      assert.equal(fetchFn.mock.callCount(), 0);
    });
  }

  it('answers 502 subscription_failed when the provider rejects the request', async () => {
    const result = await read(
      await handleSubscribe(post(validBody), options({ fetchFn: fakeFetch(500) }))
    );
    assert.deepEqual(result, { status: 502, body: { ok: false, error: 'subscription_failed' } });
  });

  it('subscribes the trimmed address to the list with the secret header', async () => {
    const fetchFn = fakeFetch();
    const request = post(JSON.stringify({ email: '  reader@example.com ' }));
    const result = await read(
      await handleSubscribe(request, options({ secret: 'the-secret', fetchFn }))
    );
    assert.deepEqual(result, { status: 200, body: { ok: true } });
    assert.equal(fetchFn.mock.callCount(), 1);
    const [url, init] = fetchFn.mock.calls[0].arguments;
    assert.equal(url, SUBSCRIPTION_URL);
    assert.equal(init?.method, 'POST');
    assert.equal(new Headers(init?.headers).get('X-Subscription-Secret'), 'the-secret');
    assert.deepEqual(JSON.parse(String(init?.body)), {
      email: 'reader@example.com',
      list_uuids: [LIST],
    });
  });

  describe('with a list resolver', () => {
    const byLocale: Record<string, string> = {
      en: '00000000-0000-4000-8000-0000000000e1',
      pt: '00000000-0000-4000-8000-0000000000e2',
    };
    const resolver = (body: Record<string, unknown>) =>
      byLocale[typeof body.locale === 'string' ? body.locale : 'en'];

    it('subscribes to the list the resolver picks from the body', async () => {
      const fetchFn = fakeFetch();
      const request = post(JSON.stringify({ email: 'a@example.com', locale: 'pt' }));
      await handleSubscribe(request, options({ listUuid: resolver, fetchFn }));
      const [, init] = fetchFn.mock.calls[0].arguments;
      assert.deepEqual(JSON.parse(String(init?.body)).list_uuids, [byLocale.pt]);
    });

    it('answers 503 not_configured when the resolver finds no list', async () => {
      const fetchFn = fakeFetch();
      const request = post(JSON.stringify({ email: 'a@example.com', locale: 'fr' }));
      const result = await read(await handleSubscribe(request, options({ listUuid: resolver, fetchFn })));
      assert.deepEqual(result, { status: 503, body: { ok: false, error: 'not_configured' } });
      assert.equal(fetchFn.mock.callCount(), 0);
    });
  });
});
