/**
 * MongoDB Connection
 * Handles database connection for EnorEtt API
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.warn('⚠️  MONGODB_URI not set. Database features will be disabled.');
}

let isConnected = false;

/**
 * Connect to MongoDB
 */
export async function connectDB() {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  if (!MONGODB_URI) {
    const error = new Error('MONGODB_URI not set');
    console.warn('⚠️  MONGODB_URI not set. Database features will be disabled.');
    throw error;
  }

  try {
    // Add database name if not present in URI
    let uri = MONGODB_URI.trim();
    
    // Parse MongoDB URI to extract parts
    // Format: mongodb+srv://user:pass@host/dbname?options
    const uriMatch = uri.match(/^(mongodb\+srv?:\/\/[^\/]+)(\/[^?]*)?(\?.*)?$/);
    
    if (!uriMatch) {
      throw new Error('Invalid MongoDB URI format');
    }
    
    const baseUri = uriMatch[1]; // mongodb+srv://user:pass@host
    const dbPath = uriMatch[2] || ''; // /dbname or empty
    const queryString = uriMatch[3] || ''; // ?options or empty
    
    // Extract database name from path (remove leading slash)
    let dbName = dbPath.replace(/^\/+/, '').split('/')[0] || '';
    
    // If no database name or it's "test", use "enorett"
    if (!dbName || dbName === 'test') {
      dbName = 'enorett';
      console.log('📝 Using database name: enorett');
    } else {
      console.log('📝 Using existing database:', dbName);
    }
    
    // Reconstruct URI with correct database name
    uri = `${baseUri}/${dbName}${queryString}`;
    
    console.log('📝 Final MongoDB URI (masked):', uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
    
    await mongoose.connect(uri, {
      // These options are recommended for Mongoose 6+
      serverSelectionTimeoutMS: 10000, // Increased timeout for production
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      maxPoolSize: 10,
      retryWrites: true,
    });

    isConnected = true;
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    isConnected = false;
    // Re-throw error so calling code can handle it
    throw error;
  }
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectDB() {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('📦 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ MongoDB disconnection error:', error);
  }
}

// Handle connection events
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err);
  isConnected = false;
});

mongoose.connection.on('disconnected', () => {
  console.log('📦 MongoDB disconnected');
  isConnected = false;
});

// Handle app termination
process.on('SIGINT', async () => {
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDB();
  process.exit(0);
});
