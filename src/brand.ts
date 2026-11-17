import { defineBrand } from './lib/brand-type';

export const brand = defineBrand({
  name: 'HowMarket',
  colors: { primary: '#EA580C', primaryText: '#FFFFFF', accent: '#16A34A' },
  screens: [
    { name: 'index', title: 'HowMarket', large: true },
    { name: 'login', title: 'Welcome' },
    { name: 'item/[id]', title: 'Item' },
    { name: 'add', title: 'Add a price', modal: true },
    { name: 'profile', title: 'Profile' },
  ],
});
