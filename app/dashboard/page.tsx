'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Upload, Calendar, FileSpreadsheet, LogOut, CheckCircle2, 
  AlertCircle, Trash2, Eye, BookOpen, Award, TrendingUp, RefreshCw,
  User, Users, Target, Save, FileText, BarChart3, ArrowRight, ClipboardList,
  PlusCircle, Trash, Lock, Key, X, Sliders
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-client';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';

interface DetailRow {
  conteudo: string;
  progresso: number;
  status: string;
  tipo?: string;
}

interface Representative {
  id: string;
  nome: string;
  observacoes: string;
  meta_aproveitamento: number;
}

interface WeeklyReport {
  id: string;
  semana_ano: string; // YYYY-MM-DD (Monday)
  total_treinamentos: number;
  treinamentos_concluidos: number;
  total_exames: number;
  exames_concluidos: number;
  aproveitamento_geral: number;
  detalhes: DetailRow[];
  observacoes: string;
}

// Helpers para tratamento de semanas ISO 8601
const getISOWeekString = (date: Date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const formatISOWeekDisplay = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00Z');
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  
  // Format DD/MM format for Monday
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `Semana ${String(weekNo).padStart(2, '0')} (${day}/${month})`;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  // Estados
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [selectedWeekInput, setSelectedWeekInput] = useState(() => getISOWeekString(new Date()));
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [activeTab, setActiveTab] = useState<'evolution' | 'comparison' | 'dossier'>('evolution');

  // Estados de Dossiê / Perfil
  const [repNotes, setRepNotes] = useState('');
  const [repTarget, setRepTarget] = useState<number>(80);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Estados de Comparação Week-over-Week
  const [compareWeekA, setCompareWeekA] = useState<string>('');
  const [compareWeekB, setCompareWeekB] = useState<string>('');

  // Estados do Visualizador de Detalhes da Semana Selecionada
  const [selectedWeeklyReport, setSelectedWeeklyReport] = useState<WeeklyReport | null>(null);

  // Estados de Upload
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Estados de Alteração de Senha
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword.length < 6) {
      setPasswordError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem.');
      return;
    }
    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setMessage({ type: 'success', text: 'Senha do administrador alterada com sucesso!' });
      setIsPasswordModalOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Erro ao alterar a senha.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Carregar dados principais
  const loadInitialData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setSessionUser(user);

      // Buscar todos os representantes vinculados ao usuário
      const { data: reps, error: repsError } = await supabase
        .from('representantes')
        .select('id, nome, observacoes, meta_aproveitamento')
        .order('nome');

      if (repsError) throw repsError;
      
      const formattedReps = (reps || []).map((r: any) => ({
        id: r.id,
        nome: r.nome,
        observacoes: r.observacoes || '',
        meta_aproveitamento: Number(r.meta_aproveitamento ?? 80)
      }));

      setRepresentatives(formattedReps);

      // Se nenhum representante estiver selecionado e houver representantes, seleciona o primeiro
      if (formattedReps.length > 0 && !selectedRepId) {
        setSelectedRepId(formattedReps[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar representantes:', err);
    }
  }, [supabase, router, selectedRepId]);

  // Carregar relatórios semanais do representante selecionado
  const loadRepresentativeReports = useCallback(async (repId: string) => {
    try {
      const { data: reports, error } = await supabase
        .from('relatorios_semanais')
        .select(`
          id,
          semana_ano,
          total_treinamentos,
          treinamentos_concluidos,
          total_exames,
          exames_concluidos,
          aproveitamento_geral,
          detalhes,
          observacoes
        `)
        .eq('representante_id', repId)
        .order('semana_ano', { ascending: false });

      if (error) throw error;

      const formatted = (reports || []).map((r: any) => ({
        id: r.id,
        semana_ano: r.semana_ano,
        total_treinamentos: r.total_treinamentos,
        treinamentos_concluidos: r.treinamentos_concluidos,
        total_exames: r.total_exames,
        exames_concluidos: r.exames_concluidos,
        aproveitamento_geral: Number(r.aproveitamento_geral),
        detalhes: r.detalhes || [],
        observacoes: r.observacoes || ''
      }));

      setWeeklyReports(formatted);

      // Set default selected report for details
      if (formatted.length > 0) {
        setSelectedWeeklyReport(formatted[0]);
        // Configurar semanas padrão de comparação
        if (formatted.length >= 2) {
          setCompareWeekA(formatted[1].semana_ano);
          setCompareWeekB(formatted[0].semana_ano);
        } else {
          setCompareWeekA(formatted[0].semana_ano);
          setCompareWeekB(formatted[0].semana_ano);
        }
      } else {
        setSelectedWeeklyReport(null);
        setCompareWeekA('');
        setCompareWeekB('');
      }
    } catch (err) {
      console.error('Erro ao carregar relatórios semanais:', err);
    }
  }, [supabase]);

  // Efeitos colaterais
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (selectedRepId) {
      loadRepresentativeReports(selectedRepId);
      const rep = representatives.find(r => r.id === selectedRepId);
      if (rep) {
        setRepNotes(rep.observacoes);
        setRepTarget(rep.meta_aproveitamento);
      }
    } else {
      setWeeklyReports([]);
      setSelectedWeeklyReport(null);
    }
  }, [selectedRepId, representatives, loadRepresentativeReports]);

  // Logout
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  // Upload de arquivos
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('week', selectedWeekInput);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao processar o arquivo.');
      }

      setMessage({ type: 'success', text: `Planilha de ${data.data.representante} importada para a semana com sucesso!` });
      
      // Recarregar os representantes (caso seja um novo) e depois atualizar a lista de relatórios
      await loadInitialData();
      
      // Achar o representante correspondente
      const targetRep = representatives.find(r => r.nome.toLowerCase() === data.data.representante.toLowerCase());
      if (targetRep) {
        setSelectedRepId(targetRep.id);
        await loadRepresentativeReports(targetRep.id);
      } else {
        // Se for um novo cadastrado
        const { data: newReps } = await supabase.from('representantes').select('id, nome').eq('nome', data.data.representante);
        if (newReps && newReps.length > 0) {
          setSelectedRepId(newReps[0].id);
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro inesperado no upload.' });
    } finally {
      setIsUploading(false);
    }
  };

  // Drag handlers
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

  // Salvar Dossiê / Perfil
  const handleSaveProfile = async () => {
    if (!selectedRepId) return;
    setIsSavingProfile(true);
    try {
      const response = await fetch('/api/representantes', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedRepId,
          observacoes: repNotes,
          meta_aproveitamento: repTarget,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Erro ao salvar dossiê.');
      }

      setMessage({ type: 'success', text: 'Dossiê do representante atualizado com sucesso!' });
      
      // Atualizar lista de representantes localmente
      setRepresentatives(prev => prev.map(r => r.id === selectedRepId ? {
        ...r,
        observacoes: repNotes,
        meta_aproveitamento: repTarget
      } : r));
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Falha ao salvar dossiê.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Excluir relatório semanal
  const handleDeleteWeeklyReport = async (id: string) => {
    if (!confirm('Deseja realmente excluir este relatório semanal permanentemente?')) return;

    try {
      const { error } = await supabase
        .from('relatorios_semanais')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Relatório semanal removido com sucesso.' });
      if (selectedRepId) {
        loadRepresentativeReports(selectedRepId);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao deletar registro.' });
    }
  };

  // Deletar Representante Inteiro
  const handleDeleteRepresentative = async (id: string) => {
    if (!confirm('ATENÇÃO: Excluir este representante irá apagar todos os relatórios semanais vinculados a ele. Continuar?')) return;

    try {
      const { error } = await supabase
        .from('representantes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Representante e todo o seu histórico foram excluídos.' });
      setSelectedRepId(null);
      loadInitialData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao deletar representante.' });
    }
  };

  // Memoizar representante ativo
  const activeRep = useMemo(() => {
    return representatives.find(r => r.id === selectedRepId) || null;
  }, [representatives, selectedRepId]);

  // Evolução geral do representante selecionado (Gráfico Recharts)
  const chartData = useMemo(() => {
    return [...weeklyReports]
      .reverse()
      .map(r => ({
        semana: formatISOWeekDisplay(r.semana_ano),
        Aproveitamento: r.aproveitamento_geral,
        Meta: activeRep?.meta_aproveitamento || 80
      }));
  }, [weeklyReports, activeRep]);

  // Média de aproveitamento geral histórico do representante ativo
  const averageAproveitamento = useMemo(() => {
    if (weeklyReports.length === 0) return 0;
    const total = weeklyReports.reduce((acc, curr) => acc + curr.aproveitamento_geral, 0);
    return parseFloat((total / weeklyReports.length).toFixed(1));
  }, [weeklyReports]);

  // Análise Week-over-Week
  const comparisonData = useMemo(() => {
    if (!compareWeekA || !compareWeekB || weeklyReports.length === 0) return [];
    
    const reportA = weeklyReports.find(r => r.semana_ano === compareWeekA);
    const reportB = weeklyReports.find(r => r.semana_ano === compareWeekB);

    if (!reportA || !reportB) return [];

    // Mapear conteúdos
    const coursesA = new Map<string, DetailRow>();
    reportA.detalhes.forEach(d => coursesA.set(d.conteudo, d));

    const coursesB = new Map<string, DetailRow>();
    reportB.detalhes.forEach(d => coursesB.set(d.conteudo, d));

    // Consolidar todos os cursos únicos
    const allCourseNames = Array.from(new Set([...coursesA.keys(), ...coursesB.keys()]));

    return allCourseNames.map(name => {
      const stateA = coursesA.get(name);
      const stateB = coursesB.get(name);

      let status = 'Sem alteração';
      let statusClass = 'text-slate-400 bg-slate-900/40 border-slate-900/60';

      if (!stateA && stateB) {
        status = 'Novo Curso';
        statusClass = 'text-blue-400 bg-blue-950/20 border-blue-900/30';
      } else if (stateA && !stateB) {
        status = 'Removido';
        statusClass = 'text-red-400 bg-red-950/20 border-red-900/30';
      } else if (stateA && stateB) {
        if (stateA.status === 'Em Andamento' && stateB.status === 'Concluído') {
          status = 'Evoluiu (Concluído)';
          statusClass = 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30';
        } else if (stateA.status === 'Concluído' && stateB.status === 'Em Andamento') {
          status = 'Regrediu';
          statusClass = 'text-orange-400 bg-orange-950/20 border-orange-900/30';
        }
      }

      return {
        nome: name,
        progressoA: stateA ? `${stateA.progresso}%` : 'N/A',
        statusA: stateA ? stateA.status : 'N/A',
        progressoB: stateB ? `${stateB.progresso}%` : 'N/A',
        statusB: stateB ? stateB.status : 'N/A',
        status,
        statusClass
      };
    });
  }, [compareWeekA, compareWeekB, weeklyReports]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* 1. CABEÇALHO */}
      <header className="border-b border-slate-900 bg-slate-900/30 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-teal-400 to-emerald-400">
              UBD Training Tracker
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Dossiês e Auditoria Semanal de Representantes Comerciais
            </p>
          </div>

          <div className="flex items-center gap-4">
            {sessionUser && (
              <span className="text-xs text-slate-400 font-semibold border border-slate-800 bg-slate-950/60 px-3 py-1.5 rounded-lg flex items-center gap-2">
                <User size={12} className="text-emerald-400" />
                {sessionUser.email}
              </span>
            )}
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-850 text-slate-350 hover:text-white text-xs font-bold rounded-lg flex items-center gap-2 transition"
              title="Alterar Senha de Acesso"
            >
              <Key size={14} className="text-teal-400" />
              Alterar Senha
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 text-red-400 hover:text-red-300 text-xs font-bold rounded-lg flex items-center gap-2 transition"
            >
              <LogOut size={14} />
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUNA ESQUERDA: LISTA DE REPRESENTANTES E UPLOAD (4 COLUNAS) */}
        <section className="lg:col-span-4 space-y-6">
          
          {/* UPLOAD DE PLANILHA */}
          <div className="p-5 bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl space-y-4 shadow-xl">
            <h2 className="text-sm font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Calendar size={16} className="text-blue-400" />
              Upload Semanal
            </h2>

            {/* Seletor de Semana */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Semana de Referência
              </label>
              <input
                type="week"
                value={selectedWeekInput}
                onChange={(e) => setSelectedWeekInput(e.target.value)}
                disabled={isUploading}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition disabled:opacity-50"
              />
            </div>

            {/* Dropzone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
              className={`p-6 border border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragActive 
                  ? 'border-emerald-500 bg-emerald-950/15' 
                  : 'border-slate-850 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/60'
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
                <div className="space-y-2 py-2">
                  <RefreshCw className="animate-spin text-emerald-400 mx-auto" size={24} />
                  <p className="text-xs font-bold text-slate-300">Auditando Planilha...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="text-slate-500 mx-auto" size={24} />
                  <div>
                    <p className="text-xs font-bold text-slate-300">Arraste ou clique para carregar</p>
                    <p className="text-[10px] text-slate-500">Planilha Excel (.xlsx) ou CSV</p>
                  </div>
                </div>
              )}
            </div>

            {message && (
              <div className={`p-3 rounded-lg border flex items-start gap-2 text-xs ${
                message.type === 'success' 
                  ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400' 
                  : 'bg-red-950/20 border-red-900/40 text-red-400'
              }`}>
                {message.type === 'success' ? (
                  <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                )}
                <span className="leading-relaxed">{message.text}</span>
              </div>
            )}
          </div>

          {/* LISTA DE REPRESENTANTES */}
          <div className="p-5 bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Users size={16} className="text-emerald-400" />
                Representantes
              </h2>
              <span className="text-[10px] font-bold bg-slate-950 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                {representatives.length}
              </span>
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
              {representatives.length > 0 ? (
                representatives.map((rep) => {
                  const isSelected = selectedRepId === rep.id;
                  return (
                    <div
                      key={rep.id}
                      onClick={() => setSelectedRepId(rep.id)}
                      className={`p-3 border rounded-xl flex items-center justify-between cursor-pointer transition ${
                        isSelected 
                          ? 'border-emerald-500/50 bg-emerald-950/10 text-slate-100 shadow-md' 
                          : 'border-slate-850 hover:border-slate-800 bg-slate-950/40 hover:bg-slate-950/60 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-emerald-950/30 text-emerald-400' : 'bg-slate-900 text-slate-500'}`}>
                          <User size={14} />
                        </div>
                        <span className="text-xs font-bold truncate">{rep.nome}</span>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRepresentative(rep.id);
                        }}
                        className="p-1 hover:text-red-400 transition rounded"
                        title="Deletar Representante"
                      >
                        <Trash size={12} />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-xs text-slate-600">
                  Nenhum representante cadastrado. Faça o upload de uma planilha para começar.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* COLUNA DIREITA: DETALHES DO PERFIL, HISTÓRICO E GRÁFICOS (8 COLUNAS) */}
        <section className="lg:col-span-8 space-y-6">
          {activeRep ? (
            <div className="space-y-6">
              
              {/* CARD RESUMO DE PERFIL */}
              <div className="p-6 bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-950/5 rounded-full blur-3xl" />
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-black text-slate-100">{activeRep.nome}</h2>
                    <span className="px-2 py-0.5 border border-emerald-900/30 bg-emerald-950/30 text-emerald-400 text-[10px] font-bold rounded-full">
                      Perfil Ativo
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-md">
                    Analise a evolução, compare resultados entre semanas e adicione observações qualitativas ao dossiê.
                  </p>
                </div>

                <div className="flex items-center gap-8 bg-slate-950/60 border border-slate-850 p-4 rounded-xl">
                  <div className="text-center">
                    <div className="text-2xl font-black text-emerald-400">{averageAproveitamento}%</div>
                    <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Aproveitamento Médio</div>
                  </div>
                  <div className="h-8 w-px bg-slate-850" />
                  <div className="text-center">
                    <div className="text-2xl font-black text-blue-400">{activeRep.meta_aproveitamento}%</div>
                    <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Meta Definida</div>
                  </div>
                </div>
              </div>

              {/* NAVEGAÇÃO POR ABAS DO PERFIL */}
              <div className="border-b border-slate-850 flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('evolution')}
                  className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border-b-2 transition -mb-px ${
                    activeTab === 'evolution'
                      ? 'border-emerald-500 text-slate-100'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <TrendingUp size={14} />
                  Evolução Semanal
                </button>
                <button
                  onClick={() => setActiveTab('comparison')}
                  className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border-b-2 transition -mb-px ${
                    activeTab === 'comparison'
                      ? 'border-emerald-500 text-slate-100'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BarChart3 size={14} />
                  Comparador de Semanas
                </button>
                <button
                  onClick={() => setActiveTab('dossier')}
                  className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border-b-2 transition -mb-px ${
                    activeTab === 'dossier'
                      ? 'border-emerald-500 text-slate-100'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ClipboardList size={14} />
                  Dossiê & Notas
                </button>
              </div>

              {/* TAB 1: EVOLUÇÃO SEMANAL */}
              {activeTab === 'evolution' && (
                <div className="space-y-6">
                  
                  {/* GRÁFICO */}
                  <div className="p-5 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-emerald-400" />
                      Histórico Semanal de Aproveitamento
                    </h3>
                    <div className="h-60 w-full">
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="semana" stroke="#64748b" fontSize={9} />
                            <YAxis stroke="#64748b" fontSize={9} domain={[0, 100]} unit="%" />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                              labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '10px' }} />
                            <Line 
                              type="monotone" 
                              dataKey="Aproveitamento" 
                              name="Aproveitamento"
                              stroke="#10b981" 
                              strokeWidth={3}
                              activeDot={{ r: 6 }} 
                            />
                            <ReferenceLine y={activeRep.meta_aproveitamento} label={{ value: `Meta (${activeRep.meta_aproveitamento}%)`, fill: '#ef4444', fontSize: 10, position: 'top' }} stroke="#ef4444" strokeDasharray="3 3" />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                          Carregue planilhas para gerar o gráfico histórico.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* LISTAGEM DE HISTÓRICO E DETALHES DA SEMANA */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    
                    {/* TABELA DE REGISTROS (7 COLS) */}
                    <div className="md:col-span-7 p-5 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <FileSpreadsheet size={14} className="text-blue-400" />
                        Histórico de Semanas
                      </h3>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/20">
                              <th className="py-2.5 px-3">Semana</th>
                              <th className="py-2.5 px-3 text-center">Progresso</th>
                              <th className="py-2.5 px-3 text-center">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900 text-xs">
                            {weeklyReports.length > 0 ? (
                              weeklyReports.map((report) => {
                                const isSelected = selectedWeeklyReport?.id === report.id;
                                return (
                                  <tr 
                                    key={report.id} 
                                    onClick={() => setSelectedWeeklyReport(report)}
                                    className={`cursor-pointer transition ${
                                      isSelected ? 'bg-slate-850/60' : 'hover:bg-slate-900/30'
                                    }`}
                                  >
                                    <td className="py-3 px-3 font-semibold text-slate-200">
                                      {formatISOWeekDisplay(report.semana_ano)}
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        report.aproveitamento_geral >= activeRep.meta_aproveitamento
                                          ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30'
                                          : 'bg-blue-950/40 text-blue-400 border border-blue-900/30'
                                      }`}>
                                        {report.aproveitamento_geral.toFixed(1)}%
                                      </span>
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                      <div className="flex items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
                                        <button
                                          onClick={() => setSelectedWeeklyReport(report)}
                                          className="p-1 hover:text-white text-slate-500 transition rounded"
                                          title="Visualizar Detalhes"
                                        >
                                          <Eye size={12} />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteWeeklyReport(report.id)}
                                          className="p-1 hover:text-red-400 text-slate-500 transition rounded"
                                          title="Deletar Semana"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={3} className="py-8 text-center text-slate-500 text-[11px]">
                                  Nenhum histórico semanal disponível.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* DETALHES DA SEMANA SELECIONADA (5 COLS) */}
                    <div className="md:col-span-5 p-5 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
                      {selectedWeeklyReport ? (
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                              Detalhes da {formatISOWeekDisplay(selectedWeeklyReport.semana_ano)}
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">Visão geral do progresso individual</p>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-center">
                            <div className="bg-slate-950/60 border border-slate-850 p-2 rounded-lg">
                              <div className="text-xs text-blue-400 font-bold">
                                {selectedWeeklyReport.treinamentos_concluidos} / {selectedWeeklyReport.total_treinamentos}
                              </div>
                              <div className="text-[8px] uppercase text-slate-500 font-bold mt-0.5">Treinamentos</div>
                            </div>
                            <div className="bg-slate-950/60 border border-slate-850 p-2 rounded-lg">
                              <div className="text-xs text-teal-400 font-bold">
                                {selectedWeeklyReport.exames_concluidos} / {selectedWeeklyReport.total_exames}
                              </div>
                              <div className="text-[8px] uppercase text-slate-500 font-bold mt-0.5">Exames</div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Módulos</div>
                            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar text-[11px]">
                              {selectedWeeklyReport.detalhes.map((c, idx) => (
                                <div key={idx} className="p-2 bg-slate-950/80 border border-slate-900 rounded-lg flex items-center justify-between">
                                  <span className="font-semibold text-slate-300 truncate max-w-[130px]" title={c.conteudo}>
                                    {c.conteudo}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
                                    c.status === 'Concluído' 
                                      ? 'bg-emerald-950/40 text-emerald-400' 
                                      : 'bg-orange-950/40 text-orange-400'
                                  }`}>
                                    {c.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-center py-10 text-slate-500 text-xs">
                          Selecione uma semana ao lado para ver os cursos.
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}

              {/* TAB 2: COMPARADOR DE SEMANAS */}
              {activeTab === 'comparison' && (
                <div className="p-5 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-6 shadow-xl">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <BarChart3 size={14} className="text-emerald-400" />
                        Comparador Week-over-Week
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Selecione duas semanas para comparar o avanço dos cursos</p>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <select
                        value={compareWeekA}
                        onChange={(e) => setCompareWeekA(e.target.value)}
                        className="px-2 py-1.5 bg-slate-950 border border-slate-800 text-slate-300 rounded-lg focus:outline-none"
                      >
                        <option value="">Semana Base...</option>
                        {weeklyReports.map(r => (
                          <option key={r.id} value={r.semana_ano}>{formatISOWeekDisplay(r.semana_ano)}</option>
                        ))}
                      </select>
                      <ArrowRight size={14} className="text-slate-500" />
                      <select
                        value={compareWeekB}
                        onChange={(e) => setCompareWeekB(e.target.value)}
                        className="px-2 py-1.5 bg-slate-950 border border-slate-800 text-slate-300 rounded-lg focus:outline-none"
                      >
                        <option value="">Semana Foco...</option>
                        {weeklyReports.map(r => (
                          <option key={r.id} value={r.semana_ano}>{formatISOWeekDisplay(r.semana_ano)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* RESULTADO COMPARATIVO */}
                  {comparisonData.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/20">
                            <th className="py-2.5 px-3">Nome do Treinamento / Exame</th>
                            <th className="py-2.5 px-3 text-center">Semana Base</th>
                            <th className="py-2.5 px-3 text-center">Semana Foco</th>
                            <th className="py-2.5 px-3 text-center">Status de Avanço</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900">
                          {comparisonData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-900/35 transition">
                              <td className="py-3 px-3 font-semibold text-slate-200">{row.nome}</td>
                              <td className="py-3 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  row.statusA === 'Concluído' ? 'text-emerald-400 bg-emerald-950/10' : 'text-orange-400 bg-orange-950/10'
                                }`}>
                                  {row.statusA}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  row.statusB === 'Concluído' ? 'text-emerald-400 bg-emerald-950/10' : 'text-orange-400 bg-orange-950/10'
                                }`}>
                                  {row.statusB}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded-[4px] border text-[9px] font-black uppercase tracking-wider ${row.statusClass}`}>
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      Por favor, selecione duas semanas diferentes no menu acima para auditar o progresso comparativo.
                    </div>
                  )}

                </div>
              )}

              {/* TAB 3: DOSSIÊ & NOTAS */}
              {activeTab === 'dossier' && (
                <div className="p-5 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-6 shadow-xl">
                  
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <ClipboardList size={14} className="text-emerald-400" />
                      Dossiê Qualitativo de Desempenho
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Registre comentários qualitativos, feedbacks e defina metas de aproveitamento.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    
                    {/* META (4 COLS) */}
                    <div className="md:col-span-4 space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Target size={12} className="text-emerald-400" />
                        Meta de Aproveitamento
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={repTarget}
                          onChange={(e) => setRepTarget(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 text-emerald-400"
                        />
                        <span className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-500">%</span>
                      </div>
                    </div>

                    {/* OBSERVAÇÕES (8 COLS) */}
                    <div className="md:col-span-8 space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <FileText size={12} className="text-blue-400" />
                        Notas e Observações de Supervisão
                      </label>
                      <textarea
                        value={repNotes}
                        onChange={(e) => setRepNotes(e.target.value)}
                        placeholder="Ex: Representante iniciou novos módulos técnicos. Necessita de acompanhamento presencial em exames de conformidade..."
                        rows={6}
                        className="w-full p-3 bg-slate-950 border border-slate-850 rounded-xl text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-600 resize-none text-slate-300"
                      />
                    </div>

                  </div>

                  <div className="flex justify-end border-t border-slate-850 pt-4">
                    <button
                      onClick={handleSaveProfile}
                      disabled={isSavingProfile}
                      className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg hover:shadow-emerald-950/20 disabled:opacity-50 transition transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                      {isSavingProfile ? (
                        <>
                          <RefreshCw className="animate-spin" size={12} />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save size={12} />
                          Salvar Alterações do Dossiê
                        </>
                      )}
                    </button>
                  </div>

                </div>
              )}

            </div>
          ) : (
            <div className="h-96 bg-slate-900/20 border border-slate-900/60 rounded-2xl flex flex-col items-center justify-center text-center p-6">
              <Users size={48} className="text-slate-700 mb-4 animate-pulse" />
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-wider">Nenhum perfil de representante ativo</h2>
              <p className="text-xs text-slate-650 mt-2 max-w-sm">
                Selecione um representante no menu lateral ou envie uma nova planilha para ver os resultados.
              </p>
            </div>
          )}
        </section>

      </main>

      {/* MODAL DE ALTERAÇÃO DE SENHA */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm space-y-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setIsPasswordModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-350 transition"
              type="button"
            >
              <X size={16} />
            </button>
            
            <div>
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Lock size={15} className="text-teal-400" />
                Alterar Senha do Supervisor
              </h3>
              <p className="text-[10px] text-slate-450 mt-1">Insira a nova senha para atualizar as credenciais do seu dashboard.</p>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nova Senha</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500 placeholder-slate-750"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Confirmar Nova Senha</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  required
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500 placeholder-slate-750"
                />
              </div>

              {passwordError && (
                <div className="text-[10px] font-semibold text-red-400 bg-red-950/20 border border-red-900/30 p-2.5 rounded-lg flex items-center gap-1.5">
                  <AlertCircle size={12} className="flex-shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg disabled:opacity-50 transition transform hover:-translate-y-0.5"
                >
                  {isUpdatingPassword ? (
                    <>
                      <RefreshCw className="animate-spin" size={12} />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Senha'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
