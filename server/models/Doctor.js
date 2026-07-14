const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    doctorName: {
      type: String,
      required: true,
      trim: true,
    },
    specialization: {
      type: String,
      required: true,
    },
    qualification: {
      type: String,
    },
    experience: {
      type: Number,
    },
    hospitalName: {
      type: String,
    },
    clinicAddress: {
      type: String,
    },
    feesNormal: {
      type: Number,
      default: 600,
    },
    feesEmergency: {
      type: Number,
      default: 1000,
    },
    feesFollowUp: {
      type: Number,
      default: 500,
    },
    maxPatientsPerDay: {
      type: Number,
      default: 30,
    },
    consultationDurationDefault: {
      type: Number,
      default: 7, // Doctor-configured average consultation time (initial default is 7 minutes)
      min: 1,
    },
    consultationDurationManualOverride: {
      type: Boolean,
      default: false,
    },
    consultationDurationRecommended: {
      type: Number,
      min: 1,
    },
    hospitalOpeningTime: {
      type: String,
      default: '09:00', // HH:MM
    },
    hospitalClosingTime: {
      type: String,
      default: '17:00', // HH:MM
    },
    lunchStart: {
      type: String,
      default: '13:00', // HH:MM
    },
    lunchEnd: {
      type: String,
      default: '14:00', // HH:MM
    },
    weeklyOff: {
      type: [Number], // Days of week (0=Sunday, 6=Saturday)
      default: [0], // Sunday off
    },
    specialHolidays: {
      type: [Date],
      default: [],
    },
    status: {
      type: String,
      enum: ['Available', 'Consulting', 'Running Late', 'Lunch Break', 'Emergency Break', 'Hospital Closed', 'Doctor Left', 'Holiday'],
      default: 'Available',
    },
    bookingsEnabled: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Doctor', doctorSchema);
