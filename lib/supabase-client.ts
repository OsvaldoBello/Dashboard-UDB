import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fallback seguro durante a compilação (build) na Vercel ou CI/CD
  if (!url || !anonKey) {
    return createBrowserClient(
      'https://placeholder-url.supabase.co',
      'placeholder-anon-key'
    );
  }

  return createBrowserClient(url, anonKey);
}
