-- ============================================
-- SQL Schema for Supabase (mercattafreedom)
-- ============================================

CREATE TABLE IF NOT EXISTS "User" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT UNIQUE NOT NULL,
  "full_name" TEXT,
  "password" TEXT NOT NULL,
  "is_verified" BOOLEAN DEFAULT false,
  "disabled" BOOLEAN DEFAULT false,
  "role" TEXT DEFAULT 'user',
  "otpCode" TEXT,
  "must_change_password" BOOLEAN DEFAULT false,
  "created_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Family" (
  "id" TEXT PRIMARY KEY,
  "nome_familia" TEXT NOT NULL,
  "tipo_familia" TEXT DEFAULT 'SEM_FILHOS',
  "moeda" TEXT DEFAULT 'BRL',
  "created_by" TEXT NOT NULL,
  "created_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY ("created_by") REFERENCES "User"("email") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Category" (
  "id" TEXT PRIMARY KEY,
  "nome" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "cor" TEXT,
  "icone" TEXT,
  "ativo" BOOLEAN DEFAULT true,
  "family_id" TEXT NOT NULL,
  "created_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY ("family_id") REFERENCES "Family"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Subcategory" (
  "id" TEXT PRIMARY KEY,
  "nome" TEXT NOT NULL,
  "ativo" BOOLEAN DEFAULT true,
  "category_id" TEXT NOT NULL,
  "created_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "FinancialMonth" (
  "id" TEXT PRIMARY KEY,
  "competencia" TEXT NOT NULL,
  "status" TEXT DEFAULT 'ABERTO',
  "renda_total_calculada" DOUBLE PRECISION DEFAULT 0,
  "family_id" TEXT NOT NULL,
  "created_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY ("family_id") REFERENCES "Family"("id") ON DELETE CASCADE,
  UNIQUE("family_id", "competencia")
);

CREATE TABLE IF NOT EXISTS "Income" (
  "id" TEXT PRIMARY KEY,
  "descricao" TEXT,
  "valor" DOUBLE PRECISION NOT NULL,
  "data_recebimento" TEXT NOT NULL,
  "tipo" TEXT,
  "recorrente" BOOLEAN DEFAULT false,
  "ativo" BOOLEAN DEFAULT true,
  "month_id" TEXT NOT NULL,
  "category_id" TEXT,
  "subcategory_id" TEXT,
  "family_id" TEXT,
  "created_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY ("month_id") REFERENCES "FinancialMonth"("id") ON DELETE CASCADE,
  FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE SET NULL,
  FOREIGN KEY ("subcategory_id") REFERENCES "Subcategory"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "Expense" (
  "id" TEXT PRIMARY KEY,
  "descricao" TEXT NOT NULL,
  "valor" DOUBLE PRECISION NOT NULL,
  "data" TEXT NOT NULL,
  "forma_pagamento" TEXT,
  "recorrente" BOOLEAN DEFAULT false,
  "tags" TEXT,
  "notes" TEXT,
  "month_id" TEXT NOT NULL,
  "category_id" TEXT,
  "subcategory_id" TEXT,
  "family_id" TEXT,
  "created_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY ("month_id") REFERENCES "FinancialMonth"("id") ON DELETE CASCADE,
  FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE SET NULL,
  FOREIGN KEY ("subcategory_id") REFERENCES "Subcategory"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "Budget" (
  "id" TEXT PRIMARY KEY,
  "tipo_orcamento" TEXT DEFAULT 'VALOR_FIXO',
  "valor_orcado" DOUBLE PRECISION,
  "percentual_orcado" DOUBLE PRECISION DEFAULT 0,
  "month_id" TEXT NOT NULL,
  "category_id" TEXT NOT NULL,
  "family_id" TEXT,
  "created_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY ("month_id") REFERENCES "FinancialMonth"("id") ON DELETE CASCADE,
  FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE CASCADE,
  UNIQUE("month_id", "category_id")
);

CREATE TABLE IF NOT EXISTS "Goal" (
  "id" TEXT PRIMARY KEY,
  "nome" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "valor_alvo" DOUBLE PRECISION NOT NULL,
  "valor_atual" DOUBLE PRECISION DEFAULT 0,
  "prazo" TEXT,
  "descricao" TEXT,
  "ativo" BOOLEAN DEFAULT true,
  "concluida" BOOLEAN DEFAULT false,
  "family_id" TEXT NOT NULL,
  "created_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY ("family_id") REFERENCES "Family"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Debt" (
  "id" TEXT PRIMARY KEY,
  "nome_divida" TEXT NOT NULL,
  "credor" TEXT,
  "tipo" TEXT DEFAULT 'OUTROS',
  "saldo_inicial" DOUBLE PRECISION DEFAULT 0,
  "saldo_atual" DOUBLE PRECISION DEFAULT 0,
  "juros_mensal_percent" DOUBLE PRECISION,
  "data_inicio" TEXT,
  "vencimento_dia" INTEGER,
  "status" TEXT DEFAULT 'ATIVA',
  "family_id" TEXT NOT NULL,
  "created_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY ("family_id") REFERENCES "Family"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "DebtPayment" (
  "id" TEXT PRIMARY KEY,
  "valor_pagamento" DOUBLE PRECISION NOT NULL,
  "data_pagamento" TEXT NOT NULL,
  "month_id" TEXT,
  "debt_id" TEXT NOT NULL,
  "created_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY ("debt_id") REFERENCES "Debt"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "RecurringExpense" (
  "id" TEXT PRIMARY KEY,
  "descricao" TEXT NOT NULL,
  "valor" DOUBLE PRECISION NOT NULL,
  "category_id" TEXT NOT NULL,
  "subcategory_id" TEXT,
  "forma_pagamento" TEXT,
  "dia_vencimento" INTEGER NOT NULL,
  "ativo" BOOLEAN DEFAULT true,
  "family_id" TEXT NOT NULL,
  "created_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY ("family_id") REFERENCES "Family"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "InvestmentBox" (
  "id" TEXT PRIMARY KEY,
  "nome" TEXT NOT NULL,
  "objetivo" TEXT,
  "valor_inicial" DOUBLE PRECISION DEFAULT 0,
  "saldo_atual" DOUBLE PRECISION DEFAULT 0,
  "tipo_rendimento" TEXT DEFAULT 'PERCENTUAL_MENSAL',
  "taxa_mensal" DOUBLE PRECISION,
  "taxa_anual_cdi" DOUBLE PRECISION,
  "cor" TEXT,
  "ativo" BOOLEAN DEFAULT true,
  "family_id" TEXT NOT NULL,
  "created_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY ("family_id") REFERENCES "Family"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "InvestmentDeposit" (
  "id" TEXT PRIMARY KEY,
  "valor" DOUBLE PRECISION NOT NULL,
  "data" TEXT NOT NULL,
  "descricao" TEXT,
  "tipo" TEXT DEFAULT 'APORTE',
  "box_id" TEXT NOT NULL,
  "created_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY ("box_id") REFERENCES "InvestmentBox"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "StockInvestment" (
  "id" TEXT PRIMARY KEY,
  "ticker" TEXT NOT NULL,
  "nome_empresa" TEXT,
  "tipo" TEXT NOT NULL,
  "quantidade" DOUBLE PRECISION NOT NULL,
  "preco_medio" DOUBLE PRECISION NOT NULL,
  "preco_atual" DOUBLE PRECISION,
  "data_primeira_compra" TEXT,
  "setor" TEXT,
  "ativo" BOOLEAN DEFAULT true,
  "family_id" TEXT NOT NULL,
  "created_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY ("family_id") REFERENCES "Family"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "StockAlert" (
  "id" TEXT PRIMARY KEY,
  "ticker" TEXT NOT NULL,
  "target_price" DOUBLE PRECISION NOT NULL,
  "alert_type" TEXT NOT NULL,
  "is_active" BOOLEAN DEFAULT true,
  "family_id" TEXT NOT NULL,
  "created_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY ("family_id") REFERENCES "Family"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "UserAccess" (
  "id" TEXT PRIMARY KEY,
  "user_email" TEXT UNIQUE NOT NULL,
  "user_name" TEXT,
  "plan_id" TEXT,
  "plan_nome" TEXT,
  "status" TEXT DEFAULT 'ATIVO',
  "data_inicio" TEXT,
  "data_expiracao" TEXT,
  "limite_familias" INTEGER DEFAULT 1,
  "observacoes" TEXT,
  "origem" TEXT DEFAULT 'MANUAL',
  "stripe_subscription_id" TEXT,
  "stripe_customer_id" TEXT,
  "created_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Plan" (
  "id" TEXT PRIMARY KEY,
  "nome" TEXT NOT NULL,
  "descricao" TEXT,
  "tipo" TEXT DEFAULT 'MENSAL',
  "preco" DOUBLE PRECISION NOT NULL,
  "preco_original" DOUBLE PRECISION,
  "features" TEXT,
  "destaque" BOOLEAN DEFAULT false,
  "badge" TEXT,
  "upsell_texto" TEXT,
  "upsell_price_id" TEXT,
  "limite_familias" INTEGER DEFAULT 1,
  "cor" TEXT,
  "ordem" INTEGER DEFAULT 0,
  "ativo" BOOLEAN DEFAULT true,
  "stripe_price_id" TEXT,
  "created_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "LandingCms" (
  "id" TEXT PRIMARY KEY DEFAULT 'singleton',
  "logo_url" TEXT,
  "hero_image_desktop" TEXT,
  "hero_image_mobile" TEXT,
  "problema_image" TEXT,
  "hero_badge" TEXT,
  "hero_titulo" TEXT,
  "hero_subtitulo" TEXT,
  "hero_cta" TEXT,
  "hero_video_url" TEXT,
  "hero_stat1_n" TEXT,
  "hero_stat1_l" TEXT,
  "hero_stat2_n" TEXT,
  "hero_stat2_l" TEXT,
  "hero_stat3_n" TEXT,
  "hero_stat3_l" TEXT,
  "problema_titulo" TEXT,
  "problema_subtitulo" TEXT,
  "features_titulo" TEXT,
  "features_subtitulo" TEXT,
  "depoimentos_titulo" TEXT,
  "depoimentos_subtitulo" TEXT,
  "depoimentos_json" TEXT,
  "planos_titulo" TEXT,
  "planos_subtitulo" TEXT,
  "faq_titulo" TEXT,
  "faqs_json" TEXT,
  "cta_final_titulo" TEXT,
  "cta_final_subtitulo" TEXT,
  "cta_final_btn" TEXT,
  "footer_texto" TEXT,
  "created_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
