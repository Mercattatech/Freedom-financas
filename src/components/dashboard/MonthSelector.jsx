import React from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function MonthSelector({ currentDate, onDateChange }) {
  const handlePrevMonth = () => {
    onDateChange(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    onDateChange(addMonths(currentDate, 1));
  };

  return (
    <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-2 shadow-sm border border-slate-100">
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePrevMonth}
        className="h-8 w-8 hover:bg-slate-100"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <div className="flex items-center gap-2 min-w-[160px] justify-center">
        <Calendar className="h-4 w-4 text-emerald-600" />
        <span className="font-semibold text-slate-800 capitalize">
          {format(currentDate, "MMMM yyyy", { locale: ptBR })}
        </span>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNextMonth}
        className="h-8 w-8 hover:bg-slate-100"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}