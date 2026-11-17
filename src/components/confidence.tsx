import { Text, View } from 'react-native';

import type { Confidence } from '@/lib/consensus';

const STYLE: Record<Confidence, { label: string; color: string; bg: string }> = {
  high: { label: 'Verified', color: '#047857', bg: '#D1FAE5' },
  medium: { label: 'Likely', color: '#B45309', bg: '#FEF3C7' },
  low: { label: 'Unconfirmed', color: '#475569', bg: '#E2E8F0' },
};

/** Confidence badge — text + colour, so it never relies on colour alone. */
export function ConfidenceBadge({ level }: { level: Confidence }) {
  const s = STYLE[level];
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color: s.color, fontSize: 11, fontWeight: '800' }}>{s.label.toUpperCase()}</Text>
    </View>
  );
}

export const ago = (t: number) => {
  const h = Math.round((Date.now() - t) / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
};
