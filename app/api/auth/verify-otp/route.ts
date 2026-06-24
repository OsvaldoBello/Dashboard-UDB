import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    const { email, token } = await request.json();

    if (!email || !token) {
      return NextResponse.json(
        { error: 'E-mail e código de verificação são obrigatórios.' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Código de verificação inválido ou expirado.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      session: data.session,
      user: data.user ? {
        id: data.user.id,
        email: data.user.email,
      } : null,
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message || 'Ocorreu um erro interno no servidor.' },
      { status: 500 }
    );
  }
}
