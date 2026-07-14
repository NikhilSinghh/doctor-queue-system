const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Queue = require('../models/Queue');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { updateQueuePredictions, getDynamicDoctorStatus } = require('../services/queueEngine');

// Book Appointment
const bookAppointment = async (req, res) => {
  try {
    const { 
      doctorId, appointmentDate, appointmentTime, chiefComplaint, notes, isEmergency,
      patientName, patientMobile, patientGender, patientAge 
    } = req.body;

    if (!doctorId || !appointmentDate || !appointmentTime) {
      return res.status(400).json({ success: false, message: 'Doctor, Date, and Time slot are required.' });
    }

    let patientId;

    if (patientName && patientMobile) {
      // Find or create the target patient User account
      let targetPatient = await User.findOne({ mobileNumber: patientMobile });
      if (!targetPatient) {
        const birthYear = new Date().getFullYear() - (parseInt(patientAge) || 30);
        const dob = new Date(`${birthYear}-01-01`);

        targetPatient = new User({
          fullName: patientName,
          mobileNumber: patientMobile,
          passwordHash: 'FamilyPatientHash_123',
          gender: patientGender || 'Male',
          dateOfBirth: dob,
          role: 'Patient',
        });
        await targetPatient.save();
      }
      patientId = targetPatient._id;
    } else if (req.user) {
      patientId = req.user._id;
    } else {
      return res.status(400).json({ success: false, message: 'Patient Name and Mobile Number are required for guest booking.' });
    }

    const bookingDateObj = new Date(appointmentDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (bookingDateObj < today) {
      return res.status(400).json({ success: false, message: 'Past dates are not allowed.' });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found.' });
    }

    if (doctor.bookingsEnabled === false) {
      return res.status(400).json({ success: false, message: 'Online bookings are temporarily stopped by the clinic admin.' });
    }

    // Check weekday off
    const dayOfWeek = bookingDateObj.getDay();
    if (doctor.weeklyOff.includes(dayOfWeek)) {
      return res.status(400).json({ success: false, message: 'The doctor is not available on this day of the week.' });
    }

    // Check special holiday
    const isHoliday = doctor.specialHolidays.some(
      (h) => new Date(h).toDateString() === bookingDateObj.toDateString()
    );
    if (isHoliday) {
      return res.status(400).json({ success: false, message: 'The clinic is closed on this date (Holiday).' });
    }

    // Check if patient already has a booking on this date with this doctor
    const startOfDay = new Date(appointmentDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(appointmentDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingBooking = await Appointment.findOne({
      patientId,
      doctorId,
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['Waiting', 'Consulting'] },
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active appointment booked for this day.',
      });
    }

    // Check max bookings limit for the day
    const activeDailyBookings = await Appointment.countDocuments({
      doctorId,
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['Waiting', 'Consulting', 'Completed'] },
    });

    const maxPatients = doctor.maxPatientsPerDay || 30;
    if (activeDailyBookings >= maxPatients) {
      return res.status(400).json({
        success: false,
        message: `Booking limit reached. This doctor accepts a maximum of ${maxPatients} appointments per day.`,
      });
    }

    // Calculate queue number
    const dailyBookingsCount = await Appointment.countDocuments({
      doctorId,
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
    });
    const queueNumber = dailyBookingsCount + 1;

    // Create Appointment
    const newAppointment = new Appointment({
      patientId,
      doctorId,
      appointmentDate: startOfDay,
      appointmentTime,
      queueNumber,
      chiefComplaint,
      notes,
      priority: isEmergency ? 'Emergency' : 'Routine',
      bookingSource: 'Online',
    });

    await newAppointment.save();

    // Trigger prediction update via Queue Engine
    const io = req.app.get('socketio');
    await updateQueuePredictions(doctorId, appointmentDate, io);

    // Create notification
    const notification = new Notification({
      recipientId: patientId,
      title: 'Appointment Booked',
      message: `Your appointment is confirmed for ${bookingDateObj.toDateString()} at ${appointmentTime}. Your Queue number is ${queueNumber}.`,
      type: 'Appointment',
    });
    await notification.save();

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully.',
      data: {
        appointmentId: newAppointment._id,
        queueNumber,
        appointmentTime,
        appointmentDate: newAppointment.appointmentDate,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Cancel Appointment
const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    // Verify it's their own appointment (Patients can only cancel their own)
    if (req.user.role === 'Patient' && appointment.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    appointment.status = 'Cancelled';
    await appointment.save();

    // Trigger queue recalculation
    const io = req.app.get('socketio');
    await updateQueuePredictions(appointment.doctorId, appointment.appointmentDate, io);

    // Create notification
    const notification = new Notification({
      recipientId: appointment.patientId,
      title: 'Appointment Cancelled',
      message: `Your appointment (Queue #${appointment.queueNumber}) has been cancelled successfully.`,
      type: 'Appointment',
    });
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Appointment cancelled successfully.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get My Profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-passwordHash');
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update My Profile
const updateProfile = async (req, res) => {
  try {
    const { fullName, email, address, darkMode, notificationPreference, language, travelTime } = req.body;
    const user = await User.findById(req.user._id);

    if (fullName) user.fullName = fullName;
    if (email) user.email = email;
    if (address) user.address = address;
    if (darkMode !== undefined) user.darkMode = darkMode;
    if (notificationPreference) user.notificationPreference = notificationPreference;
    if (language) user.language = language;
    if (travelTime !== undefined) user.travelTime = travelTime;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        mobileNumber: user.mobileNumber,
        role: user.role,
        darkMode: user.darkMode,
        language: user.language,
        travelTime: user.travelTime,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get My Appointments
const getMyAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ patientId: req.user._id })
      .populate('doctorId', 'doctorName specialization hospitalName')
      .sort({ appointmentDate: -1, queueNumber: -1 });

    res.status(200).json({ success: true, data: appointments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get My Notifications
const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipientId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Public Queue (Unauthenticated)
const getPublicQueue = async (req, res) => {
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
      const io = req.app.get('socketio');
      const { updateQueuePredictions } = require('../services/queueEngine');
      queue = await updateQueuePredictions(doctorId, todayStart.toDateString(), io);
    }

    const appointments = await Appointment.find({
      doctorId,
      appointmentDate: { $gte: todayStart, $lte: todayEnd },
      status: { $in: ['Waiting', 'Consulting'] },
    }).sort({ queueNumber: 1 });

    const shieldedQueue = appointments.map((appt) => {
      const avatarSeed = appt._id.toString().slice(-4);
      return {
        appointmentId: appt._id,
        queueNumber: null, // Shield queue numbers for public
        priority: appt.priority,
        status: appt.status,
        predictedConsultationTime: null,
        predictedWaitingTime: null,
        isMine: false,
        avatarSeed,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        doctorId: queue.doctorId,
        doctorStatus: getDynamicDoctorStatus(doctor, targetDate, queue),
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

// Get Public Doctor Profile
const getDoctorProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await Doctor.findById(id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }
    res.status(200).json({
      success: true,
      data: {
        id: doctor._id,
        doctorName: doctor.doctorName,
        specialization: doctor.specialization,
        qualification: doctor.qualification,
        experience: doctor.experience,
        hospitalName: doctor.hospitalName,
        clinicAddress: doctor.clinicAddress,
        feesNormal: doctor.feesNormal,
        feesEmergency: doctor.feesEmergency,
        feesFollowUp: doctor.feesFollowUp,
        weeklyOff: doctor.weeklyOff,
        specialHolidays: doctor.specialHolidays,
        maxPatientsPerDay: doctor.maxPatientsPerDay || 30,
        hospitalOpeningTime: doctor.hospitalOpeningTime,
        hospitalClosingTime: doctor.hospitalClosingTime,
        status: doctor.status,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  bookAppointment,
  cancelAppointment,
  getProfile,
  updateProfile,
  getMyAppointments,
  getMyNotifications,
  getPublicQueue,
  getDoctorProfile,
};
