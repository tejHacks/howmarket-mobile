import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Body, Button, Card, Field, H1, Label, Pill, Row, Screen } from '@/components/ui';
import { useHowMarket } from '@/data/store';
import { AREAS, type Area } from '@/data/seed';
import { usePalette } from '@/theme';

/** Sign in. Supabase email code when configured; local profile in demo mode. */
export default function Login() {
  const c = usePalette();
  const hm = useHowMarket();
  const [name, setName] = useState('');
  const [area, setArea] = useState<Area>('Ibadan');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'details' | 'code'>('details');
  const [busy, setBusy] = useState(false);

  const validEmail = /^\S+@\S+\.\S+$/.test(email);
  const canContinue = name.trim().length > 1 && (hm.isDemo || validEmail);

  const submit = async () => {
    setBusy(true);
    const res = await hm.signIn(name.trim(), area, hm.isDemo ? undefined : email.trim());
    setBusy(false);
    if (res === 'signed-in') router.replace('/');
    if (res === 'check-email') setStep('code');
  };

  const verify = async () => {
    setBusy(true);
    await hm.verifyCode(email.trim(), code.trim(), name.trim(), area);
    setBusy(false);
    router.replace('/');
  };

  return (
    <Screen>
      <Text style={{ fontSize: 56 }}>🧺</Text>
      <H1>How much is it at the market today?</H1>
      <Body muted>Real prices from people in your area — checked against each other, so one wrong report can&apos;t fool you.</Body>

      {step === 'details' ? (
        <Card>
          <Field label="Your name" value={name} onChangeText={setName} placeholder="e.g. Tejumade" autoComplete="name" />
          {!hm.isDemo ? (
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          ) : null}
          <Label>Your area</Label>
          <Row style={{ flexWrap: 'wrap' }}>
            {AREAS.map((a) => (
              <Pill key={a} active={area === a} onPress={() => setArea(a)}>
                {a}
              </Pill>
            ))}
          </Row>
          <Button title={busy ? 'Please wait…' : hm.isDemo ? 'Continue' : 'Send me a code'} disabled={!canContinue || busy} onPress={submit} />
        </Card>
      ) : (
        <Card>
          <Body>We sent a 6-digit code to {email}.</Body>
          <Field label="Code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="123456" />
          <Button title={busy ? 'Checking…' : 'Verify'} disabled={code.trim().length < 6 || busy} onPress={verify} />
        </Card>
      )}

      {hm.error ? <Text style={{ color: c.danger }}>{hm.error}</Text> : null}
      {hm.isDemo ? <Body muted style={{ fontSize: 13 }}>Demo mode: no account needed, prices are sample data on this phone. Add Supabase keys to go live.</Body> : null}
    </Screen>
  );
}
