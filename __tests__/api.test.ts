import { api, ApiError, normaliseServer } from '@/lib/api';

const SERVER = 'http://127.0.0.1:8001/api';

function mockFetch(status: number, body: unknown) {
  const fn = jest.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response);
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

it('sends the token as a Bearer header and JSON bodies', async () => {
  const fetchFn = mockFetch(201, { report: { id: '1' }, me: {} });
  await api.report(SERVER, 'tok', { item_id: 'rice-50kg', market_id: 'bodija', price: 80000 });
  const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe(`${SERVER}/reports`);
  expect(init.method).toBe('POST');
  expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  expect(JSON.parse(init.body as string)).toEqual({ item_id: 'rice-50kg', market_id: 'bodija', price: 80000 });
});

it('does not send a token when there is none', async () => {
  const fetchFn = mockFetch(200, {});
  await api.snapshot(SERVER, 'Lagos');
  const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe(`${SERVER}/snapshot?area=Lagos`);
  expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
});

it('turns Laravel validation errors into a readable message', async () => {
  mockFetch(422, { message: 'invalid', errors: { email: ['The email has already been taken.'] } });
  await expect(api.register(SERVER, { name: 'Ada', email: 'a@b.co', password: 'secret123', area: 'Ibadan' })).rejects.toMatchObject({
    message: 'The email has already been taken.',
    status: 422,
  });
});

it('keeps the status so the app can tell a daily limit from other errors', async () => {
  mockFetch(429, { message: 'You’ve reached today’s limit of 20 price reports. Try again tomorrow.' });
  const err = await api.report(SERVER, 'tok', { item_id: 'x', market_id: 'y', price: 1 }).catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err.status).toBe(429);
});

it('explains network failures', async () => {
  globalThis.fetch = jest.fn(async () => {
    throw new TypeError('Network request failed');
  }) as unknown as typeof fetch;
  await expect(api.snapshot(SERVER, 'Ibadan')).rejects.toMatchObject({ status: 0, message: expect.stringContaining("Can't reach") });
});

it('only accepts http(s) server addresses', () => {
  expect(normaliseServer(' https://api.example.com/api/ ')).toBe('https://api.example.com/api');
  expect(() => normaliseServer('javascript:alert(1)')).toThrow(ApiError);
  expect(() => normaliseServer('api.example.com')).toThrow(ApiError);
});
