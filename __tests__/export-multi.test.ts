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
        ? (latestReport.aproveitamento_geral >= rep.meta_aproveitamento ? 'Meta Atingida' : 'Abaixo da Meta') 
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
});
