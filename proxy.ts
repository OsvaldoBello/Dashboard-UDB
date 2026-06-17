import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 1. Inicializar cliente Supabase Serverless de forma segura
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Se as variáveis de ambiente não estiverem configuradas na Vercel,
    // permite a requisição seguir para evitar erro 500 geral.
    return response;
  }

  const supabase = createServerClient(
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
    const rateLimitCookieName = 'udb-rate-limit';
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

    // Limite de 5 requisições por minuto
    if (timestamps.length >= 5) {
      return new NextResponse(
        JSON.stringify({
          error: 'Limite de requisições excedido. Tente novamente em um minuto.',
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
