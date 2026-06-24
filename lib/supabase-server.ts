import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function cleanEnvValue(value: string | undefined): string | undefined {
  if (!value) return value;
  let cleaned = value.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.trim();
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  let url = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  let anonKey = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  console.log("SUPABASE CONFIG DIAGNOSTICS:");
  console.log("- process.env.NEXT_PUBLIC_SUPABASE_URL defined:", !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.log("  Raw URL length:", process.env.NEXT_PUBLIC_SUPABASE_URL.length);
    console.log("  Raw URL prefix:", process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 10));
  }
  console.log("- process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY defined:", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.log("  Raw ANON_KEY length:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length);
    console.log("  Raw ANON_KEY prefix:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 15));
  }

  // Auto-correção caso as chaves estejam invertidas na Vercel
  if (url && anonKey) {
    const urlIsJwtOrKey = !url.startsWith('http://') && !url.startsWith('https://');
    const keyIsUrl = anonKey.startsWith('http://') || anonKey.startsWith('https://');
    if (urlIsJwtOrKey && keyIsUrl) {
      console.log("  Dynamic Correction: Swapping URL and ANON_KEY because they were inverted!");
      const temp = url;
      url = anonKey;
      anonKey = temp;
    }
  }

  console.log("  Post-Correction URL prefix:", url ? url.substring(0, 10) : "null");
  console.log("  Post-Correction Key prefix:", anonKey ? anonKey.substring(0, 15) : "null");

  const isValidUrl = url && (url.startsWith('http://') || url.startsWith('https://'));

  // Fallback seguro durante a compilação (build) na Vercel ou CI/CD
  if (!url || !anonKey || !isValidUrl) {
    return createServerClient(
      'https://placeholder-url.supabase.co',
      'placeholder-anon-key',
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll() {},
        },
      }
    );
  }

  try {
    return createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Silencia erro se chamado de um Server Component estrutural
          }
        },
      },
    });
  } catch (err) {
    console.error("Erro ao instanciar Supabase Server Client com URL:", url, err);
    return createServerClient(
      'https://placeholder-url.supabase.co',
      'placeholder-anon-key',
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll() {},
        },
      }
    );
  }
}
