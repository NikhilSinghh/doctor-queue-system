const express = require('express');
const router = express.Router();
const { register, registerStaff, login, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect, restrictTo } = require('../middleware/auth');

router.post('/register', register);
router.post('/register-staff', protect, restrictTo('Super Admin'), registerStaff);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
