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

module.exports = router;
