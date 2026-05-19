import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, MessageSquare, Brain, ShieldCheck, HelpCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const CONFIG_KEYS = [
  { 
    key: 'WHATSAPP_ACCESS_TOKEN', 
    label: 'Token de Acesso (WhatsApp)', 
    category: 'whatsapp',
    placeholder: 'EAAB...',
    help: 'Obtido no painel da Meta for Developers. Use um Token de Acesso Permanente.'
  },
  { 
    key: 'WHATSAPP_PHONE_NUMBER_ID', 
    label: 'Phone Number ID', 
    category: 'whatsapp',
    placeholder: '1234567890',
    help: 'ID numérico do número de telefone que enviará as mensagens.'
  },
  { 
    key: 'WHATSAPP_VERIFY_TOKEN', 
    label: 'Token de Verificação do Webhook', 
    category: 'whatsapp',
    placeholder: 'Ex: freedom_token_2026',
    help: 'Token arbitrário que você define aqui e deve ser o mesmo configurado no painel da Meta.'
  },
  { 
    key: 'OPENAI_API_KEY', 
    label: 'OpenAI API Key', 
    category: 'ai',
    placeholder: 'sk-...',
    help: 'Sua chave secreta da OpenAI para processar a inteligência das mensagens.'
  }
];

export default function WhatsAppConfig() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({});

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['system-config'],
    queryFn: async () => {
      // Usando a rota de admin que criamos
      const res = await apiClient.entities.SystemConfig.list();
      return res;
    }
  });

  useEffect(() => {
    if (configs.length > 0) {
      const configMap = {};
      configs.forEach(c => configMap[c.key] = c.value);
      setForm(configMap);
    }
  }, [configs]);

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }) => {
      // Usando o endpoint de upsert no backend admin
      const token = localStorage.getItem('freedom_access_token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      
      const response = await fetch(`${baseUrl}/admin/config`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key, value })
      });
      
      if (!response.ok) throw new Error('Erro ao salvar configuração');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['system-config']);
    }
  });

  const handleSaveAll = async () => {
    try {
      const promises = Object.entries(form).map(([key, value]) => 
        saveMutation.mutateAsync({ key, value })
      );
      await Promise.all(promises);
      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar algumas configurações.');
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-emerald-500" /> Configuração WhatsApp & IA
          </h2>
          <p className="text-slate-400 text-sm mt-1">Configure as chaves da API para habilitar os lançamentos por voz e texto via WhatsApp.</p>
        </div>
        <Button onClick={handleSaveAll} className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar Alterações
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* WhatsApp Settings */}
          <Card className="bg-slate-900 border-slate-800 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-blue-400" /> WhatsApp Cloud API
            </h3>
            
            {CONFIG_KEYS.filter(k => k.category === 'whatsapp').map(item => (
              <div key={item.key} className="space-y-2">
                <Label className="text-slate-300 flex items-center justify-between">
                  {item.label}
                  <HelpCircle className="w-4 h-4 text-slate-500 cursor-help" title={item.help} />
                </Label>
                <Input 
                  type={item.key.includes('TOKEN') ? 'password' : 'text'}
                  value={form[item.key] || ''} 
                  onChange={e => setForm({...form, [item.key]: e.target.value})}
                  placeholder={item.placeholder}
                  className="bg-slate-800 border-slate-700 text-white focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-500">{item.help}</p>
              </div>
            ))}
          </Card>

          {/* AI Settings */}
          <Card className="bg-slate-900 border-slate-800 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-2">
              <Brain className="w-5 h-5 text-purple-400" /> Inteligência Artificial
            </h3>
            
            {CONFIG_KEYS.filter(k => k.category === 'ai').map(item => (
              <div key={item.key} className="space-y-2">
                <Label className="text-slate-300">{item.label}</Label>
                <Input 
                  type="password"
                  value={form[item.key] || ''} 
                  onChange={e => setForm({...form, [item.key]: e.target.value})}
                  placeholder={item.placeholder}
                  className="bg-slate-800 border-slate-700 text-white focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-500">{item.help}</p>
              </div>
            ))}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-blue-500/10 border-blue-500/20 p-5">
            <h4 className="font-bold text-blue-400 flex items-center gap-2 mb-3">
              <HelpCircle className="w-4 h-4" /> Como configurar?
            </h4>
            <div className="space-y-4 text-sm text-blue-200/80">
              <p>1. Crie um App no <span className="font-bold">developers.facebook.com</span> do tipo Business.</p>
              <p>2. Adicione o produto "WhatsApp" ao App.</p>
              <p>3. Configure o Webhook para apontar para:</p>
              <code className="block bg-slate-950 p-2 rounded text-[10px] text-emerald-400 break-all">
                {import.meta.env.VITE_API_URL || 'https://sua-api.com/api'}/webhooks/whatsapp
              </code>
              <p>4. Inscreva-se no webhook para o campo <span className="font-bold text-white">messages</span>.</p>
            </div>
            <a 
              href="https://developers.facebook.com/apps" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-400 hover:underline mt-4 font-semibold"
            >
              Abrir Meta Developers <ExternalLink className="w-3 h-3" />
            </a>
          </Card>

          <Card className="bg-amber-500/10 border-amber-500/20 p-5">
            <h4 className="font-bold text-amber-400 flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4" /> Importante
            </h4>
            <p className="text-xs text-amber-200/70 leading-relaxed">
              O token temporário da Meta expira em 24h. Para produção, gere um 
              <span className="font-bold text-white"> Usuário do Sistema</span> no Gerenciador de Negócios e gere um token permanente.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
