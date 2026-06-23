import { createBrowserClient } from '@supabase/ssr';

function cleanEnvValue(value: string | undefined): string | undefined {
  if (!value) return value;
  let cleaned = value.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.trim();
}

export function createSupabaseBrowserClient() {
  const url = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const isValidUrl = url && (url.startsWith('http://') || url.startsWith('https://'));

  // Fallback seguro durante a compilação (build) na Vercel ou CI/CD
  if (!url || !anonKey || !isValidUrl) {
    return createBrowserClient(
      'https://placeholder-url.supabase.co',
      'placeholder-anon-key'
    );
  }

  try {
    return createBrowserClient(url, anonKey);
  } catch (err) {
    console.error("Erro ao instanciar Supabase Browser Client com URL:", url, err);
    return createBrowserClient(
      'https://placeholder-url.supabase.co',
      'placeholder-anon-key'
    );
  }
}
