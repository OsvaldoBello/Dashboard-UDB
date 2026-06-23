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
  const url = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);

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
