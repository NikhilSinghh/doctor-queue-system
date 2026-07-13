const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
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
    bookingDate: {
      type: Date,
      default: Date.now,
    },
    appointmentDate: {
      type: Date,
      required: true,
    },
    appointmentTime: {
      type: String, // HH:MM
      required: true,
    },
    queueNumber: {
      type: Number,
      required: true,
    },
    predictedConsultationTime: {
      type: Date, // Live predicted start time
    },
    predictedWaitingTime: {
      type: Number, // In minutes
    },
    actualConsultationStart: {
      type: Date,
    },
    actualConsultationEnd: {
      type: Date,
    },
    actualConsultationDuration: {
      type: Number, // In minutes
    },
    status: {
      type: String,
      enum: ['Waiting', 'Consulting', 'Completed', 'Cancelled', 'No Show', 'Skipped'],
      default: 'Waiting',
    },
    priority: {
      type: String,
      enum: ['Routine', 'Walk-in', 'Emergency'],
      default: 'Routine',
    },
    bookingSource: {
      type: String,
      enum: ['Online', 'Walk-in', 'Receptionist'],
      default: 'Online',
    },
    chiefComplaint: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Appointment', appointmentSchema);
