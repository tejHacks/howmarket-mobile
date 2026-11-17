import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Body, Button, Field, Label, Pill, Row, Screen } from '@/components/ui';
import { DAILY_REPORT_LIMIT } from '@/lib/consensus';
import { naira } from '@/data/seed';
import { useHowMarket } from '@/data/store';
import { usePalette } from '@/theme';

/** Report a price you saw today. */
export default function AddPrice() {
  const c = usePalette();
  const params = useLocalSearchParams<{ item?: string }>();
  const hm = useHowMarket();
  const [itemId, setItemId] = useState(params.item ?? hm.items[0]?.id);
  const [marketId, setMarketId] = useState(hm.areaMarkets[0]?.id);
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const value = Number(price.replace(/[^\d]/g, ''));
  const item = hm.items.find((i) => i.id === itemId);
  const current = itemId && marketId ? hm.priceFor(itemId, marketId) : null;
  // Gentle sanity check before submitting — not a block, just a nudge.
  const farOff = current && value > 0 && (value > current.price * 2 || value < current.price / 2);

  const submit = async () => {
    if (!itemId || !marketId) return;
    const res = await hm.addReport(itemId, marketId, value);
    if (res === 'limit') return setMessage(`You've reached today's limit of ${DAILY_REPORT_LIMIT} reports. Thank you!`);
    if (res === 'ok') router.back();
  };

  return (
    <Screen>
      <Label>What did you buy or see?</Label>
      <Row style={{ flexWrap: 'wrap' }}>
        {hm.items.map((i) => (
          <Pill key={i.id} active={itemId === i.id} onPress={() => setItemId(i.id)}>
            {i.emoji} {i.name}
          </Pill>
        ))}
      </Row>
      <Label>Where?</Label>
      <Row style={{ flexWrap: 'wrap' }}>
        {hm.areaMarkets.map((m) => (
          <Pill key={m.id} active={marketId === m.id} onPress={() => setMarketId(m.id)}>
            {m.name}
          </Pill>
        ))}
      </Row>
      <Field label={`Price for ${item?.unit ?? 'item'} (₦)`} value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="e.g. 2500" />
      {current ? <Body muted>Others reported about {naira(current.price)} here.</Body> : null}
      {farOff ? <Text style={{ color: '#B45309' }}>That&apos;s very different from what others saw — please double-check the amount and unit.</Text> : null}
      <Button title="Submit price" disabled={!(value > 0) || !itemId || !marketId} onPress={submit} />
      {message ? <Text style={{ color: c.danger }}>{message}</Text> : null}
      <Body muted style={{ fontSize: 13 }}>Prices are checked against other reports. Accurate reports raise your trust score.</Body>
    </Screen>
  );
}
