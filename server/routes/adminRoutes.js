const express = require('express');
const router = express.Router();
const {
  getLiveQueue,
  startConsultation,
  completeConsultation,
  insertWalkIn,
  updateDoctorStatus,
  getAnalytics,
  getMLStatus,
  triggerMLTrain,
  acceptRecommendation,
  getDoctorSettings,
  updateDoctorSettings,
  getPatientHistory,
} = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/auth');

// Allow patients to view the live queue (privacy mapping is enforced inside controller)
router.get('/queue/live', protect, getLiveQueue);

// Protect other clinical orchestration endpoints to staff only
router.use(protect);
router.use(restrictTo('Doctor', 'Receptionist', 'Super Admin'));

router.get('/patients/history', getPatientHistory);

router.post('/consultation/start', startConsultation);
router.post('/consultation/complete', completeConsultation);
router.post('/walkin', insertWalkIn);
router.post('/doctor/status', updateDoctorStatus);
router.get('/doctor/settings', getDoctorSettings);
router.put('/doctor/settings', updateDoctorSettings);
router.get('/analytics', getAnalytics);
router.get('/ml/status', getMLStatus);
router.post('/ml/train', triggerMLTrain);
router.post('/ml/recommendation/accept', acceptRecommendation);

module.exports = router;
