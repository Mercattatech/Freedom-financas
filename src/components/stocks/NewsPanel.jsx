// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/api/apiClient';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, TrendingDown, Newspaper, RefreshCw, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export default function NewsPanel({ tickers = [] }) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchNews = useCallback(async () => {
    if (tickers.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.functions.invoke('stockNews', { tickers });
      if (res.data?.news) {
        setNews(res.data.news);
      }
    } catch (e) {
      console.error('Failed to fetch news', e);
      setError('Não foi possível carregar notícias');
    }
    setLoading(false);
  }, [tickers.join(',')]);

  useEffect(() => { 
    fetchNews();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchNews, 300000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  const getImpactIcon = (impact) => {
    if (impact === 'positive') return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (impact === 'negative') return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <AlertCircle className="w-4 h-4 text-yellow-600" />;
  };

  const getImpactColor = (impact) => {
    if (impact === 'positive') return 'bg-green-50 border-green-200';
    if (impact === 'negative') return 'bg-red-50 border-red-200';
    return 'bg-yellow-50 border-yellow-200';
  };

  const getBadgeColor = (impact) => {
    if (impact === 'positive') return 'bg-green-100 text-green-800';
    if (impact === 'negative') return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  return (
    <Card className="border-0 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-amber-500" />
          <h2 className="font-semibold text-slate-800">Notícias do Mercado</h2>
          <Badge variant="outline" className="text-xs text-amber-600 border-amber-200 bg-amber-50">
            Em tempo real
          </Badge>
        </div>
        <button 
          onClick={fetchNews} 
          disabled={loading}
          className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Content */}
      <div className="divide-y divide-slate-100">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
            <Zap className="w-4 h-4 animate-pulse" /> Carregando notícias...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-500 text-sm">{error}</div>
        ) : news.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Nenhuma notícia disponível no momento</div>
        ) : (
          news.map((item, idx) => (
            <div key={idx} className={cn("p-4 hover:bg-slate-50 transition-colors border-l-4", getImpactColor(item.impact))}>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {getImpactIcon(item.impact)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <a href={item.url} target="_blank" rel="noreferrer" className="hover:underline">
                      <h3 className="font-semibold text-slate-800 text-sm leading-snug">{item.title}</h3>
                    </a>
                    <Badge className={cn("flex-shrink-0 text-xs", getBadgeColor(item.impact))}>
                      {item.impact === 'positive' ? '↑' : item.impact === 'negative' ? '↓' : '→'}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{item.summary}</p>
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-xs">{item.ticker}</Badge>
                    <span className="text-xs text-slate-400">{item.date}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}