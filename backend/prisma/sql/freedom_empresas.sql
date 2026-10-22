-- Gerado a partir de backend/prisma/schema.prisma (equivalente ao prisma db push)

CREATE TABLE IF NOT EXISTS "biz_company" (
    "id" TEXT NOT NULL,
    "razao_social" TEXT NOT NULL,
    "nome_fantasia" TEXT,
    "cnpj" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "site" TEXT,
    "endereco" JSONB,
    "logo_url" TEXT,
    "cor_primaria" TEXT NOT NULL DEFAULT '#0F172A',
    "cor_secundaria" TEXT NOT NULL DEFAULT '#10B981',
    "regime_tributario" TEXT NOT NULL DEFAULT 'SIMPLES',
    "aliquota_imposto" DECIMAL(6,3) NOT NULL DEFAULT 6,
    "aliquota_comissao" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "meta_margem_contrato" DECIMAL(6,3) NOT NULL DEFAULT 40,
    "rateio_overhead" TEXT NOT NULL DEFAULT 'RECEITA',
    "asaas_api_key" TEXT,
    "asaas_ambiente" TEXT NOT NULL DEFAULT 'SANDBOX',
    "asaas_webhook_token" TEXT,
    "asaas_conta_financeira_id" TEXT,
    "proposta_validade_dias" INTEGER NOT NULL DEFAULT 15,
    "proposta_termos" TEXT,
    "proposta_rodape" TEXT,
    "plano" TEXT NOT NULL DEFAULT 'TRIAL',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "biz_company_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "biz_company_member" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "papel" TEXT NOT NULL DEFAULT 'ADMIN',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "biz_company_member_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "biz_client" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "tipo_pessoa" TEXT NOT NULL DEFAULT 'PJ',
    "nome" TEXT NOT NULL,
    "nome_fantasia" TEXT,
    "documento" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "contato_nome" TEXT,
    "endereco" JSONB,
    "segmento" TEXT,
    "origem" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "observacoes" TEXT,
    "asaas_customer_id" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "biz_client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "biz_supplier" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "tipo_pessoa" TEXT NOT NULL DEFAULT 'PJ',
    "nome" TEXT NOT NULL,
    "documento" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "categoria" TEXT,
    "chave_pix" TEXT,
    "dados_bancarios" JSONB,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "biz_supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "biz_chart_account" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "natureza" TEXT NOT NULL,
    "grupo_dre" TEXT NOT NULL,
    "custo_direto" BOOLEAN NOT NULL DEFAULT false,
    "fixa" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "sistema" BOOLEAN NOT NULL DEFAULT false,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "biz_chart_account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "biz_cost_center" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "codigo" TEXT,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'OPERACIONAL',
    "orcamento_mensal" DECIMAL(14,2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "biz_cost_center_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "biz_bank_account" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'CORRENTE',
    "banco" TEXT,
    "saldo_inicial" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "data_saldo_inicial" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "biz_bank_account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "biz_product" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'SERVICO',
    "codigo" TEXT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" TEXT,
    "unidade" TEXT NOT NULL DEFAULT 'UN',
    "preco_venda" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "custo_unitario" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "horas_estimadas" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cobranca" TEXT NOT NULL DEFAULT 'UNICA',
    "periodicidade" TEXT,
    "controla_estoque" BOOLEAN NOT NULL DEFAULT false,
    "estoque_atual" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "estoque_minimo" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "account_id" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "biz_product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "biz_stock_movement" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "quantidade" DECIMAL(14,4) NOT NULL,
    "custo_unitario" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "saldo_apos" DECIMAL(14,4) NOT NULL,
    "custo_medio_apos" DECIMAL(14,4) NOT NULL,
    "contract_id" TEXT,
    "transaction_id" TEXT,
    "documento" TEXT,
    "observacao" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "biz_stock_movement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "biz_proposal" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "client_id" TEXT,
    "prospect_nome" TEXT,
    "prospect_email" TEXT,
    "prospect_empresa" TEXT,
    "titulo" TEXT NOT NULL,
    "introducao" TEXT,
    "escopo" TEXT,
    "condicoes" TEXT,
    "capa_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "validade" TIMESTAMP(3),
    "desconto_percent" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "total_unico" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_recorrente" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "custo_estimado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "prazo_contrato_meses" INTEGER,
    "public_token" TEXT NOT NULL,
    "visualizacoes" INTEGER NOT NULL DEFAULT 0,
    "ultima_visualizacao" TIMESTAMP(3),
    "enviada_em" TIMESTAMP(3),
    "respondida_em" TIMESTAMP(3),
    "aceite_nome" TEXT,
    "aceite_documento" TEXT,
    "aceite_ip" TEXT,
    "motivo_recusa" TEXT,
    "contract_id" TEXT,
    "responsavel" TEXT,
    "created_by" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "biz_proposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "biz_proposal_item" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "product_id" TEXT,
    "descricao" TEXT NOT NULL,
    "detalhes" TEXT,
    "quantidade" DECIMAL(14,4) NOT NULL DEFAULT 1,
    "preco_unitario" DECIMAL(14,2) NOT NULL,
    "desconto_percent" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "custo_unitario" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "cobranca" TEXT NOT NULL DEFAULT 'UNICA',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "biz_proposal_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "biz_contract" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "client_id" TEXT NOT NULL,
    "proposal_id" TEXT,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3),
    "periodicidade" TEXT NOT NULL DEFAULT 'MENSAL',
    "dia_vencimento" INTEGER NOT NULL DEFAULT 10,
    "valor_recorrente" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valor_pontual" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "parcelas_pontual" INTEGER NOT NULL DEFAULT 1,
    "custo_previsto_mensal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "horas_previstas_mensal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "aliquota_imposto" DECIMAL(6,3),
    "comissao_percent" DECIMAL(6,3),
    "forma_pagamento" TEXT NOT NULL DEFAULT 'BOLETO',
    "cobrar_via_asaas" BOOLEAN NOT NULL DEFAULT true,
    "asaas_subscription_id" TEXT,
    "indice_reajuste" TEXT,
    "data_reajuste" TIMESTAMP(3),
    "cost_center_id" TEXT,
    "responsavel" TEXT,
    "motivo_cancelamento" TEXT,
    "cancelado_em" TIMESTAMP(3),
    "observacoes" TEXT,
    "created_by" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "biz_contract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "biz_contract_item" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "product_id" TEXT,
    "descricao" TEXT NOT NULL,
    "quantidade" DECIMAL(14,4) NOT NULL DEFAULT 1,
    "preco_unitario" DECIMAL(14,2) NOT NULL,
    "custo_unitario" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "cobranca" TEXT NOT NULL DEFAULT 'RECORRENTE',
    CONSTRAINT "biz_contract_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "biz_transaction" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "valor_pago" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "juros_multa" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "desconto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxa" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "competencia" TIMESTAMP(3) NOT NULL,
    "data_pagamento" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "forma_pagamento" TEXT,
    "documento" TEXT,
    "parcela" INTEGER,
    "total_parcelas" INTEGER,
    "grupo_parcelas" TEXT,
    "recorrente" BOOLEAN NOT NULL DEFAULT false,
    "client_id" TEXT,
    "supplier_id" TEXT,
    "contract_id" TEXT,
    "account_id" TEXT,
    "cost_center_id" TEXT,
    "bank_account_id" TEXT,
    "asaas_payment_id" TEXT,
    "asaas_status" TEXT,
    "asaas_invoice_url" TEXT,
    "asaas_boleto_url" TEXT,
    "asaas_pix_payload" TEXT,
    "observacoes" TEXT,
    "anexo_url" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "created_by" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "biz_transaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "biz_team_member" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "cargo" TEXT,
    "vinculo" TEXT NOT NULL DEFAULT 'CLT',
    "custo_mensal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "horas_mes" DECIMAL(10,2) NOT NULL DEFAULT 160,
    "custo_hora_override" DECIMAL(14,4),
    "produtivo" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "biz_team_member_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "biz_time_entry" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "team_member_id" TEXT NOT NULL,
    "contract_id" TEXT,
    "data" TIMESTAMP(3) NOT NULL,
    "horas" DECIMAL(10,2) NOT NULL,
    "custo_hora" DECIMAL(14,4) NOT NULL,
    "descricao" TEXT,
    "created_by" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "biz_time_entry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "biz_api_key" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "prefixo" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "escopo" TEXT NOT NULL DEFAULT 'ESCRITA',
    "user_id" TEXT NOT NULL,
    "ultimo_uso" TIMESTAMP(3),
    "revogada" BOOLEAN NOT NULL DEFAULT false,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "biz_api_key_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "biz_audit_log" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'APP',
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" TEXT,
    "resumo" TEXT,
    "dados" JSONB,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "biz_audit_log_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "biz_webhook_event" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "provedor" TEXT NOT NULL DEFAULT 'ASAAS',
    "evento_id" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEBIDO',
    "erro" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "biz_webhook_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "biz_company_member_user_id_idx" ON "biz_company_member"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "biz_company_member_company_id_user_id_key" ON "biz_company_member"("company_id", "user_id");
CREATE INDEX IF NOT EXISTS "biz_client_company_id_status_idx" ON "biz_client"("company_id", "status");
CREATE INDEX IF NOT EXISTS "biz_supplier_company_id_idx" ON "biz_supplier"("company_id");
CREATE UNIQUE INDEX IF NOT EXISTS "biz_chart_account_company_id_codigo_key" ON "biz_chart_account"("company_id", "codigo");
CREATE INDEX IF NOT EXISTS "biz_product_company_id_tipo_idx" ON "biz_product"("company_id", "tipo");
CREATE INDEX IF NOT EXISTS "biz_stock_movement_company_id_product_id_idx" ON "biz_stock_movement"("company_id", "product_id");
CREATE UNIQUE INDEX IF NOT EXISTS "biz_proposal_public_token_key" ON "biz_proposal"("public_token");
CREATE UNIQUE INDEX IF NOT EXISTS "biz_proposal_company_id_numero_key" ON "biz_proposal"("company_id", "numero");
CREATE INDEX IF NOT EXISTS "biz_contract_company_id_status_idx" ON "biz_contract"("company_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "biz_contract_company_id_numero_key" ON "biz_contract"("company_id", "numero");
CREATE UNIQUE INDEX IF NOT EXISTS "biz_transaction_asaas_payment_id_key" ON "biz_transaction"("asaas_payment_id");
CREATE INDEX IF NOT EXISTS "biz_transaction_company_id_tipo_status_idx" ON "biz_transaction"("company_id", "tipo", "status");
CREATE INDEX IF NOT EXISTS "biz_transaction_company_id_vencimento_idx" ON "biz_transaction"("company_id", "vencimento");
CREATE INDEX IF NOT EXISTS "biz_transaction_company_id_competencia_idx" ON "biz_transaction"("company_id", "competencia");
CREATE INDEX IF NOT EXISTS "biz_transaction_contract_id_idx" ON "biz_transaction"("contract_id");
CREATE INDEX IF NOT EXISTS "biz_time_entry_company_id_data_idx" ON "biz_time_entry"("company_id", "data");
CREATE INDEX IF NOT EXISTS "biz_time_entry_contract_id_idx" ON "biz_time_entry"("contract_id");
CREATE UNIQUE INDEX IF NOT EXISTS "biz_api_key_hash_key" ON "biz_api_key"("hash");
CREATE INDEX IF NOT EXISTS "biz_audit_log_company_id_created_date_idx" ON "biz_audit_log"("company_id", "created_date");
CREATE UNIQUE INDEX IF NOT EXISTS "biz_webhook_event_provedor_evento_id_key" ON "biz_webhook_event"("provedor", "evento_id");

DO $$ BEGIN
  ALTER TABLE "biz_company_member" ADD CONSTRAINT "biz_company_member_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "biz_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_client" ADD CONSTRAINT "biz_client_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "biz_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_supplier" ADD CONSTRAINT "biz_supplier_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "biz_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_chart_account" ADD CONSTRAINT "biz_chart_account_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "biz_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_cost_center" ADD CONSTRAINT "biz_cost_center_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "biz_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_bank_account" ADD CONSTRAINT "biz_bank_account_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "biz_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_product" ADD CONSTRAINT "biz_product_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "biz_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_product" ADD CONSTRAINT "biz_product_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "biz_chart_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_stock_movement" ADD CONSTRAINT "biz_stock_movement_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "biz_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_stock_movement" ADD CONSTRAINT "biz_stock_movement_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "biz_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_stock_movement" ADD CONSTRAINT "biz_stock_movement_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "biz_contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_proposal" ADD CONSTRAINT "biz_proposal_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "biz_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_proposal" ADD CONSTRAINT "biz_proposal_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "biz_client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_proposal_item" ADD CONSTRAINT "biz_proposal_item_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "biz_proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_proposal_item" ADD CONSTRAINT "biz_proposal_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "biz_product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_contract" ADD CONSTRAINT "biz_contract_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "biz_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_contract" ADD CONSTRAINT "biz_contract_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "biz_client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_contract" ADD CONSTRAINT "biz_contract_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "biz_cost_center"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_contract_item" ADD CONSTRAINT "biz_contract_item_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "biz_contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_contract_item" ADD CONSTRAINT "biz_contract_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "biz_product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_transaction" ADD CONSTRAINT "biz_transaction_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "biz_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_transaction" ADD CONSTRAINT "biz_transaction_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "biz_client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_transaction" ADD CONSTRAINT "biz_transaction_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "biz_supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_transaction" ADD CONSTRAINT "biz_transaction_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "biz_contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_transaction" ADD CONSTRAINT "biz_transaction_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "biz_chart_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_transaction" ADD CONSTRAINT "biz_transaction_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "biz_cost_center"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_transaction" ADD CONSTRAINT "biz_transaction_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "biz_bank_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_team_member" ADD CONSTRAINT "biz_team_member_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "biz_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_time_entry" ADD CONSTRAINT "biz_time_entry_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "biz_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_time_entry" ADD CONSTRAINT "biz_time_entry_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "biz_team_member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_time_entry" ADD CONSTRAINT "biz_time_entry_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "biz_contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_api_key" ADD CONSTRAINT "biz_api_key_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "biz_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_audit_log" ADD CONSTRAINT "biz_audit_log_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "biz_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "biz_webhook_event" ADD CONSTRAINT "biz_webhook_event_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "biz_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- NFS-e (Asaas) migration
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE "biz_company" ADD COLUMN IF NOT EXISTS "municipal_service_code" TEXT;
ALTER TABLE "biz_company" ADD COLUMN IF NOT EXISTS "municipal_service_name" TEXT;
ALTER TABLE "biz_company" ADD COLUMN IF NOT EXISTS "nfse_descricao_padrao" TEXT;
ALTER TABLE "biz_company" ADD COLUMN IF NOT EXISTS "nfse_emitir_ao_receber" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "biz_company" ADD COLUMN IF NOT EXISTS "nfse_reter_iss" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "biz_company" ADD COLUMN IF NOT EXISTS "nfse_aliquota_iss" DECIMAL(6,3);

ALTER TABLE "biz_transaction" ADD COLUMN IF NOT EXISTS "asaas_invoice_id" TEXT;
ALTER TABLE "biz_transaction" ADD COLUMN IF NOT EXISTS "nfse_numero" TEXT;
ALTER TABLE "biz_transaction" ADD COLUMN IF NOT EXISTS "nfse_status" TEXT;
ALTER TABLE "biz_transaction" ADD COLUMN IF NOT EXISTS "nfse_pdf_url" TEXT;
ALTER TABLE "biz_transaction" ADD COLUMN IF NOT EXISTS "nfse_xml_url" TEXT;
ALTER TABLE "biz_transaction" ADD COLUMN IF NOT EXISTS "nfse_rps_numero" TEXT;
ALTER TABLE "biz_transaction" ADD COLUMN IF NOT EXISTS "nfse_erro" TEXT;
