import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
}
