import React from 'react';
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function StatCard({ title, value, subtitle, icon: Icon, trend, trendUp, className, iconColor = "text-emerald-600", iconBg = "bg-emerald-50" }) {
  return (
    <Card className={cn("p-6 border-0 shadow-sm hover:shadow-md transition-all duration-300", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-500 tracking-wide uppercase">{title}</p>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{value}</p>
          {subtitle && (
            <p className="text-sm text-slate-500">{subtitle}</p>
          )}
          {trend !== undefined && (
            <div className={cn(
              "inline-flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-full",
              trendUp ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            )}>
              {trendUp ? "↑" : "↓"} {Math.abs(trend)}%
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn("p-3 rounded-xl", iconBg)}>
            <Icon className={cn("w-6 h-6", iconColor)} />
          </div>
        )}
      </div>
    </Card>
  );
}