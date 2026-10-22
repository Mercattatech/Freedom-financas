import React, { useEffect, useState } from 'react';

/**
 * Painel de configuração da WhatsApp Cloud API (oficial, Meta) — genérico,
 * sem dependência de shadcn/ui, lucide-react ou react-query, para poder ser
 * colado em qualquer sistema React que já tenha Tailwind configurado.
 *
 * Espera um back-end com dois endpoints simples de configuração chave/valor:
 *   GET  {apiBase}{configEndpoint}          -> { data: [{ key, value }, ...] }
 *   POST {apiBase}{configEndpoint}          -> body { key, value }
 * (veja README.md deste kit para um exemplo de implementação em Express)
 *
 * Props:
 * - apiBase: string                 base da API, ex: '/api' ou 'https://meusistema.com/api'
 * - configEndpoint?: string         default '/admin/config'
 * - authHeaders?: () => object      headers extras (ex: Authorization), default {}
 * - webhookPath?: string            caminho do webhook no seu backend, default '/webhooks/whatsapp'
 * - onSaved?: () => void            callback opcional após salvar com sucesso
 */

const FIELDS = [
  { key: 'WHATSAPP_ACCESS_TOKEN', label: 'Token de Acesso', secret: true, placeholder: 'EAAB...', help: 'Token permanente gerado via Usuário do Sistema no Meta Business Manager.' },
  { key: 'WHATSAPP_PHONE_NUMBER_ID', label: 'Phone Number ID', secret: false, placeholder: '1234567890', help: 'ID numérico do número (não é o número em si) — está no painel do app, em WhatsApp > Configuração da API.' },
  { key: 'WHATSAPP_VERIFY_TOKEN', label: 'Token de Verificação do Webhook', secret: true, placeholder: 'ex: meusistema_token_2026', help: 'Você inventa esse valor aqui e cola o mesmo valor no painel da Meta ao configurar o webhook.' },
  { key: 'WHATSAPP_APP_SECRET', label: 'App Secret (opcional, recomendado em produção)', secret: true, placeholder: '', help: 'Usado para validar a assinatura das requisições do webhook. Fica em Configurações Básicas do App no Meta Developers.' },
];

export default function WhatsAppOfficialConfig({
  apiBase,
  configEndpoint = '/admin/config',
  authHeaders = () => ({}),
  webhookPath = '/webhooks/whatsapp',
}) {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const url = `${apiBase}${configEndpoint}`;
  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}${webhookPath}` : webhookPath;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url, { headers: { ...authHeaders() } });
        if (!res.ok) throw new Error('Erro ao carregar configurações');
        const body = await res.json();
        if (cancelled) return;
        const map = {};
        (body.data || []).forEach((c) => { map[c.key] = c.value; });
        setForm(map);
      } catch (err) {
        if (!cancelled) setMessage({ type: 'error', text: err.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await Promise.all(
        FIELDS.map(async (f) => {
          const value = form[f.key];
          if (value === undefined) return;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ key: f.key, value }),
          });
          if (!res.ok) throw new Error(`Erro ao salvar ${f.key}`);
        })
      );
      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-4 bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-2">WhatsApp Cloud API (oficial)</h3>

        {loading ? (
          <p className="text-slate-400 text-sm">Carregando...</p>
        ) : (
          FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-sm text-slate-300 block">{f.label}</label>
              <input
                type={f.secret ? 'password' : 'text'}
                value={form[f.key] || ''}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm"
              />
              <p className="text-[11px] text-slate-500">{f.help}</p>
            </div>
          ))
        )}

        {message && (
          <div className={`text-sm rounded-md px-3 py-2 ${message.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
            {message.text}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-md h-11 font-medium mt-2"
        >
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      <div className="space-y-4">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5">
          <h4 className="font-bold text-blue-400 mb-3 text-sm">Como configurar?</h4>
          <div className="space-y-2 text-sm text-blue-200/80">
            <p>1. Crie um App em <strong>developers.facebook.com</strong>, tipo Business.</p>
            <p>2. Adicione o produto "WhatsApp" ao App.</p>
            <p>3. Em WhatsApp → Configuração, defina a URL do webhook:</p>
            <code className="block bg-slate-950 p-2 rounded text-[11px] text-emerald-400 break-all">
              {webhookUrl}
            </code>
            <p>4. Cole o mesmo valor do campo "Token de Verificação" acima no campo de verify token do Meta.</p>
            <p>5. Inscreva-se no campo <strong>messages</strong>.</p>
          </div>
          <a
            href="https://developers.facebook.com/apps"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs text-blue-400 hover:underline mt-4 font-semibold"
          >
            Abrir Meta Developers →
          </a>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
          <h4 className="font-bold text-amber-400 mb-2 text-sm">Importante</h4>
          <p className="text-xs text-amber-200/70 leading-relaxed">
            O token temporário expira em 24h. Para produção, gere um token permanente via
            <strong className="text-white"> Usuário do Sistema</strong> no Gerenciador de Negócios (veja o README do kit).
          </p>
        </div>
      </div>
    </div>
  );
}
