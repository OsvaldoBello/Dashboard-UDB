import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import * as XLSX from 'xlsx';

// Constantes de Segurança
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'text/csv', // .csv
  'application/vnd.ms-excel', // .xls
];

// Helper para obter a segunda-feira de uma semana ISO 8601 (formato YYYY-Www)
function getMondayOfISOWeek(weekStr: string): Date {
  const parts = weekStr.split('-W');
  const year = parseInt(parts[0], 10);
  const week = parseInt(parts[1], 10);

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay();
  const monday = new Date(jan4.getTime() - ((day === 0 ? 6 : day - 1) * 24 * 60 * 60 * 1000));
  const targetMonday = new Date(monday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
  return targetMonday;
}

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
    const weekStr = formData.get('week') as string | null; // Formato: YYYY-Www ou YYYY-MM-DD
    const representanteIdRaw = formData.get('representanteId') as string | null;
    const representanteIdFromClient = (representanteIdRaw && representanteIdRaw !== 'null' && representanteIdRaw !== 'undefined') ? representanteIdRaw : null;

    if (!file || !weekStr) {
      return NextResponse.json(
        { error: 'Arquivo e referência temporal são obrigatórios.' },
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
      // Regra 3: Considerar Concluído:
      // - Para conteúdos (não marcados como Exame): a partir de 97%
      // - Para exames: apenas com 100%
      const status = isExam
        ? (progresso === 100.0 ? 'Concluído' : 'Em Andamento')
        : (progresso >= 97.0 ? 'Concluído' : 'Em Andamento');

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

    // 5. Determinar Nome do Representante e ID
    let finalRepresentanteId: string;
    let repName = '';

    if (representanteIdFromClient) {
      // Obter representante do banco
      const { data: rep, error: repError } = await supabase
        .from('representantes')
        .select('id, nome')
        .eq('id', representanteIdFromClient)
        .maybeSingle();

      if (repError || !rep) {
        return NextResponse.json(
          { error: 'Representante não encontrado.' },
          { status: 400 }
        );
      }
      finalRepresentanteId = rep.id;
      repName = rep.nome;
    } else {
      // Fallback/Legacy behavior: parse from file name
      let parsedRepName = file.name;
      const dotIndex = parsedRepName.lastIndexOf('.');
      if (dotIndex !== -1) {
        parsedRepName = parsedRepName.substring(0, dotIndex);
      }
      
      // Detecção de região do nome do arquivo (ex: _MG, -SP, _RS no final do nome, case-insensitive)
      let detectedRegion: string | null = null;
      const regionMatch = parsedRepName.match(/[_\s-]+(RS|SP|MG)(?![a-zA-Z])/i);
      if (regionMatch) {
        detectedRegion = regionMatch[1].toUpperCase();
        parsedRepName = parsedRepName.substring(0, regionMatch.index);
      }

      // Remove prefixos comuns de timestamps e identificadores
      parsedRepName = parsedRepName.replace(/^\d+_[a-zA-Z0-9]+_/g, '');
      // Se houver um número no início seguido de underscore (ex: 21321312_), removemos também
      parsedRepName = parsedRepName.replace(/^\d+_/g, '');
      
      // Substituir underscores e hifens por espaços para normalizar o nome do representante (ex: João_Paulo ou Lucas-Silveira -> João Paulo ou Lucas Silveira)
      parsedRepName = parsedRepName.replace(/[_-]/g, ' ');
      
      // Remover sufixos representantes
      parsedRepName = parsedRepName.replace(/\srepresentante$/i, '').replace(/representante$/i, '').trim();

      // Capitalizar (Primeira letra maiúscula, restante minúscula)
      parsedRepName = parsedRepName.split(' ')
        .filter(w => w.length > 0)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      repName = parsedRepName;

      // Buscar ou cadastrar representante
      let { data: representante, error: repSelectError } = await supabase
        .from('representantes')
        .select('id')
        .eq('nome', repName)
        .limit(1)
        .maybeSingle();

      if (repSelectError) {
        throw new Error(`Erro ao verificar representante: ${repSelectError.message}`);
      }

      if (!representante) {
        const { data: newRep, error: repInsertError } = await supabase
          .from('representantes')
          .insert({ 
            nome: repName, 
            usuario_id: usuarioId,
            regiao: detectedRegion
          })
          .select('id')
          .single();

        if (repInsertError) {
          throw new Error(`Erro ao inserir representante: ${repInsertError.message}`);
        }
        finalRepresentanteId = newRep.id;
      } else {
        finalRepresentanteId = representante.id;
      }
    }

    // 6. Gravar ou Atualizar Relatório Semanal
    let semanaReferencia: string;
    if (weekStr.includes('-W')) {
      const mondayDate = getMondayOfISOWeek(weekStr);
      semanaReferencia = mondayDate.toISOString().split('T')[0];
    } else {
      // Já está no formato YYYY-MM-DD
      semanaReferencia = weekStr;
    }
    
    const { error: reportError } = await supabase
      .from('relatorios_semanais')
      .upsert({
        representante_id: finalRepresentanteId,
        semana_ano: semanaReferencia,
        total_treinamentos: totalContents,
        treinamentos_concluidos: completedContents,
        total_exames: totalExams,
        exames_concluidos: completedExams,
        aproveitamento_geral: aproveitamentoGeral,
        detalhes: detalhes,
        usuario_id: usuarioId
      }, {
        onConflict: 'representante_id,semana_ano'
      });

    if (reportError) {
      throw new Error(`Erro ao salvar relatório semanal: ${reportError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        representante: repName,
        representanteId: finalRepresentanteId,
        week: weekStr,
        semana_ano: semanaReferencia,
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
