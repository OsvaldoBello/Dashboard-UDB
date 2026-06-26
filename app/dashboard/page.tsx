'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Upload, Calendar, FileSpreadsheet, LogOut, CheckCircle2, 
  AlertCircle, Trash2, Eye, BookOpen, Award, TrendingUp, RefreshCw,
  User, Users, Target, Save, FileText, BarChart3, ArrowRight, ClipboardList,
  PlusCircle, Trash, Lock, Key, X, Sliders, Shield, Loader2,
  Sun, Moon, Download
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-client';
import * as XLSX from 'xlsx';
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
  supervisor_email?: string;
  supervisorEmail?: string;
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

// Helpers para tratamento de semanas do mês
const formatISOWeekDisplay = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00Z');
  const day = date.getUTCDate();
  const weekOfMonth = Math.ceil(day / 7);
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const monthName = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `Semana ${weekOfMonth}/${monthName} (${year})`;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  // Estados
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth()); // 0-11
  const [selectedWeekOfMonth, setSelectedWeekOfMonth] = useState(1);
  const [uploadRepId, setUploadRepId] = useState<string | null>(null);
  
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [activeTab, setActiveTab] = useState<'evolution' | 'comparison' | 'dossier' | 'admin' | 'export'>('evolution');



  // Estados Admin
  const [userRole, setUserRole] = useState<'admin' | 'supervisor' | null>(null);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [isLoadingSupervisors, setIsLoadingSupervisors] = useState(false);

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
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'manual'>('file');
  const [totalTreinamentos, setTotalTreinamentos] = useState<string>('');
  const [treinamentosConcluidos, setTreinamentosConcluidos] = useState<string>('');
  const [totalExames, setTotalExames] = useState<string>('');
  const [examesConcluidos, setExamesConcluidos] = useState<string>('');
  const [manualObservations, setManualObservations] = useState<string>('');
  const [isSavingManual, setIsSavingManual] = useState(false);
  
  // Tema Claro/Escuro
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Estados de Alteração de Senha
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const validatePassword = (pwd: string) => {
    return {
      length: pwd.length >= 8 && pwd.length <= 32,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd)
    };
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    
    const criteria = validatePassword(newPassword);
    const isPwdValid = Object.values(criteria).every(Boolean);

    if (!isPwdValid) {
      setPasswordError('A nova senha não atende a todos os requisitos de segurança.');
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
      setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
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

      // Buscar papel do usuário na tabela perfis com fallback seguro
      let role: 'admin' | 'supervisor' = 'supervisor';
      try {
        const { data: profile } = await supabase
          .from('perfis')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (profile?.role) {
          role = profile.role;
        }
      } catch (e) {
        console.warn('Tabela perfis indisponível:', e);
      }
      setUserRole(role);

      // Buscar representantes. Se for admin, busca também o email do supervisor associado
      let repsResult: any[] = [];
      let repsQuery = supabase.from('representantes').select('id, nome, observacoes, meta_aproveitamento');
      
      if (role === 'admin') {
        try {
          const adminQuery = supabase.from('representantes').select('id, nome, observacoes, meta_aproveitamento, perfis(email)');
          const { data, error } = await adminQuery.order('nome');
          if (error) throw error;
          repsResult = data || [];
        } catch (e) {
          console.warn('Falha ao buscar representantes com perfis, buscando sem join:', e);
          const { data, error } = await repsQuery.order('nome');
          if (error) throw error;
          repsResult = data || [];
        }
      } else {
        const { data, error } = await repsQuery.order('nome');
        if (error) throw error;
        repsResult = data || [];
      }
      
      const formattedReps = repsResult.map((r: any) => ({
        id: r.id,
        nome: r.nome,
        observacoes: r.observacoes || '',
        meta_aproveitamento: Number(r.meta_aproveitamento ?? 80),
        supervisor_email: r.perfis?.email || undefined,
        supervisorEmail: r.perfis?.email || undefined
      }));

      setRepresentatives(formattedReps);

      // Se nenhum representante estiver selecionado e houver representantes, seleciona o primeiro
      setSelectedRepId(current => {
        if (!current && formattedReps.length > 0) {
          return formattedReps[0].id;
        }
        return current;
      });
    } catch (err) {
      console.error('Erro ao carregar representantes:', err);
    }
  }, [supabase, router]);

  const loadSupervisors = useCallback(async () => {
    setIsLoadingSupervisors(true);
    try {
      const res = await fetch('/api/auth/users');
      if (res.ok) {
        const data = await res.json();
        setSupervisors(data.supervisors || []);
      } else {
        const data = await res.json();
        console.error('Erro ao buscar supervisores:', data.error);
      }
    } catch (err) {
      console.error('Erro ao carregar supervisores:', err);
    } finally {
      setIsLoadingSupervisors(false);
    }
  }, []);

  const handleDeleteSupervisor = async (userId: string, userEmail: string) => {
    if (!confirm(`Tem certeza que deseja excluir permanentemente o supervisor ${userEmail}? Isso apagará todos os representantes e planilhas vinculados a ele.`)) {
      return;
    }
    setIsLoadingSupervisors(true);
    try {
      const res = await fetch(`/api/auth/users?id=${userId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Supervisor excluído com sucesso!' });
        loadSupervisors();
        loadInitialData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao excluir supervisor.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro de rede ao excluir supervisor.' });
    } finally {
      setIsLoadingSupervisors(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'admin' && userRole === 'admin') {
      loadSupervisors();
    }
  }, [activeTab, userRole, loadSupervisors]);

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

  // Auto-selecionar uploadRepId quando selectedRepId muda
  useEffect(() => {
    if (selectedRepId) {
      setUploadRepId(selectedRepId);
    }
  }, [selectedRepId]);

  // Inicialização e gerenciamento de Tema Claro/Escuro
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleDownloadComparison = () => {
    if (comparisonData.length === 0 || !activeRep) return;

    try {
      // 1. Criar dados formatados para a planilha
      const rows = comparisonData.map(row => ({
        'Nome do Treinamento / Exame': row.nome,
        'Status (Semana Base)': row.statusA,
        'Progresso (Semana Base)': row.progressoA,
        'Status (Semana Foco)': row.statusB,
        'Progresso (Semana Foco)': row.progressoB,
        'Status de Avanço': row.status
      }));

      // 2. Criar workbook
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();

      // Definir larguras de colunas
      worksheet['!cols'] = [
        { wch: 45 }, // Nome do Treinamento
        { wch: 25 }, // Status Base
        { wch: 25 }, // Progresso Base
        { wch: 25 }, // Status Foco
        { wch: 25 }, // Progresso Foco
        { wch: 30 }, // Status de Avanço
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Comparação de Semanas');

      // Nome do arquivo
      const safeRepName = activeRep.nome.replace(/\s+/g, '_');
      const fileName = `Comparativo_${safeRepName}_${compareWeekA}_vs_${compareWeekB}.xlsx`;

      XLSX.writeFile(workbook, fileName);
    } catch (err) {
      console.error('Erro ao gerar planilha comparativa:', err);
      alert('Não foi possível gerar a planilha de comparação.');
    }
  };

  // Data de referência calculada
  const computedDateString = useMemo(() => {
    const day = (selectedWeekOfMonth - 1) * 7 + 1;
    const y = selectedYear;
    const m = String(selectedMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [selectedYear, selectedMonth, selectedWeekOfMonth]);

  // Upload de arquivos
  const handleFileUpload = async (files: FileList | File[]) => {
    setIsUploading(true);
    setUploadProgress(null);
    setMessage(null);

    const fileArray = Array.from(files);
    let successCount = 0;
    let failCount = 0;
    let lastRepId = null;

    // Obter o token da sessão uma única vez para evitar condições de corrida de refresh
    let token = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token;
    } catch (sessionErr) {
      console.warn('Erro ao carregar token da sessão:', sessionErr);
    }

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setUploadProgress({
        current: i + 1,
        total: fileArray.length,
        fileName: file.name
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('week', computedDateString);

      const headersObj: Record<string, string> = {};
      if (token) {
        headersObj['Authorization'] = `Bearer ${token}`;
      }

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          headers: headersObj,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Falha ao processar o arquivo.');
        }

        successCount++;
        if (data.data?.representanteId) {
          lastRepId = data.data.representanteId;
        }
      } catch (err: any) {
        console.error(`Erro ao processar ${file.name}:`, err);
        failCount++;
      }
    }

    setUploadProgress(null);
    setIsUploading(false);

    if (successCount > 0) {
      await loadInitialData();
      if (lastRepId) {
        setSelectedRepId(lastRepId);
        setUploadRepId(lastRepId);
        await loadRepresentativeReports(lastRepId);
      }
    }

    if (fileArray.length === 1) {
      if (successCount === 1) {
        setMessage({ type: 'success', text: `Planilha importada com sucesso!` });
      } else {
        setMessage({ type: 'error', text: `Falha ao processar o arquivo.` });
      }
    } else {
      if (failCount === 0) {
        setMessage({ type: 'success', text: `Processamento concluído: ${successCount} planilhas importadas com sucesso!` });
      } else if (successCount > 0) {
        setMessage({ type: 'success', text: `Processamento parcial: ${successCount} planilhas importadas, ${failCount} falhas.` });
      } else {
        setMessage({ type: 'error', text: `Falha ao processar as ${failCount} planilhas selecionadas.` });
      }
    }
  };

  // Exportar todos os representantes consolidado em um único Excel
  const handleExportConsolidatedExcel = async () => {
    setIsExporting(true);
    setMessage(null);
    try {
      const { data: reps, error: repsError } = await supabase
        .from('representantes')
        .select('id, nome, meta_aproveitamento')
        .order('nome');

      if (repsError) throw repsError;
      if (!reps || reps.length === 0) {
        throw new Error('Nenhum representante cadastrado para exportar.');
      }

      const { data: reports, error: reportsError } = await supabase
        .from('relatorios_semanais')
        .select('*')
        .order('semana_ano', { ascending: false });

      if (reportsError) throw reportsError;

      const summaryRows = reps.map(rep => {
        const repReports = (reports || []).filter(r => r.representante_id === rep.id);
        const latestReport = repReports[0] || null;

        return {
          'Representante': rep.nome,
          'Última Semana Ativa': latestReport ? formatISOWeekDisplay(latestReport.semana_ano) : 'Sem dados',
          'Treinamentos Concluídos': latestReport ? `${latestReport.treinamentos_concluidos} de ${latestReport.total_treinamentos}` : '0 de 0',
          'Exames Concluídos': latestReport ? `${latestReport.exames_concluidos} de ${latestReport.total_exames}` : '0 de 0',
          'Aproveitamento Geral (%)': latestReport ? `${latestReport.aproveitamento_geral.toFixed(1)}%` : '0.0%',
          'Meta Definida (%)': `${rep.meta_aproveitamento}%`,
          'Status da Meta': latestReport 
            ? (latestReport.aproveitamento_geral >= rep.meta_aproveitamento ? 'Meta Atingida' : 'Abaixo da Meta') 
            : 'Sem dados'
        };
      });

      const historyRows = (reports || []).map(r => {
        const rep = reps.find(rep => rep.id === r.representante_id);
        return {
          'Representante': rep ? rep.nome : 'Desconhecido',
          'Semana (Referência)': formatISOWeekDisplay(r.semana_ano),
          'Treinamentos Concluídos': r.treinamentos_concluidos,
          'Total Treinamentos': r.total_treinamentos,
          'Exames Concluídos': r.exames_concluidos,
          'Total Exames': r.total_exames,
          'Aproveitamento Geral (%)': r.aproveitamento_geral,
          'Meta (%)': rep ? rep.meta_aproveitamento : 80,
          'Observações': r.observacoes || ''
        };
      });

      const wb = XLSX.utils.book_new();

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      wsSummary['!cols'] = [
        { wch: 30 },
        { wch: 25 },
        { wch: 25 },
        { wch: 20 },
        { wch: 25 },
        { wch: 20 },
        { wch: 20 }
      ];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo Diretoria');

      if (historyRows.length > 0) {
        const wsHistory = XLSX.utils.json_to_sheet(historyRows);
        wsHistory['!cols'] = [
          { wch: 30 },
          { wch: 25 },
          { wch: 22 },
          { wch: 18 },
          { wch: 18 },
          { wch: 15 },
          { wch: 25 },
          { wch: 12 },
          { wch: 35 }
        ];
        XLSX.utils.book_append_sheet(wb, wsHistory, 'Histórico Consolidado');
      }

      for (const rep of reps) {
        const repReports = (reports || []).filter(r => r.representante_id === rep.id);
        const latestReport = repReports[0] || null;

        const detailRows = (latestReport?.detalhes || []).map((d: any) => ({
          'Treinamento / Exame': d.conteudo,
          'Tipo': (d.conteudo.toLowerCase().endsWith('- exame') || d.conteudo.toLowerCase().includes('- exame ')) ? 'Exame' : 'Conteúdo',
          'Progresso (%)': `${d.progresso}%`,
          'Status': d.status
        }));

        if (detailRows.length > 0) {
          const wsDetail = XLSX.utils.json_to_sheet(detailRows);
          wsDetail['!cols'] = [
            { wch: 50 },
            { wch: 15 },
            { wch: 15 },
            { wch: 18 }
          ];
          const safeSheetName = rep.nome.replace(/[\\\/\?\*\:\[\]]/g, '').substring(0, 30);
          XLSX.utils.book_append_sheet(wb, wsDetail, safeSheetName);
        }
      }

      XLSX.writeFile(wb, 'Auditoria_Consolidada_UBD.xlsx');
      setMessage({ type: 'success', text: 'Relatório consolidado exportado com sucesso!' });
    } catch (err: any) {
      console.error('Erro ao exportar consolidado:', err);
      setMessage({ type: 'error', text: err.message || 'Erro ao gerar o arquivo de exportação.' });
    } finally {
      setIsExporting(false);
    }
  };

  // Exportar cada representante em ZIP separado
  const handleExportIndividualExcelsZip = async () => {
    setIsExporting(true);
    setMessage(null);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      const { data: reps, error: repsError } = await supabase
        .from('representantes')
        .select('id, nome, meta_aproveitamento')
        .order('nome');

      if (repsError) throw repsError;
      if (!reps || reps.length === 0) {
        throw new Error('Nenhum representante cadastrado para exportar.');
      }

      const { data: reports, error: reportsError } = await supabase
        .from('relatorios_semanais')
        .select('*')
        .order('semana_ano', { ascending: false });

      if (reportsError) throw reportsError;

      let filesAdded = 0;

      for (const rep of reps) {
        const repReports = (reports || []).filter(r => r.representante_id === rep.id);
        if (repReports.length === 0) continue;

        const repWb = XLSX.utils.book_new();

        const historyRows = repReports.map(r => ({
          'Semana (Referência)': formatISOWeekDisplay(r.semana_ano),
          'Treinamentos Concluídos': r.treinamentos_concluidos,
          'Total Treinamentos': r.total_treinamentos,
          'Exames Concluídos': r.exames_concluidos,
          'Total Exames': r.total_exames,
          'Aproveitamento Geral (%)': r.aproveitamento_geral,
          'Meta (%)': rep.meta_aproveitamento,
          'Observações': r.observacoes || ''
        }));

        const wsHist = XLSX.utils.json_to_sheet(historyRows);
        wsHist['!cols'] = [
          { wch: 25 },
          { wch: 22 },
          { wch: 18 },
          { wch: 18 },
          { wch: 15 },
          { wch: 25 },
          { wch: 12 },
          { wch: 35 }
        ];
        XLSX.utils.book_append_sheet(repWb, wsHist, 'Histórico');

        const latestReport = repReports[0];
        const detailRows = latestReport.detalhes.map((d: any) => ({
          'Treinamento / Exame': d.conteudo,
          'Tipo': (d.conteudo.toLowerCase().endsWith('- exame') || d.conteudo.toLowerCase().includes('- exame ')) ? 'Exame' : 'Conteúdo',
          'Progresso (%)': `${d.progresso}%`,
          'Status': d.status
        }));

        const wsDetail = XLSX.utils.json_to_sheet(detailRows);
        wsDetail['!cols'] = [
          { wch: 50 },
          { wch: 15 },
          { wch: 15 },
          { wch: 18 }
        ];
        XLSX.utils.book_append_sheet(repWb, wsDetail, 'Últimos Detalhes');

        const excelBuffer = XLSX.write(repWb, { bookType: 'xlsx', type: 'array' });
        const safeName = rep.nome.replace(/\s+/g, '_').replace(/[\\\/\?\*\:\[\]]/g, '');
        zip.file(`Relatorio_${safeName}.xlsx`, excelBuffer);
        filesAdded++;
      }

      if (filesAdded === 0) {
        throw new Error('Nenhum representante possui relatórios semanais cadastrados para exportar.');
      }

      const zipContent = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipContent);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Relatorios_Individuais_Representantes.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: `Arquivo ZIP gerado com sucesso contendo ${filesAdded} relatórios!` });
    } catch (err: any) {
      console.error('Erro ao exportar ZIP:', err);
      setMessage({ type: 'error', text: err.message || 'Erro ao gerar arquivos separados em ZIP.' });
    } finally {
      setIsExporting(false);
    }
  };

  // Salvar Relatório Semanal Manual
  const handleSaveManualReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadRepId) {
      setMessage({ type: 'error', text: 'Selecione ou crie um representante para vincular o lançamento.' });
      return;
    }

    setIsSavingManual(true);
    setMessage(null);

    try {
      const response = await fetch('/api/relatorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          representanteId: uploadRepId,
          semana_ano: computedDateString,
          total_treinamentos: Number(totalTreinamentos) || 0,
          treinamentos_concluidos: Number(treinamentosConcluidos) || 0,
          total_exames: Number(totalExames) || 0,
          exames_concluidos: Number(examesConcluidos) || 0,
          observacoes: manualObservations,
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Falha ao salvar relatório manual.');
      }

      setMessage({ type: 'success', text: `Dados de aproveitamento salvos com sucesso!` });

      // Resetar form
      setTotalTreinamentos('');
      setTreinamentosConcluidos('');
      setTotalExames('');
      setExamesConcluidos('');
      setManualObservations('');

      await loadInitialData();
      await loadRepresentativeReports(uploadRepId);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro inesperado.' });
    } finally {
      setIsSavingManual(false);
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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
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
      let statusClass = 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-slate-900/60';

      if (!stateA && stateB) {
        status = 'Novo Curso';
        statusClass = 'text-blue-650 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30';
      } else if (stateA && !stateB) {
        status = 'Removido';
        statusClass = 'text-red-650 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30';
      } else if (stateA && stateB) {
        if (stateA.status === 'Em Andamento' && stateB.status === 'Concluído') {
          status = 'Evoluiu (Concluído)';
          statusClass = 'text-emerald-650 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30';
        } else if (stateA.status === 'Concluído' && stateB.status === 'Em Andamento') {
          status = 'Regrediu';
          statusClass = 'text-orange-650 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/30';
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans relative overflow-hidden transition-colors duration-200">
      {/* Glows de Fundo Ambiente */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500/[0.03] dark:bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/[0.03] dark:bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      
      {/* 1. CABEÇALHO */}
      <header className="border-b border-slate-200 dark:border-slate-900 bg-white/70 dark:bg-slate-900/20 backdrop-blur-xl sticky top-0 z-40 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 dark:from-blue-400 dark:via-teal-400 dark:to-emerald-400">
              UBD Training Tracker
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Dossiês e Auditoria Semanal de Representantes Comerciais
            </p>
          </div>

          <div className="flex items-center gap-4">
            {sessionUser && (
              <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/60 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors">
                <User size={12} className="text-emerald-500 dark:text-emerald-400" />
                {sessionUser.email}
              </span>
            )}
            <button
              onClick={toggleTheme}
              className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 rounded-lg transition"
              title="Alternar Tema"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/15 dark:hover:bg-blue-950/30 border border-blue-200 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-xs font-bold rounded-lg flex items-center gap-2 transition"
              title="Alterar Senha de Acesso"
            >
              <Key size={14} />
              Alterar Senha
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs font-bold rounded-lg flex items-center gap-2 transition"
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
          <div className="p-5 bg-white dark:bg-slate-900/50 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Calendar size={16} className="text-blue-500 dark:text-blue-400" />
                Adicionar Dados
              </h2>
              <div className="flex bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setUploadMode('file')}
                  disabled={isUploading || isSavingManual}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded transition ${
                    uploadMode === 'file'
                      ? 'bg-blue-600 text-white dark:bg-blue-600/20 dark:text-blue-400 dark:border dark:border-blue-500/20 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300'
                  }`}
                >
                  Planilha
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('manual')}
                  disabled={isUploading || isSavingManual}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded transition ${
                    uploadMode === 'manual'
                      ? 'bg-emerald-600 text-white dark:bg-emerald-600/20 dark:text-emerald-400 dark:border dark:border-emerald-500/20 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300'
                  }`}
                >
                  Manual
                </button>
              </div>
            </div>

            {/* Seletor de Representante */}
            {uploadMode === 'manual' && (
              <div className="space-y-1.5 animate-fadeIn">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Vincular ao Representante
                </label>
                <select
                  value={uploadRepId || ''}
                  onChange={(e) => setUploadRepId(e.target.value)}
                  disabled={isUploading || isSavingManual}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition disabled:opacity-50"
                >
                  <option value="">Selecione um representante...</option>
                  {representatives.map(r => (
                    <option key={r.id} value={r.id}>{r.nome}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Seletores de Mês e Semana de Referência */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Referência do Lançamento
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <span className="text-[9px] font-semibold text-slate-500 block">Ano</span>
                  <input
                    type="number"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    disabled={isUploading || isSavingManual}
                    min="2000"
                    max="2100"
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/30 text-center"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-semibold text-slate-500 block">Mês</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    disabled={isUploading || isSavingManual}
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    {[
                      { value: 0, label: 'Janeiro' },
                      { value: 1, label: 'Fevereiro' },
                      { value: 2, label: 'Março' },
                      { value: 3, label: 'Abril' },
                      { value: 4, label: 'Maio' },
                      { value: 5, label: 'Junho' },
                      { value: 6, label: 'Julho' },
                      { value: 7, label: 'Agosto' },
                      { value: 8, label: 'Setembro' },
                      { value: 9, label: 'Outubro' },
                      { value: 10, label: 'Novembro' },
                      { value: 11, label: 'Dezembro' }
                    ].map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-semibold text-slate-500 block">Semana</span>
                  <select
                     value={selectedWeekOfMonth}
                     onChange={(e) => setSelectedWeekOfMonth(Number(e.target.value))}
                     disabled={isUploading || isSavingManual}
                     className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5].map(w => (
                      <option key={w} value={w}>Semana {w}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {uploadMode === 'file' ? (
              /* Dropzone para planilha */
              <>
                <input
                  id="file-input"
                  type="file"
                  multiple
                  accept=".xlsx,.csv"
                  className="hidden"
                  onClick={(e) => {
                    (e.target as HTMLInputElement).value = '';
                  }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileUpload(e.target.files);
                    }
                  }}
                  disabled={isUploading}
                />
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('file-input')?.click()}
                  className={`p-6 border border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    dragActive 
                      ? 'border-blue-500 bg-blue-500/10 dark:bg-blue-950/15' 
                      : 'border-slate-200 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-slate-100/50 dark:hover:bg-slate-950/60'
                  }`}
                >
                  {isUploading ? (
                    <div className="space-y-2 py-2">
                      <RefreshCw className="animate-spin text-emerald-500 dark:text-emerald-400 mx-auto" size={24} />
                      {uploadProgress ? (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Processando {uploadProgress.current} de {uploadProgress.total}
                          </p>
                          <p className="text-[10px] text-slate-500 max-w-[180px] truncate mx-auto">
                            {uploadProgress.fileName}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Auditando Planilha...</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="text-slate-400 dark:text-slate-500 mx-auto" size={24} />
                      <div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Arraste ou clique para carregar</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-500">Planilha Excel (.xlsx) ou CSV</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Formulário manual */
              <form onSubmit={handleSaveManualReport} className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase">Treinamentos Concluídos</label>
                    <input
                      type="number"
                      min="0"
                      value={treinamentosConcluidos}
                      onChange={(e) => setTreinamentosConcluidos(e.target.value)}
                      placeholder="0"
                      disabled={isSavingManual}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase">Total Treinamentos</label>
                    <input
                      type="number"
                      min="0"
                      value={totalTreinamentos}
                      onChange={(e) => setTotalTreinamentos(e.target.value)}
                      placeholder="0"
                      disabled={isSavingManual}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase">Exames Concluídos</label>
                    <input
                      type="number"
                      min="0"
                      value={examesConcluidos}
                      onChange={(e) => setExamesConcluidos(e.target.value)}
                      placeholder="0"
                      disabled={isSavingManual}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase">Total de Exames</label>
                    <input
                      type="number"
                      min="0"
                      value={totalExames}
                      onChange={(e) => setTotalExames(e.target.value)}
                      placeholder="0"
                      disabled={isSavingManual}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-slate-500 uppercase">Observações da Semana</label>
                  <textarea
                    rows={2}
                    value={manualObservations}
                    onChange={(e) => setManualObservations(e.target.value)}
                    placeholder="Opcional: notas sobre o desempenho na semana..."
                    disabled={isSavingManual}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingManual || !uploadRepId}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20"
                >
                  {isSavingManual && <RefreshCw size={12} className="animate-spin" />}
                  Salvar Lançamento Manual
                </button>
              </form>
            )}

            {message && (
              <div className={`p-3 rounded-lg border flex items-start gap-2 text-xs ${
                message.type === 'success' 
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400' 
                  : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400'
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
          <div className="p-5 bg-white dark:bg-slate-900/50 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-850 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Users size={16} className="text-emerald-500 dark:text-emerald-400" />
                Representantes
              </h2>
              <span className="text-[10px] font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
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
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-gradient-to-r dark:from-blue-950/20 dark:to-emerald-950/20 text-blue-700 dark:text-slate-100 shadow-sm ring-1 ring-blue-500/20 dark:ring-emerald-500/30' 
                          : 'border-slate-200 dark:border-slate-855 hover:border-slate-300 dark:hover:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-slate-100/70 dark:hover:bg-slate-950/60 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-900 text-slate-500'}`}>
                          <User size={14} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold truncate">{rep.nome}</span>
                          {userRole === 'admin' && (rep.supervisorEmail || rep.supervisor_email) && (
                            <span className="text-[9px] text-slate-500 truncate">{rep.supervisorEmail || rep.supervisor_email}</span>
                          )}
                        </div>
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
                <div className="text-center py-6 text-xs text-slate-500">
                  Nenhum representante cadastrado. Envie uma planilha de treinamentos para cadastrar automaticamente.
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
              <div className="p-6 bg-white dark:bg-slate-900/50 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-blue-950/10 rounded-full blur-3xl" />
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">{activeRep.nome}</h2>
                    <span className="px-2 py-0.5 border border-blue-200 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-full">
                      Perfil Ativo
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-md">
                    Analise a evolução, compare resultados entre semanas e adicione observações qualitativas ao dossiê.
                  </p>
                </div>

                <div className="flex items-center gap-8 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-850 p-4 rounded-xl">
                  <div className="text-center">
                    <div className="text-2xl font-black text-emerald-500 dark:text-emerald-400">{averageAproveitamento}%</div>
                    <div className="text-[9px] uppercase font-bold text-slate-550 tracking-wider">Aproveitamento Médio</div>
                  </div>
                  <div className="h-8 w-px bg-slate-850" />
                  <div className="text-center">
                    <div className="text-2xl font-black text-blue-500 dark:text-blue-400">{activeRep.meta_aproveitamento}%</div>
                    <div className="text-[9px] uppercase font-bold text-slate-550 tracking-wider">Meta Definida</div>
                  </div>
                </div>
              </div>

              {/* NAVEGAÇÃO POR ABAS DO PERFIL */}
              <div className="border-b border-slate-200 dark:border-slate-850 flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('evolution')}
                  className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border-b-2 transition -mb-px ${
                    activeTab === 'evolution'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <TrendingUp size={14} />
                  Evolução Semanal
                </button>
                <button
                  onClick={() => setActiveTab('comparison')}
                  className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border-b-2 transition -mb-px ${
                    activeTab === 'comparison'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <BarChart3 size={14} />
                  Comparador de Semanas
                </button>
                <button
                  onClick={() => setActiveTab('dossier')}
                  className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border-b-2 transition -mb-px ${
                    activeTab === 'dossier'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <ClipboardList size={14} />
                  Dossiê & Notas
                </button>
                <button
                  onClick={() => setActiveTab('export')}
                  className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border-b-2 transition -mb-px ${
                    activeTab === 'export'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Download size={14} className="text-emerald-500 dark:text-emerald-400" />
                  Exportação Geral
                </button>
                {userRole === 'admin' && (
                  <button
                    onClick={() => setActiveTab('admin')}
                    className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border-b-2 transition -mb-px ${
                      activeTab === 'admin'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Shield size={14} className="text-blue-500 dark:text-blue-400" />
                    Painel Admin (Supervisores)
                  </button>
                )}
              </div>

              {/* TAB 1: EVOLUÇÃO SEMANAL */}
              {activeTab === 'evolution' && (
                <div className="space-y-6">
                  
                  {/* GRÁFICO */}
                  <div className="p-5 bg-white dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-4 shadow-xl">
                    <h3 className="text-xs font-bold text-slate-650 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-blue-550 dark:text-blue-400" />
                      Histórico Semanal de Aproveitamento
                    </h3>
                    <div className="h-60 w-full">
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                           <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                             <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} />
                             <XAxis dataKey="semana" stroke="#64748b" fontSize={9} />
                             <YAxis stroke="#64748b" fontSize={9} domain={[0, 100]} unit="%" />
                             <Tooltip 
                               contentStyle={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', borderColor: theme === 'dark' ? '#334155' : '#e2e8f0', borderRadius: '8px' }}
                               labelStyle={{ color: theme === 'dark' ? '#94a3b8' : '#475569', fontWeight: 'bold' }}
                             />
                             <Line 
                               type="monotone" 
                               dataKey="Aproveitamento" 
                               name="Aproveitamento"
                               stroke="#3b82f6" 
                               strokeWidth={3}
                               activeDot={{ r: 6 }} 
                             />
                             <ReferenceLine y={activeRep.meta_aproveitamento} label={{ value: `Meta (${activeRep.meta_aproveitamento}%)`, fill: '#10b981', fontSize: 10, position: 'top' }} stroke="#10b981" strokeDasharray="3 3" />
                           </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-slate-500 text-xs text-center px-4 leading-relaxed">
                          Nenhum relatório semanal importado. Vincule e envie uma planilha para gerar o gráfico histórico.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* LISTAGEM DE HISTÓRICO E DETALHES DA SEMANA */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    
                    {/* TABELA DE REGISTROS (7 COLS) */}
                    <div className="md:col-span-7 p-5 bg-white dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-4 shadow-xl">
                      <h3 className="text-xs font-bold text-slate-650 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <FileSpreadsheet size={14} className="text-blue-550 dark:text-blue-400" />
                        Histórico de Semanas
                      </h3>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-100/50 dark:bg-slate-950/20">
                              <th className="py-2.5 px-3">Semana</th>
                              <th className="py-2.5 px-3 text-center">Progresso</th>
                              <th className="py-2.5 px-3 text-center">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-900 text-xs">
                            {weeklyReports.length > 0 ? (
                              weeklyReports.map((report) => {
                                const isSelected = selectedWeeklyReport?.id === report.id;
                                return (
                                  <tr 
                                    key={report.id} 
                                    onClick={() => setSelectedWeeklyReport(report)}
                                    className={`cursor-pointer transition ${
                                      isSelected ? 'bg-blue-50 dark:bg-slate-800/60' : 'hover:bg-slate-100/60 dark:hover:bg-slate-900/30'
                                    }`}
                                  >
                                    <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-200">
                                      {formatISOWeekDisplay(report.semana_ano)}
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        report.aproveitamento_geral >= activeRep.meta_aproveitamento
                                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30'
                                          : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30'
                                      }`}>
                                        {report.aproveitamento_geral.toFixed(1)}%
                                      </span>
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                      <div className="flex items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
                                        <button
                                          onClick={() => setSelectedWeeklyReport(report)}
                                          className="p-1 hover:text-slate-850 dark:hover:text-white text-slate-500 transition rounded"
                                          title="Visualizar Detalhes"
                                        >
                                          <Eye size={12} />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteWeeklyReport(report.id)}
                                          className="p-1 hover:text-red-500 dark:hover:text-red-400 text-slate-500 transition rounded"
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
                                <td colSpan={3} className="py-8 text-center text-slate-500 dark:text-slate-400 text-[11px]">
                                  Este representante ainda não possui relatórios semanais cadastrados.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* DETALHES DA SEMANA SELECIONADA (5 COLS) */}
                    <div className="md:col-span-5 p-5 bg-white dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-4 shadow-xl">
                      {selectedWeeklyReport ? (
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                              Detalhes da {formatISOWeekDisplay(selectedWeeklyReport.semana_ano)}
                            </h3>
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">Visão geral do progresso individual</p>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-center">
                            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-850 p-2 rounded-lg">
                              <div className="text-xs text-blue-600 dark:text-blue-400 font-bold">
                                {selectedWeeklyReport.treinamentos_concluidos} / {selectedWeeklyReport.total_treinamentos}
                              </div>
                              <div className="text-[8px] uppercase text-slate-500 font-bold mt-0.5">Treinamentos</div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-855 p-2 rounded-lg">
                              <div className="text-xs text-teal-650 dark:text-teal-400 font-bold">
                                {selectedWeeklyReport.exames_concluidos} / {selectedWeeklyReport.total_exames}
                              </div>
                              <div className="text-[8px] uppercase text-slate-500 font-bold mt-0.5">Exames</div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Módulos</div>
                            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar text-[11px]">
                              {selectedWeeklyReport.detalhes.map((c, idx) => (
                                <div key={idx} className="p-2 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-900 rounded-lg flex items-center justify-between">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[130px]" title={c.conteudo}>
                                    {c.conteudo}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
                                    c.status === 'Concluído' 
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' 
                                      : 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400'
                                  }`}>
                                    {c.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center py-10 text-slate-500 text-xs space-y-2">
                          <Calendar size={24} className="text-slate-300 dark:text-slate-700 animate-pulse" />
                          <p className="font-bold text-slate-600 dark:text-slate-400">Sem Relatórios</p>
                          <p className="text-[10px] text-slate-500 max-w-[200px] leading-relaxed">
                            Selecione este representante no painel de upload à esquerda e envie uma planilha.
                          </p>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}

              {/* TAB 2: COMPARADOR DE SEMANAS */}
              {activeTab === 'comparison' && (
                <div className="p-5 bg-white dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-6 shadow-xl">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <BarChart3 size={14} className="text-blue-555 dark:text-blue-400" />
                        Comparador Week-over-Week
                      </h3>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">Selecione duas semanas para comparar o avanço dos cursos</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <select
                        value={compareWeekA}
                        onChange={(e) => setCompareWeekA(e.target.value)}
                        className="px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors"
                      >
                        <option value="">Semana Base...</option>
                        {weeklyReports.map(r => (
                          <option key={r.id} value={r.semana_ano}>{formatISOWeekDisplay(r.semana_ano)}</option>
                        ))}
                      </select>
                      <ArrowRight size={14} className="text-slate-400 dark:text-slate-500" />
                      <select
                        value={compareWeekB}
                        onChange={(e) => setCompareWeekB(e.target.value)}
                        className="px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors"
                      >
                        <option value="">Semana Foco...</option>
                        {weeklyReports.map(r => (
                          <option key={r.id} value={r.semana_ano}>{formatISOWeekDisplay(r.semana_ano)}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleDownloadComparison}
                        disabled={comparisonData.length === 0}
                        className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 disabled:from-slate-100 disabled:to-slate-100 dark:disabled:from-slate-900/40 dark:disabled:to-slate-900/40 disabled:border-slate-200 dark:disabled:border-slate-800/80 disabled:text-slate-400 dark:disabled:text-slate-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm dark:shadow-md cursor-pointer disabled:cursor-not-allowed border-none whitespace-nowrap flex-shrink-0"
                        title="Baixar Comparativo em Excel para a Diretoria"
                      >
                        <Download size={13} />
                        Exportar para Diretoria
                      </button>
                    </div>
                  </div>

                  {/* RESULTADO COMPARATIVO */}
                  {comparisonData.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-100/50 dark:bg-slate-950/20">
                            <th className="py-2.5 px-3">Nome do Treinamento / Exame</th>
                            <th className="py-2.5 px-3 text-center">Semana Base</th>
                            <th className="py-2.5 px-3 text-center">Semana Foco</th>
                            <th className="py-2.5 px-3 text-center">Status de Avanço</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-900">
                          {comparisonData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/35 transition">
                              <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-200">{row.nome}</td>
                              <td className="py-3 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  row.statusA === 'Concluído' ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/10' : 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/10'
                                }`}>
                                  {row.statusA}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  row.statusB === 'Concluído' ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/10' : 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/10'
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
                    <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500 text-xs space-y-2">
                      <BarChart3 size={32} className="text-slate-400 dark:text-slate-700" />
                      <p className="font-bold text-slate-600 dark:text-slate-400">Comparação Indisponível</p>
                      <p className="text-[10px] text-slate-500 max-w-[250px] leading-relaxed">
                        {weeklyReports.length === 0 
                          ? 'É necessário que o representante possua pelo menos dois relatórios semanais carregados para habilitar a comparação.' 
                          : 'Por favor, selecione duas semanas diferentes no menu acima para auditar o progresso comparativo.'}
                      </p>
                    </div>
                  )}

                </div>
              )}

              {/* TAB 3: DOSSIÊ & NOTAS */}
              {activeTab === 'dossier' && (
                <div className="p-5 bg-white dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-6 shadow-xl">
                  
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <ClipboardList size={14} className="text-blue-555 dark:text-blue-400" />
                      Dossiê Qualitativo de Desempenho
                    </h3>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">Registre comentários qualitativos, feedbacks e defina metas de aproveitamento.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    
                    {/* META (4 COLS) */}
                    <div className="md:col-span-4 space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Target size={12} className="text-emerald-500 dark:text-emerald-400" />
                        Meta de Aproveitamento
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={repTarget}
                          onChange={(e) => setRepTarget(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 text-emerald-600 dark:text-emerald-400"
                        />
                        <span className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-400 dark:text-slate-500">%</span>
                      </div>
                    </div>

                    {/* OBSERVAÇÕES (8 COLS) */}
                    <div className="md:col-span-8 space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <FileText size={12} className="text-blue-555 dark:text-blue-400" />
                        Notas e Observações de Supervisão
                      </label>
                      <textarea
                        value={repNotes}
                        onChange={(e) => setRepNotes(e.target.value)}
                        placeholder="Ex: Representante iniciou novos módulos técnicos. Necessita de acompanhamento presencial em exames de conformidade..."
                        rows={6}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-xl text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-400 dark:placeholder-slate-600 resize-none text-slate-800 dark:text-slate-300"
                      />
                    </div>

                  </div>

                  <div className="flex justify-end border-t border-slate-200 dark:border-slate-850 pt-4">
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

              {/* TAB 4: PAINEL ADMIN */}
              {activeTab === 'admin' && userRole === 'admin' && (
                <div className="p-5 bg-white dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-6 shadow-xl animate-in fade-in duration-300">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Shield size={14} className="text-teal-500 dark:text-teal-400" />
                        Gerenciamento de Supervisores
                      </h3>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">Exclua ou gerencie o acesso dos supervisores cadastrados no sistema.</p>
                    </div>
                    <button
                      onClick={loadSupervisors}
                      disabled={isLoadingSupervisors}
                      className="px-3 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={isLoadingSupervisors ? 'animate-spin' : ''} />
                      Atualizar Lista
                    </button>
                  </div>

                  {isLoadingSupervisors ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
                      <Loader2 className="animate-spin text-teal-500 dark:text-teal-400" size={24} />
                      Carregando supervisores...
                    </div>
                  ) : supervisors.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-100/50 dark:bg-slate-950/20">
                            <th className="py-2.5 px-3">E-mail do Supervisor</th>
                            <th className="py-2.5 px-3 text-center">Data de Cadastro</th>
                            <th className="py-2.5 px-3 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-900">
                          {supervisors.map((sup) => (
                            <tr key={sup.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/35 transition">
                              <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-200">{sup.email}</td>
                              <td className="py-3 px-3 text-center text-slate-555 dark:text-slate-400">
                                {new Date(sup.created_at).toLocaleDateString('pt-BR')}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <button
                                  onClick={() => handleDeleteSupervisor(sup.id, sup.email)}
                                  className="px-2.5 py-1 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-[10px] font-bold transition flex items-center gap-1 mx-auto"
                                >
                                  <Trash2 size={10} />
                                  Excluir Conta
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      Nenhum supervisor cadastrado além de você.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: EXPORTAÇÃO GERAL */}
              {activeTab === 'export' && (
                <div className="p-5 bg-white dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-6 shadow-xl animate-fadeIn">
                  
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                    <h3 className="text-xs font-bold text-slate-850 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Download size={14} className="text-emerald-500 dark:text-emerald-400" />
                      Central de Exportação de Resultados
                    </h3>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">
                      Gere e faça o download de relatórios detalhados de todos os representantes comerciais cadastrados.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* CARD 1: EXPORTAR CONSOLIDADO */}
                    <div className="p-5 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-xl space-y-4 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="p-2 w-fit rounded-lg bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
                          <FileSpreadsheet size={20} />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                          Relatório Único Consolidado
                        </h4>
                        <p className="text-[11px] text-slate-655 dark:text-slate-400 leading-relaxed">
                          Gera uma única planilha Excel (`.xlsx`) com abas separadas. Contém o **Resumo da Diretoria**, o **Histórico Consolidado** de todas as semanas e o **detalhamento das atividades** de cada representante. Ideal para análises gerais rápidas ou impressão consolidada.
                        </p>
                      </div>

                      <button
                        onClick={handleExportConsolidatedExcel}
                        disabled={isExporting}
                        className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold rounded-lg text-xs shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50 border-none"
                      >
                        {isExporting ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Processando...
                          </>
                        ) : (
                          <>
                            <Download size={14} />
                            Exportar Tudo em um Arquivo
                          </>
                        )}
                      </button>
                    </div>

                    {/* CARD 2: EXPORTAR SEPARADOS ZIP */}
                    <div className="p-5 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-855 rounded-xl space-y-4 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="p-2 w-fit rounded-lg bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                          <Users size={20} />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                          Arquivos Individuais (.zip)
                        </h4>
                        <p className="text-[11px] text-slate-655 dark:text-slate-400 leading-relaxed">
                          Gera planilhas Excel independentes para cada representante (contendo seu histórico e detalhes do último período) e as exporta compactadas em uma pasta compactada `.zip`. Ideal para envio individualizado de dossiês para cada supervisor ou comercial.
                        </p>
                      </div>

                      <button
                        onClick={handleExportIndividualExcelsZip}
                        disabled={isExporting}
                        className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-bold rounded-lg text-xs shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50 border-none"
                      >
                        {isExporting ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Processando...
                          </>
                        ) : (
                          <>
                            <Download size={14} />
                            Exportar em ZIP Separado
                          </>
                        )}
                      </button>
                    </div>

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
                  placeholder="Defina uma nova senha segura"
                  required
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500 placeholder-slate-750"
                />
              </div>

              {/* Checklist de Segurança da Senha no Modal */}
              {newPassword.length > 0 && (
                <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl space-y-1 text-[9px] max-w-sm animate-in fade-in duration-200">
                  <p className="font-bold text-slate-400 uppercase tracking-wider">Requisitos da Senha:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1">
                    <div className="flex items-center gap-1">
                      <span className={`w-1 h-1 rounded-full ${validatePassword(newPassword).length ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className={validatePassword(newPassword).length ? 'text-emerald-400' : 'text-slate-500'}>8 a 32 caracteres</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`w-1 h-1 rounded-full ${validatePassword(newPassword).uppercase ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className={validatePassword(newPassword).uppercase ? 'text-emerald-400' : 'text-slate-500'}>Letra maiúscula</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`w-1 h-1 rounded-full ${validatePassword(newPassword).lowercase ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className={validatePassword(newPassword).lowercase ? 'text-emerald-400' : 'text-slate-500'}>Letra minúscula</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`w-1 h-1 rounded-full ${validatePassword(newPassword).number ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className={validatePassword(newPassword).number ? 'text-emerald-400' : 'text-slate-500'}>Um número</span>
                    </div>
                    <div className="flex items-center gap-1 sm:col-span-2">
                      <span className={`w-1 h-1 rounded-full ${validatePassword(newPassword).special ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className={validatePassword(newPassword).special ? 'text-emerald-400' : 'text-slate-500'}>Caractere especial</span>
                    </div>
                  </div>
                </div>
              )}

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
                  disabled={isUpdatingPassword || !Object.values(validatePassword(newPassword)).every(Boolean)}
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
