import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { ago, ConfidenceBadge } from '@/components/confidence';
import { Body, Button, Card, H1, Label, Row, Screen } from '@/components/ui';
import { naira } from '@/data/seed';
import { useHowMarket } from '@/data/store';
import { usePalette } from '@/theme';

/** One item: price per market, how it was worked out, and the reports behind it. */
export default function ItemScreen() {
  const c = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const hm = useHowMarket();
  const item = hm.items.find((i) => i.id === id);
  if (!item) return <Screen><Body>Item not found.</Body></Screen>;

  const areaCons = hm.priceFor(item.id);

  return (
    <Screen>
      <Stack.Screen options={{ title: item.name }} />
      <Text style={{ fontSize: 48 }}>{item.emoji}</Text>
      <H1>{item.name}</H1>
      <Body muted>{item.unit} · {hm.profile?.area}</Body>

      {areaCons ? (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label>Typical price in {hm.profile?.area}</Label>
            <ConfidenceBadge level={areaCons.confidence} />
          </Row>
          <Text style={{ fontSize: 40, fontWeight: '800', color: c.text }}>{naira(areaCons.price)}</Text>
          <Body muted>
            Range {naira(areaCons.low)} – {naira(areaCons.high)} · {areaCons.reporters} people · updated {ago(areaCons.updatedAt)}
          </Body>
          {areaCons.outliers.length ? (
            <Body muted style={{ fontSize: 13 }}>{areaCons.outliers.length} report(s) ignored as too far from what others saw.</Body>
          ) : null}
        </Card>
      ) : null}

      <Label>By market</Label>
      {hm.areaMarkets.map((m) => {
        const cons = hm.priceFor(item.id, m.id);
        const recent = hm.reports
          .filter((r) => r.itemId === item.id && r.marketId === m.id)
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 4);
        return (
          <Card key={m.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: c.text, fontSize: 17, fontWeight: '700', flex: 1 }}>{m.name}</Text>
              {cons ? <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>{naira(cons.price)}</Text> : <Text style={{ color: c.subtle }}>No reports</Text>}
            </Row>
            {cons ? <ConfidenceBadge level={cons.confidence} /> : null}
            {recent.map((r) => {
              const outlier = cons?.outliers.some((o) => o.id === r.id);
              const voted = hm.votes[r.id];
              return (
                <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6 }}>
                  <Text style={{ color: outlier ? c.subtle : c.text, textDecorationLine: outlier ? 'line-through' : 'none', flex: 1 }}>
                    {naira(r.price)} · {ago(r.createdAt)}
                    {r.confirms ? ` · ✓${r.confirms}` : ''}
                  </Text>
                  {r.userId !== hm.profile?.id ? (
                    <>
                      <Pressable accessibilityLabel="Confirm this price" disabled={!!voted} onPress={() => hm.vote(r.id, 'confirm')} hitSlop={10}>
                        <Text style={{ fontSize: 18, opacity: voted && voted !== 'confirm' ? 0.3 : 1 }}>👍</Text>
                      </Pressable>
                      <Pressable accessibilityLabel="Flag this price as wrong" disabled={!!voted} onPress={() => hm.vote(r.id, 'flag')} hitSlop={10}>
                        <Text style={{ fontSize: 18, opacity: voted && voted !== 'flag' ? 0.3 : 1 }}>🚩</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Text style={{ color: c.subtle, fontSize: 12 }}>yours</Text>
                  )}
                </View>
              );
            })}
          </Card>
        );
      })}

      <Button title={`Add today's ${item.name.toLowerCase()} price`} onPress={() => router.push({ pathname: '/add', params: { item: item.id } })} />
      <Card>
        <Label>How we keep prices honest</Label>
        <Body muted>• Only the last 14 days count, and newer reports count more.</Body>
        <Body muted>• Prices far from what others saw are ignored.</Body>
        <Body muted>• &quot;Verified&quot; needs 3+ different people agreeing in the last 3 days.</Body>
        <Body muted>• 👍 and 🚩 from neighbours raise or lower a report&apos;s weight, and accurate reporters earn more trust.</Body>
      </Card>
    </Screen>
  );
}
