const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();
let yahooFinance;

try {
  const YahooFinance = require('yahoo-finance2').default;
  yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
} catch (err) {
  console.warn("yahoo-finance2 not installed or failed to load", err);
}

// Inicializa Stripe se houver chave
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  try {
    const Stripe = require('stripe');
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  } catch(e) {
     console.warn("Stripe module not installed", e);
  }
}

// Protected route
router.use(authenticateToken);

router.post('/invoke', async (req, res) => {
  console.log('[FUNCTIONS] Invoke invoked:', req.body.name, req.body.payload);
  try {
    const { name, payload } = req.body;
    
    if (!yahooFinance) {
      return res.status(500).json({ error: 'yahoo-finance2 is not configured on the backend.' });
    }
    
    if (name === 'stockQuotes') {
      const tickers = payload?.tickers || [];
      const quotes = [];
      
      for (const t of tickers) {
        try {
          // Add default ".SA" suffix for typical Brazilian tickers if no suffix exists
          let symbol = t;
          if (!t.includes('.') && /^[A-Z]{4}\d/.test(t)) {
            symbol = `${t}.SA`;
          }
          
          const quote = await yahooFinance.quote(symbol);
          quotes.push({
            symbol: t,
            name: quote.longName || quote.shortName || t,
            price: quote.regularMarketPrice,
            changePercent: quote.regularMarketChangePercent
          });
        } catch (e) {
          console.warn(`Could not fetch quote for ${t}:`, e.message);
        }
      }
      
      console.log(`[FUNCTIONS] Returning ${quotes.length} quotes`);
      return res.json({ data: { quotes } });
    }
    
    if (name === 'stockNews') {
      const tickers = payload?.tickers || [];
      let query = 'IBOV';
      
      if (tickers.length > 0) {
        let t = tickers[0];
        query = (!t.includes('.') && /^[A-Z]{4}\d/.test(t)) ? `${t}.SA` : t;
      }
      
      try {
        const result = await yahooFinance.search(query, { newsCount: 5 });
        const news = (result.news || []).map(n => ({
          impact: 'neutral', // Yahoo finance search doesn't provide sentiment out-of-the-box
          title: n.title,
          summary: n.publisher,
          ticker: tickers[0] || 'Mercado',
          date: n.providerPublishTime 
            ? new Date(n.providerPublishTime * 1000).toLocaleDateString('pt-BR') 
            : new Date().toLocaleDateString('pt-BR'),
          url: n.link
        }));
        
        console.log(`[FUNCTIONS] Returning ${news.length} news items`);
        return res.json({ data: { news } });
      } catch (err) {
        console.warn('Failed fetching news for', query, err.message);
        return res.json({ data: { news: [] } });
      }
    }

    if (name === 'syncStripePlan') {
      const { plan_id, nome, descricao, preco, tipo } = payload || {};
      if (!stripe) return res.status(500).json({ data: { error: 'Chave do Stripe não configurada.' }});
      
      try {
        const productOptions = {
          name: nome,
          metadata: { plan_id }
        };
        if (descricao) productOptions.description = descricao;
        
        const product = await stripe.products.create(productOptions);
        
        let priceData = {
          currency: 'brl',
          unit_amount: Math.round(preco * 100),
          product: product.id,
        };
        
        if (tipo === 'MENSAL') priceData.recurring = { interval: 'month' };
        if (tipo === 'ANUAL') priceData.recurring = { interval: 'year' };

        const price = await stripe.prices.create(priceData);
        
        const { PrismaClient } = require('@prisma/client');
        const p = new PrismaClient();
        await p.plan.update({ where: { id: plan_id }, data: { stripe_price_id: price.id } });
        await p.$disconnect();

        return res.json({ data: { success: true, stripe_price_id: price.id } });
      } catch (err) {
        console.error('Erro no SyncStripe:', err);
        return res.status(500).json({ data: { error: err.message } });
      }
    }

    return res.json({ success: true, message: 'Função executada (mas não mapeada).' });
    
  } catch (error) {
    console.error('Functions API Error:', error);
    res.status(500).json({ error: 'Internal error executing function' });
  }
});

module.exports = router;
