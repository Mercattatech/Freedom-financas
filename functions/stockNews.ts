import { createClientFromRequest } from 'npm:@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await apiClient.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const tickers = body.tickers || [];

    if (tickers.length === 0) return Response.json({ news: [] });

    const prompt = `Busque as últimas notícias e informações sobre essas ações (use nomes das empresas também): ${tickers.join(', ')}. 
    Forneça no máximo 6 notícias mais relevantes e recentes. Para cada notícia, inclua:
    - Título
    - Resumo (máximo 100 caracteres)
    - Ticker relacionado
    - Data aproximada (hoje, ontem, etc)
    - Impacto estimado (positivo, negativo ou neutro)
    
    Responda APENAS em JSON, sem texto adicional, no seguinte formato:
    {
      "news": [
        {
          "title": "string",
          "summary": "string",
          "ticker": "string",
          "date": "string",
          "impact": "positive" | "negative" | "neutral"
        }
      ]
    }`;

    const result = await apiClient.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          news: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                summary: { type: 'string' },
                ticker: { type: 'string' },
                date: { type: 'string' },
                impact: { type: 'string' }
              }
            }
          }
        }
      }
    });

    return Response.json({ news: result.news || [] });
  } catch (error) {
    console.error('Stock news error:', error.message);
    return Response.json({ news: [] });
  }
});