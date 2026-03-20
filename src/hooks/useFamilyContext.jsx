import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';

const FamilyContext = createContext();

export function FamilyProvider({ children }) {
  const queryClient = useQueryClient();
  const [selectedFamilyId, setSelectedFamilyId] = useState(
    () => localStorage.getItem('selectedFamilyId')
  );

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => apiClient.auth.me()
  });

  const { data: families = [], isLoading } = useQuery({
    queryKey: ['families', user?.email],
    queryFn: () => apiClient.entities.Family.filter({ created_by: user.email }),
    enabled: !!user
  });

  const family = selectedFamilyId
    ? families.find(f => f.id === selectedFamilyId) || families[0]
    : families[0];

  const selectFamily = (familyId) => {
    localStorage.setItem('selectedFamilyId', familyId);
    setSelectedFamilyId(familyId);
    queryClient.invalidateQueries();
  };

  useEffect(() => {
    if (family && !selectedFamilyId) {
      localStorage.setItem('selectedFamilyId', family.id);
      setSelectedFamilyId(family.id);
    }
  }, [family]);

  return (
    <FamilyContext.Provider value={{
      user,
      families,
      family,
      selectedFamilyId: family?.id,
      selectFamily,
      isLoading
    }}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const context = useContext(FamilyContext);
  if (!context) {
    throw new Error('useFamily must be used within a FamilyProvider');
  }
  return context;
}
