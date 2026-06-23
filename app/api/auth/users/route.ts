import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

// Helper de Autenticação e Autorização Admin
async function checkAdminAuth() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Acesso não autorizado.', status: 401 };
  }

  // Verificar papel do usuário na tabela perfis
  const { data: profile, error: profileError } = await supabase
    .from('perfis')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== 'admin') {
    return { error: 'Acesso proibido. Apenas administradores podem gerenciar usuários.', status: 403 };
  }

  return { user, supabase };
}

// 1. GET: Retorna todos os supervisores (exclui admins por segurança)
export async function GET() {
  try {
    const authResult = await checkAdminAuth();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { supabase } = authResult;

    const { data: supervisors, error } = await supabase
      .from('perfis')
      .select('id, email, role, created_at')
      .eq('role', 'supervisor')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, supervisors });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro ao buscar a lista de supervisores.' },
      { status: 500 }
    );
  }
}

// 2. DELETE: Exclui a conta do supervisor de forma definitiva no Supabase Auth e cascateia no banco
export async function DELETE(request: Request) {
  try {
    const authResult = await checkAdminAuth();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('id');

    if (!targetUserId) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório.' }, { status: 400 });
    }

    // Instanciar cliente admin que possui permissão bypass RLS e privilégio gotrue:admin
    const supabaseAdmin = createSupabaseAdminClient();

    // Deletar o usuário no Auth (isso dispara o DELETE ON CASCADE na tabela perfis e relatórios)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true, message: 'Usuário excluído com sucesso!' });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro interno ao tentar excluir o usuário.' },
      { status: 500 }
    );
  }
}
