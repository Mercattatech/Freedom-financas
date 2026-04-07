const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const prisma = new PrismaClient();
router.use(authenticateToken);

// GET /api/subcategories
router.get('/', async (req, res) => {
  try {
    const subcategories = await prisma.subcategory.findMany();
    
    // Convert back from Prisma column names to frontend aliases
    res.json(subcategories.map(s => ({
      id: s.id,
      nome: s.nome,
      category_id: s.category_id
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/subcategories
router.post('/', async (req, res) => {
  try {
    const { ...data } = req.body;
    
    const sub = await prisma.subcategory.create({
      data: {
        nome: data.nome,
        category_id: data.category_id
      }
    });
    
    res.status(201).json({
      id: sub.id,
      nome: sub.nome,
      category_id: sub.category_id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/subcategories/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, category_id, ativo } = req.body;
    const sub = await prisma.subcategory.update({
      where: { id },
      data: {
        ...(nome !== undefined && { nome }),
        ...(category_id !== undefined && { category_id }),
        ...(ativo !== undefined && { ativo })
      }
    });
    res.json(sub);
  } catch (error) {
    console.error('Erro ao atualizar subcategoria:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/subcategories/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.subcategory.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir subcategoria:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
