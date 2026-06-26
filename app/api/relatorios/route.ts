import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    // 1. Validar Autenticação
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    }

    const usuarioId = user.id;

    // 2. Extrair dados
    const body = await request.json();
    const {
      representanteId,
      semana_ano, // YYYY-MM-DD
      total_treinamentos,
      treinamentos_concluidos,
      total_exames,
      exames_concluidos,
      observacoes,
    } = body;

    if (!representanteId || !semana_ano) {
      return NextResponse.json(
        { error: 'Representante e semana de referência são obrigatórios.' },
        { status: 400 }
      );
    }

    const totalTreinamentos = parseInt(total_treinamentos || 0, 10);
    const concluidosTreinamentos = parseInt(treinamentos_concluidos || 0, 10);
    const totalExames = parseInt(total_exames || 0, 10);
    const concluidosExames = parseInt(exames_concluidos || 0, 10);

    if (concluidosTreinamentos > totalTreinamentos) {
      return NextResponse.json(
        { error: 'Treinamentos concluídos não podem ser maiores do que o total de treinamentos.' },
        { status: 400 }
      );
    }

    if (concluidosExames > totalExames) {
      return NextResponse.json(
        { error: 'Exames concluídos não podem ser maiores do que o total de exames.' },
        { status: 400 }
      );
    }

    const totalAll = totalTreinamentos + totalExames;
    const completedAll = concluidosTreinamentos + concluidosExames;
    const aproveitamentoGeral = totalAll > 0 ? parseFloat(((completedAll / totalAll) * 100).toFixed(2)) : 0.00;

    // 3. Validar se o representante existe
    const { data: rep, error: repError } = await supabase
      .from('representantes')
      .select('id, nome')
      .eq('id', representanteId)
      .maybeSingle();

    if (repError || !rep) {
      return NextResponse.json(
        { error: 'Representante não encontrado.' },
        { status: 400 }
      );
    }

    // 4. Salvar ou Atualizar Relatório Semanal
    const { data, error: reportError } = await supabase
      .from('relatorios_semanais')
      .upsert({
        representante_id: representanteId,
        semana_ano: semana_ano,
        total_treinamentos: totalTreinamentos,
        treinamentos_concluidos: concluidosTreinamentos,
        total_exames: totalExames,
        exames_concluidos: concluidosExames,
        aproveitamento_geral: aproveitamentoGeral,
        detalhes: [], // Vazio para manual
        observacoes: observacoes || '',
        usuario_id: usuarioId
      }, {
        onConflict: 'representante_id,semana_ano'
      })
      .select()
      .single();

    if (reportError) {
      throw new Error(`Erro ao salvar relatório semanal: ${reportError.message}`);
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (err: any) {
    console.error('Erro ao salvar relatório semanal manual:', err);
    return NextResponse.json(
      { error: err.message || 'Não foi possível salvar o relatório semanal.' },
      { status: 500 }
    );
  }
}
