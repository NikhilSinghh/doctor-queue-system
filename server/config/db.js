const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/doctor_queue';
  try {
    console.log(`Attempting connection to MongoDB: ${uri}`);
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`Connection failed: ${error.message}. Initializing in-memory fallback database...`);
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create({
        binary: {
          version: '7.0.3'
        }
      });
      const mongoUri = mongoServer.getUri();
      
      process.env.MONGO_URI = mongoUri; // Pass to child processes
      
      const conn = await mongoose.connect(mongoUri);
      console.log(`In-Memory MongoDB Connected: ${conn.connection.host}`);
    } catch (memError) {
      console.error(`In-Memory MongoDB start failed: ${memError.message}`);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
