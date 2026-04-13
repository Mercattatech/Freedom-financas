import React, { useState } from 'react';
import { useFinancialMonth } from '@/components/hooks/useFinancialMonth';
import { apiClient } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Plus, Wallet, TrendingUp, TrendingDown, PiggyBank, AlertCircle, Download } from "lucide-react";
import { motion } from "framer-motion";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';

import FamilySetup from '@/components/setup/FamilySetup';
import MonthSelector from '@/components/dashboard/MonthSelector';
import FamilySelector from '@/components/dashboard/FamilySelector';
import PrintableReport from '@/components/dashboard/PrintableReport';
import StatCard from '@/components/dashboard/StatCard';
import BudgetProgress from '@/components/dashboard/BudgetProgress';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import ExpenseChart from '@/components/dashboard/ExpenseChart';
import DRE from '@/components/dashboard/DRE';
import IncomeModal from '@/components/modals/IncomeModal';
import ExpenseModal from '@/components/modals/ExpenseModal';


export default function Dashboard() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  
  const competencia = format(currentDate, 'yyyy-MM');

  // Fetch current user and families
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => apiClient.auth.me()
  });

  const { data: families = [], isLoading: loadingFamily } = useQuery({
    queryKey: ['families', user?.email],
    queryFn: () => apiClient.entities.Family.filter({ created_by: user.email }),
    enabled: !!user
  });

  const selectedFamilyId = localStorage.getItem('selectedFamilyId');
  const family = selectedFamilyId 
    ? families.find(f => f.id === selectedFamilyId) 
    : families[0];

  // Fetch or create month (sem duplicatas)
  const { month } = useFinancialMonth(family?.id, competencia);

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', family?.id],
    queryFn: () => apiClient.entities.Category.filter({ family_id: family.id }),
    enabled: !!family
  });

  // Fetch subcategories
  const { data: subcategories = [] } = useQuery({
    queryKey: ['subcategories'],
    queryFn: () => apiClient.entities.Subcategory.list(),
    enabled: !!family
  });

  // Fetch incomes
  const { data: incomes = [] } = useQuery({
    queryKey: ['incomes', month?.id],
    queryFn: () => apiClient.entities.Income.filter({ month_id: month.id }),
    enabled: !!month
  });

  // Fetch expenses
  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', month?.id],
    queryFn: () => apiClient.entities.Expense.filter({ month_id: month.id }),
    enabled: !!month
  });

  // Fetch budgets
  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets', month?.id],
    queryFn: () => apiClient.entities.Budget.filter({ month_id: month.id }),
    enabled: !!month
  });

  // Fetch debts
  const { data: debts = [] } = useQuery({
    queryKey: ['debts', family?.id],
    queryFn: () => apiClient.entities.Debt.filter({ family_id: family.id, status: 'ATIVA' }),
    enabled: !!family
  });

  // Fetch investment boxes
  const { data: investmentBoxes = [] } = useQuery({
    queryKey: ['investmentBoxes', family?.id],
    queryFn: () => apiClient.entities.InvestmentBox.filter({ family_id: family.id, ativo: true }),
    enabled: !!family
  });

  // Fetch stock investments
  const { data: stockInvestments = [] } = useQuery({
    queryKey: ['stocks', family?.id],
    queryFn: () => apiClient.entities.StockInvestment.filter({ family_id: family.id, ativo: true }),
    enabled: !!family
  });

  // Fetch alerts
  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts', month?.id],
    queryFn: () => apiClient.entities.Alert.filter({ month_id: month.id, resolvido: false }),
    enabled: !!month
  });

  // Fetch credit cards
  const { data: creditCards = [] } = useQuery({
    queryKey: ['creditcards', family?.id],
    queryFn: () => apiClient.entities.CreditCard.filter({ family_id: family.id, ativo: true }),
    enabled: !!family
  });

  // Create family mutation
  const createFamilyMutation = useMutation({
    mutationFn: async (familyData) => {
      const newFamily = await apiClient.entities.Family.create(familyData);
      return newFamily;
    },
    onSuccess: (newFamily) => {
      if (newFamily && newFamily.id) {
        localStorage.setItem('selectedFamilyId', newFamily.id);
      }
      queryClient.invalidateQueries(['families']);
      queryClient.invalidateQueries(['categories']);
      queryClient.invalidateQueries(['subcategories']);
    }
  });

  // Income mutations
  const saveIncomeMutation = useMutation({
    mutationFn: ({ data, id }) => id ? apiClient.entities.Income.update(id, data) : apiClient.entities.Income.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['incomes']);
      toast.success('Receita salva com sucesso!');
    },
    onError: (e) => toast.error('Erro ao salvar receita: ' + e.message)
  });

  // Expense mutations
  const saveExpenseMutation = useMutation({
    mutationFn: ({ data, id }) => id ? apiClient.entities.Expense.update(id, data) : apiClient.entities.Expense.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['expenses']);
      toast.success('Despesa salva com sucesso!');
    },
    onError: (e) => toast.error('Erro ao salvar despesa: ' + e.message)
  });

  const handleSaveIncome = (data, id) => {
    saveIncomeMutation.mutate({ data, id });
  };

  const handleSaveExpense = (data, id) => {
    saveExpenseMutation.mutate({ data, id });
  };

  // Calculations
  // Despesas de cartão ficam só no extrato do cartão; faturas (is_fatura_cartao=true) aparecem normalmente
  const visibleExpenses = expenses.filter(e => !e.credit_card_id || e.is_fatura_cartao);
  const totalIncome = incomes.reduce((sum, i) => sum + (i.valor || 0), 0);
  const totalExpenses = visibleExpenses.reduce((sum, e) => sum + (e.valor || 0), 0);
  const balance = totalIncome - totalExpenses;
  const totalDebt = debts.reduce((sum, d) => sum + (d.saldo_atual || 0), 0);


  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const generatePDF = async () => {
    const element = document.getElementById('printable-report');
    if (!element) return;
    
    const toastId = toast.loading('Gerando relatório PDF...');
    
    try {
      element.style.top = '0px';
      element.style.left = '0px';
      element.style.zIndex = '-9999';

      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let position = 0;
      let heightLeft = pdfHeight;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Relatorio_Freedom_${competencia}.pdf`);
      toast.success('Relatório baixado com sucesso!', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar relatório', { id: toastId });
    } finally {
      element.style.top = '-9999px';
      element.style.left = '-9999px';
    }
  };

  if (loadingFamily) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!family) {
    return <FamilySetup onComplete={createFamilyMutation.mutate} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Olá, {family.nome_familia} 👋
            </h1>
            <p className="text-slate-500 mt-1">Aqui está seu resumo financeiro</p>
          </div>
          <div className="flex items-center gap-3">
            <FamilySelector />
            <MonthSelector currentDate={currentDate} onDateChange={setCurrentDate} />
          </div>
        </motion.div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl"
          >
            <div className="flex items-center gap-2 text-amber-800">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">{alerts.length} alerta(s) de orçamento</span>
            </div>
          </motion.div>
        )}

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          <StatCard
            title="Renda Total"
            value={formatCurrency(totalIncome)}
            icon={Wallet}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50"
          />
          <StatCard
            title="Despesas"
            value={formatCurrency(totalExpenses)}
            icon={TrendingDown}
            iconColor="text-red-600"
            iconBg="bg-red-50"
          />
          <StatCard
            title="Saldo"
            value={formatCurrency(balance)}
            icon={balance >= 0 ? TrendingUp : TrendingDown}
            iconColor={balance >= 0 ? "text-emerald-600" : "text-red-600"}
            iconBg={balance >= 0 ? "bg-emerald-50" : "bg-red-50"}
          />
          <StatCard
            title="Dívidas Ativas"
            value={formatCurrency(totalDebt)}
            icon={PiggyBank}
            iconColor="text-violet-600"
            iconBg="bg-violet-50"
          />
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap gap-3 mb-8"
        >
          <Button
            onClick={() => setIncomeModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" /> Nova Renda
          </Button>
          <Button
            onClick={() => setExpenseModalOpen(true)}
            variant="outline"
            className="border-slate-300"
          >
            <Plus className="w-4 h-4 mr-2" /> Nova Despesa
          </Button>
          
          <Button
            onClick={generatePDF}
            variant="outline"
            className="ml-auto border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-white"
          >
            <Download className="w-4 h-4 mr-2" /> Baixar PDF
          </Button>
        </motion.div>

        {/* Main Content Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          <div className="lg:col-span-2 space-y-6">
            <BudgetProgress
              categories={categories}
              expenses={visibleExpenses}
              budgets={budgets}
              totalIncome={totalIncome}
            />
            <RecentTransactions
              expenses={visibleExpenses}
              incomes={incomes}
              categories={categories}
            />
          </div>
          <div>
            <ExpenseChart
              categories={categories}
              expenses={visibleExpenses}
            />
          </div>
        </motion.div>

        {/* DRE */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6"
        >
          <DRE
            incomes={incomes}
            expenses={visibleExpenses}
            debts={debts}
            categories={categories}
            investmentBoxes={investmentBoxes}
            stockInvestments={stockInvestments}
          />
        </motion.div>
      </div>

      <PrintableReport
        family={family}
        month={{ month_year: competencia }}
        incomes={incomes}
        expenses={visibleExpenses}
        debts={debts}
        balance={balance}
      />

      {/* Modals */}
      <IncomeModal
        open={incomeModalOpen}
        onOpenChange={setIncomeModalOpen}
        onSave={handleSaveIncome}
        monthId={month?.id}
      />

      <ExpenseModal
        open={expenseModalOpen}
        onOpenChange={setExpenseModalOpen}
        onSave={handleSaveExpense}
        monthId={month?.id}
        categories={categories}
        subcategories={subcategories}
        creditCards={creditCards}
      />
    </div>
  );
}