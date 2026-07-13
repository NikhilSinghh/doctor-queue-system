const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    currentServingNumber: {
      type: Number,
      default: 0,
    },
    currentQueueLength: {
      type: Number,
      default: 0,
    },
    estimatedAverageTime: {
      type: Number,
      default: 7, // Initial default
    },
    predictionConfidence: {
      type: Number,
      default: 100, // Percentage
    },
    doctorDelay: {
      type: Number,
      default: 0, // Delay reported by doctor in minutes
    },
    lunchDelay: {
      type: Number,
      default: 0, // Lunch break duration shift if custom-lengthened
    },
    activePatients: [
      {
        appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
        queueNumber: Number,
        priority: String,
        status: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Queue', queueSchema);
