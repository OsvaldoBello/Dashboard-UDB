import { describe, it, expect } from 'vitest';

interface DetailRow {
  conteudo: string;
  progresso: number;
  status: 'Concluído' | 'Em Andamento';
}

interface WeeklyReport {
  semana_ano: string;
  detalhes: DetailRow[];
}

// Função de cálculo de comparação idêntica à do frontend
const calculateComparison = (reportA: WeeklyReport | null, reportB: WeeklyReport | null) => {
  if (!reportA || !reportB) return [];

  const coursesA = new Map<string, DetailRow>();
  reportA.detalhes.forEach(d => coursesA.set(d.conteudo, d));

  const coursesB = new Map<string, DetailRow>();
  reportB.detalhes.forEach(d => coursesB.set(d.conteudo, d));

  const allCourseNames = Array.from(new Set([...coursesA.keys(), ...coursesB.keys()]));

  return allCourseNames.map(name => {
    const stateA = coursesA.get(name);
    const stateB = coursesB.get(name);

    let status = 'Sem alteração';

    if (!stateA && stateB) {
      status = 'Novo Curso';
    } else if (stateA && !stateB) {
      status = 'Removido';
    } else if (stateA && stateB) {
      if (stateA.status === 'Em Andamento' && stateB.status === 'Concluído') {
        status = 'Evoluiu (Concluído)';
      } else if (stateA.status === 'Concluído' && stateB.status === 'Em Andamento') {
        status = 'Regrediu';
      }
    }

    return {
      nome: name,
      progressoA: stateA ? `${stateA.progresso}%` : 'N/A',
      statusA: stateA ? stateA.status : 'N/A',
      progressoB: stateB ? `${stateB.progresso}%` : 'N/A',
      statusB: stateB ? stateB.status : 'N/A',
      status
    };
  });
};

describe('Comparador Week-over-Week', () => {
  it('deve retornar vazio se algum dos relatórios for nulo', () => {
    const res = calculateComparison(null, null);
    expect(res).toEqual([]);
  });

  it('deve identificar "Novo Curso" se o curso existir apenas na semana foco (B)', () => {
    const reportA: WeeklyReport = { semana_ano: '2026-W01', detalhes: [] };
    const reportB: WeeklyReport = {
      semana_ano: '2026-W02',
      detalhes: [{ conteudo: 'Curso Novo', progresso: 50, status: 'Em Andamento' }]
    };

    const res = calculateComparison(reportA, reportB);
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual({
      nome: 'Curso Novo',
      progressoA: 'N/A',
      statusA: 'N/A',
      progressoB: '50%',
      statusB: 'Em Andamento',
      status: 'Novo Curso'
    });
  });

  it('deve identificar "Removido" se o curso existir apenas na semana base (A)', () => {
    const reportA: WeeklyReport = {
      semana_ano: '2026-W01',
      detalhes: [{ conteudo: 'Curso Removido', progresso: 100, status: 'Concluído' }]
    };
    const reportB: WeeklyReport = { semana_ano: '2026-W02', detalhes: [] };

    const res = calculateComparison(reportA, reportB);
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual({
      nome: 'Curso Removido',
      progressoA: '100%',
      statusA: 'Concluído',
      progressoB: 'N/A',
      statusB: 'N/A',
      status: 'Removido'
    });
  });

  it('deve identificar "Evoluiu (Concluído)" quando muda de "Em Andamento" para "Concluído"', () => {
    const reportA: WeeklyReport = {
      semana_ano: '2026-W01',
      detalhes: [{ conteudo: 'Curso X', progresso: 90, status: 'Em Andamento' }]
    };
    const reportB: WeeklyReport = {
      semana_ano: '2026-W02',
      detalhes: [{ conteudo: 'Curso X', progresso: 98, status: 'Concluído' }] // Concluído (regra >= 97%)
    };

    const res = calculateComparison(reportA, reportB);
    expect(res).toHaveLength(1);
    expect(res[0].status).toBe('Evoluiu (Concluído)');
  });

  it('deve identificar "Regrediu" se o status mudar de "Concluído" para "Em Andamento"', () => {
    const reportA: WeeklyReport = {
      semana_ano: '2026-W01',
      detalhes: [{ conteudo: 'Curso X', progresso: 100, status: 'Concluído' }]
    };
    const reportB: WeeklyReport = {
      semana_ano: '2026-W02',
      detalhes: [{ conteudo: 'Curso X', progresso: 90, status: 'Em Andamento' }]
    };

    const res = calculateComparison(reportA, reportB);
    expect(res).toHaveLength(1);
    expect(res[0].status).toBe('Regrediu');
  });

  it('deve identificar "Sem alteração" se o status for idêntico', () => {
    const reportA: WeeklyReport = {
      semana_ano: '2026-W01',
      detalhes: [{ conteudo: 'Curso X', progresso: 50, status: 'Em Andamento' }]
    };
    const reportB: WeeklyReport = {
      semana_ano: '2026-W02',
      detalhes: [{ conteudo: 'Curso X', progresso: 60, status: 'Em Andamento' }]
    };

    const res = calculateComparison(reportA, reportB);
    expect(res).toHaveLength(1);
    expect(res[0].status).toBe('Sem alteração');
  });
});
