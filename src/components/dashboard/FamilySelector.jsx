import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";

export default function FamilySelector() {
  const queryClient = useQueryClient();
  
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => apiClient.auth.me()
  });

  const { data: families = [] } = useQuery({
    queryKey: ['families', user?.email],
    queryFn: () => apiClient.entities.Family.filter({ created_by: user.email }),
    enabled: !!user
  });

  const selectedFamilyId = localStorage.getItem('selectedFamilyId') || families[0]?.id;

  const handleFamilyChange = (familyId) => {
    localStorage.setItem('selectedFamilyId', familyId);
    queryClient.invalidateQueries(); // Refresh all data with new family
  };

  if (families.length <= 1) {
    return null;
  }

  const selectedFamily = families.find(f => f.id === selectedFamilyId);

  return (
    <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-sm border border-slate-100">
      <Users className="w-4 h-4 text-slate-500" />
      <Select value={selectedFamilyId} onValueChange={handleFamilyChange}>
        <SelectTrigger className="border-0 h-auto p-0 min-w-[140px] focus:ring-0">
          <SelectValue>
            <span className="font-medium text-slate-800">{selectedFamily?.nome_familia}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {families.map((family) => (
            <SelectItem key={family.id} value={family.id}>
              <div>
                <p className="font-medium">{family.nome_familia}</p>
                <p className="text-xs text-slate-500">{family.tipo_familia.replace(/_/g, ' ')}</p>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}