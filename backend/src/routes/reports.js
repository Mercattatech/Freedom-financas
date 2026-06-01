const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const prisma = new PrismaClient();
const router = express.Router();

router.use(authenticateToken);

router.get('/analytical', async (req, res) => {
  try {
    const { family_id, startDate, endDate } = req.query;

    if (!family_id || !startDate || !endDate) {
      return res.status(400).json({ error: 'Faltam parâmetros: family_id, startDate, endDate' });
    }

    // Validar se o usuário tem acesso à família
    const userFamily = await prisma.family.findFirst({
      where: { id: family_id, created_by: req.user.email }
    });

    if (!userFamily && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso Negado.' });
    }

    const [incomes, expenses] = await Promise.all([
      prisma.income.findMany({
        where: {
          family_id,
          data_recebimento: { gte: startDate, lte: endDate }
        },
        include: { category: true }
      }),
      prisma.expense.findMany({
        where: {
          family_id,
          data: { gte: startDate, lte: endDate }
        },
        include: { category: true }
      })
    ]);

    res.json({
      incomes,
      expenses
    });
  } catch (error) {
    console.error('Error in /analytical:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório analítico' });
  }
});

module.exports = router;
