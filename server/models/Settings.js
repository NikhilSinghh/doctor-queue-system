const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    clinicName: {
      type: String,
      default: 'Smart Doctor Clinic',
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    mlTrainingFrequency: {
      type: String,
      enum: ['Daily', 'Weekly', 'Monthly'],
      default: 'Weekly',
    },
    queueColorThresholds: {
      lightGreen: { type: Number, default: 5 },
      freshGreen: { type: Number, default: 15 },
      yellowGreen: { type: Number, default: 30 },
      amber: { type: Number, default: 50 },
      orange: { type: Number, default: 70 },
      softRed: { type: Number, default: 90 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
