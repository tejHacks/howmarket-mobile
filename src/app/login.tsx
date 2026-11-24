import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { Body, Button, Card, Field, H1, Label, Pill, Row, Screen } from '@/components/ui';
import { useHowMarket } from '@/data/store';
import { AREAS, type Area } from '@/data/seed';
import { DEFAULT_API_URL } from '@/lib/api';
import { usePalette } from '@/theme';

type Mode = 'register' | 'login' | 'demo';

/** Create an account, sign in, or try the demo with sample prices on this phone. */
export default function Login() {
  const c = usePalette();
  const hm = useHowMarket();
  const [mode, setMode] = useState<Mode>('register');
  const [name, setName] = useState('');
  const [area, setArea] = useState<Area>('Ibadan');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState(DEFAULT_API_URL);
  const [showServer, setShowServer] = useState(false);
  const [busy, setBusy] = useState(false);

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());
  const validName = name.trim().length > 1;
  const canContinue =
    mode === 'demo' ? validName : mode === 'register' ? validName && validEmail && password.length >= 8 : validEmail && password.length > 0;

  const submit = async () => {
    setBusy(true);
    const res =
      mode === 'demo'
        ? await hm.signIn(name.trim(), area)
        : await hm.signInLive(mode, { email: email.trim(), password, name: name.trim(), area }, server.trim());
    setBusy(false);
    if (res === 'signed-in') router.replace('/');
  };

  return (
    <Screen>
      <Text style={{ fontSize: 56 }}>🧺</Text>
      <H1>How much is it at the market today?</H1>
      <Body muted>Real prices from people in your area, checked against each other, so one wrong report can&apos;t fool you.</Body>

      <Row style={{ flexWrap: 'wrap' }}>
        <Pill active={mode === 'register'} onPress={() => setMode('register')}>Create account</Pill>
        <Pill active={mode === 'login'} onPress={() => setMode('login')}>Sign in</Pill>
        <Pill active={mode === 'demo'} onPress={() => setMode('demo')}>Try the demo</Pill>
      </Row>

      <Card>
        {mode !== 'login' ? <Field label="Your name" value={name} onChangeText={setName} placeholder="e.g. Tejumade" autoComplete="name" /> : null}
        {mode !== 'demo' ? (
          <>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              textContentType={mode === 'register' ? 'newPassword' : 'password'}
            />
          </>
        ) : null}
        {mode !== 'login' ? (
          <>
            <Label>Your area</Label>
            <Row style={{ flexWrap: 'wrap' }}>
              {AREAS.map((a) => (
                <Pill key={a} active={area === a} onPress={() => setArea(a)}>
                  {a}
                </Pill>
              ))}
            </Row>
          </>
        ) : null}
        <Button
          title={busy ? 'Please wait…' : mode === 'register' ? 'Create account' : mode === 'login' ? 'Sign in' : 'Continue'}
          disabled={!canContinue || busy}
          onPress={submit}
        />
      </Card>

      {hm.error ? <Text style={{ color: c.danger }}>{hm.error}</Text> : null}

      {mode === 'demo' ? (
        <Body muted style={{ fontSize: 13 }}>Demo mode: no account needed. Prices are sample data that stay on this phone.</Body>
      ) : (
        <>
          <Body muted style={{ fontSize: 13 }}>Your sign-in is kept in this phone&apos;s secure storage. Other people only ever see an anonymous id, never your email.</Body>
          <Pressable onPress={() => setShowServer((s) => !s)} accessibilityRole="button" hitSlop={8}>
            <Text style={{ color: c.primary, fontWeight: '600', fontSize: 13 }}>{showServer ? 'Hide server' : 'Server settings'}</Text>
          </Pressable>
          {showServer ? <Field label="Server" value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} keyboardType="url" /> : null}
        </>
      )}
    </Screen>
  );
}
