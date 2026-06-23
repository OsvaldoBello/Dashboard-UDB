import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function PATCH(request: Request) {
  try {
    // 1. Validar Autenticação
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    }

    // 2. Extrair e validar dados do body
    const body = await request.json();
    const { id, observacoes, meta_aproveitamento } = body;

    if (!id) {
      return NextResponse.json({ error: 'O ID do representante é obrigatório.' }, { status: 400 });
    }

    // 3. Atualizar no banco (o RLS garante que o usuário só altere o próprio registro)
    const updateData: any = {};
    if (observacoes !== undefined) updateData.observacoes = observacoes;
    if (meta_aproveitamento !== undefined) {
      const target = parseFloat(meta_aproveitamento);
      if (!isNaN(target)) {
        updateData.meta_aproveitamento = target;
      }
    }

    const { data, error } = await supabase
      .from('representantes')
      .update(updateData)
      .eq('id', id)
      .eq('usuario_id', user.id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('Erro ao atualizar representante:', err);
    return NextResponse.json(
      { error: 'Não foi possível atualizar o dossiê do representante.' },
      { status: 500 }
    );
  }
}
