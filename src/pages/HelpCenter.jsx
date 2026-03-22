import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Receipt, PieChart, Target, PiggyBank, HelpCircle, ChevronDown, Landmark } from 'lucide-react';

const helpSections = [
  {
    id: 'intro',
    title: 'Visão Geral do Freedom',
    icon: BookOpen,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-100',
    content: (
      <div className="space-y-4 text-slate-700 dark:text-slate-300">
        <p>Bem-vindo ao <strong>Freedom Gestão Financeira</strong>. Este sistema foi cuidadosamente criado para ajudar famílias a alcançarem não apenas organização, mas a verdadeira liberdade financeira.</p>
        <p>A filosofia do Freedom baseia-se em quatro pilares principais:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Registro disciplinado:</strong> Todas as entradas e saídas devem ser anotadas fielmente.</li>
          <li><strong>Orçamento pré-definido:</strong> O dinheiro recebe um destino antes mesmo de ser gasto.</li>
          <li><strong>Criação de reservas:</strong> O futuro é protegido por metas de poupança (Caixinhas).</li>
          <li><strong>Evolução de Patrimônio:</strong> A riqueza é medida pela diferença real entre os seus ativos e os passivos.</li>
        </ul>
      </div>
    )
  },
  {
    id: 'transacoes',
    title: 'Transações e Fluxo de Caixa',
    icon: Receipt,
    color: 'text-blue-500',
    bgColor: 'bg-blue-100',
    content: (
      <div className="space-y-4 text-slate-700 dark:text-slate-300">
        <p>As <strong>Transações</strong> são o coração da rotina financeira.</p>
        <h4 className="font-bold text-slate-900 dark:text-slate-100">Como usar corretamente:</h4>
        <ul className="list-decimal pl-5 space-y-2">
          <li>Sempre que você receber seu salário ou qualquer outra renda extra, adicione como uma <strong>Receita</strong>.</li>
          <li>Sempre que realizar um pagamento (cartão, pix, boleto), registre imediatamente como <strong>Despesa</strong>.</li>
          <li>Você pode marcar despesas e receitas como recorrentes caso elas aconteçam todo mês no mesmo valor (ex: Spotify, Conta de Luz Fixa), poupando tempo nos meses seguintes.</li>
        </ul>
      </div>
    )
  },
  {
    id: 'orcamento',
    title: 'Orçamento (Budgeting inteligente)',
    icon: PieChart,
    color: 'text-rose-500',
    bgColor: 'bg-rose-100',
    content: (
      <div className="space-y-4 text-slate-700 dark:text-slate-300">
        <p>O <strong>Orçamento</strong> não é feito para te prender ou proibir, mas para libertar com clareza.</p>
        <h4 className="font-bold text-slate-900 dark:text-slate-100">Como funciona:</h4>
        <p>Todo mês, entre na aba Orçamento e estabeleça limites seguros para categorias rotineiras, baseadas na estimativa da sua receita principal.</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Se você estipulou R$ 1000 para Lazer, acompanhe pelo gráfico circular para não exceder esse teto.</li>
          <li>O painel irá exibir as barras na cor verde ou vermelha conforme os gastos chegarem perigosamente perto dos limites planejados.</li>
        </ul>
      </div>
    )
  },
  {
    id: 'caixinhas',
    title: 'Caixinhas (Reserva e Retabilidade Segura)',
    icon: PiggyBank,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-100',
    content: (
      <div className="space-y-4 text-slate-700 dark:text-slate-300">
        <p>As <strong>Caixinhas de Investimento</strong> refletem onde seu dinheiro de liquidez imediata está acondicionado.</p>
        <p>Aqui você deve simular aplicações de curto prazo (Ex: CDB de liquidez diária, LCIs curtas, Tesouro Direto Selic). Elas aplicam automaticamente uma meta de rentabilidade projetando juros compostos a cada fechamento de mês.</p>
        <p><strong>Ação imediata recomendada:</strong> Tenha sempre uma Caixinha nomeada "Reserva de Emergência", idealmente cobrindo e protegendo 6 meses dos gastos essenciais da família ou dos negócios.</p>
      </div>
    )
  },
  {
    id: 'metas',
    title: 'Metas e Sonhos de Médio a Longo Prazo',
    icon: Target,
    color: 'text-amber-500',
    bgColor: 'bg-amber-100',
    content: (
      <div className="space-y-4 text-slate-700 dark:text-slate-300">
        <p>Na aba de <strong>Metas</strong>, você visualizará a distância percentual exata que falta para conquistar algo extraordinário, como uma Viagem Internacional, a festa de Casamento ou a aquisição de um Imóvel novo.</p>
        <p>Em vez de misturar metas de vida com contas do mês atual, isole esse capital nesta ferramenta. Isso gera motivação psicológica massiva para que o casal continue a economizar!</p>
      </div>
    )
  },
  {
    id: 'patrimonio',
    title: 'Patrimônio: A Riqueza Verdadeira',
    icon: Landmark,
    color: 'text-teal-500',
    bgColor: 'bg-teal-100',
    content: (
      <div className="space-y-4 text-slate-700 dark:text-slate-300">
        <p>O módulo <strong>Patrimônio</strong> revoluciona o que a maioria dos apps fazem. Ele serve como o seu Balanço Patrimonial definitivo e é o principal medidor do seu sucesso ao longo dos anos.</p>
        <h4 className="font-bold text-slate-900 dark:text-slate-100">Avaliação (Ativos - Passivos = Patrimônio Líquido):</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Seus Ativos (Bens Inerentes):</strong> Seus Lotes, Terras, Casas e Carros. Quantifique tudo aqui. Esses valores, que muitos esquecem, geram um imenso reajuste na autoestima do construtor de riquezas.</li>
          <li><strong>Seus Passivos (Dívidas):</strong> O módulo puxa diretamente os saldos da tela "Dívidas" (Financiamentos de Banco, Financiamento Veicular, Rotativo), pesando contra seus ativos.</li>
        </ul>
        <p>A chave matemática é implacável: reduza os passivos e aumente sistematicamente seus investimentos (ativos em dinheiro) para inflar a sua principal métrica financeira.</p>
      </div>
    )
  }
];

export default function HelpCenter() {
  const [openSection, setOpenSection] = useState('intro');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <div className="bg-emerald-700 dark:bg-emerald-950 px-4 sm:px-6 lg:px-8 py-16 lg:pt-20 lg:pb-32 relative overflow-hidden">
        {/* Abstract Background pattern */}
        <div className="absolute top-[-20%] left-[-10%] w-96 h-96 rounded-full bg-emerald-500/20 blur-3xl opacity-50" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[32rem] h-[32rem] rounded-full bg-teal-500/10 blur-3xl opacity-50" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="w-20 h-20 bg-white/10 dark:bg-emerald-900/40 border border-white/20 rounded-3xl flex items-center justify-center mx-auto mb-6 backdrop-blur-md shadow-xl">
              <HelpCircle className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">Central Exclusiva de Ajuda</h1>
            <p className="text-emerald-50 dark:text-emerald-200 mt-6 text-lg sm:text-xl max-w-2xl mx-auto font-light leading-relaxed">
              O seu manual definitivo passo-a-passo. Desvende como mapear, proteger e multiplicar o dinheiro da sua família usando o método Freedom.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 sm:-mt-20 relative z-20">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl shadow-slate-200/50 dark:shadow-none p-2 sm:p-6 space-y-3 sm:space-y-4 border border-slate-100 dark:border-slate-800">
           {helpSections.map((section, idx) => {
             const isOpen = openSection === section.id;
             const Icon = section.icon;
             
             return (
               <motion.div 
                 key={section.id} 
                 initial={{ opacity: 0, y: 20 }} 
                 animate={{ opacity: 1, y: 0 }} 
                 transition={{ delay: idx * 0.1 }}
                 className={`border rounded-xl overflow-hidden transition-all duration-300 ${isOpen ? 'border-emerald-300 shadow-md dark:border-emerald-700' : 'border-slate-100 dark:border-slate-800'}`}
               >
                 <button 
                   onClick={() => setOpenSection(isOpen ? '' : section.id)}
                   className={`w-full flex items-center justify-between p-4 sm:p-6 text-left transition-colors ${isOpen ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                 >
                   <div className="flex items-center gap-4">
                     <div className={`p-3 rounded-xl ${section.bgColor} dark:bg-opacity-20 hidden sm:flex items-center justify-center`}>
                       <Icon className={`w-6 h-6 ${section.color}`} />
                     </div>
                     <div>
                       <h3 className={`font-bold text-lg sm:text-xl ${isOpen ? 'text-emerald-900 dark:text-emerald-100' : 'text-slate-800 dark:text-slate-200'}`}>{section.title}</h3>
                       {!isOpen && <p className="text-sm text-slate-500 line-clamp-1 mt-1 font-medium sm:hidden">Clique para expandir as instruções</p>}
                     </div>
                   </div>
                   <div className={`p-2 rounded-full transition-transform duration-300 ${isOpen ? 'bg-emerald-200 text-emerald-700 rotate-180 dark:bg-emerald-800 dark:text-emerald-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'}`}>
                      <ChevronDown className="w-5 h-5" />
                   </div>
                 </button>
                 
                 {isOpen && (
                   <motion.div 
                     initial={{ opacity: 0, height: 0 }}
                     animate={{ opacity: 1, height: 'auto' }}
                     className="p-5 sm:p-8 bg-white dark:bg-slate-900 border-t border-emerald-100 dark:border-emerald-800/30 text-base leading-relaxed"
                   >
                     {section.content}
                   </motion.div>
                 )}
               </motion.div>
             )
           })}
        </div>
        
        <div className="mt-12 text-center bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-slate-900 p-8 sm:p-12 rounded-3xl border border-indigo-100 dark:border-indigo-800 shadow-lg">
           <div className="w-16 h-16 bg-white dark:bg-indigo-900 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
             <BookOpen className="w-8 h-8 text-indigo-500 dark:text-indigo-300" />
           </div>
           <h3 className="text-xl font-bold text-indigo-900 dark:text-indigo-200 mb-2">Ainda com dúvidas no método?</h3>
           <p className="text-indigo-700 dark:text-indigo-400 max-w-lg mx-auto leading-relaxed">Nossa equipe de suporte técnico e de consultores financeiros está pronta para auxiliá-lo pessoalmente na tomada de decisões complexas ou uso avançado da plataforma.</p>
        </div>
      </div>
    </div>
  )
}
