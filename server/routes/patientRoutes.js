const express = require('express');
const router = express.Router();
const {
  bookAppointment,
  cancelAppointment,
  getProfile,
  updateProfile,
  getMyAppointments,
  getMyNotifications,
  getPublicQueue,
  getDoctorProfile,
} = require('../controllers/patientController');
const { protect } = require('../middleware/auth');

// Public patient routes (unauthenticated)
router.get('/queue/public', getPublicQueue);
router.get('/doctor/:id', getDoctorProfile);
router.post('/book', bookAppointment);

router.use(protect); // protect all subsequent patient routes

router.put('/cancel/:id', cancelAppointment);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/appointments', getMyAppointments);
router.get('/notifications', getMyNotifications);

module.exports = router;
