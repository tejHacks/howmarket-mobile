import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ago, ConfidenceBadge } from '@/components/confidence';
import { Body, Button, Pill, Row } from '@/components/ui';
import { naira } from '@/data/seed';
import { useHowMarket } from '@/data/store';
import { usePalette } from '@/theme';

/** Prices in my area — consensus price per item, per market or area-wide. */
export default function Home() {
  const c = usePalette();
  const hm = useHowMarket();
  const [market, setMarket] = useState<string | 'all'>('all');
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const rows = useMemo(
    () =>
      hm.items
        .filter((it) => `${it.name} ${it.unit}`.toLowerCase().includes(q.toLowerCase()))
        .map((it) => ({ it, cons: hm.priceFor(it.id, market === 'all' ? undefined : market) })),
    [hm, market, q],
  );

  if (!hm.ready) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  if (!hm.profile) return <Redirect href="/login" />;

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}
        refreshControl={
          hm.isDemo ? undefined : (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await hm.refresh();
                setRefreshing(false);
              }}
            />
          )
        }>
        <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel="Your profile and area">
          <Text style={{ color: c.muted }}>
            Hi {hm.profile.name} · 📍 {hm.profile.area} <Text style={{ color: c.primary, fontWeight: '700' }}>change</Text>
          </Text>
        </Pressable>

        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search rice, garri, tomatoes…"
          placeholderTextColor={c.subtle}
          accessibilityLabel="Search goods"
          style={[styles.search, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Pill active={market === 'all'} onPress={() => setMarket('all')}>All {hm.profile.area}</Pill>
          {hm.areaMarkets.map((m) => (
            <Pill key={m.id} active={market === m.id} onPress={() => setMarket(m.id)}>
              {m.name}
            </Pill>
          ))}
        </ScrollView>

        {rows.map(({ it, cons }) => (
          <Pressable
            key={it.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/item/[id]', params: { id: it.id } })}
            style={({ pressed }) => [styles.row, { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}>
            <Text style={{ fontSize: 30 }}>{it.emoji}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.name, { color: c.text }]}>{it.name}</Text>
              <Text style={{ color: c.muted, fontSize: 13 }}>
                {it.unit}
                {cons ? ` · ${cons.reporters} ${cons.reporters === 1 ? 'person' : 'people'} · ${ago(cons.updatedAt)}` : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={[styles.price, { color: c.text }]}>{cons ? naira(cons.price) : '—'}</Text>
              {cons ? <ConfidenceBadge level={cons.confidence} /> : <Text style={{ color: c.subtle, fontSize: 12 }}>No reports yet</Text>}
            </View>
          </Pressable>
        ))}

        {hm.error ? <Body muted style={{ fontSize: 13 }}>Showing the last prices saved on this phone. {hm.error}</Body> : null}
        {hm.isDemo ? <Body muted style={{ fontSize: 13 }}>Demo mode · sample prices, not real quotes.</Body> : null}
      </ScrollView>

      <View style={styles.fab}>
        <Row>
          <Button title="＋ Add a price" style={{ flex: 1 }} onPress={() => router.push('/add')} />
        </Row>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  search: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1 },
  name: { fontSize: 17, fontWeight: '700' },
  price: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  fab: { position: 'absolute', left: 16, right: 16, bottom: 28 },
});
