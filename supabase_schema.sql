-- ====================================================================
-- SCRIPT DE MIGRAÇÃO SQL PARA O SUPABASE (SEMANAL & PERFIS)
-- ====================================================================
-- Cole este script no Editor de Consultas (SQL Editor) do seu painel Supabase.

-- Habilitar a extensão para geração de UUID se não estiver ativa
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Limpeza das tabelas antigas para evitar conflitos se necessário
DROP TABLE IF EXISTS public.relatorios_mensais CASCADE;
DROP TABLE IF EXISTS public.relatorios_semanais CASCADE;

-- 1. TABELA DE REPRESENTANTES
CREATE TABLE public.representantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    observacoes TEXT DEFAULT '', -- Dossiê / Observações qualitativas do representante
    meta_aproveitamento NUMERIC(5, 2) DEFAULT 80.00, -- Meta de progresso padrão (ex: 80%)
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Restrição: Evita nomes duplicados para o mesmo usuário/supervisor
    CONSTRAINT unique_representante_por_usuario UNIQUE (nome, usuario_id)
);

-- Indexação para buscas rápidas por nome e dono
CREATE INDEX idx_representantes_nome ON public.representantes(nome);
CREATE INDEX idx_representantes_usuario ON public.representantes(usuario_id);

-- 2. TABELA DE RELATÓRIOS SEMANAIS
CREATE TABLE public.relatorios_semanais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    representante_id UUID NOT NULL REFERENCES public.representantes(id) ON DELETE CASCADE,
    semana_ano DATE NOT NULL, -- Segunda-feira de início da semana (ISO Week)
    total_treinamentos INT NOT NULL DEFAULT 0,
    treinamentos_concluidos INT NOT NULL DEFAULT 0,
    total_exames INT NOT NULL DEFAULT 0,
    exames_concluidos INT NOT NULL DEFAULT 0,
    aproveitamento_geral NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    detalhes JSONB NOT NULL DEFAULT '[]'::jsonb, -- Armazena a lista detalhada de cursos/exames
    observacoes TEXT DEFAULT '', -- Observações semanais sobre o desempenho
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Restrição: Apenas um relatório por representante por semana
    CONSTRAINT unique_relatorio_representante_semana UNIQUE (representante_id, semana_ano)
);

-- Indexação para buscas rápidas e filtros
CREATE INDEX idx_relatorios_representante ON public.relatorios_semanais(representante_id);
CREATE INDEX idx_relatorios_semana ON public.relatorios_semanais(semana_ano);
CREATE INDEX idx_relatorios_usuario ON public.relatorios_semanais(usuario_id);

-- ====================================================================
-- CONFIGURAÇÃO DE SEGURANÇA (ROW LEVEL SECURITY - RLS)
-- ====================================================================

-- Habilitar RLS em ambas as tabelas
ALTER TABLE public.representantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorios_semanais ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS PARA A TABELA REPRESENTANTES

CREATE POLICY "Permitir leitura dos próprios representantes" 
ON public.representantes 
FOR SELECT 
TO authenticated 
USING (auth.uid() = usuario_id);

CREATE POLICY "Permitir inserção dos próprios representantes" 
ON public.representantes 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Permitir atualização dos próprios representantes" 
ON public.representantes 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = usuario_id) 
WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Permitir exclusão dos próprios representantes" 
ON public.representantes 
FOR DELETE 
TO authenticated 
USING (auth.uid() = usuario_id);

-- POLÍTICAS PARA A TABELA RELATÓRIOS SEMANAIS

CREATE POLICY "Permitir leitura dos próprios relatórios" 
ON public.relatorios_semanais 
FOR SELECT 
TO authenticated 
USING (auth.uid() = usuario_id);

CREATE POLICY "Permitir inserção dos próprios relatórios" 
ON public.relatorios_semanais 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Permitir atualização dos próprios relatórios" 
ON public.relatorios_semanais 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = usuario_id) 
WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Permitir exclusão dos próprios relatórios" 
ON public.relatorios_semanais 
FOR DELETE 
TO authenticated 
USING (auth.uid() = usuario_id);
