import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { CheckCircle2, Printer, Loader2 } from 'lucide-react';
import { biz } from '../api';
import { money, date, docMask } from '../format';
import '../biz.css';

// Página pública da proposta — com a marca da empresa que enviou
export default function PublicProposal() {
  const { token } = useParams();
  const [sp] = useSearchParams();
  const [p, setP] = useState(null);
  const [err, setErr] = useState(null);
  const [form, setForm] = useState({ nome: '', documento: '', ok: false });
  const [sending, setSending] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    biz(`/public/proposals/${token}`, { auth: false, query: { preview: sp.get('preview') || undefined } }).then(setP).catch(setErr);
  }, [token, sp]);

  useEffect(() => { if (p) document.title = `${p.titulo} — ${p.empresa.nome}`; }, [p]);

  if (err) return <div className="biz min-h-screen grid place-items-center p-6 text-center"><div><p className="text-xl font-bold">Proposta não encontrada</p><p className="text-[var(--muted)] mt-1">Confira o link recebido ou fale com quem enviou.</p></div></div>;
  if (!p) return <div className="biz min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--muted)]" /></div>;

  const brand = p.empresa.cor_secundaria || '#5161D6';
  const dark = p.empresa.cor_primaria || '#172033';
  const rec = p.items.filter((i) => i.cobranca === 'RECORRENTE');
  const uni = p.items.filter((i) => i.cobranca !== 'RECORRENTE');
  const aberta = ['ENVIADA', 'VISUALIZADA'].includes(p.status);

  const accept = async () => {
    setSending(true);
    try { setP(await biz(`/public/proposals/${token}/accept`, { method: 'POST', auth: false, body: { nome: form.nome, documento: form.documento } })); }
    catch (e) { alert(e.message); }
    finally { setSending(false); }
  };
  const reject = async () => {
    setSending(true);
    try { setP(await biz(`/public/proposals/${token}/reject`, { method: 'POST', auth: false, body: { motivo } })); setRejecting(false); }
    catch (e) { alert(e.message); }
    finally { setSending(false); }
  };

  const Section = ({ title, children }) => (
    <section className="py-8 border-b border-[var(--line)] last:border-0">
      <h2 className="text-[13px] font-bold mb-3" style={{ color: brand }}>{title}</h2>
      {children}
    </section>
  );
  const md = 'prose-sm max-w-none text-[16px] leading-[1.7] text-[var(--ink-2)] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_p]:my-2 [&_strong]:text-[var(--ink)]';

  return (
    <div className="biz min-h-screen" style={{ background: '#F3F4F6' }}>
      <header style={{ background: dark }} className="text-white">
        <div className="max-w-[860px] mx-auto px-6 pt-8 pb-24">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {p.empresa.logo_url ? <img src={p.empresa.logo_url} alt={p.empresa.nome} className="h-10 max-w-[180px] object-contain" /> : <span className="text-lg font-extrabold">{p.empresa.nome}</span>}
            </div>
            <button onClick={() => window.print()} className="biz-noprint inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white"><Printer className="w-4 h-4" />Salvar em PDF</button>
          </div>
          <p className="mt-14 text-white/70 font-semibold">Proposta nº {p.numero} para {p.cliente.nome}</p>
          <h1 className="text-[34px] sm:text-[44px] leading-[1.08] font-extrabold mt-2 max-w-[22ch]">{p.titulo}</h1>
          <p className="mt-4 text-white/70 text-sm">Emitida em {date(p.created_date)}{p.validade ? `, válida até ${date(p.validade)}` : ''}{p.responsavel ? `. Responsável: ${p.responsavel}` : ''}</p>
        </div>
      </header>

      <main className="max-w-[860px] mx-auto px-4 sm:px-6 -mt-16 pb-16">
        <div className="rounded-2xl bg-white shadow-xl px-6 sm:px-10">
          {p.introducao && <Section title="Apresentação"><div className={md}><ReactMarkdown>{p.introducao}</ReactMarkdown></div></Section>}
          {p.escopo && <Section title="O que vamos entregar"><div className={md}><ReactMarkdown>{p.escopo}</ReactMarkdown></div></Section>}

          <Section title="Investimento">
            <div className="space-y-6">
              {[['Mensal', rec], ['Projeto e implantação', uni]].filter(([, l]) => l.length).map(([label, list]) => (
                <div key={label}>
                  <p className="font-bold mb-2">{label}</p>
                  <table className="tbl">
                    <thead><tr><th>Item</th><th className="r">Qtd.</th><th className="r">Valor</th></tr></thead>
                    <tbody>{list.map((i, k) => (
                      <tr key={k}><td><b>{i.descricao}</b>{i.detalhes && <div className="text-sm text-[var(--muted)] mt-0.5 max-w-[60ch]">{i.detalhes}</div>}</td><td className="r num">{Number(i.quantidade)}</td><td className="r num font-semibold">{money(i.total)}{Number(i.desconto_percent) > 0 && <div className="text-xs text-[var(--muted)]">{Number(i.desconto_percent)}% de desconto</div>}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              ))}
              <div className="rounded-xl p-6 text-white grid sm:grid-cols-2 gap-4" style={{ background: brand }}>
                {p.total_recorrente > 0 && <div><p className="text-white/80 text-sm font-semibold">Investimento mensal</p><p className="num text-[30px] font-extrabold leading-tight">{money(p.total_recorrente)}</p>{p.prazo_contrato_meses && <p className="text-white/80 text-sm">Contrato de {p.prazo_contrato_meses} meses</p>}</div>}
                {p.total_unico > 0 && <div><p className="text-white/80 text-sm font-semibold">Projeto (pagamento único)</p><p className="num text-[30px] font-extrabold leading-tight">{money(p.total_unico)}</p></div>}
                {Number(p.desconto_percent) > 0 && <p className="sm:col-span-2 text-sm text-white/85">Já inclui {Number(p.desconto_percent)}% de desconto sobre o total.</p>}
              </div>
            </div>
          </Section>

          {p.condicoes && <Section title="Condições"><div className={md}><ReactMarkdown>{p.condicoes}</ReactMarkdown></div></Section>}

          <Section title={p.status === 'ACEITA' ? 'Proposta aceita' : 'Próximo passo'}>
            {p.status === 'ACEITA' ? (
              <div className="flex gap-3 items-start"><CheckCircle2 className="w-7 h-7 shrink-0" style={{ color: brand }} /><div><p className="font-bold text-lg">Obrigado, {p.aceite_nome}!</p><p className="text-[var(--muted)]">Aceite registrado em {date(p.respondida_em)}. Nossa equipe vai entrar em contato para iniciar o trabalho.</p></div></div>
            ) : p.status === 'RECUSADA' ? (
              <p className="text-[var(--muted)]">Esta proposta foi recusada. Se mudar de ideia, fale com {p.empresa.nome}.</p>
            ) : p.status === 'EXPIRADA' ? (
              <p className="text-[var(--muted)]">Esta proposta expirou. Peça uma versão atualizada para {p.empresa.nome}.</p>
            ) : aberta && !rejecting ? (
              <div className="biz-noprint">
                <p className="text-[var(--ink-2)] mb-4">Para aceitar, informe seu nome e CPF ou CNPJ. O aceite fica registrado com data e hora.</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <input className="h-11 rounded-lg border border-[var(--line)] px-3" placeholder="Nome completo" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                  <input className="h-11 rounded-lg border border-[var(--line)] px-3" placeholder="CPF ou CNPJ" value={form.documento} onChange={(e) => setForm({ ...form, documento: docMask(e.target.value) })} />
                </div>
                <label className="flex items-start gap-2 text-sm mt-3"><input type="checkbox" className="mt-1" checked={form.ok} onChange={(e) => setForm({ ...form, ok: e.target.checked })} />Li e concordo com o escopo, os valores e as condições desta proposta.</label>
                <div className="flex flex-wrap gap-3 mt-5 items-center">
                  <button disabled={!form.nome || !form.ok || sending} onClick={accept} className="h-12 px-6 rounded-lg text-white font-bold disabled:opacity-40" style={{ background: brand }}>{sending ? 'Registrando…' : 'Aceitar proposta'}</button>
                  <button onClick={() => setRejecting(true)} className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">Não vou seguir agora</button>
                </div>
              </div>
            ) : rejecting ? (
              <div className="biz-noprint">
                <p className="text-[var(--ink-2)] mb-3">Pode nos contar o motivo? Isso nos ajuda a melhorar.</p>
                <textarea className="w-full rounded-lg border border-[var(--line)] p-3 min-h-[90px]" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Preço, prazo, escopo…" />
                <div className="flex gap-3 mt-3"><button onClick={reject} disabled={sending} className="h-11 px-5 rounded-lg bg-[var(--ink)] text-white font-semibold">Recusar proposta</button><button onClick={() => setRejecting(false)} className="text-sm font-semibold text-[var(--muted)]">Voltar</button></div>
              </div>
            ) : <p className="text-[var(--muted)]">Pré-visualização: o aceite fica disponível depois que a proposta for enviada.</p>}
          </Section>
        </div>

        <footer className="text-center text-sm text-[#6B7280] mt-8 space-y-1">
          <p className="font-semibold text-[#374151]">{p.empresa.razao_social}{p.empresa.cnpj ? `, CNPJ ${docMask(p.empresa.cnpj)}` : ''}</p>
          <p>{[p.empresa.email, p.empresa.telefone, p.empresa.site].filter(Boolean).join('  |  ')}</p>
          {p.empresa.rodape && <p>{p.empresa.rodape}</p>}
        </footer>
      </main>
    </div>
  );
}
