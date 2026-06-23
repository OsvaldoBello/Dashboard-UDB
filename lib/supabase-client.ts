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
  let url = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  let anonKey = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  // Auto-correção caso as chaves estejam invertidas na Vercel
  if (url && anonKey) {
    const urlIsJwtOrKey = !url.startsWith('http://') && !url.startsWith('https://');
    const keyIsUrl = anonKey.startsWith('http://') || anonKey.startsWith('https://');
    if (urlIsJwtOrKey && keyIsUrl) {
      const temp = url;
      url = anonKey;
      anonKey = temp;
    }
  }

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
