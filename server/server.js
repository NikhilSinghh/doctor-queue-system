require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');

// Import Schemas to seed default doctor on startup
const User = require('./models/User');
const Doctor = require('./models/Doctor');
const Settings = require('./models/Settings');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Connect Database
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());

// Set socket.io instance
app.set('socketio', io);

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/patient', require('./routes/patientRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// Basic Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Socket.IO logic
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Room subscription per doctor for live queue updates
  socket.on('joinDoctorRoom', (doctorId) => {
    socket.join(`doctor_${doctorId}`);
    console.log(`Client ${socket.id} joined doctor room: doctor_${doctorId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Seed Initial System Admin/Doctor data for immediate testing
const seedDefaultDoctor = async () => {
  try {
    const mongoose = require('mongoose');

    // Check if Doctor already exists
    let docProfile = await Doctor.findOne({ _id: new mongoose.Types.ObjectId("66914b48bcde36814b72648a") });
    if (!docProfile) {
      console.log('Seeding default doctor and settings...');
      
      // Create user doctor account
      const doctorUser = new User({
        _id: new mongoose.Types.ObjectId("66914b48bcde36814b72648d"),
        fullName: 'Dr. Avinash Singh',
        mobileNumber: '9876543210',
        email: 'dr.avinash@ashaneurology.com',
        passwordHash: 'Password123!', // Hashed via pre-save
        gender: 'Male',
        dateOfBirth: new Date('1982-08-20'),
        role: 'Doctor',
      });
      await doctorUser.save();

      docProfile = new Doctor({
        _id: new mongoose.Types.ObjectId("66914b48bcde36814b72648a"),
        userId: doctorUser._id,
        doctorName: 'Dr. Avinash Singh',
        specialization: 'Neurology',
        qualification: 'MBBS, MD, DM (Neurology)',
        experience: 13,
        hospitalName: 'Asha Neurology Center',
        clinicAddress: 'Brij Enclave Colony, Sundarpur, Nagwa, Varanasi, UP, India',
        feesNormal: 600,
        feesEmergency: 1000,
        feesFollowUp: 500,
        consultationDurationDefault: 7,
        hospitalOpeningTime: '11:00',
        hospitalClosingTime: '15:30',
        lunchStart: '13:00',
        lunchEnd: '13:30',
        weeklyOff: [0], // Sunday
        maxPatientsPerDay: 30,
        specialHolidays: [],
      });
      await docProfile.save();

      // Create a default receptionist account for testing too
      const receptionistUser = new User({
        _id: new mongoose.Types.ObjectId("66914b48bcde36814b72648e"),
        fullName: 'John Watson',
        mobileNumber: '8765432109',
        email: 'john.reception@hospital.com',
        passwordHash: 'Password123!',
        gender: 'Male',
        dateOfBirth: new Date('1990-11-20'),
        role: 'Receptionist',
      });
      await receptionistUser.save();

      // Create default settings
      const settings = new Settings({
        clinicName: 'Asha Neurology Center',
        timezone: 'Asia/Kolkata',
      });
      await settings.save();
    } else {
      // Force update existing doctor profile to Dr. Avinash Singh and Varanasi coordinates
      console.log('Verifying default doctor profile...');
      docProfile.doctorName = 'Dr. Avinash Singh';
      docProfile.specialization = 'Neurology';
      docProfile.qualification = 'MBBS, MD, DM (Neurology)';
      docProfile.experience = 13;
      docProfile.hospitalName = 'Asha Neurology Center';
      docProfile.clinicAddress = 'Brij Enclave Colony, Sundarpur, Nagwa, Varanasi, UP, India';
      docProfile.feesNormal = 600;
      docProfile.feesEmergency = 1000;
      docProfile.feesFollowUp = 500;
      docProfile.hospitalOpeningTime = '11:00';
      docProfile.hospitalClosingTime = '15:30';
      if (docProfile.maxPatientsPerDay === undefined) docProfile.maxPatientsPerDay = 30;
      await docProfile.save();

      const doctorUser = await User.findOne({ _id: new mongoose.Types.ObjectId("66914b48bcde36814b72648d") });
      if (doctorUser) {
        doctorUser.fullName = 'Dr. Avinash Singh';
        await doctorUser.save();
      }
    }

    console.log('--------------------------------------------------');
    console.log('DEFAULT TEST ACCOUNTS ACTIVE:');
    console.log('1. Doctor:');
    console.log('   - Mobile: 9876543210');
    console.log('   - Password: Password123!');
    console.log('2. Receptionist:');
    console.log('   - Mobile: 8765432109');
    console.log('   - Password: Password123!');
    console.log('--------------------------------------------------');

    // Spawn Python historical data generator and initial model trainer if needed
    const { exec } = require('child_process');
    const path = require('path');
    const fs = require('fs');

    const venvPython = process.platform === 'win32'
      ? path.join(__dirname, 'venv', 'Scripts', 'python.exe')
      : path.join(__dirname, 'venv', 'bin', 'python');

    const pythonCmd = fs.existsSync(venvPython) ? `"${venvPython}"` : 'python';

    const modelPath = path.join(__dirname, 'ml', 'models', 'best_model.joblib');
    if (!fs.existsSync(modelPath)) {
      console.log('Spawning Python seeder to populate historical records...');
      exec(`${pythonCmd} "${path.join(__dirname, 'ml', 'generate_data.py')}"`, (err, stdout, stderr) => {
        if (err) {
          console.error('Python historical data seeder error:', err, stderr);
        } else {
          console.log('Python seeder output:', stdout.trim());
          console.log('Training initial scikit-learn models...');
          exec(`${pythonCmd} "${path.join(__dirname, 'ml', 'train.py')}"`, (trainErr, trainStdout, trainStderr) => {
            if (trainErr) {
              console.error('Python training error:', trainErr, trainStderr);
            } else {
              console.log('Initial ML model training completed successfully:', trainStdout.trim());
            }
          });
        }
      });
    }
  } catch (err) {
    console.error('Seeding default doctor failed:', err);
  }
};

let fastapiProcess = null;

const startFastAPIMicroservice = () => {
  const { spawn } = require('child_process');
  const path = require('path');
  const fs = require('fs');

  console.log('Starting FastAPI ML Microservice on 127.0.0.1:8000...');
  
  const venvPython = process.platform === 'win32'
    ? path.join(__dirname, 'venv', 'Scripts', 'python.exe')
    : path.join(__dirname, 'venv', 'bin', 'python');
  
  const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python';
  
  fastapiProcess = spawn(pythonCmd, ['-m', 'uvicorn', 'ml.app:app', '--host', '127.0.0.1', '--port', '8000'], {
    cwd: __dirname,
    env: process.env
  });
  
  fastapiProcess.stdout.on('data', (data) => {
    console.log(`[FastAPI] ${data.toString().trim()}`);
  });
  
  fastapiProcess.stderr.on('data', (data) => {
    console.error(`[FastAPI Error] ${data.toString().trim()}`);
  });
  
  fastapiProcess.on('close', (code) => {
    console.log(`FastAPI process exited with code ${code}`);
  });
};

const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await seedDefaultDoctor();
  startFastAPIMicroservice();
});

process.on('SIGINT', () => {
  if (fastapiProcess) {
    console.log('Stopping FastAPI ML service...');
    fastapiProcess.kill();
  }
  process.exit();
});
