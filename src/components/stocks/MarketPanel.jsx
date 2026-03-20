// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/api/apiClient';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, RefreshCw, Plus, X, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_TICKERS = ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'WEGE3', 'MGLU3'];

const AVAILABLE_TICKERS = [
  { ticker: 'PETR4', name: 'Petrobras' },
  { ticker: 'VALE3', name: 'Vale' },
  { ticker: 'ITUB4', name: 'Itaú' },
  { ticker: 'BBDC4', name: 'Bradesco' },
  { ticker: 'WEGE3', name: 'WEG' },
  { ticker: 'MGLU3', name: 'Magazine Luiza' },
  { ticker: 'XPML11', name: 'XP Malls' },
  { ticker: 'MSFT', name: 'Microsoft' },
  { ticker: 'NVIDIA', name: 'NVIDIA' },
  { ticker: 'BBAS3', name: 'Banco do Brasil' },
  { ticker: 'CSAN3', name: 'Cosan' },
  { ticker: 'RAIL3', name: 'Rumo' }
];

const formatCurrency = (v, symbol) => {
  if (!v) return '-';
  if (symbol?.endsWith('.SA') || !symbol?.includes('.')) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
};

export default function MarketPanel({ portfolioTickers = [] }) {
  const storageKey = 'watchlist_tickers';
  const [watchlist, setWatchlist] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : DEFAULT_TICKERS;
    } catch { return DEFAULT_TICKERS; }
  });
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [newTicker, setNewTicker] = useState('');

  const allTickers = [...new Set([...watchlist, ...portfolioTickers])];

  const fetchQuotes = useCallback(async () => {
    if (allTickers.length === 0) return;
    setLoading(true);
    try {
      const res = await apiClient.functions.invoke('stockQuotes', { tickers: allTickers });
      console.log('MARKET RES', res);
      if (res?.data?.quotes) {
        setQuotes(res.data.quotes);
        setLastUpdate(new Date());
      } else if (res?.quotes) { // Fallback just in case
        setQuotes(res.quotes);
        setLastUpdate(new Date());
      }
    } catch (e) {
      console.error('Failed to fetch quotes', e);
    }
    setLoading(false);
  }, [allTickers.join(',')]);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);
  
  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchQuotes, 60000);
    return () => clearInterval(interval);
  }, [fetchQuotes]);

  const addTicker = (ticker) => {
    const t = ticker?.trim().toUpperCase() || newTicker.trim().toUpperCase();
    if (!t || watchlist.includes(t)) { setNewTicker(''); return; }
    const updated = [...watchlist, t];
    setWatchlist(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setNewTicker('');
  };

  const filteredTickers = newTicker 
    ? AVAILABLE_TICKERS.filter(a => a.ticker.includes(newTicker.toUpperCase()))
    : [];

  const removeTicker = (ticker) => {
    const updated = watchlist.filter(t => t !== ticker);
    setWatchlist(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  return (
    <Card className="border-0 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold text-slate-800">Painel de Cotações</h2>
          <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">
            Tempo Real
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-xs text-slate-400">
              Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
            </span>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={fetchQuotes} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Add ticker */}
      <div className="p-3 border-b border-slate-100 bg-slate-50 space-y-2">
        <div className="flex gap-2">
          <Input
            value={newTicker}
            onChange={e => setNewTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && addTicker()}
            placeholder="Adicionar ticker (ex: XPML11, MSFT)"
            className="h-8 text-sm"
          />
          <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700" onClick={() => addTicker()}>
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        </div>
        {filteredTickers.length > 0 && (
          <div className="grid grid-cols-2 gap-1">
            {filteredTickers.map(a => (
              <button
                key={a.ticker}
                onClick={() => addTicker(a.ticker)}
                className="text-left p-2 text-xs rounded bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-400 transition-colors"
              >
                <div className="font-semibold text-slate-800">{a.ticker}</div>
                <div className="text-slate-500 truncate">{a.name}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quotes grid */}
      {loading && quotes.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-sm">Carregando cotações...</div>
      ) : quotes.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-sm">Nenhuma cotação disponível</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-y divide-slate-50 sm:divide-y-0">
          {quotes.map((q) => {
            const isPositive = q.changePercent >= 0;
            const isPortfolio = portfolioTickers.includes(q.symbol);
            return (
              <div key={q.symbol}
                className={cn(
                  "flex items-center justify-between p-3 hover:bg-slate-50 transition-colors border-b border-slate-50",
                  isPortfolio && "bg-emerald-50/40"
                )}>
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    isPortfolio ? "bg-emerald-100" : "bg-blue-50"
                  )}>
                    <span className={cn("text-xs font-bold", isPortfolio ? "text-emerald-700" : "text-blue-700")}>
                      {q.symbol?.slice(0, 3)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="font-semibold text-slate-800 text-sm">{q.symbol}</p>
                      {isPortfolio && <Badge className="text-xs bg-emerald-100 text-emerald-700 px-1 py-0 h-4">Carteira</Badge>}
                    </div>
                    <p className="text-xs text-slate-400 truncate max-w-[120px]">{q.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="font-semibold text-slate-800 text-sm">{formatCurrency(q.price, q.symbol)}</p>
                    <div className={cn("flex items-center justify-end gap-0.5 text-xs font-medium",
                      isPositive ? "text-emerald-600" : "text-red-500")}>
                      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {isPositive ? '+' : ''}{q.changePercent?.toFixed(2)}%
                    </div>
                  </div>
                  {watchlist.includes(q.symbol) && (
                    <button onClick={() => removeTicker(q.symbol)} className="text-slate-300 hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}