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

module.exports = router;
