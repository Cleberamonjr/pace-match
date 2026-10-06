export function createClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key, from() { throw new Error("Cliente Supabase ainda não instalado. Aplique a migration e adicione @supabase/supabase-js."); } };
}
