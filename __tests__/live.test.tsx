import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { resetStoredStateCache } from '@/lib/storage';
import { resetTokenCache } from '@/lib/token';

const APP = './src/app';
const me = { id: 'a1b2c3d4e5f6a7b8', name: 'Tolu', email: 'tolu@example.com', area: 'Ibadan', trust: 1, reportsToday: 0, dailyLimit: 20 };
const snapshot = {
  area: 'Ibadan',
  markets: [{ id: 'bodija', name: 'Bodija Market', area: 'Ibadan' }],
  items: [{ id: 'rice-50kg', name: 'Rice', unit: '50kg bag', emoji: '🍚' }],
  reports: [
    { id: '1', itemId: 'rice-50kg', marketId: 'bodija', userId: 'other1', price: 81000, createdAt: new Date().toISOString(), confirms: 0, flags: 0 },
    { id: '2', itemId: 'rice-50kg', marketId: 'bodija', userId: 'other2', price: 83000, createdAt: new Date().toISOString(), confirms: 0, flags: 0 },
  ],
  trust: { other1: 1, other2: 1 },
  myVotes: {},
  me,
};

let calls: { url: string; init: RequestInit }[] = [];

beforeEach(async () => {
  await AsyncStorage.clear();
  resetStoredStateCache();
  resetTokenCache();
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
  calls = [];
  globalThis.fetch = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const path = url.replace(/^https?:\/\/[^/]+\/api/, '');
    const json = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body }) as unknown as Response;
    if (path === '/register') return json(201, { token: '1|secret-token', user: me });
    if (path.startsWith('/snapshot')) return json(200, snapshot);
    return json(404, { message: 'Not found' });
  }) as unknown as typeof fetch;
});

it('creates an account, keeps the token in secure storage only, and shows server prices', async () => {
  await renderRouter(APP, { initialUrl: '/login' });
  await fireEvent.changeText(await screen.findByPlaceholderText('e.g. Tejumade'), 'Tolu');
  await fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'tolu@example.com');
  await fireEvent.changeText(screen.getByPlaceholderText('At least 8 characters'), 'secret123');
  await fireEvent.press(screen.getAllByText('Create account')[1]);

  expect(await screen.findByText('Rice')).toBeOnTheScreen();
  expect(await screen.findByText('₦81,000')).toBeOnTheScreen();

  expect(await SecureStore.getItemAsync('howmarket.token')).toBe('1|secret-token');
  const keys = await AsyncStorage.getAllKeys();
  for (const k of keys) expect(await AsyncStorage.getItem(k)).not.toContain('secret-token');

  await waitFor(() => expect(calls.some((c) => c.url.includes('/snapshot?area=Ibadan'))).toBe(true));
  const snap = calls.find((c) => c.url.includes('/snapshot'))!;
  expect((snap.init.headers as Record<string, string>).Authorization).toBe('Bearer 1|secret-token');
  expect(screen.queryByText(/Demo mode/)).toBeNull();
});
