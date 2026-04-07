const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const prisma = new PrismaClient();
router.use(authenticateToken);

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const { family_id } = req.query;
    if (!family_id) return res.json([]);
    
    // Na vida real, verificariamos se a familia pertence ao usuario logado
    const categories = await prisma.category.findMany({
      where: { family_id }
    });
    res.json(categories);
  } catch (error) {
    console.error('[GET /api/categories Error]', error, 'Query:', req.query);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/categories
router.post('/', async (req, res) => {
  try {
    const { ...data } = req.body;
    // Opcional no Prisma: Quando criamos, passamos o family_id que o frontend ta mandando diretamente
    const category = await prisma.category.create({
      data: {
        nome: data.nome,
        tipo: data.tipo,
        cor: data.cor,
        icone: data.icone,
        family_id: data.family_id
      }
    });
    // O frontend proxy espera os mesmos parametros "traduzidos" de volta
    res.status(201).json({
      id: category.id,
      nome: category.nome,
      tipo: category.tipo,
      cor: category.cor,
      icone: category.icone,
      family_id: category.family_id
    });
  } catch (error) {
    console.error('Erro ao criar categoria:', error.message, req.body);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/categories/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, tipo, cor, icone, ordem_exibicao, ativo } = req.body;
    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(nome !== undefined && { nome }),
        ...(tipo !== undefined && { tipo }),
        ...(cor !== undefined && { cor }),
        ...(icone !== undefined && { icone }),
        ...(ordem_exibicao !== undefined && { ordem_exibicao }),
        ...(ativo !== undefined && { ativo })
      }
    });
    res.json(category);
  } catch (error) {
    console.error('Erro ao atualizar categoria:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/categories/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.$transaction(async (tx) => {
      // 1. Desvincula subcategorias de despesas (set null)
      await tx.expense.updateMany({
        where: { subcategory_id: { in: (await tx.subcategory.findMany({ where: { category_id: id }, select: { id: true } })).map(s => s.id) } },
        data: { subcategory_id: null }
      });

      // 2. Remove o category_id das despesas
      await tx.expense.updateMany({
        where: { category_id: id },
        data: { category_id: null }
      });

      // 3. Remove o category_id dos budgets (se existir)
      try {
        await tx.budget.updateMany({
          where: { category_id: id },
          data: { category_id: null }
        });
      } catch (_) {}

      // 4. Deleta as subcategorias
      await tx.subcategory.deleteMany({ where: { category_id: id } });

      // 5. Finalmente deleta a categoria
      await tx.category.delete({ where: { id } });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir categoria:', error.message);
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;
