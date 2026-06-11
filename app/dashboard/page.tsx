'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Upload, Calendar, FileSpreadsheet, LogOut, CheckCircle2, 
  AlertCircle, Trash2, Eye, BookOpen, Award, TrendingUp, RefreshCw
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-client';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

interface DetailRow {
  conteudo: string;
  progresso: number;
  status: string;
  tipo?: string;
}

interface Report {
  id: string;
  mes_ano: string;
  total_treinamentos: number;
  treinamentos_concluidos: number;
  total_exames: number;
  exames_concluidos: number;
  aproveitamento_geral: number;
  detalhes: DetailRow[];
  representante: {
    id: string;
    nome: string;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  // Estados principais
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });
  
  const [reports, setReports] = useState<Report[]>([]);
  const [representatives, setRepresentatives] = useState<{ id: string; nome: string }[]>([]);
  const [selectedRepFilter, setSelectedRepFilter] = useState<string>('all');
  
  // Dashboard ativo
  const [activeMetrics, setActiveMetrics] = useState<{
    repName: string;
    totalContents: number;
    completedContents: number;
    totalExams: number;
    completedExams: number;
    overallProgress: number;
    detalhes: DetailRow[];
  } | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Carregar dados iniciais
  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setSessionUser(user);

      // 1. Buscar representantes
      const { data: reps } = await supabase
        .from('representantes')
        .select('id, nome')
        .order('nome');
      
      setRepresentatives(reps || []);

      // 2. Buscar relatórios com join
      const { data: rels, error } = await supabase
        .from('relatorios_mensais')
        .select(`
          id,
          mes_ano,
          total_treinamentos,
          treinamentos_concluidos,
          total_exames,
          exames_concluidos,
          aproveitamento_geral,
          detalhes,
          representantes (
            id,
            nome
          )
        `)
        .order('mes_ano', { ascending: false });

      if (error) throw error;

      const formattedReports: Report[] = (rels || []).map((r: any) => ({
        id: r.id,
        mes_ano: r.mes_ano.substring(0, 7), // Formato YYYY-MM
        total_treinamentos: r.total_treinamentos,
        treinamentos_concluidos: r.treinamentos_concluidos,
        total_exames: r.total_exames,
        exames_concluidos: r.exames_concluidos,
        aproveitamento_geral: Number(r.aproveitamento_geral),
        detalhes: r.detalhes,
        representante: {
          id: r.representantes?.id || '',
          nome: r.representantes?.nome || 'Desconhecido',
        }
      }));

      setReports(formattedReports);

      // Define o primeiro relatório carregado como ativo no dashboard por padrão
      if (formattedReports.length > 0 && !activeMetrics) {
        const first = formattedReports[0];
        setActiveMetrics({
          repName: first.representante.nome,
          totalContents: first.total_treinamentos,
          completedContents: first.treinamentos_concluidos,
          totalExams: first.total_exames,
          completedExams: first.exames_concluidos,
          overallProgress: first.aproveitamento_geral,
          detalhes: first.detalhes,
        });
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  }, [supabase, router, activeMetrics]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Logout
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  // Upload de Arquivos
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('month', selectedMonth);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao processar o arquivo.');
      }

      setMessage({ type: 'success', text: `Planilha de ${data.data.representante} importada com sucesso!` });
      
      // Atualizar dados da tela
      await loadData();
      
      // Definir este novo como ativo
      const res = data.data;
      // Buscar detalhes recém importados no novo estado carregado
      const matchingReport = reports.find(r => r.representante.nome === res.representante && r.mes_ano === res.mes);
      
      setActiveMetrics({
        repName: res.representante,
        totalContents: res.total_treinamentos,
        completedContents: res.treinamentos_concluidos,
        totalExams: res.total_exames,
        completedExams: res.exames_concluidos,
        overallProgress: res.aproveitamento_geral,
        detalhes: matchingReport?.detalhes || [],
      });

    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro inesperado no upload.' });
    } finally {
      setIsUploading(false);
    }
  };

  // Drag Event Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Deletar Relatório
  const handleDeleteReport = async (id: string) => {
    if (!confirm('Deseja realmente excluir este relatório do histórico?')) return;

    try {
      const { error } = await supabase
        .from('relatorios_mensais')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setReports(prev => prev.filter(r => r.id !== id));
      if (activeMetrics) {
        setActiveMetrics(null);
      }
      setMessage({ type: 'success', text: 'Relatório removido com sucesso.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao deletar registro.' });
    }
  };

  // Formatar Mês para exibição amigável (Ex: 06/2026)
  const formatMonth = (val: string) => {
    const [year, month] = val.split('-');
    return `${month}/${year}`;
  };

  // Filtragem de dados
  const filteredReports = selectedRepFilter === 'all'
    ? reports
    : reports.filter(r => r.representante.id === selectedRepFilter);

  // Dados para o Gráfico de Evolução (ordenado por mês cronologicamente)
  const chartData = [...filteredReports]
    .reverse()
    .map(r => ({
      mes: formatMonth(r.mes_ano),
      Aproveitamento: r.aproveitamento_geral,
      name: r.representante.nome
    }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 1. TOPO / CABEÇALHO */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              UBD Training Tracker
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Portal Enterprise de Consolidação de Resultados
            </p>
          </div>

          <div className="flex items-center gap-6">
            {sessionUser && (
              <span className="text-sm text-slate-300 font-medium">
                {sessionUser.email}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition"
            >
              <LogOut size={14} />
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUNA ESQUERDA: IMPORTAÇÃO E METRICAS (5 COLS) */}
        <section className="lg:col-span-5 space-y-8">
          
          {/* CARD DE IMPORTAÇÃO */}
          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-xl space-y-6">
            <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
              <Calendar size={18} className="text-blue-400" />
              Importar Nova Planilha
            </h2>

            {/* Seletor do Mês de Referência */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Mês de Referência
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                disabled={isUploading}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition disabled:opacity-50"
              />
            </div>

            {/* Dropzone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
              className={`p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragActive 
                  ? 'border-emerald-500 bg-emerald-950/15' 
                  : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/60'
              }`}
            >
              <input
                id="file-input"
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
                disabled={isUploading}
              />

              {isUploading ? (
                <div className="space-y-3 py-4">
                  <RefreshCw className="animate-spin text-emerald-400 mx-auto" size={36} />
                  <p className="text-sm font-semibold text-slate-300">Processando e Auditando Dados...</p>
                  <p className="text-xs text-slate-500">Calculando progresso e filtrandoCafé com Química</p>
                </div>
              ) : (
                <div className="space-y-3 py-2">
                  <Upload className="text-slate-500 mx-auto" size={32} />
                  <div>
                    <p className="text-sm font-semibold text-slate-300">Arraste ou clique para carregar</p>
                    <p className="text-xs text-slate-500 mt-1">Formatos suportados: Excel (.xlsx) ou CSV (Max 10MB)</p>
                  </div>
                </div>
              )}
            </div>

            {message && (
              <div className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${
                message.type === 'success' 
                  ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400' 
                  : 'bg-red-950/20 border-red-900/40 text-red-400'
              }`}>
                {message.type === 'success' ? (
                  <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            )}
          </div>

          {/* DASHBOARD DE MÉTRICAS ATIVAS */}
          {activeMetrics && (
            <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-200">
                    {activeMetrics.repName}
                  </h2>
                  <p className="text-xs text-slate-400">Resultados da planilha carregada</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-emerald-400">
                    {activeMetrics.overallProgress.toFixed(1)}%
                  </div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Aproveitamento
                  </div>
                </div>
              </div>

              {/* CARD 1: Conteúdos */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 font-medium flex items-center gap-1.5">
                    <BookOpen size={14} className="text-blue-400" />
                    Treinamentos (Conteúdos)
                  </span>
                  <span className="text-blue-400 font-bold">
                    {activeMetrics.completedContents} de {activeMetrics.totalContents}
                  </span>
                </div>
                <div className="h-2 bg-slate-950 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ 
                      width: `${activeMetrics.totalContents > 0 
                        ? (activeMetrics.completedContents / activeMetrics.totalContents) * 100 
                        : 0}%` 
                    }}
                  />
                </div>
              </div>

              {/* CARD 2: Exames */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 font-medium flex items-center gap-1.5">
                    <Award size={14} className="text-teal-400" />
                    Exames Avaliativos
                  </span>
                  <span className="text-teal-400 font-bold">
                    {activeMetrics.completedExams} de {activeMetrics.totalExams}
                  </span>
                </div>
                <div className="h-2 bg-slate-950 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-teal-500 transition-all duration-500"
                    style={{ 
                      width: `${activeMetrics.totalExams > 0 
                        ? (activeMetrics.completedExams / activeMetrics.totalExams) * 100 
                        : 0}%` 
                    }}
                  />
                </div>
              </div>

              {/* LISTA DETALHADA DE CURSOS DA PLANILHA ATIVA */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cursos e Exames da Planilha</h3>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {activeMetrics.detalhes.map((c, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-950/80 border border-slate-900 rounded-lg flex items-center justify-between text-xs">
                      <div className="space-y-0.5 pr-2">
                        <span className="font-semibold text-slate-300 block truncate max-w-xs">{c.conteudo}</span>
                        <span className={`text-[10px] font-bold ${c.tipo === 'Exame' ? 'text-teal-500' : 'text-blue-500'}`}>
                          {c.tipo || (c.conteudo.toLowerCase().includes('- exame') ? 'Exame' : 'Conteúdo')}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.status === 'Concluído' 
                          ? 'bg-emerald-950/40 border border-emerald-900/30 text-emerald-400' 
                          : 'bg-orange-950/40 border border-orange-900/30 text-orange-400'
                      }`}>
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* COLUNA DIREITA: HISTÓRICO E GRÁFICO (7 COLS) */}
        <section className="lg:col-span-7 space-y-8">
          
          {/* GRÁFICO DE EVOLUÇÃO */}
          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <TrendingUp size={18} className="text-emerald-400" />
                Histórico de Aproveitamento
              </h2>

              {/* Filtro por Representante */}
              <select
                value={selectedRepFilter}
                onChange={(e) => setSelectedRepFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="all">Ver Todos os Representantes</option>
                {representatives.map(r => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </select>
            </div>

            <div className="h-64 w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="mes" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} unit="%" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                      labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="Aproveitamento" 
                      name="Aproveitamento Geral"
                      stroke="#10b981" 
                      strokeWidth={3}
                      activeDot={{ r: 8 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                  Nenhum dado de histórico disponível para gerar gráfico.
                </div>
              )}
            </div>
          </div>

          {/* TABELA DO HISTÓRICO RETROATIVO */}
          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-xl space-y-6">
            <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-emerald-400" />
              Arquivos de Histórico Salvos
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-950/20">
                    <th className="py-3 px-4">Representante</th>
                    <th className="py-3 px-4">Mês/Ano</th>
                    <th className="py-3 px-4 text-center">Aproveitamento</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-xs">
                  {filteredReports.length > 0 ? (
                    filteredReports.map((report) => (
                      <tr key={report.id} className="hover:bg-slate-900/40 transition">
                        <td className="py-3 px-4 font-semibold text-slate-200">
                          {report.representante.nome}
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {formatMonth(report.mes_ano)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded font-bold ${
                            report.aproveitamento_geral === 100 
                              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30'
                              : 'bg-blue-950/40 text-blue-400 border border-blue-900/30'
                          }`}>
                            {report.aproveitamento_geral.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {/* Visualizar detalhes */}
                            <button
                              onClick={() => setActiveMetrics({
                                repName: report.representante.nome,
                                totalContents: report.total_treinamentos,
                                completedContents: report.treinamentos_concluidos,
                                totalExams: report.total_exames,
                                completedExams: report.exames_concluidos,
                                overallProgress: report.aproveitamento_geral,
                                detalhes: report.detalhes
                              })}
                              title="Visualizar no Painel"
                              className="p-1.5 bg-slate-950 border border-slate-850 hover:border-slate-700 text-slate-400 hover:text-white rounded transition"
                            >
                              <Eye size={13} />
                            </button>
                            {/* Deletar */}
                            <button
                              onClick={() => handleDeleteReport(report.id)}
                              title="Excluir Registro"
                              className="p-1.5 bg-red-950/20 border border-red-950 hover:border-red-900 text-red-500 hover:text-red-400 rounded transition"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">
                        Nenhuma planilha importada no histórico.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
