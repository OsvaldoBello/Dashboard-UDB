-- ====================================================================
-- SCRIPT DE MIGRAÇÃO SQL PARA O SUPABASE
-- ====================================================================
-- Cole este script no Editor de Consultas (SQL Editor) do seu painel Supabase.

-- Habilitar a extensão para geração de UUID se não estiver ativa
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE REPRESENTANTES
CREATE TABLE public.representantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Restrição: Evita nomes duplicados para o mesmo usuário/supervisor
    CONSTRAINT unique_representante_por_usuario UNIQUE (nome, usuario_id)
);

-- Indexação para buscas rápidas por nome
CREATE INDEX idx_representantes_nome ON public.representantes(nome);
CREATE INDEX idx_representantes_usuario ON public.representantes(usuario_id);

-- 2. TABELA DE RELATÓRIOS MENSAIS
CREATE TABLE public.relatorios_mensais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    representante_id UUID NOT NULL REFERENCES public.representantes(id) ON DELETE CASCADE,
    mes_ano DATE NOT NULL, -- Primeiro dia do mês de referência (Ex: 2026-06-01)
    total_treinamentos INT NOT NULL DEFAULT 0,
    treinamentos_concluidos INT NOT NULL DEFAULT 0,
    total_exames INT NOT NULL DEFAULT 0,
    exames_concluidos INT NOT NULL DEFAULT 0,
    aproveitamento_geral NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    detalhes JSONB NOT NULL DEFAULT '[]'::jsonb, -- Armazena a lista detalhada de cursos/exames
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Restrição: Apenas um relatório por representante por mês
    CONSTRAINT unique_relatorio_representante_mes UNIQUE (representante_id, mes_ano)
);

CREATE INDEX idx_relatorios_representante ON public.relatorios_mensais(representante_id);
CREATE INDEX idx_relatorios_mes ON public.relatorios_mensais(mes_ano);
CREATE INDEX idx_relatorios_usuario ON public.relatorios_mensais(usuario_id);

-- ====================================================================
-- CONFIGURAÇÃO DE SEGURANÇA (ROW LEVEL SECURITY - RLS)
-- ====================================================================

-- Habilitar RLS em ambas as tabelas
ALTER TABLE public.representantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorios_mensais ENABLE ROW LEVEL SECURITY;

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

-- POLÍTICAS PARA A TABELA RELATÓRIOS MENSAIS

CREATE POLICY "Permitir leitura dos próprios relatórios" 
ON public.relatorios_mensais 
FOR SELECT 
TO authenticated 
USING (auth.uid() = usuario_id);

CREATE POLICY "Permitir inserção dos próprios relatórios" 
ON public.relatorios_mensais 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Permitir atualização dos próprios relatórios" 
ON public.relatorios_mensais 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = usuario_id) 
WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Permitir exclusão dos próprios relatórios" 
ON public.relatorios_mensais 
FOR DELETE 
TO authenticated 
USING (auth.uid() = usuario_id);
