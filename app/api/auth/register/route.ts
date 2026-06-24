import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'E-mail e senha são obrigatórios.' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Erro ao cadastrar usuário.' },
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
