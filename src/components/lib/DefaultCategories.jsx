export const DEFAULT_CATEGORIES = [
  { nome: 'Moradia', icone: 'Home', cor: '#3B82F6', ordem_exibicao: 1 },
  { nome: 'Alimentação', icone: 'UtensilsCrossed', cor: '#F59E0B', ordem_exibicao: 2 },
  { nome: 'Transporte', icone: 'Car', cor: '#8B5CF6', ordem_exibicao: 3 },
  { nome: 'Saúde', icone: 'Heart', cor: '#EF4444', ordem_exibicao: 4 },
  { nome: 'Educação', icone: 'GraduationCap', cor: '#06B6D4', ordem_exibicao: 5 },
  { nome: 'Vestuário', icone: 'Shirt', cor: '#EC4899', ordem_exibicao: 6 },
  { nome: 'Entretenimento', icone: 'Gamepad2', cor: '#10B981', ordem_exibicao: 7 },
  { nome: 'Dívidas', icone: 'CreditCard', cor: '#DC2626', ordem_exibicao: 8 },
  { nome: 'Seguro', icone: 'Shield', cor: '#6366F1', ordem_exibicao: 9 },
  { nome: 'Poupança', icone: 'PiggyBank', cor: '#22C55E', ordem_exibicao: 10 },
  { nome: 'Investimentos', icone: 'TrendingUp', cor: '#14B8A6', ordem_exibicao: 11 },
  { nome: 'Dízimos', icone: 'Church', cor: '#A855F7', ordem_exibicao: 12 },
  { nome: 'Ofertas', icone: 'Gift', cor: '#F97316', ordem_exibicao: 13 },
  { nome: 'Despesas Diversas', icone: 'MoreHorizontal', cor: '#6B7280', ordem_exibicao: 14 },
  { nome: 'Previdência', icone: 'Landmark', cor: '#0EA5E9', ordem_exibicao: 15 }
];

export const SUBCATEGORIES_BY_FAMILY_TYPE = {
  SEM_FILHOS: {
    'Moradia': ['Aluguel/Financiamento', 'Condomínio', 'Água', 'Luz', 'Gás', 'Internet', 'Telefone', 'TV/Streaming', 'Manutenção', 'Faxina/Diarista'],
    'Alimentação': ['Supermercado', 'Hortifruti', 'Padaria', 'Restaurantes/Delivery', 'Café/Lanches'],
    'Transporte': ['Combustível', 'Manutenção do carro', 'IPVA/Licenciamento', 'Estacionamento/Pedágio', 'Transporte por app'],
    'Saúde': ['Plano de saúde', 'Farmácia', 'Consultas/Exames', 'Academia', 'Terapias'],
    'Vestuário': ['Roupas', 'Calçados', 'Acessórios'],
    'Entretenimento': ['Viagens/Passeios', 'Cinema/Shows', 'Assinaturas'],
    'Educação': ['Cursos', 'Livros', 'Materiais'],
    'Despesas Diversas': ['Presentes', 'Serviços pessoais', 'Imprevistos']
  },
  '2_FILHOS': {
    'Moradia': ['Aluguel/Financiamento', 'Condomínio', 'Água', 'Luz', 'Gás', 'Internet', 'Telefone', 'TV/Streaming', 'Manutenção', 'Faxina/Diarista'],
    'Alimentação': ['Supermercado', 'Hortifruti', 'Padaria', 'Restaurantes/Delivery', 'Lanches escolares', 'Alimentação infantil'],
    'Transporte': ['Combustível', 'Manutenção do carro', 'IPVA/Licenciamento', 'Transporte escolar', 'Transporte por app'],
    'Saúde': ['Plano de saúde', 'Farmácia', 'Pediatra', 'Vacinas', 'Academia'],
    'Vestuário': ['Roupas adultos', 'Roupas crianças', 'Calçados', 'Uniformes'],
    'Entretenimento': ['Viagens/Passeios', 'Cinema/Shows', 'Brinquedos', 'Festas/Aniversários'],
    'Educação': ['Escola/Mensalidade', 'Material escolar', 'Cursos extras', 'Idiomas/Esportes'],
    'Despesas Diversas': ['Presentes', 'Babá/Cuidador', 'Fraldas', 'Imprevistos']
  },
  '3_FILHOS': {
    'Moradia': ['Aluguel/Financiamento', 'Condomínio', 'Água', 'Luz', 'Gás', 'Internet', 'Telefone', 'TV/Streaming', 'Manutenção', 'Faxina/Diarista'],
    'Alimentação': ['Supermercado', 'Hortifruti', 'Padaria', 'Restaurantes/Delivery', 'Lanches escolares', 'Alimentação infantil'],
    'Transporte': ['Combustível', 'Manutenção do carro', 'IPVA/Licenciamento', 'Transporte escolar', 'Van escolar', 'Transporte por app'],
    'Saúde': ['Plano de saúde', 'Farmácia', 'Pediatra', 'Vacinas', 'Odontopediatria', 'Academia'],
    'Vestuário': ['Roupas adultos', 'Roupas crianças', 'Calçados', 'Uniformes'],
    'Entretenimento': ['Viagens/Passeios', 'Cinema/Shows', 'Brinquedos', 'Festas/Aniversários', 'Lazer familiar'],
    'Educação': ['Escola/Mensalidade', 'Material escolar', 'Cursos extras', 'Reforço escolar', 'Atividades extracurriculares'],
    'Despesas Diversas': ['Presentes', 'Babá/Cuidador', 'Fraldas', 'Imprevistos crianças']
  },
  '4_FILHOS': {
    'Moradia': ['Aluguel/Financiamento', 'Condomínio', 'Água', 'Luz', 'Gás', 'Internet', 'Telefone', 'TV/Streaming', 'Manutenção', 'Faxina/Diarista'],
    'Alimentação': ['Supermercado', 'Hortifruti', 'Padaria', 'Restaurantes/Delivery', 'Lanches escolares', 'Alimentação infantil', 'Compras em atacado'],
    'Transporte': ['Combustível', 'Manutenção do carro', 'IPVA/Licenciamento', 'Transporte escolar', 'Van escolar', 'Transporte por app'],
    'Saúde': ['Plano de saúde familiar', 'Farmácia', 'Pediatra', 'Vacinas', 'Odontopediatria', 'Coparticipações'],
    'Vestuário': ['Roupas adultos', 'Roupas crianças', 'Calçados', 'Uniformes', 'Roupas usadas/brechó'],
    'Entretenimento': ['Viagens/Passeios', 'Cinema/Shows', 'Brinquedos', 'Festas/Aniversários', 'Lazer familiar'],
    'Educação': ['Escola/Mensalidade', 'Material escolar', 'Cursos extras', 'Reforço escolar', 'Aulas particulares', 'Atividades múltiplas'],
    'Despesas Diversas': ['Presentes', 'Babá/Cuidador', 'Fraldas', 'Imprevistos crianças', 'Manutenção equipamentos']
  },
  '5_FILHOS': {
    'Moradia': ['Aluguel/Financiamento', 'Condomínio', 'Água', 'Luz', 'Gás', 'Internet', 'Telefone', 'TV/Streaming', 'Manutenção', 'Faxina/Diarista'],
    'Alimentação': ['Supermercado', 'Hortifruti', 'Padaria', 'Restaurantes/Delivery', 'Lanches escolares', 'Alimentação infantil', 'Compras em atacado'],
    'Transporte': ['Combustível', 'Manutenção do carro', 'IPVA/Licenciamento', 'Transporte escolar', 'Van escolar', 'Transporte por app', 'Veículo maior'],
    'Saúde': ['Plano de saúde familiar', 'Farmácia', 'Pediatra', 'Vacinas', 'Odontopediatria', 'Coparticipações', 'Reserva emergência saúde'],
    'Vestuário': ['Roupas adultos', 'Roupas crianças', 'Calçados', 'Uniformes', 'Roupas usadas/brechó', 'Cotas vestuário'],
    'Entretenimento': ['Viagens/Passeios', 'Cinema/Shows', 'Brinquedos', 'Festas/Aniversários', 'Lazer familiar'],
    'Educação': ['Cotas educação', 'Material escolar', 'Cursos extras', 'Reforço escolar', 'Aulas particulares', 'Atividades múltiplas'],
    'Despesas Diversas': ['Presentes', 'Babá/Cuidador', 'Fraldas', 'Imprevistos crianças', 'Manutenção equipamentos', 'Reserva emergência']
  }
};