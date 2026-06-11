import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Desconecta o usuário do Supabase e remove os cookies da sessão local
    const { error } = await supabase.auth.signOut();

    if (error) {
      return NextResponse.json(
        { error: 'Não foi possível encerrar a sessão no servidor.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: 'Ocorreu um erro interno ao efetuar logout.' },
      { status: 500 }
    );
  }
}
