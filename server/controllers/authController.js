const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Doctor = require('../models/Doctor');

// Helper to sign JWT
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'super_secret_healthcare_key_123_abc', {
    expiresIn: '30d',
  });
};

// Temp store for reset OTPs (In-Memory for simplicity)
const otpStore = new Map();

// Register Patient
const register = async (req, res) => {
  try {
    const { fullName, mobileNumber, email, password, gender, dateOfBirth, address } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ mobileNumber });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this mobile number already exists.',
      });
    }

    const newUser = new User({
      fullName,
      mobileNumber,
      email,
      passwordHash: password, // pre-save hook handles hashing
      gender,
      dateOfBirth,
      address,
      role: 'Patient',
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message: 'Registration Successful. You can now login.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error occurred during registration.',
    });
  }
};

// Register Doctor/Receptionist (Admin only action or initial setup seed)
const registerStaff = async (req, res) => {
  try {
    const { fullName, mobileNumber, email, password, gender, dateOfBirth, role, specialization } = req.body;

    const existingUser = await User.findOne({ mobileNumber });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this mobile number already exists.',
      });
    }

    const newUser = new User({
      fullName,
      mobileNumber,
      email,
      passwordHash: password,
      gender,
      dateOfBirth,
      role,
    });

    const savedUser = await newUser.save();

    if (role === 'Doctor') {
      const newDoctor = new Doctor({
        userId: savedUser._id,
        doctorName: fullName,
        specialization: specialization || 'General Physician',
      });
      await newDoctor.save();
    }

    res.status(201).json({
      success: true,
      message: `${role} account created successfully.`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error occurred creating staff account.',
    });
  }
};

// Login User (supports Mobile Number or Email)
const login = async (req, res) => {
  try {
    const { username, password } = req.body; // username is either email or mobile number

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide credentials.',
      });
    }

    // Query user by mobile or email
    const user = await User.findOne({
      $or: [{ mobileNumber: username }, { email: username.toLowerCase() }],
    });

    if (!user || !(await user.comparePassword(password))) {
      // Don't leak details about whether user exists or password fails
      return res.status(401).json({
        success: false,
        message: 'Invalid mobile number/email or password.',
      });
    }

    if (user.status === 'Suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your account is suspended. Please contact management.',
      });
    }

    const token = signToken(user._id);

    // If doctor, fetch doctor id
    let doctorId = null;
    if (user.role === 'Doctor') {
      const doctor = await Doctor.findOne({ userId: user._id });
      if (doctor) doctorId = doctor._id;
    }

    user.lastLogin = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          mobileNumber: user.mobileNumber,
          role: user.role,
          darkMode: user.darkMode,
          language: user.language,
          doctorId,
          travelTime: user.travelTime,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error occurred during login.',
    });
  }
};

// Forgot Password Flow (Generates OTP and logs to console)
const forgotPassword = async (req, res) => {
  try {
    const { mobileNumber } = req.body;
    const user = await User.findOne({ mobileNumber });

    if (!user) {
      // For security: return 200 even if user not found, so we don't leak user list
      return res.status(200).json({
        success: true,
        message: 'If account exists, OTP has been sent.',
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(mobileNumber, { otp, expires: Date.now() + 600000 }); // 10 minutes expiry

    // SECURITY WARNING: In production we send SMS. For offline, log to server console.
    console.log(`\n====================================\n[SMS GATEWAY MOCK] OTP for Reset to ${mobileNumber}: ${otp}\n====================================\n`);

    res.status(200).json({
      success: true,
      message: 'If account exists, OTP has been sent.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error during forgot password request.',
    });
  }
};

// Reset Password Flow
const resetPassword = async (req, res) => {
  try {
    const { mobileNumber, otp, newPassword } = req.body;
    const stored = otpStore.get(mobileNumber);

    if (!stored || stored.otp !== otp || stored.expires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP code.',
      });
    }

    const user = await User.findOne({ mobileNumber });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    user.passwordHash = newPassword; // Hashed inside pre-save
    await user.save();
    otpStore.delete(mobileNumber);

    res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now login.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error resetting password.',
    });
  }
};

module.exports = {
  register,
  registerStaff,
  login,
  forgotPassword,
  resetPassword,
};
