/**
 * Supabase client — only created when EXPO_PUBLIC_SUPABASE_URL and
 * EXPO_PUBLIC_SUPABASE_ANON_KEY are set. Otherwise the app runs in demo mode.
 * The anon key is safe to ship; Row Level Security in supabase/schema.sql
 * is what protects the data.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      })
    : null;

export const isDemo = supabase === null;
