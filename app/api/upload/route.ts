import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import * as XLSX from 'xlsx';

// Constantes de Segurança
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'text/csv', // .csv
  'application/vnd.ms-excel', // .xls
];

export async function POST(request: Request) {
  try {
    // 1. Validar Autenticação (Session Hardening)
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    }

    const usuarioId = user.id;

    // 2. Extrair dados da Requisição
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const monthYear = formData.get('month') as string | null; // Formato: YYYY-MM

    if (!file || !monthYear) {
      return NextResponse.json(
        { error: 'Arquivo e mês de referência são obrigatórios.' },
        { status: 400 }
      );
    }

    // 3. Sanitização e Validações de Upload (File Upload Security)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'O arquivo excede o limite máximo permitido de 10MB.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Formato inválido. Somente planilhas Excel (.xlsx) ou CSV são permitidas.' },
        { status: 400 }
      );
    }

    // Prevenir Path Traversal sanitizando o nome do arquivo
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');

    // 4. Ler e Processar Dados da Planilha
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

    if (jsonData.length === 0) {
      return NextResponse.json(
        { error: 'A planilha enviada está vazia.' },
        { status: 400 }
      );
    }

    // Localizar colunas exigidas de forma tolerante a maiúsculas/minúsculas
    const firstRowKeys = Object.keys(jsonData[0]);
    const keyConteudo = firstRowKeys.find(k => k.trim().toLowerCase() === 'conteúdo' || k.trim().toLowerCase() === 'conteudo');
    const keyProgresso = firstRowKeys.find(k => k.trim().toLowerCase() === 'média de consumo do conteúdo' || k.trim().toLowerCase() === 'media de consumo do conteudo');

    if (!keyConteudo || !keyProgresso) {
      return NextResponse.json(
        { error: "Colunas obrigatórias ausentes. A planilha deve conter as colunas 'Conteúdo' e 'Média de Consumo do Conteúdo'." },
        { status: 400 }
      );
    }

    // Aplicar Lógica de Negócio UBD
    let totalContents = 0;
    let completedContents = 0;
    let totalExams = 0;
    let completedExams = 0;
    const detalhes: any[] = [];

    for (const row of jsonData) {
      const conteudoRaw = String(row[keyConteudo] || '').trim();
      const progressoRaw = row[keyProgresso];

      if (!conteudoRaw) continue;

      // Regra 1: Ignorar "Café com Química"
      if (conteudoRaw.toLowerCase().includes('café com química') || conteudoRaw.toLowerCase().includes('cafe com quimica')) {
        continue;
      }

      // Limpar progresso
      let progresso = 0;
      if (progressoRaw !== undefined && progressoRaw !== null) {
        progresso = parseFloat(String(progressoRaw).replace('%', '').trim());
        if (isNaN(progresso)) progresso = 0;
      }

      // Regra 2: Identificar se é Exame ou Conteúdo
      const isExam = conteudoRaw.toLowerCase().endsWith('- exame') || conteudoRaw.toLowerCase().includes('- exame ');
      // Regra 3: Considerar Concluído apenas progresso = 100
      const status = progresso === 100.0 ? 'Concluído' : 'Em Andamento';

      const registro = {
        conteudo: conteudoRaw,
        progresso: progresso,
        status: status,
      };

      detalhes.push(registro);

      if (isExam) {
        totalExams++;
        if (status === 'Concluído') completedExams++;
      } else {
        totalContents++;
        if (status === 'Concluído') completedContents++;
      }
    }

    const totalAll = totalContents + totalExams;
    const completedAll = completedContents + completedExams;
    const aproveitamentoGeral = totalAll > 0 ? parseFloat(((completedAll / totalAll) * 100).toFixed(2)) : 0.00;

    // 5. Determinar Nome do Representante baseado no Arquivo
    let repName = file.name;
    const dotIndex = repName.lastIndexOf('.');
    if (dotIndex !== -1) {
      repName = repName.substring(0, dotIndex);
    }
    // Remove prefixos comuns de timestamps e identificadores (ex: "20260603170623_3U2R417Z20Q_")
    repName = repName.replace(/^\d+_[a-zA-Z0-9]+_/g, '').replace(/_representante$/i, '').replace(/representante$/i, '').trim();
    // Capitalizar
    repName = repName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    // 6. Gravar ou Atualizar no Supabase
    // Buscar ou cadastrar representante
    let { data: representante, error: repSelectError } = await supabase
      .from('representantes')
      .select('id')
      .eq('nome', repName)
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (repSelectError) {
      throw new Error(`Erro ao verificar representante: ${repSelectError.message}`);
    }

    let representanteId: string;
    if (!representante) {
      const { data: newRep, error: repInsertError } = await supabase
        .from('representantes')
        .insert({ nome: repName, usuario_id: usuarioId })
        .select('id')
        .single();

      if (repInsertError) {
        throw new Error(`Erro ao inserir representante: ${repInsertError.message}`);
      }
      representanteId = newRep.id;
    } else {
      representanteId = representante.id;
    }

    // Gravar/Upsert relatório mensal do representante
    const mesReferencia = `${monthYear}-01`; // Primeiro dia do mês para formato DATE
    const { error: reportError } = await supabase
      .from('relatorios_mensais')
      .upsert({
        representante_id: representanteId,
        mes_ano: mesReferencia,
        total_treinamentos: totalContents,
        treinamentos_concluidos: completedContents,
        total_exames: totalExams,
        exames_concluidos: completedExams,
        aproveitamento_geral: aproveitamentoGeral,
        detalhes: detalhes,
        usuario_id: usuarioId
      }, {
        onConflict: 'representante_id,mes_ano'
      });

    if (reportError) {
      throw new Error(`Erro ao salvar relatório mensal: ${reportError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        representante: repName,
        mes: monthYear,
        total_treinamentos: totalContents,
        treinamentos_concluidos: completedContents,
        total_exames: totalExams,
        exames_concluidos: completedExams,
        aproveitamento_geral: aproveitamentoGeral
      }
    });

  } catch (err: any) {
    // Tratamento Seguro de Erros: Esconder detalhes sensíveis da Exception do usuário
    console.error('Erro de Processamento no Servidor:', err);
    return NextResponse.json(
      { error: 'Não foi possível processar a planilha de treinamentos. Verifique o arquivo e tente novamente.' },
      { status: 500 }
    );
  }
}
