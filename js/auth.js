import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const SUPABASE_SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
let clientPromise;

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL.trim() && SUPABASE_PUBLISHABLE_KEY.trim());
}

async function getClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Add your project URL and publishable key in js/supabase-config.js.");
  }
  if (!clientPromise) {
    clientPromise = import(SUPABASE_SDK_URL)
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
      }));
  }
  return clientPromise;
}

export async function getCurrentSession() {
  const client = await getClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signInWithPassword(email, password) {
  const client = await getClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithPassword(email, password, displayName) {
  const client = await getClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: displayName } },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const client = await getClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function loadCloudData() {
  const client = await getClient();
  const { data, error } = await client.from("user_data").select("payload").maybeSingle();
  if (error) throw error;
  return data?.payload ?? null;
}

export async function saveCloudData(payload) {
  const client = await getClient();
  const { data, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (!data.session) throw new Error("Your session has expired. Sign in again to sync your data.");
  const { error } = await client.from("user_data").upsert({
    user_id: data.session.user.id,
    payload,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function subscribeToAuthChanges(callback) {
  const client = await getClient();
  const { data } = client.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION") return;
    window.setTimeout(() => callback(event, session), 0);
  });
  return () => data.subscription.unsubscribe();
}
