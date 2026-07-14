const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ConsultationHistory = require('../models/ConsultationHistory');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Queue = require('../models/Queue');

// Run offline Python prediction
const runPythonPrediction = async (inputData) => {
  try {
    const response = await fetch('http://127.0.0.1:8000/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(inputData),
    });
    if (!response.ok) {
      console.warn(`FastAPI Prediction returned status ${response.status}. Falling back.`);
      return null;
    }
    const result = await response.json();
    if (result.success) {
      return result.prediction;
    } else {
      console.error('FastAPI ML execution error:', result.error);
      return null;
    }
  } catch (err) {
    console.warn('FastAPI Prediction service connection failed. Falling back to baseline calculations.', err.message);
    return null;
  }
};

// Calculate Weighted Moving Average (WMA)
const calculateWMA = (history, count = 20) => {
  if (history.length === 0) return 7;
  const subset = history.slice(-count);
  let weightedSum = 0;
  let weightSum = 0;

  subset.forEach((record, index) => {
    const weight = index + 1; // Later consultations get higher weight
    weightedSum += record.consultationDuration * weight;
    weightSum += weight;
  });

  return weightedSum / weightSum;
};

// Main Smart Queue Engine Logic
const updateQueuePredictions = async (doctorId, dateStr, ioInstance = null) => {
  try {
    const startOfDay = new Date(dateStr);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(dateStr);
    endOfDay.setHours(23, 59, 59, 999);

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) throw new Error('Doctor not found');

    // Fetch daily queue doc or create one
    let queue = await Queue.findOne({ doctorId, date: { $gte: startOfDay, $lte: endOfDay } });
    if (!queue) {
      queue = new Queue({
        doctorId,
        date: startOfDay,
        currentServingNumber: 0,
        currentQueueLength: 0,
        estimatedAverageTime: doctor.consultationDurationDefault,
      });
    }

    // Fetch active appointments (Waiting/Consulting)
    const appointments = await Appointment.find({
      doctorId,
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['Waiting', 'Consulting'] },
    }).sort({ queueNumber: 1 });

    // Fetch total completed consultations for this doctor to determine hybrid prediction stage
    const completedCount = await ConsultationHistory.countDocuments({ doctorId });
    const historyRecords = await ConsultationHistory.find({ doctorId }).sort({ createdAt: 1 });

    let stage = 1;
    let fallbackWMA = doctor.consultationDurationDefault;

    if (completedCount >= 500) {
      stage = 4; // Auto best ML
    } else if (completedCount >= 100) {
      stage = 3; // ML training active
    } else if (completedCount >= 20) {
      stage = 2; // WMA
    }

    if (completedCount >= 20) {
      fallbackWMA = calculateWMA(historyRecords, 20);
    }

    queue.estimatedAverageTime = fallbackWMA; // Display WMA on queue details
    queue.currentQueueLength = appointments.filter(a => a.status === 'Waiting').length;

    const getKolkataTimeForHours = (baseDate, hour, minute) => {
      const d = new Date(baseDate);
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCMinutes(hour * 60 + minute - 330);
      return d;
    };

    const [openHour, openMin] = (doctor.hospitalOpeningTime || '09:00').split(':').map(Number);
    const openTimeLocal = getKolkataTimeForHours(startOfDay, openHour, openMin);

    // We calculate wait times starting from now
    let currentTime = new Date();
    if (currentTime < openTimeLocal) {
      // If clinic has not opened yet, start predictions from clinic open time
      currentTime = openTimeLocal;
    }

    // Parse lunch hour limits
    const [lunchStartHour, lunchStartMin] = (doctor.lunchStart || '13:00').split(':').map(Number);
    const [lunchEndHour, lunchEndMin] = (doctor.lunchEnd || '14:00').split(':').map(Number);
    const lunchStart = getKolkataTimeForHours(startOfDay, lunchStartHour, lunchStartMin);
    const lunchEnd = getKolkataTimeForHours(startOfDay, lunchEndHour, lunchEndMin);

    let nextAvailableTime = new Date(currentTime);

    // Apply reported doctor delay to patient timelines
    if (queue.doctorDelay > 0) {
      nextAvailableTime = new Date(nextAvailableTime.getTime() + queue.doctorDelay * 60000);
    }

    // Apply manual lunch break delay to patient timelines
    if (queue.lunchDelay > 0) {
      nextAvailableTime = new Date(nextAvailableTime.getTime() + queue.lunchDelay * 60000);
    }

    // Feature accumulators for ML predictions
    let walkInsBeforeCount = 0;
    let cancelledBeforeCount = 0;

    // Fetch today's cancelled appointments
    const cancelledTodayCount = await Appointment.countDocuments({
      doctorId,
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
      status: 'Cancelled',
    });

    const activeList = [];

    for (let index = 0; index < appointments.length; index++) {
      const appt = appointments[index];
      const positionInLine = index + 1;

      // Stage-specific Prediction Duration
      let predictedDuration = doctor.consultationDurationDefault;

      if (appt.status === 'Consulting' && appt.actualConsultationStart) {
        // If already consulting, estimate remaining time based on start
        const elapsedMin = (new Date().getTime() - new Date(appt.actualConsultationStart).getTime()) / 60000;
        predictedDuration = Math.max(1, doctor.consultationDurationDefault - elapsedMin);
      } else {
        if (stage === 1) {
          predictedDuration = doctor.consultationDurationDefault;
        } else if (stage === 2) {
          predictedDuration = fallbackWMA;
        } else {
          // Stage 3 & 4: Python ML Prediction
          const nowHour = nextAvailableTime.getHours();
          const peakHourFlag = [10, 11, 12, 16, 17].includes(nowHour) ? 1 : 0;
          const holidayFlag = doctor.specialHolidays && doctor.specialHolidays.some(h => new Date(h).toDateString() === startOfDay.toDateString()) ? 1 : 0;

          const features = {
            queuePosition: positionInLine,
            weekday: startOfDay.getDay(),
            month: startOfDay.getMonth() + 1,
            holidayFlag,
            peakHourFlag,
            doctorDelay: queue.doctorDelay,
            lunchDelay: queue.lunchDelay,
            emergencyDelay: appt.priority === 'Emergency' ? 20 : 0, // emergency duration buffer
            walkInsBefore: walkInsBeforeCount,
            cancelledBefore: cancelledTodayCount, // today's cumulative cancellations
            doctorConfiguredDefault: doctor.consultationDurationDefault,
          };

          const mlPred = await runPythonPrediction(features);
          predictedDuration = mlPred !== null ? mlPred : fallbackWMA;
        }
      }

      // Check for lunch break shift
      // If expected consultation start time lands within lunch hours, move patient start to after lunch
      if (nextAvailableTime >= lunchStart && nextAvailableTime < lunchEnd) {
        nextAvailableTime = new Date(lunchEnd.getTime());
      }

      // Record expected times
      let apptPredictedStartTime = new Date(nextAvailableTime);
      let apptWaitingTime = Math.max(0, Math.round((apptPredictedStartTime.getTime() - currentTime.getTime()) / 60000));

      appt.predictedConsultationTime = apptPredictedStartTime;
      appt.predictedWaitingTime = apptWaitingTime;
      await appt.save();

      // Accumulate for next patient
      nextAvailableTime = new Date(apptPredictedStartTime.getTime() + predictedDuration * 60000);

      if (appt.priority === 'Walk-in') {
        walkInsBeforeCount++;
      }

      activeList.push({
        appointmentId: appt._id,
        queueNumber: appt.queueNumber,
        priority: appt.priority,
        status: appt.status,
      });
    }

    queue.activePatients = activeList;
    await queue.save();

    // Broadcast update via socket
    if (ioInstance) {
      ioInstance.emit('queueUpdated', {
        doctorId,
        date: queue.date,
        currentServingNumber: queue.currentServingNumber,
        queueLength: queue.currentQueueLength,
        activePatients: queue.activePatients,
        estimatedAverageTime: queue.estimatedAverageTime,
        doctorDelay: queue.doctorDelay,
      });
    }

    return queue;
  } catch (error) {
    console.error('Queue Engine update failure:', error);
    throw error;
  }
};

// Check for training criteria & trigger Python training script
const checkAndTrainModel = async () => {
  try {
    const response = await fetch('http://127.0.0.1:8000/train', {
      method: 'POST',
    });
    if (!response.ok) {
      return { success: false, error: `FastAPI Train returned status ${response.status}` };
    }
    return await response.json();
  } catch (err) {
    console.warn('FastAPI Train service connection failed.', err.message);
    return { success: false, error: err.message };
  }
};

const getDynamicDoctorStatus = (doctor, targetDate = new Date(), queue = null) => {
  const doctorDelay = queue ? queue.doctorDelay : 0;

  // Timezone helper to parse dates in Asia/Kolkata (IST) safely
  const getKolkataTimeInfo = (d = new Date()) => {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      });
      const parts = formatter.formatToParts(d);
      const v = {};
      parts.forEach(p => { v[p.type] = p.value; });

      const year = parseInt(v.year);
      const month = parseInt(v.month);
      const day = parseInt(v.day);
      let hour = parseInt(v.hour);
      if (hour === 24) hour = 0;
      const minute = parseInt(v.minute);

      const dateUTC = new Date(Date.UTC(year, month - 1, day));
      const dayOfWeek = dateUTC.getUTCDay();

      return {
        year,
        month,
        day,
        hour,
        minute,
        dayOfWeek,
        dateString: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      };
    } catch (e) {
      return {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
        hour: d.getHours(),
        minute: d.getMinutes(),
        dayOfWeek: d.getDay(),
        dateString: d.toISOString().split('T')[0]
      };
    }
  };

  const nowInfo = getKolkataTimeInfo(new Date());
  const targetInfo = getKolkataTimeInfo(targetDate);

  // 1. Holiday Check
  const dateStr = targetInfo.dateString;
  const isHoliday = doctor.specialHolidays && doctor.specialHolidays.some(h => {
    try {
      return h && getKolkataTimeInfo(h).dateString === dateStr;
    } catch (e) {
      return false;
    }
  });
  if (isHoliday) return 'Holiday';

  // 2. Weekly Off Check
  if (doctor.weeklyOff && doctor.weeklyOff.includes(targetInfo.dayOfWeek)) return 'Week Off';

  // 3. Time-based checks (only apply if targetDate is TODAY)
  const isToday = nowInfo.dateString === targetInfo.dateString;
  if (isToday) {
    const currentMinutes = nowInfo.hour * 60 + nowInfo.minute;

    // Parse Opening/Closing hours
    const [openHour, openMin] = (doctor.hospitalOpeningTime || '09:00').split(':').map(Number);
    const [closeHour, closeMin] = (doctor.hospitalClosingTime || '17:00').split(':').map(Number);
    const openMinutes = openHour * 60 + openMin;
    const closeMinutes = closeHour * 60 + closeMin;

    // Parse Lunch hour
    const [lunchStartHour, lunchStartMin] = (doctor.lunchStart || '13:00').split(':').map(Number);
    const [lunchEndHour, lunchEndMin] = (doctor.lunchEnd || '14:00').split(':').map(Number);
    const lunchStartMinutes = lunchStartHour * 60 + lunchStartMin;
    const lunchEndMinutes = lunchEndHour * 60 + lunchEndMin;

    const formatTimeHelper = (h, m) => {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayHours = h % 12 || 12;
      const displayMinutes = m.toString().padStart(2, '0');
      return `${displayHours}:${displayMinutes} ${ampm}`;
    };

    if (currentMinutes > closeMinutes) {
      return 'Clinic Closed';
    }

    // Default automated schedule calculations
    if (doctor.defaultMode !== false) {
      const totalOpenMinutes = openMinutes + (doctorDelay || 0);

      if (currentMinutes < totalOpenMinutes) {
        let actualOpenHour = openHour;
        let actualOpenMin = openMin + (doctorDelay || 0);
        if (actualOpenMin >= 60) {
          actualOpenHour += Math.floor(actualOpenMin / 60);
          actualOpenMin = actualOpenMin % 60;
        }
        actualOpenHour = actualOpenHour % 24;

        return `Opens Today at ${formatTimeHelper(actualOpenHour, actualOpenMin)}`;
      }

      if (currentMinutes >= lunchStartMinutes && currentMinutes < lunchEndMinutes) {
        return 'Lunch Break';
      }

      return 'Available';
    }

    // Manual Override Mode: Check if checked in today
    let hasCheckedInToday = false;

    // 1) Check if queue has started serving patients
    if (queue && queue.currentServingNumber > 0) {
      hasCheckedInToday = true;
    }

    // 2) Check if status was manually updated today
    if (doctor.statusLastUpdatedAt) {
      const lastUpdateDate = getKolkataTimeInfo(doctor.statusLastUpdatedAt).dateString;
      if (lastUpdateDate === nowInfo.dateString) {
        hasCheckedInToday = true;
      }
    }

    if (!hasCheckedInToday) {
      let actualOpenHour = openHour;
      let actualOpenMin = openMin + (doctorDelay || 0);
      if (actualOpenMin >= 60) {
        actualOpenHour += Math.floor(actualOpenMin / 60);
        actualOpenMin = actualOpenMin % 60;
      }
      actualOpenHour = actualOpenHour % 24;

      return `Opens Today at ${formatTimeHelper(actualOpenHour, actualOpenMin)}`;
    }

    if (currentMinutes >= lunchStartMinutes && currentMinutes < lunchEndMinutes) {
      return 'Lunch Break';
    }
  }

  // 4. Default to manual status
  return doctor.status || 'Available';
};

module.exports = {
  updateQueuePredictions,
  checkAndTrainModel,
  calculateWMA,
  getDynamicDoctorStatus,
};
