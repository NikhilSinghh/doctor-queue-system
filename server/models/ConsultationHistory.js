const mongoose = require('mongoose');

const consultationHistorySchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
    },
    queuePosition: {
      type: Number,
      required: true,
    },
    appointmentTime: {
      type: String, // HH:MM
      required: true,
    },
    consultationStart: {
      type: Date,
      required: true,
    },
    consultationEnd: {
      type: Date,
      required: true,
    },
    consultationDuration: {
      type: Number, // actual duration in minutes
      required: true,
    },
    waitingDuration: {
      type: Number, // actual waiting time in minutes
      required: true,
    },
    doctorDelay: {
      type: Number,
      default: 0,
    },
    lunchDelay: {
      type: Number,
      default: 0,
    },
    emergencyDelay: {
      type: Number,
      default: 0,
    },
    walkInsBefore: {
      type: Number,
      default: 0,
    },
    cancelledBefore: {
      type: Number,
      default: 0,
    },
    weekday: {
      type: Number, // 0-6
      required: true,
    },
    month: {
      type: Number, // 1-12
      required: true,
    },
    holidayFlag: {
      type: Number, // 0 or 1
      required: true,
    },
    peakHourFlag: {
      type: Number, // 0 or 1
      required: true,
    },
    modelVersion: {
      type: String,
      default: 'Baseline-7m',
    },
    predictionError: {
      type: Number, // Predicted Duration - Actual Duration
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ConsultationHistory', consultationHistorySchema);
