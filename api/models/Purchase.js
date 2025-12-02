/**
 * Purchase Model
 * Stores Premium tier purchases/subscriptions
 */

import mongoose from 'mongoose';

const purchaseSchema = new mongoose.Schema({
  // User identification
  userId: {
    type: String,
    required: true,
    index: true,
  },
  
  // Stripe information
  stripeCustomerId: {
    type: String,
    index: true,
  },
  
  stripeSessionId: {
    type: String,
    unique: true,
    index: true,
  },
  
  stripePaymentIntentId: {
    type: String,
    index: true,
  },
  
  // Purchase details
  purchaseType: {
    type: String,
    enum: ['one-time', 'subscription'],
    default: 'one-time',
  },
  
  plan: {
    type: String,
    default: 'Premium',
  },
  
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'trialing'],
    default: 'active',
  },
  
  // Expiry information
  expiresAt: {
    type: Date,
    default: null, // null means lifetime access
  },
  
  // Amount and currency
  amount: {
    type: Number,
    required: true,
  },
  
  currency: {
    type: String,
    default: 'sek',
  },
  
  // Extension ID (for tracking)
  extensionId: {
    type: String,
    default: 'enorett',
  },
  
  // Metadata
  metadata: {
    type: Map,
    of: String,
  },
  
  // Timestamps
  purchasedAt: {
    type: Date,
    default: Date.now,
  },
  
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

// Index for efficient queries
purchaseSchema.index({ userId: 1, status: 1 });
purchaseSchema.index({ stripeCustomerId: 1 });
purchaseSchema.index({ expiresAt: 1 });

// Method to check if purchase is active
purchaseSchema.methods.isActive = function() {
  if (this.status !== 'active' && this.status !== 'trialing') {
    return false;
  }
  
  if (this.expiresAt && new Date(this.expiresAt) < new Date()) {
    return false;
  }
  
  return true;
};

// Static method to find active purchase for user
purchaseSchema.statics.findActivePurchase = async function(userId) {
  const purchase = await this.findOne({
    userId,
    status: { $in: ['active', 'trialing'] },
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  }).sort({ purchasedAt: -1 }); // Get most recent purchase
  
  return purchase;
};

const Purchase = mongoose.models.Purchase || mongoose.model('Purchase', purchaseSchema);

export default Purchase;
