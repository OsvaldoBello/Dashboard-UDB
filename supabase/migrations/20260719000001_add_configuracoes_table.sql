-- ====================================================================
-- Corrige débito D6: a tabela `configuracoes` já é usada pelo código
-- (app/api/upload/route.ts, app/api/relatorios/route.ts, app/dashboard/page.tsx)
-- mas nunca foi versionada. Esta migração é idempotente: pode ser aplicada
-- com segurança mesmo que a tabela já exista em produção (criada manualmente).
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.configuracoes (
    id INT PRIMARY KEY,
    total_aulas INT NOT NULL DEFAULT 136,
    total_exames INT NOT NULL DEFAULT 112,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Linha singleton (id = 1) usada pelo app; não falha se já existir.
INSERT INTO public.configuracoes (id, total_aulas, total_exames)
VALUES (1, 136, 112)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Mesma postura permissiva das demais tabelas hoje (ver nota na migração
-- baseline sobre D2 — hardening fica para a Fase 2). Uso de DO blocks para
-- não falhar caso as políticas já existam de uma configuração manual anterior.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'configuracoes'
      AND policyname = 'Permitir leitura de configuracoes para autenticados'
  ) THEN
    CREATE POLICY "Permitir leitura de configuracoes para autenticados"
    ON public.configuracoes FOR SELECT TO authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'configuracoes'
      AND policyname = 'Permitir upsert de configuracoes para autenticados'
  ) THEN
    CREATE POLICY "Permitir upsert de configuracoes para autenticados"
    ON public.configuracoes FOR INSERT TO authenticated
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'configuracoes'
      AND policyname = 'Permitir atualização de configuracoes para autenticados'
  ) THEN
    CREATE POLICY "Permitir atualização de configuracoes para autenticados"
    ON public.configuracoes FOR UPDATE TO authenticated
    USING (true) WITH CHECK (true);
  END IF;
END $$;
