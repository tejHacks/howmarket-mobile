import { router } from 'expo-router';

import { Body, Button, Card, H2, Label, Pill, Row, Screen } from '@/components/ui';
import { AREAS } from '@/data/seed';
import { useHowMarket } from '@/data/store';

export default function Profile() {
  const hm = useHowMarket();
  if (!hm.profile) return <Screen>{null}</Screen>;
  const trustPct = Math.round((hm.profile.trust / 2) * 100);

  return (
    <Screen>
      <H2>{hm.profile.name}</H2>
      <Card>
        <Label>Trust score</Label>
        <Body>
          {hm.profile.trust.toFixed(2)} · {trustPct >= 60 ? 'Trusted reporter' : trustPct >= 40 ? 'Getting started' : 'Low — check your amounts'}
        </Body>
        <Body muted style={{ fontSize: 13 }}>Grows when your prices match what others see. Reports today: {hm.reportsToday}.</Body>
      </Card>
      <Label>Area</Label>
      <Row style={{ flexWrap: 'wrap' }}>
        {AREAS.map((a) => (
          <Pill key={a} active={hm.profile?.area === a} onPress={() => hm.setArea(a)}>
            {a}
          </Pill>
        ))}
      </Row>
      <Button
        title="Sign out"
        variant="secondary"
        onPress={async () => {
          await hm.signOut();
          router.replace('/login');
        }}
      />
    </Screen>
  );
}
