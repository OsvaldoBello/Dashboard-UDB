import { describe, it, expect } from 'vitest';

// Simulação de montagem de abas consolidada de exportação
const buildConsolidatedSummary = (reps: any[], reports: any[]) => {
  return reps.map(rep => {
    const repReports = reports.filter(r => r.representante_id === rep.id);
    const latestReport = repReports[0] || null;

    return {
      'Representante': rep.nome,
      'Última Semana Ativa': latestReport ? latestReport.semana_ano : 'Sem dados',
      'Aproveitamento Geral (%)': latestReport ? `${latestReport.aproveitamento_geral.toFixed(1)}%` : '0.0%',
      'Meta Definida (%)': `${rep.meta_aproveitamento}%`,
      'Status da Meta': latestReport 
        ? (Number(latestReport.aproveitamento_geral.toFixed(1)) >= rep.meta_aproveitamento ? 'Meta Atingida' : 'Abaixo da Meta') 
        : 'Sem dados'
    };
  });
};

describe('Multi-Exportação e Consolidação', () => {
  it('deve consolidar o resumo com dados vazios', () => {
    const res = buildConsolidatedSummary([], []);
    expect(res).toEqual([]);
  });

  it('deve consolidar representantes com e sem relatórios ativos', () => {
    const reps = [
      { id: '1', nome: 'Juliana Freitas', meta_aproveitamento: 80 },
      { id: '2', nome: 'Pedro Lima', meta_aproveitamento: 85 }
    ];
    const reports = [
      { representante_id: '1', semana_ano: '2026-06-01', aproveitamento_geral: 95.5 }
    ];

    const res = buildConsolidatedSummary(reps, reports);
    expect(res).toHaveLength(2);
    expect(res[0]).toEqual({
      'Representante': 'Juliana Freitas',
      'Última Semana Ativa': '2026-06-01',
      'Aproveitamento Geral (%)': '95.5%',
      'Meta Definida (%)': '80%',
      'Status da Meta': 'Meta Atingida'
    });
    expect(res[1]).toEqual({
      'Representante': 'Pedro Lima',
      'Última Semana Ativa': 'Sem dados',
      'Aproveitamento Geral (%)': '0.0%',
      'Meta Definida (%)': '85%',
      'Status da Meta': 'Sem dados'
    });
  });

  it('deve filtrar representantes por regiao', () => {
    const reps = [
      { id: '1', nome: 'Juliana Freitas', meta_aproveitamento: 95, regiao: 'RS' },
      { id: '2', nome: 'Pedro Lima', meta_aproveitamento: 95, regiao: 'SP' },
      { id: '3', nome: 'Ana Costa', meta_aproveitamento: 95, regiao: 'MG' }
    ];

    const filterRegion = (list: any[], region: string) => {
      if (region === 'Todos') return list;
      return list.filter(r => r.regiao === region);
    };

    expect(filterRegion(reps, 'RS')).toHaveLength(1);
    expect(filterRegion(reps, 'RS')[0].nome).toBe('Juliana Freitas');
    expect(filterRegion(reps, 'SP')).toHaveLength(1);
    expect(filterRegion(reps, 'MG')).toHaveLength(1);
    expect(filterRegion(reps, 'Todos')).toHaveLength(3);
  });

  it('deve extrair nome e regiao do nome do arquivo da planilha', () => {
    const parseRepNameAndRegion = (fileName: string) => {
      let parsedRepName = fileName;
      const dotIndex = parsedRepName.lastIndexOf('.');
      if (dotIndex !== -1) {
        parsedRepName = parsedRepName.substring(0, dotIndex);
      }
      
      let detectedRegion: string | null = null;
      const regionMatch = parsedRepName.match(/[_\s-]+(RS|SP|MG)(?![a-zA-Z])/i);
      if (regionMatch) {
        detectedRegion = regionMatch[1].toUpperCase();
        parsedRepName = parsedRepName.substring(0, regionMatch.index);
      }

      parsedRepName = parsedRepName.replace(/^\d+_[a-zA-Z0-9]+_/g, '');
      parsedRepName = parsedRepName.replace(/^\d+_/g, '');
      parsedRepName = parsedRepName.replace(/[_-]/g, ' ');
      parsedRepName = parsedRepName.replace(/\srepresentante$/i, '').replace(/representante$/i, '').trim();

      parsedRepName = parsedRepName.split(' ')
        .filter(w => w.length > 0)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      
      return { nome: parsedRepName, regiao: detectedRegion };
    };

    expect(parseRepNameAndRegion('21321312_João_Paulo_MG.xlsx')).toEqual({ nome: 'João Paulo', regiao: 'MG' });
    expect(parseRepNameAndRegion('12345_Lucas-Silveira_RS.csv')).toEqual({ nome: 'Lucas Silveira', regiao: 'RS' });
    expect(parseRepNameAndRegion('Pedro_Lima_SP.xlsx')).toEqual({ nome: 'Pedro Lima', regiao: 'SP' });
    expect(parseRepNameAndRegion('Juliana_Freitas.xlsx')).toEqual({ nome: 'Juliana Freitas', regiao: null });
    expect(parseRepNameAndRegion('Jorge Rubens RS.xlsx')).toEqual({ nome: 'Jorge Rubens', regiao: 'RS' });
    expect(parseRepNameAndRegion('Jorge Rubens SP.csv')).toEqual({ nome: 'Jorge Rubens', regiao: 'SP' });
    expect(parseRepNameAndRegion('Jorge Rubens MG.xlsx')).toEqual({ nome: 'Jorge Rubens', regiao: 'MG' });
    expect(parseRepNameAndRegion('JOÃO BASTOS NEVES SP (4).xlsx')).toEqual({ nome: 'João Bastos Neves', regiao: 'SP' });
    expect(parseRepNameAndRegion('JOÃO BASTOS NEVES SP (4)')).toEqual({ nome: 'João Bastos Neves', regiao: 'SP' });
    expect(parseRepNameAndRegion('PEDRO_LIMA_SP.xlsx')).toEqual({ nome: 'Pedro Lima', regiao: 'SP' });
  });

  it('deve atingir a meta se o aproveitamento arredondado for igual à meta (ex: 94.96% arredonda para 95.0% com meta 95%)', () => {
    const reps = [
      { id: '1', nome: 'Christian Severo', meta_aproveitamento: 95 }
    ];
    const reports = [
      { representante_id: '1', semana_ano: '2026-07-01', aproveitamento_geral: 94.96 }
    ];

    const res = buildConsolidatedSummary(reps, reports);
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual({
      'Representante': 'Christian Severo',
      'Última Semana Ativa': '2026-07-01',
      'Aproveitamento Geral (%)': '95.0%',
      'Meta Definida (%)': '95%',
      'Status da Meta': 'Meta Atingida'
    });
  });
});

