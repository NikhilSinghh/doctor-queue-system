const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Queue = require('../models/Queue');
const User = require('../models/User');
const ConsultationHistory = require('../models/ConsultationHistory');
const Settings = require('../models/Settings');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const { updateQueuePredictions, checkAndTrainModel } = require('../services/queueEngine');

// Create Audit Log Entry
const logAudit = async (userId, action, details, req) => {
  try {
    const log = new AuditLog({
      userId,
      action,
      details,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    await log.save();
  } catch (err) {
    console.error('Audit logging failed:', err);
  }
};

// Get Live Queue with strict Privacy Controls
const getLiveQueue = async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId) {
      return res.status(400).json({ success: false, message: 'Doctor ID is required.' });
    }

    const targetDate = date ? new Date(date) : new Date();
    const todayStart = new Date(targetDate);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(targetDate);
    todayEnd.setHours(23, 59, 59, 999);

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    let queue = await Queue.findOne({ doctorId, date: { $gte: todayStart, $lte: todayEnd } });
    if (!queue) {
      // Re-trigger/initialise
      const io = req.app.get('socketio');
      queue = await updateQueuePredictions(doctorId, todayStart.toDateString(), io);
    }

    // Populate active appointments with user details
    const appointments = await Appointment.find({
      doctorId,
      appointmentDate: { $gte: todayStart, $lte: todayEnd },
      status: { $in: ['Waiting', 'Consulting'] },
    })
      .sort({ queueNumber: 1 })
      .populate('patientId', 'fullName mobileNumber gender dateOfBirth');

    const clientRole = req.user ? req.user.role : 'Patient';
    const isMedicalStaff = ['Doctor', 'Receptionist', 'Super Admin'].includes(clientRole);

    // Map appointments applying security shielding for patients
    const shieldedQueue = appointments.map((appt, idx) => {
      const isMine = req.user && appt.patientId._id.toString() === req.user._id.toString();

      if (isMedicalStaff) {
        // Staff sees full data
        return {
          appointmentId: appt._id,
          queueNumber: appt.queueNumber,
          priority: appt.priority,
          status: appt.status,
          predictedConsultationTime: appt.predictedConsultationTime,
          predictedWaitingTime: appt.predictedWaitingTime,
          patient: {
            id: appt.patientId._id,
            fullName: appt.patientId.fullName,
            mobileNumber: appt.patientId.mobileNumber,
            gender: appt.patientId.gender,
            age: new Date().getFullYear() - appt.patientId.dateOfBirth.getFullYear(),
          },
          chiefComplaint: appt.chiefComplaint,
          isMine,
        };
      } else {
        // Patients see shielded anonymous details
        // To support animated queue, generate a consistent avatar variation seed based on appointmentId hash
        const avatarSeed = appt._id.toString().slice(-4);
        
        return {
          appointmentId: appt._id,
          queueNumber: isMine ? appt.queueNumber : null, // Shield queue numbers of others
          priority: appt.priority,
          status: appt.status,
          predictedConsultationTime: isMine ? appt.predictedConsultationTime : null,
          predictedWaitingTime: isMine ? appt.predictedWaitingTime : null,
          isMine,
          avatarSeed, // For drawing avatar types deterministically on frontend
          // Shield all PII: name, age, phone number, medical complaint
        };
      }
    });

    res.status(200).json({
      success: true,
      data: {
        doctorId: queue.doctorId,
        doctorStatus: doctor.status,
        currentServingNumber: queue.currentServingNumber,
        currentQueueLength: queue.currentQueueLength,
        estimatedAverageTime: queue.estimatedAverageTime,
        doctorDelay: queue.doctorDelay,
        lunchDelay: queue.lunchDelay,
        queueList: shieldedQueue,
        lunchStart: doctor.lunchStart,
        lunchEnd: doctor.lunchEnd,
        maxPatientsPerDay: doctor.maxPatientsPerDay || 30,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Start Consultation
const startConsultation = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const appt = await Appointment.findById(appointmentId);

    if (!appt) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    appt.status = 'Consulting';
    appt.actualConsultationStart = new Date();
    await appt.save();

    // Update serving number in daily queue
    const todayStart = new Date(appt.appointmentDate);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(appt.appointmentDate);
    todayEnd.setHours(23, 59, 59, 999);

    const queue = await Queue.findOne({ doctorId: appt.doctorId, date: { $gte: todayStart, $lte: todayEnd } });
    if (queue) {
      queue.currentServingNumber = appt.queueNumber;
      await queue.save();
    }

    // Trigger update and socket push
    const io = req.app.get('socketio');
    await updateQueuePredictions(appt.doctorId, appt.appointmentDate, io);

    // Notify patient
    const notification = new Notification({
      recipientId: appt.patientId,
      title: 'Consultation Started',
      message: 'The doctor is ready for you. Please step into the cabin.',
      type: 'DoctorStatus',
    });
    await notification.save();
    if (io) {
      io.emit(`notification_${appt.patientId}`, {
        title: 'Consultation Started',
        message: 'The doctor is ready for you. Please step into the cabin.',
      });
    }

    await logAudit(req.user._id, 'START_CONSULTATION', `Started appt ${appointmentId} (Queue #${appt.queueNumber})`, req);

    res.status(200).json({ success: true, message: 'Consultation started successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Complete Consultation
const completeConsultation = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const appt = await Appointment.findById(appointmentId);

    if (!appt) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    const start = appt.actualConsultationStart ? new Date(appt.actualConsultationStart) : new Date();
    const end = new Date();
    const duration = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));

    appt.status = 'Completed';
    appt.actualConsultationEnd = end;
    appt.actualConsultationDuration = duration;
    await appt.save();

    // Fetch doctor default timings
    const doctor = await Doctor.findById(appt.doctorId);
    const todayStart = new Date(appt.appointmentDate);
    todayStart.setHours(0, 0, 0, 0);

    const holidayFlag = doctor.specialHolidays.some(h => h.toDateString() === todayStart.toDateString()) ? 1 : 0;
    const peakHourFlag = [10, 11, 12, 16, 17].includes(start.getHours()) ? 1 : 0;

    // Load queue configuration to record delay details
    const queue = await Queue.findOne({
      doctorId: appt.doctorId,
      date: { $gte: todayStart, $lte: new Date(appt.appointmentDate).setHours(23,59,59,999) }
    });

    // Record in historical database for training
    const history = new ConsultationHistory({
      patientId: appt.patientId,
      doctorId: appt.doctorId,
      appointmentId: appt._id,
      queuePosition: appt.queueNumber,
      appointmentTime: appt.appointmentTime,
      consultationStart: start,
      consultationEnd: end,
      consultationDuration: duration,
      waitingDuration: appt.predictedWaitingTime || 0,
      doctorDelay: queue ? queue.doctorDelay : 0,
      lunchDelay: queue ? queue.lunchDelay : 0,
      emergencyDelay: appt.priority === 'Emergency' ? 20 : 0,
      walkInsBefore: appt.priority === 'Walk-in' ? 1 : 0,
      weekday: todayStart.getDay(),
      month: todayStart.getMonth() + 1,
      holidayFlag,
      peakHourFlag,
    });
    await history.save();

    // Recalculate remaining queue
    const io = req.app.get('socketio');
    await updateQueuePredictions(appt.doctorId, appt.appointmentDate, io);

    // Dynamic warning alert to other patients remaining
    // Trigger notification if a user is next in line
    const remaining = await Appointment.find({
      doctorId: appt.doctorId,
      appointmentDate: todayStart,
      status: 'Waiting'
    }).sort({ queueNumber: 1 }).limit(3);

    if (remaining.length > 0 && io) {
      remaining.forEach(async (patientAppt, index) => {
        let msg = '';
        if (index === 0) msg = 'You are next! Please be ready outside the cabin.';
        else msg = `There are only ${index + 1} patients ahead of you in the queue.`;

        const notification = new Notification({
          recipientId: patientAppt.patientId,
          title: 'Queue Moving Up',
          message: msg,
          type: 'QueueUpdate',
        });
        await notification.save();
        io.emit(`notification_${patientAppt.patientId}`, { title: 'Queue Update', message: msg });
      });
    }

    // Weekly/daily checks to suggest recommendations
    // If training history increases, trigger checking and train ML
    const totalConsultations = await ConsultationHistory.countDocuments({ doctorId: doctor._id });
    if (totalConsultations % 50 === 0) {
      // Background train checks
      checkAndTrainModel().then((res) => {
        console.log('Periodic ML Auto-Retrain result:', res);
      });
    }

    await logAudit(req.user._id, 'COMPLETE_CONSULTATION', `Completed appt ${appointmentId} (Duration: ${duration}m)`, req);

    res.status(200).json({ success: true, message: 'Consultation completed.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Insert Walk-in / Emergency Patient
const insertWalkIn = async (req, res) => {
  try {
    const { fullName, mobileNumber, gender, dateOfBirth, chiefComplaint, isEmergency, doctorId, appointmentDate } = req.body;

    if (!fullName || !mobileNumber || !doctorId) {
      return res.status(400).json({ success: false, message: 'Full Name, Mobile Number, and Doctor are required.' });
    }

    // Find or create Patient user account
    let patient = await User.findOne({ mobileNumber });
    if (!patient) {
      patient = new User({
        fullName,
        mobileNumber,
        email: `walkin_${mobileNumber}@ashaneurology.com`,
        passwordHash: 'WalkInPatientHash_123', // Dummy password for walk-in accounts
        gender: gender || 'Male',
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date('1990-01-01'),
        role: 'Patient',
      });
      await patient.save();
    }

    const todayStart = appointmentDate ? new Date(appointmentDate) : new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    const queue = await Queue.findOne({ doctorId, date: { $gte: todayStart, $lte: todayEnd } });
    const currentServed = queue ? queue.currentServingNumber : 0;

    let targetQueueNum = 1;
    const countToday = await Appointment.countDocuments({
      doctorId,
      appointmentDate: { $gte: todayStart, $lte: todayEnd },
    });

    if (isEmergency) {
      // Place emergency case right after current serving index
      targetQueueNum = currentServed + 1;
      // Shift all other pending queue positions down by 1
      await Appointment.updateMany(
        {
          doctorId,
          appointmentDate: { $gte: todayStart, $lte: todayEnd },
          queueNumber: { $gte: targetQueueNum },
          status: 'Waiting',
        },
        { $inc: { queueNumber: 1 } }
      );
    } else {
      // Normal walk-in appended to back
      targetQueueNum = countToday + 1;
    }

    const hour = new Date().getHours().toString().padStart(2, '0');
    const min = new Date().getMinutes().toString().padStart(2, '0');

    const appointment = new Appointment({
      patientId: patient._id,
      doctorId,
      appointmentDate: todayStart,
      appointmentTime: `${hour}:${min}`,
      queueNumber: targetQueueNum,
      priority: isEmergency ? 'Emergency' : 'Walk-in',
      bookingSource: 'Walk-in',
      chiefComplaint: chiefComplaint || (isEmergency ? 'Emergency Triage' : 'Routine walk-in consultation'),
      status: 'Waiting',
    });
    await appointment.save();

    // Trigger update
    const io = req.app.get('socketio');
    await updateQueuePredictions(doctorId, todayStart.toDateString(), io);

    await logAudit(req.user._id, 'INSERT_WALKIN', `Inserted ${isEmergency ? 'Emergency' : 'Walk-in'} (Queue #${targetQueueNum})`, req);

    res.status(201).json({
      success: true,
      message: `${isEmergency ? 'Emergency' : 'Walk-in'} appointment registered.`,
      data: { queueNumber: targetQueueNum },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Set Doctor Status / Delays
const updateDoctorStatus = async (req, res) => {
  try {
    const { doctorId, status, delayMinutes, isLunch } = req.body;
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found.' });

    if (status) {
      doctor.status = status;
      await doctor.save();
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const queue = await Queue.findOne({ doctorId, date: { $gte: todayStart, $lte: new Date().setHours(23,59,59,999) } });
    if (queue) {
      if (delayMinutes !== undefined) {
        queue.doctorDelay = delayMinutes;
      }
      if (isLunch !== undefined) {
        queue.lunchDelay = isLunch ? 45 : 0; // standard 45m lunch shift
      }
      await queue.save();
    }

    // Trigger recalcs
    const io = req.app.get('socketio');
    await updateQueuePredictions(doctorId, todayStart.toDateString(), io);

    // Broadcast doctor status update
    if (io) {
      io.emit('doctorStatusChanged', { doctorId, status: doctor.status, delayMinutes, isLunch });
    }

    await logAudit(req.user._id, 'UPDATE_DOCTOR_STATUS', `Status: ${doctor.status}, Delay: ${delayMinutes}m`, req);

    res.status(200).json({ success: true, message: 'Doctor status/delays updated.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Fetch Analytics Panel
const getAnalytics = async (req, res) => {
  try {
    const { doctorId } = req.query;
    const filter = doctorId ? { doctorId: new mongoose.Types.ObjectId(doctorId) } : {};

    // 1. Total status counts
    const statusCounts = await Appointment.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // 2. Average waiting and consultation time
    const historyAvg = await ConsultationHistory.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          avgConsultation: { $avg: '$consultationDuration' },
          avgWaiting: { $avg: '$waitingDuration' },
        },
      },
    ]);

    // 3. Weekly visitors
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weeklyData = await ConsultationHistory.aggregate([
      { $match: { ...filter, createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dayOfWeek: '$createdAt' },
          count: { $sum: 1 },
          avgDuration: { $avg: '$consultationDuration' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 4. Visitors per hour (Peak times)
    const hourlyData = await ConsultationHistory.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $hour: '$consultationStart' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        statusCounts,
        averages: historyAvg[0] || { avgConsultation: 7, avgWaiting: 0 },
        weeklyData,
        hourlyData,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Machine Learning Panel Status
const getMLStatus = async (req, res) => {
  try {
    const { doctorId } = req.query;
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor profile not found.' });

    const totalSamples = await ConsultationHistory.countDocuments({ doctorId });

    // Load saved metrics.json if exists
    const metricsPath = path.join(__dirname, '..', 'ml', 'models', 'metrics.json');
    let mlMetrics = null;

    if (fs.existsSync(metricsPath)) {
      try {
        const raw = fs.readFileSync(metricsPath);
        mlMetrics = JSON.parse(raw);
      } catch (err) {
        console.error('Error reading ML metrics file:', err);
      }
    }

    // Generate weekly consultation recommendation
    // Suggest recommended value if average significantly diverges
    let recommendation = null;
    if (totalSamples >= 50) {
      const avgQuery = await ConsultationHistory.aggregate([
        { $match: { doctorId: doctor._id } },
        { $group: { _id: null, avgVal: { $avg: '$consultationDuration' } } },
      ]);

      if (avgQuery.length > 0) {
        const historicAverage = parseFloat(avgQuery[0].avgVal.toFixed(1));
        const roundedAvg = Math.round(historicAverage);
        const diff = Math.abs(historicAverage - doctor.consultationDurationDefault);

        if (doctor.consultationDurationManualOverride !== true) {
          // Automatically set as default
          if (doctor.consultationDurationDefault !== roundedAvg) {
            doctor.consultationDurationDefault = roundedAvg;
            doctor.consultationDurationRecommended = undefined;
            await doctor.save();
          }
        } else if (diff >= 0.5) {
          // If manual override is active, provide a recommendation alert instead of overriding
          recommendation = {
            currentDefault: doctor.consultationDurationDefault,
            suggested: roundedAvg,
            exactSuggested: historicAverage,
            totalSamples,
          };
          if (doctor.consultationDurationRecommended !== roundedAvg) {
            doctor.consultationDurationRecommended = roundedAvg;
            await doctor.save();
          }
        }
      }
    }

    res.status(200).json({
      success: true,
      data: {
        totalSamples,
        currentDefault: doctor.consultationDurationDefault,
        mlMetrics,
        recommendation,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Trigger manual ML retrain
const triggerMLTrain = async (req, res) => {
  try {
    const result = await checkAndTrainModel();
    if (result.success) {
      res.status(200).json({ success: true, message: 'Machine learning model trained successfully.', data: result });
    } else {
      res.status(400).json({ success: false, message: result.error || 'Training failed.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Accept ML consultation duration recommendation
const acceptRecommendation = async (req, res) => {
  try {
    const { doctorId } = req.body;
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor profile not found.' });

    if (!doctor.consultationDurationRecommended) {
      return res.status(400).json({ success: false, message: 'No recommendation active.' });
    }

    const prev = doctor.consultationDurationDefault;
    doctor.consultationDurationDefault = doctor.consultationDurationRecommended;
    doctor.consultationDurationRecommended = undefined;
    await doctor.save();

    await logAudit(req.user._id, 'ACCEPT_ML_RECOMMENDATION', `Updated default consultation duration from ${prev}m to ${doctor.consultationDurationDefault}m`, req);

    res.status(200).json({
      success: true,
      message: `Updated average consultation duration to ${doctor.consultationDurationDefault} minutes.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Doctor Settings
const getDoctorSettings = async (req, res) => {
  try {
    const { doctorId } = req.query;
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found.' });

    res.status(200).json({
      success: true,
      data: {
        consultationDurationDefault: doctor.consultationDurationDefault,
        consultationDurationManualOverride: doctor.consultationDurationManualOverride || false,
        hospitalOpeningTime: doctor.hospitalOpeningTime || '09:00',
        hospitalClosingTime: doctor.hospitalClosingTime || '17:00',
        maxPatientsPerDay: doctor.maxPatientsPerDay || 30,
        weeklyOff: doctor.weeklyOff,
        specialHolidays: doctor.specialHolidays,
        status: doctor.status,
        bookingsEnabled: doctor.bookingsEnabled !== false,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Doctor Settings
const updateDoctorSettings = async (req, res) => {
  try {
    const { 
      doctorId, consultationDurationDefault, consultationDurationManualOverride,
      hospitalOpeningTime, hospitalClosingTime, maxPatientsPerDay, weeklyOff, 
      specialHolidays, bookingsEnabled 
    } = req.body;
    
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found.' });

    if (consultationDurationDefault !== undefined) doctor.consultationDurationDefault = consultationDurationDefault;
    if (consultationDurationManualOverride !== undefined) doctor.consultationDurationManualOverride = consultationDurationManualOverride;
    if (hospitalOpeningTime !== undefined) doctor.hospitalOpeningTime = hospitalOpeningTime;
    if (hospitalClosingTime !== undefined) doctor.hospitalClosingTime = hospitalClosingTime;
    if (maxPatientsPerDay !== undefined) doctor.maxPatientsPerDay = maxPatientsPerDay;
    if (weeklyOff !== undefined) doctor.weeklyOff = weeklyOff;
    if (specialHolidays !== undefined) doctor.specialHolidays = specialHolidays;
    if (bookingsEnabled !== undefined) doctor.bookingsEnabled = bookingsEnabled;

    await doctor.save();

    res.status(200).json({
      success: true,
      message: 'Doctor settings updated successfully.',
      data: doctor
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
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
};
