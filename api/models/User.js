/**
 * User Model
 * Stores user information and preferences
 */

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  // Unique user ID (from extension)
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  
  // User information
  email: {
    type: String,
    index: true,
    sparse: true, // Allow null but ensure uniqueness when set
  },
  
  // Stripe customer ID
  stripeCustomerId: {
    type: String,
    index: true,
    sparse: true,
  },
  
  // User preferences
  preferences: {
    language: {
      type: String,
      default: 'sv',
    },
    // Add more preferences as needed
  },
  
  // Statistics
  stats: {
    totalLookups: {
      type: Number,
      default: 0,
    },
    firstSeen: {
      type: Date,
      default: Date.now,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  
  // Metadata
  metadata: {
    type: Map,
    of: String,
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Indexes for efficient queries
userSchema.index({ userId: 1 });
userSchema.index({ email: 1 });
userSchema.index({ stripeCustomerId: 1 });
userSchema.index({ 'stats.lastSeen': -1 });

// Static method to find or create user
userSchema.statics.findOrCreate = async function(userId, defaults = {}) {
  let user = await this.findOne({ userId });
  
  if (!user) {
    user = new this({
      userId,
      ...defaults,
    });
    await user.save();
  }
  
  return user;
};

// Method to update last seen
userSchema.methods.updateLastSeen = async function() {
  this.stats.lastSeen = new Date();
  this.stats.totalLookups = (this.stats.totalLookups || 0) + 1;
  await this.save();
};

// Method to link Stripe customer
userSchema.methods.linkStripeCustomer = async function(stripeCustomerId) {
  this.stripeCustomerId = stripeCustomerId;
  await this.save();
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
