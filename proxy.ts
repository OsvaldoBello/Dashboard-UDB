import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function cleanEnvValue(value: string | undefined): string | undefined {
  if (!value) return value;
  let cleaned = value.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.trim();
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 1. Inicializar cliente Supabase Serverless de forma segura
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

  if (!url || !anonKey) {
    // Se as variáveis de ambiente não estiverem configuradas na Vercel,
    // permite a requisição seguir para evitar erro 500 geral.
    return response;
  }

  let supabase;
  try {
    supabase = createServerClient(
      url,
      anonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );
  } catch (err) {
    console.error("Erro ao instanciar Supabase no proxy:", err);
    return response;
  }

  // 2. Refresh e Validação da Sessão (Session Hardening)
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (error) {
    console.error('Erro no middleware Supabase:', error);
    // Em caso de erro na API do Supabase (ex: chaves inválidas), prossegue sem usuário
  }

  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard');
  const isApiUpload = request.nextUrl.pathname.startsWith('/api/upload');
  const isLoginPath = request.nextUrl.pathname.startsWith('/login');
  const isApiLogin = request.nextUrl.pathname.startsWith('/api/auth/login');

  // 3. Rate Limiting Estateless para Rotas Críticas (Login e Upload)
  if (isApiUpload || isApiLogin) {
    const rateLimitCookieName = isApiUpload ? 'udb-rate-limit-upload' : 'udb-rate-limit-login';
    const rateLimitCookie = request.cookies.get(rateLimitCookieName);
    const now = Date.now();
    const oneMinute = 60 * 1000;

    let timestamps: number[] = [];
    if (rateLimitCookie) {
      try {
        timestamps = JSON.parse(rateLimitCookie.value).filter(
          (t: number) => now - t < oneMinute
        );
      } catch {
        timestamps = [];
      }
    }

    // Limite diferenciado: 5 por minuto para login, 100 por minuto para upload (suporta lote de 30)
    const limit = isApiUpload ? 100 : 5;
    if (timestamps.length >= limit) {
      return new NextResponse(
        JSON.stringify({
          error: isApiUpload 
            ? 'Limite de uploads excedido. Aguarde um minuto antes de enviar mais arquivos.'
            : 'Limite de requisições excedido. Tente novamente em um minuto.',
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Registra novo timestamp da requisição
    timestamps.push(now);
    response.cookies.set(rateLimitCookieName, JSON.stringify(timestamps), {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 60, // Expira em 1 minuto
    });
  }

  // 4. Redirecionamento Protetivo
  if ((isDashboard || isApiUpload) && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isLoginPath && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (svg, png, jpg, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
