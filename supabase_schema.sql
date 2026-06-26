-- ====================================================================
-- SCRIPT DE MIGRAÇÃO SQL PARA O SUPABASE (SEMANAL, PERFIS & CONTROLE DE ACESSO)
-- ====================================================================
-- Cole este script no Editor de Consultas (SQL Editor) do seu painel Supabase.

-- Habilitar a extensão para geração de UUID se não estiver ativa
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Limpeza de recursos antigos (opcional, remova se quiser preservar dados existentes)
-- DROP TABLE IF EXISTS public.relatorios_semanais CASCADE;
-- DROP TABLE IF EXISTS public.representantes CASCADE;
-- DROP TABLE IF EXISTS public.perfis CASCADE;
-- DROP TYPE IF EXISTS public.user_role CASCADE;

-- 1. ENUM E TABELA DE PERFIS DE USUÁRIOS (ROLES)
CREATE TYPE public.user_role AS ENUM ('admin', 'supervisor');

CREATE TABLE public.perfis (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role public.user_role NOT NULL DEFAULT 'supervisor',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TABELA DE REPRESENTANTES
CREATE TABLE public.representantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    observacoes TEXT DEFAULT '', -- Dossiê / Observações qualitativas do representante
    meta_aproveitamento NUMERIC(5, 2) DEFAULT 80.00, -- Meta de progresso padrão (ex: 80%)
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Restrição: Evita nomes duplicados globalmente no site
    CONSTRAINT unique_representante_nome UNIQUE (nome)
);

-- Indexação para buscas rápidas por nome e dono
CREATE INDEX IF NOT EXISTS idx_representantes_nome ON public.representantes(nome);
CREATE INDEX IF NOT EXISTS idx_representantes_usuario ON public.representantes(usuario_id);

-- 3. TABELA DE RELATÓRIOS SEMANAIS
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
CREATE INDEX IF NOT EXISTS idx_relatorios_representante ON public.relatorios_semanais(representante_id);
CREATE INDEX IF NOT EXISTS idx_relatorios_semana ON public.relatorios_semanais(semana_ano);
CREATE INDEX IF NOT EXISTS idx_relatorios_usuario ON public.relatorios_semanais(usuario_id);

-- ====================================================================
-- CONFIGURAÇÃO DE SEGURANÇA (ROW LEVEL SECURITY - RLS)
-- ====================================================================

-- Habilitar RLS nas tabelas
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.representantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorios_semanais ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS PARA A TABELA PERFIS
CREATE POLICY "Permitir leitura de perfis para o próprio usuário ou administradores" 
ON public.perfis FOR SELECT TO authenticated 
USING (auth.uid() = id OR EXISTS (SELECT 1 FROM public.perfis WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Permitir atualização do próprio perfil ou por administradores" 
ON public.perfis FOR UPDATE TO authenticated 
USING (auth.uid() = id OR EXISTS (SELECT 1 FROM public.perfis WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (auth.uid() = id OR EXISTS (SELECT 1 FROM public.perfis WHERE id = auth.uid() AND role = 'admin'));

-- 5. POLÍTICAS PARA A TABELA REPRESENTANTES
CREATE POLICY "Permitir leitura de todos os representantes para autenticados" 
ON public.representantes FOR SELECT TO authenticated 
USING (true);

CREATE POLICY "Permitir inserção de representantes para autenticados" 
ON public.representantes FOR INSERT TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir atualização de todos os representantes para autenticados" 
ON public.representantes FOR UPDATE TO authenticated 
USING (true) WITH CHECK (true);

CREATE POLICY "Permitir exclusão de todos os representantes para autenticados" 
ON public.representantes FOR DELETE TO authenticated 
USING (true);

-- 6. POLÍTICAS PARA A TABELA RELATÓRIOS SEMANAIS
CREATE POLICY "Permitir leitura de todos os relatórios para autenticados" 
ON public.relatorios_semanais FOR SELECT TO authenticated 
USING (true);

CREATE POLICY "Permitir inserção de relatórios para autenticados" 
ON public.relatorios_semanais FOR INSERT TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir atualização de todos os relatórios para autenticados" 
ON public.relatorios_semanais FOR UPDATE TO authenticated 
USING (true) WITH CHECK (true);

CREATE POLICY "Permitir exclusão de todos os relatórios para autenticados" 
ON public.relatorios_semanais FOR DELETE TO authenticated 
USING (true);

-- ====================================================================
-- AUTOMACÃO DE CADASTRO (TRIGGERS & PROCEDURES)
-- ====================================================================

-- Função que cria o perfil do usuário imediatamente após o registro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfis (id, email, role)
  VALUES (
    new.id,
    new.email,
    CASE 
      WHEN new.email = 'admin@bondmann.com.br' THEN 'admin'::public.user_role
      ELSE 'supervisor'::public.user_role
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger disparada no INSERT do auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- POPULAR USUÁRIOS EXISTENTES (CASO O BANCO JÁ TENHA REGISTROS)
-- ====================================================================
INSERT INTO public.perfis (id, email, role)
SELECT id, email, 
  CASE 
    WHEN email = 'admin@bondmann.com.br' THEN 'admin'::public.user_role
    ELSE 'supervisor'::public.user_role
  END
FROM auth.users
ON CONFLICT (id) DO NOTHING;
