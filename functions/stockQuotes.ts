import { createClientFromRequest } from 'npm:@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await apiClient.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const tickers = body.tickers || [];

    if (tickers.length === 0) return Response.json({ quotes: [] });

    // Append .SA for Brazilian tickers
    const symbols = tickers.map(t => {
      const upper = t.toUpperCase();
      if (upper.includes('.')) return upper;
      if (/\d$/.test(upper)) return upper + '.SA';
      return upper;
    });

    // Mock data for now since Yahoo Finance may be blocked
    const mockData = {
      'PETR4.SA': { price: 29.45, change: 0.35, changePercent: 1.20, name: 'Petrobras' },
      'VALE3.SA': { price: 58.92, change: 1.15, changePercent: 1.98, name: 'Vale' },
      'ITUB4.SA': { price: 32.10, change: -0.45, changePercent: -1.38, name: 'Itaú' },
      'BBDC4.SA': { price: 15.78, change: 0.12, changePercent: 0.77, name: 'Bradesco' },
      'WEGE3.SA': { price: 78.50, change: 2.30, changePercent: 3.02, name: 'WEG' },
      'MGLU3.SA': { price: 8.75, change: -0.25, changePercent: -2.78, name: 'Magazine Luiza' },
      'XPML11.SA': { price: 12.35, change: 0.45, changePercent: 3.78, name: 'XP Malls' },
      'MSFT': { price: 420.30, change: 5.20, changePercent: 1.25, name: 'Microsoft' },
      'NVIDIA': { price: 875.60, change: -12.40, changePercent: -1.40, name: 'NVIDIA' },
      'BBAS3.SA': { price: 35.20, change: 0.80, changePercent: 2.33, name: 'Banco do Brasil' },
      'CSAN3.SA': { price: 24.50, change: -0.50, changePercent: -2.00, name: 'Cosan' },
      'RAIL3.SA': { price: 18.90, change: 0.35, changePercent: 1.88, name: 'Rumo' }
    };

    const quotes = symbols.map(sym => {
      const data = mockData[sym] || mockData[sym.replace('.SA', '') + '.SA'] || { price: 0, change: 0, changePercent: 0, name: sym };
      return {
        symbol: sym.replace('.SA', ''),
        name: data.name,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        prevClose: data.price - data.change,
        volume: 1000000
      };
    });

    return Response.json({ quotes });
  } catch (error) {
    console.error('Stock quotes error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});