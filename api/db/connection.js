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
  if (isConnected) {
    return;
  }

  if (!MONGODB_URI) {
    console.log('📦 Database connection skipped (MONGODB_URI not set)');
    return;
  }

  try {
    // Add database name if not present in URI
    let uri = MONGODB_URI;
    
    // MongoDB Atlas format examples:
    // mongodb+srv://user:pass@cluster.net/?options  -> needs /enorett
    // mongodb+srv://user:pass@cluster.net/enorett?options  -> already has it
    // mongodb+srv://user:pass@cluster.net  -> needs /enorett
    
    // Parse the URI to check if database name exists
    // Pattern: @hostname/ or @hostname? or @hostname$
    const hasDatabaseName = uri.match(/@[^\/\?]+\/([^\/\?]+)/);
    
    if (!hasDatabaseName) {
      // No database name found - add /enorett
      if (uri.includes('?')) {
        // Has query params: insert /enorett before ?
        uri = uri.replace(/\?/, '/enorett?');
      } else {
        // No query params: append /enorett
        uri = uri + (uri.endsWith('/') ? 'enorett' : '/enorett');
      }
      console.log('📝 Added database name "enorett" to connection string');
    } else {
      const dbName = hasDatabaseName[1];
      console.log('📝 Using existing database:', dbName);
    }
    
    await mongoose.connect(uri, {
      // These options are recommended for Mongoose 6+
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    });

    isConnected = true;
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    isConnected = false;
    return;
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
