import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { resetStoredStateCache } from '@/lib/storage';

const APP = './src/app';

beforeEach(async () => {
  await AsyncStorage.clear();
  resetStoredStateCache();
});

it('sends new users to sign in, then shows prices for their area (demo mode)', async () => {
  await renderRouter(APP, { initialUrl: '/' });
  const name = await screen.findByPlaceholderText('e.g. Tejumade');
  await fireEvent.changeText(name, 'Tolu');
  await fireEvent.press(screen.getByText('Continue'));
  expect(await screen.findByPlaceholderText('Search rice, garri, tomatoes…')).toBeOnTheScreen();
  expect(await screen.findByText('Rice')).toBeOnTheScreen();
  expect(JSON.parse((await AsyncStorage.getItem('profile'))!).name).toBe('Tolu');
});

it('search filters the price list', async () => {
  await AsyncStorage.setItem('profile', JSON.stringify({ id: 'me', name: 'Tolu', area: 'Ibadan', trust: 1 }));
  await renderRouter(APP, { initialUrl: '/' });
  await screen.findByText('Rice');
  await fireEvent.changeText(screen.getByPlaceholderText('Search rice, garri, tomatoes…'), 'garri');
  expect(screen.queryByText('Rice')).toBeNull();
  expect(screen.getByText('Garri (white)')).toBeOnTheScreen();
});
