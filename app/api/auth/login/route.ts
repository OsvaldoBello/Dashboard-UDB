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
    
    // Autentica o usuário e define os cookies HttpOnly de sessão automaticamente
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Retorna uma mensagem tratada amigável para evitar vazamentos de detalhes
      return NextResponse.json(
        { error: 'Credenciais inválidas. Verifique seu e-mail e senha.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch (err) {
    // Tratamento seguro contra OWASP Top 10 (vazamento de detalhes de erro)
    return NextResponse.json(
      { error: 'Ocorreu um erro interno no servidor de autenticação.' },
      { status: 500 }
    );
  }
}
