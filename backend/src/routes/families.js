const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const prisma = new PrismaClient();

// Aplica autenticação em todas rotas de familias
router.use(authenticateToken);

// GET /api/families
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const families = await prisma.family.findMany({
      where: isAdmin ? undefined : { 
        created_by: req.user.email 
      }
    });
    res.json(families);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/families
router.post('/', async (req, res) => {
  try {
    const family = await prisma.$transaction(async (tx) => {
      const fam = await tx.family.create({
        data: {
          ...req.body,
          created_by: req.user.email
        }
      });

      // Gerar o pacote inicial de categorias para esta família
      const defaultCategories = [
        { nome: 'Moradia', tipo: 'DESPESA', cor: '#3B82F6', icone: 'Home', subs: ['Aluguel', 'Condomínio', 'Luz', 'Água', 'Internet'] },
        { nome: 'Alimentação', tipo: 'DESPESA', cor: '#F59E0B', icone: 'Utensils', subs: ['Supermercado', 'Restaurante', 'Padaria', 'Delivery'] },
        { nome: 'Transporte', tipo: 'DESPESA', cor: '#6366F1', icone: 'Car', subs: ['Combustível', 'Aplicativo', 'Estacionamento', 'Manutenção'] },
        { nome: 'Saúde', tipo: 'DESPESA', cor: '#10B981', icone: 'HeartPulse', subs: ['Plano de Saúde', 'Farmácia', 'Consultas', 'Exames'] },
        { nome: 'Lazer', tipo: 'DESPESA', cor: '#EC4899', icone: 'Smile', subs: ['Cinema', 'Shows', 'Viagens', 'Hobbys'] },
        { nome: 'Educação', tipo: 'DESPESA', cor: '#8B5CF6', icone: 'GraduationCap', subs: ['Mensalidade', 'Cursos', 'Material Escolar', 'Livros'] },
        { nome: 'Salário', tipo: 'RECEITA', cor: '#10B981', icone: 'Wallet', subs: ['Principal', 'Adiantamento', 'Férias', '13º Salário'] },
        { nome: 'Investimentos', tipo: 'RECEITA', cor: '#3B82F6', icone: 'TrendingUp', subs: ['Dividendos', 'Rendimentos', 'Resgates'] }
      ];

      for (const cat of defaultCategories) {
        const createdCat = await tx.category.create({
          data: {
            nome: cat.nome,
            tipo: cat.tipo,
            cor: cat.cor,
            icone: cat.icone,
            family_id: fam.id,
            ativo: true
          }
        });

        for (const subName of cat.subs) {
          await tx.subcategory.create({
            data: {
              nome: subName,
              category_id: createdCat.id,
              ativo: true
            }
          });
        }
      }

      return fam;
    });

    res.status(201).json(family);
  } catch (error) {
    console.error('[Create Family Error]', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/families/:id
router.put('/:id', async (req, res) => {
  try {
    const family = await prisma.family.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(family);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/families/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.family.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
