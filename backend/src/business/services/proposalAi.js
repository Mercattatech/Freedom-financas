// Geração de propostas comerciais formais por IA a partir de áudio gravado/enviado ou texto de reunião
const { OpenAI, toFile } = require('openai');
const prisma = require('../db');
const configService = require('../../services/configService');
const { badRequest, HttpError } = require('../lib/errors');
const { num, round2 } = require('../lib/money');
const { audit } = require('../lib/audit');

async function getOpenAIClient() {
  const apiKey = await configService.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new HttpError(400, 'Chave da OpenAI (OPENAI_API_KEY) não configurada. Configure em Admin › WhatsApp & IA.');
  }
  return new OpenAI({ apiKey });
}

async function transcribeBuffer(openai, buffer, filename = 'reuniao.webm', mimeType = 'audio/webm') {
  const ext = (filename.split('.').pop() || 'webm').toLowerCase();
  const safeName = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg', 'flac'].includes(ext)
    ? filename
    : 'reuniao.webm';
  const file = await toFile(buffer, safeName, { type: mimeType || 'audio/webm' });
  const res = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'pt',
  });
  return String(res?.text || '').trim();
}

async function generateFromInput(ctx, { texto, audioFile, instrucoes_extras, client_id } = {}) {
  const rawText = String(texto || '').trim();
  if (!rawText && !audioFile?.buffer?.length) {
    throw badRequest('Grave um áudio, envie um arquivo de áudio ou cole/envie o texto da reunião.');
  }

  const openai = await getOpenAIClient();

  let transcricao = '';
  if (audioFile?.buffer?.length) {
    transcricao = await transcribeBuffer(openai, audioFile.buffer, audioFile.originalname, audioFile.mimetype);
    if (!transcricao && !rawText) {
      throw badRequest('Não foi possível identificar fala no áudio enviado. Tente gravar novamente mais próximo do microfone.');
    }
  }

  const conteudoReuniao = [
    transcricao ? `=== TRANSCRIÇÃO DO ÁUDIO DA REUNIÃO ===\n${transcricao}` : '',
    rawText ? `=== NOTAS / TEXTO DA REUNIÃO ===\n${rawText}` : '',
    instrucoes_extras ? `=== INSTRUÇÕES ADICIONAIS DO VENDEDOR ===\n${String(instrucoes_extras).trim()}` : '',
  ].filter(Boolean).join('\n\n');

  const [company, products, clients] = await Promise.all([
    prisma.bizCompany.findUnique({
      where: { id: ctx.companyId },
      select: { razao_social: true, nome_fantasia: true, proposta_termos: true, proposta_validade_dias: true },
    }),
    prisma.bizProduct.findMany({
      where: { company_id: ctx.companyId, ativo: true },
      select: { id: true, nome: true, descricao: true, preco_venda: true, custo_unitario: true, cobranca: true },
      take: 100,
    }),
    prisma.bizClient.findMany({
      where: { company_id: ctx.companyId, status: { not: 'INATIVO' } },
      select: { id: true, nome: true, nome_fantasia: true, email: true },
      take: 200,
    }),
  ]);

  const empresaNome = company?.nome_fantasia || company?.razao_social || 'Nossa Empresa';
  const catalogoStr = products.length
    ? products.map((p) => `- id="${p.id}" | ${p.nome} | ${p.cobranca} | R$ ${num(p.preco_venda)} | custo R$ ${num(p.custo_unitario)}${p.descricao ? ` | ${p.descricao}` : ''}`).join('\n')
    : 'Nenhum produto pré-cadastrado (crie itens livres conforme a reunião).';

  const clientesStr = clients.length
    ? clients.map((c) => `- id="${c.id}" | ${c.nome_fantasia || c.nome}${c.email ? ` (${c.email})` : ''}`).join('\n')
    : 'Nenhum cliente cadastrado.';

  const clientePreSelecionado = client_id ? clients.find((c) => c.id === client_id) : null;

  const systemPrompt = `Você é um diretor comercial sênior da empresa "${empresaNome}".
Sua tarefa é transformar o conteúdo de uma reunião comercial (áudio transcrito e/ou texto/notas) em uma PROPOSTA COMERCIAL FORMAL, clara, persuasiva e pronta para envio e assinatura/aceite eletrônico pelo cliente.

REGRAS OBRIGATÓRIAS:
1. Escreva sempre em português do Brasil formal, elegante e objetivo.
2. Retorne APENAS um objeto JSON válido com a estrutura exata abaixo.
3. Use Markdown limpo (**negrito**, listas com -) nos campos "introducao", "escopo" e "condicoes".
4. Em "introducao": faça uma apresentação executiva contextualizando o cenário/necessidade do cliente discutido na reunião, o objetivo do projeto e a proposta de valor da ${empresaNome}.
5. Em "escopo": organize claramente as entregas, fases, atividades, frequências e prazos combinados na reunião.
6. Em "condicoes": inclua forma de pagamento, vigência, validade da proposta, reajuste anual automático pelo IPCA todo dia 1º de janeiro (para itens recorrentes), confidencialidade e aceite formal. ${company?.proposta_termos ? `Incorpore também estas condições padrão da empresa quando fizer sentido:\n${company.proposta_termos}` : ''}
7. Em "items": extraia TODOS os serviços/produtos e valores mencionados na reunião. Se um serviço corresponder a algum item do catálogo abaixo, preencha o "product_id" correspondente (e use o preço combinado na reunião, ou o preço do catálogo caso não tenha sido dito valor). Se não corresponder, deixe "product_id": null.
8. Classifique cada item em "cobranca": "RECORRENTE" (mensalidade, gestão mensal, assinatura, fee) ou "UNICA" (projeto, implantação, setup, pagamento único).
9. Se o cliente citado na reunião corresponder claramente a um cliente da lista abaixo, preencha "client_id". Caso contrário, deixe "client_id": null e preencha "prospect_empresa", "prospect_nome" e "prospect_email" com o que tiver sido citado.
10. Nunca invente valores absurdos: se nenhum valor foi citado para um item livre, coloque preco_unitario: 0 para o vendedor preencher.

CATÁLOGO DE PRODUTOS/SERVIÇOS DA EMPRESA:
${catalogoStr}

CLIENTES CADASTRADOS:
${clientesStr}
${clientePreSelecionado ? `\nCLIENTE JÁ SELECIONADO PELO VENDEDOR: id="${clientePreSelecionado.id}" (${clientePreSelecionado.nome_fantasia || clientePreSelecionado.nome}). Use este client_id.` : ''}

FORMATO JSON EXATO DE SAÍDA:
{
  "titulo": "Título formal e executivo da proposta",
  "client_id": "id-do-cliente-ou-null",
  "prospect_empresa": "Nome da empresa prospect ou null",
  "prospect_nome": "Nome do contato prospect ou null",
  "prospect_email": "email@exemplo.com ou null",
  "introducao": "Texto formal em Markdown...",
  "escopo": "Escopo detalhado e entregáveis em Markdown...",
  "condicoes": "Condições comerciais e jurídicas em Markdown...",
  "prazo_contrato_meses": 12,
  "desconto_percent": 0,
  "items": [
    {
      "product_id": "id-do-produto-ou-null",
      "descricao": "Nome do serviço/item",
      "detalhes": "Descrição concisa do entregável deste item",
      "quantidade": 1,
      "preco_unitario": 1500,
      "desconto_percent": 0,
      "custo_unitario": 0,
      "cobranca": "RECORRENTE"
    }
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: conteudoReuniao },
    ],
  });

  const rawJson = completion.choices?.[0]?.message?.content;
  if (!rawJson) throw new HttpError(502, 'A IA não retornou resposta. Tente novamente.');

  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new HttpError(502, 'Resposta da IA em formato inválido. Tente novamente.');
  }

  const validClientIds = new Set(clients.map((c) => c.id));
  const prodById = Object.fromEntries(products.map((p) => [p.id, p]));

  const resolvedClientId = client_id && validClientIds.has(client_id)
    ? client_id
    : (parsed.client_id && validClientIds.has(parsed.client_id) ? parsed.client_id : null);

  const items = Array.isArray(parsed.items) && parsed.items.length
    ? parsed.items.map((it) => {
        const prod = it.product_id ? prodById[it.product_id] : null;
        return {
          product_id: prod ? prod.id : '',
          descricao: String(it.descricao || prod?.nome || 'Serviço').trim(),
          detalhes: String(it.detalhes || prod?.descricao || '').trim(),
          quantidade: Math.max(1, num(it.quantidade) || 1),
          preco_unitario: round2(it.preco_unitario != null ? num(it.preco_unitario) : num(prod?.preco_venda)),
          desconto_percent: Math.max(0, Math.min(100, num(it.desconto_percent))),
          custo_unitario: round2(it.custo_unitario > 0 ? num(it.custo_unitario) : num(prod?.custo_unitario)),
          cobranca: it.cobranca === 'RECORRENTE' ? 'RECORRENTE' : 'UNICA',
        };
      })
    : [];

  const proposta = {
    titulo: String(parsed.titulo || 'Proposta Comercial').trim(),
    client_id: resolvedClientId || '',
    prospect_empresa: resolvedClientId ? '' : String(parsed.prospect_empresa || '').trim(),
    prospect_nome: resolvedClientId ? '' : String(parsed.prospect_nome || '').trim(),
    prospect_email: resolvedClientId ? '' : String(parsed.prospect_email || '').trim(),
    introducao: String(parsed.introducao || '').trim(),
    escopo: String(parsed.escopo || '').trim(),
    condicoes: String(parsed.condicoes || company?.proposta_termos || '').trim(),
    prazo_contrato_meses: parsed.prazo_contrato_meses ? Math.max(1, parseInt(parsed.prazo_contrato_meses, 10) || 12) : 12,
    desconto_percent: Math.max(0, Math.min(100, num(parsed.desconto_percent))),
    items,
  };

  await audit(ctx, 'ai_generate', 'proposta', ctx.companyId, `Proposta gerada por IA${audioFile ? ' (áudio)' : ' (texto)'}: "${proposta.titulo}"`);
  return { transcricao, proposta };
}

module.exports = { generateFromInput };
