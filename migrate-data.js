import mysql from 'mysql2/promise';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ijqogxsxsqcnabtfrkhy.supabase.co';
// Using the service_role key to bypass RLS
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqcW9neHN4c3FjbmFidGZya2h5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk5ODEzNSwiZXhwIjoyMDg5NTc0MTM1fQ.IxEENb_1MDzMoWWANxvDifc_exDbR4eEjiSkv6Bo0Mo';
const MYSQL_URI = 'mysql://root@localhost:3306/freedom_db';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  let connection;
  try {
    connection = await mysql.createConnection(MYSQL_URI);
    console.log("🔌 Conectado ao MySQL local: freedom_db");
  } catch(e) {
    console.error("❌ Erro ao conectar no MySQL local. O banco está rodando?", e.message);
    process.exit(1);
  }
  
  // Ordem importa por conta de dependências (Foreign Keys) definidos no SQL
  const tables = [
    'User', 
    'Family', 
    'Category', 
    'Subcategory', 
    'FinancialMonth', 
    'Income', 
    'Expense', 
    'Budget', 
    'Goal', 
    'Debt', 
    'DebtPayment', 
    'RecurringExpense', 
    'InvestmentBox', 
    'InvestmentDeposit', 
    'StockInvestment', 
    'StockAlert', 
    'UserAccess', 
    'Plan', 
    'LandingCms'
  ];

  for (const table of tables) {
    console.log(`\n📦 Lendo tabela MySQL: ${table}...`);
    try {
      const [rows] = await connection.execute(`SELECT * FROM \`${table}\``);
      if (rows.length === 0) {
        console.log(`ℹ️  Tabela ${table} está vazia no MySQL. Pulando...`);
        continue;
      }
      
      console.log(`🚀 Enviando ${rows.length} registros de ${table} para Supabase...`);
      // Use upsert so we don't duplicate if script is run twice
      const { data, error } = await supabase.from(table).upsert(rows);
      
      if (error) {
         console.error(`❌ Erro inserindo em ${table}:`, error);
      } else {
         console.log(`✅ Sucesso! Tabela ${table} migrada.`);
      }
    } catch(err) {
       console.error(`❌ Erro ao processar tabela ${table}:`, err.message);
    }
  }

  await connection.end();
  console.log("\n🎉 Migração de dados concluída!");
}

run();
