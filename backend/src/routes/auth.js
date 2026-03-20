const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');

const prisma = new PrismaClient();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ status: 400, message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

      const user = await prisma.user.create({
        data: {
          email,
          full_name: name,
          password: hashedPassword,
          otpCode,
          is_verified: false,
          role: 'user'
        }
      });

    // In a real app we would send the email here.
    console.log(`[AUTH SERVER] Registrando ${email}... OTP CÓDIGO gerado: ${otpCode}`);

    res.status(201).json({ 
      status: 201, 
      data: { 
        id: user.id, 
        email: user.email, 
        _dev_otp: otpCode // sending back just to simulate email for local dev
      } 
    });
  } catch (error) {
    res.status(500).json({ status: 500, message: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ status: 401, message: 'Email ou senha incorretos' });
    }

    if (user.disabled) {
      return res.status(403).json({ status: 403, message: 'Sua conta está desativada por falta de pagamento ou suspensão.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ status: 401, message: 'Email ou senha incorretos' });
    }

    if (!user.is_verified) {
      return res.status(403).json({ status: 403, message: 'verify your email' });
    }

    // Generate JWT
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({
      access_token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        must_change_password: user.must_change_password
      }
    });
  } catch (error) {
    res.status(500).json({ status: 500, message: error.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ 
      where: { id: req.user.id },
      select: { id: true, email: true, full_name: true, role: true, is_verified: true, created_date: true, disabled: true, must_change_password: true }
    });
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.disabled) return res.status(403).json({ message: 'User suspended' });
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ status: 500, message: error.message });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otpCode } = req.body;
    
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.otpCode !== otpCode) {
      return res.status(400).json({ status: 400, message: 'Código inválido ou expirado' });
    }

    await prisma.user.update({
      where: { email },
      data: { is_verified: true, otpCode: null } // clean OTP after success
    });

    res.json({ success: true, message: 'Email verified' });
  } catch (error) {
    res.status(500).json({ status: 500, message: error.message });
  }
});

// POST /api/auth/resend-otp
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();

    const user = await prisma.user.update({
      where: { email },
      data: { otpCode: newOtp }
    });

    console.log(`[AUTH SERVER] Reenviando OTP para ${email}... NOVO CÓDIGO: ${newOtp}`);

    res.json({ success: true, _dev_otp: newOtp });
  } catch (error) {
    res.status(500).json({ status: 500, message: error.message });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Return success anyway to prevent email enumeration
      return res.json({ success: true, message: 'Se o email existir, um link de recuperação foi enviado.' });
    }

    // Generate a reset token (expires in 1h)
    const resetToken = jwt.sign(
      { id: user.id, purpose: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    const requestHost = 'http://localhost:5173'; // Force frontend port for local testing
    const resetLink = `${requestHost}/ResetPassword?token=${resetToken}`;

    console.log('\n======================================================');
    console.log('🚨 LINK DE RECUPERAÇÃO DE SENHA GERADO 🚨');
    console.log(`Para o usuário: ${email}`);
    console.log(`Acesse este link para redefinir: ${resetLink}`);
    console.log('======================================================\n');

    return res.json({ success: true, message: 'Verifique o log do servidor (Node) para clicar no link!' });
  } catch (error) {
    console.error('Error in forgot-password:', error);
    res.status(500).json({ status: 500, message: 'Erro interno ao processar a solicitação.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ status: 400, message: 'Dados inválidos.' });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ status: 400, message: 'Link inválido ou expirado.' });
    }

    if (decoded.purpose !== 'password_reset') {
      return res.status(400).json({ status: 400, message: 'Token inválido.' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await prisma.user.update({
      where: { id: decoded.id },
      data: { password: hashedPassword }
    });

    return res.json({ success: true, message: 'Senha redefinida com sucesso!' });
  } catch (error) {
    console.error('Error in reset-password:', error);
    res.status(500).json({ status: 500, message: 'Erro interno ao redefinir a senha.' });
  }
});

// POST /api/auth/update-password-first-access
router.post('/update-password-first-access', authenticateToken, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ status: 400, message: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword, must_change_password: false }
    });

    res.json({ success: true, message: 'Senha atualizada com sucesso!' });
  } catch (error) {
    res.status(500).json({ status: 500, message: 'Erro interno ao atualizar a senha.' });
  }
});

module.exports = router;
