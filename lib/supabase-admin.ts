import { createClient } from '@supabase/supabase-js';

function cleanEnvValue(value: string | undefined): string | undefined {
  if (!value) return value;
  let cleaned = value.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.trim();
}

export function createSupabaseAdminClient() {
  let url = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  let serviceKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Auto-correção caso as chaves estejam invertidas na Vercel
  if (url && serviceKey) {
    const urlIsJwtOrKey = !url.startsWith('http://') && !url.startsWith('https://');
    const keyIsUrl = serviceKey.startsWith('http://') || serviceKey.startsWith('https://');
    if (urlIsJwtOrKey && keyIsUrl) {
      const temp = url;
      url = serviceKey;
      serviceKey = temp;
    }
  }

  const isValidUrl = url && (url.startsWith('http://') || url.startsWith('https://'));

  if (!url || !serviceKey || !isValidUrl) {
    // Fallback seguro de compilação
    return createClient(
      'https://placeholder-url.supabase.co',
      'placeholder-service-key',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  try {
    return createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } catch (err) {
    console.error("Erro ao instanciar Supabase Admin Client com URL:", url, err);
    return createClient(
      'https://placeholder-url.supabase.co',
      'placeholder-service-key',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }
}
