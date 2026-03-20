const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const prisma = new PrismaClient();

router.use(authenticateToken);

// GET /api/goals (pass ?family_id=123 to filter)
router.get('/', async (req, res) => {
  try {
    const { family_id } = req.query;
    
    // Filtro dinamico
    const whereClause = {};
    if (family_id) {
      whereClause.family_id = family_id;
    }

    const goals = await prisma.goal.findMany({ where: whereClause });
    res.json(goals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/goals
router.post('/', async (req, res) => {
  try {
    const goal = await prisma.goal.create({
      data: req.body
    });
    res.status(201).json(goal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/goals/:id
router.put('/:id', async (req, res) => {
  try {
    const goal = await prisma.goal.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(goal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/goals/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.goal.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
