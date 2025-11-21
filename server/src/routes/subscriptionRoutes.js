const express = require('express');
const router = express.Router();
const Subscription = require('../models/Subscription');
const { ClerkExpressRequireAuth, clerkClient } = require('@clerk/clerk-sdk-node');
const { processPayment } = require('../utils/paymentProvider');

/**
 * GET /api/subscriptions/current
 * Get current user's subscription details
 */
router.get('/current', ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    
    if (!userId) {
      console.error('No userId found in req.auth');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    console.log('Fetching subscription for userId:', userId);
    let subscription = await Subscription.findOne({ userId });

    if (!subscription) {
      // Create trial subscription for new user
      subscription = new Subscription({
        userId,
        tier: 'trial',
        status: 'active',
      });
      await subscription.save();
    }

    // Calculate days remaining
    let daysRemaining = null;
    if (subscription.tier === 'trial') {
      const now = new Date();
      const msRemaining = subscription.trialEndDate - now;
      daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
    }

    res.json({
      subscription: {
        tier: subscription.tier,
        status: subscription.status,
        isActive: subscription.isActive(),
        trialEndDate: subscription.trialEndDate,
        daysRemaining,
        currentPeriodEnd: subscription.currentPeriodEnd,
        nextBillingDate: subscription.nextBillingDate,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        billingCycle: subscription.billingCycle,
        usage: subscription.usage,
      },
      limits: Subscription.getLimits()[subscription.tier],
      pricing: Subscription.getPricing(),
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch subscription details',
      message: error.message 
    });
  }
});

/**
 * GET /api/subscriptions/plans
 * Get available subscription plans
 */
router.get('/plans', (req, res) => {
  try {
    const pricing = Subscription.getPricing();
    const limits = Subscription.getLimits();

    const plans = Object.keys(pricing).filter(tier => tier !== 'trial').map(tier => ({
      tier,
      monthlyPrice: pricing[tier].price,
      annualPrice: pricing[tier].annual?.price,
      annualSavings: pricing[tier].annual?.savings,
      annualDiscount: pricing[tier].annual?.discount,
      currency: pricing[tier].currency,
      duration: pricing[tier].duration,
      limits: limits[tier],
      features: getFeaturesList(tier),
    }));

    res.json({ plans });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});

/**
 * POST /api/subscriptions/upgrade
 * Upgrade to a paid tier
 */
router.post('/upgrade', ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { tier, paymentMethod, phoneNumber, billingCycle } = req.body;

    // Validate tier
    const validTiers = ['basic', 'pro', 'enterprise'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: 'Invalid subscription tier' });
    }

    // Validate billing cycle
    const cycle = billingCycle || 'monthly';
    if (!['monthly', 'annual'].includes(cycle)) {
      return res.status(400).json({ error: 'Invalid billing cycle' });
    }

    // Get subscription
    let subscription = await Subscription.findOne({ userId });
    if (!subscription) {
      subscription = new Subscription({ userId });
    }

    // Get user email from Clerk for payment processing
    let userEmail;
    try {
      const user = await clerkClient.users.getUser(userId);
      userEmail = user.emailAddresses?.[0]?.emailAddress || user.primaryEmailAddress?.emailAddress;
    } catch (error) {
      console.error('Error fetching user from Clerk:', error);
    }

    // Fallback to session claims or generate email
    if (!userEmail) {
      userEmail = req.auth.sessionClaims?.email || `user-${userId}@recordiq.com`;
    }

    // Get pricing
    const pricing = Subscription.getPricing();
    const amount = cycle === 'annual' 
      ? pricing[tier].annual.price 
      : pricing[tier].price;

    // Process payment via IntaSend
    const paymentResult = await processPayment({
      amount,
      currency: 'USD',
      email: userEmail,
      phoneNumber: phoneNumber || req.body.phone,
      method: paymentMethod || 'MPESA',
      metadata: {
        userId,
        tier,
        type: cycle === 'annual' ? 'annual_subscription' : 'subscription_upgrade',
        billingCycle: cycle,
      },
    });

    if (!paymentResult.success) {
      return res.status(400).json({ 
        error: 'Payment failed',
        message: paymentResult.message,
      });
    }

    // Store pending upgrade info (will be activated by webhook after payment confirmation)
    subscription.pendingUpgrade = {
      tier,
      billingCycle: cycle,
      amount,
      initiatedAt: new Date(),
    };

    // Add to payment history as pending
    subscription.paymentHistory.push({
      amount,
      tier,
      status: 'pending',
      transactionId: paymentResult.transactionId,
      method: paymentMethod || 'MPESA',
    });

    await subscription.save();

    res.json({
      success: true,
      message: `Payment initiated for ${tier} tier. Your subscription will be activated once payment is confirmed.`,
      subscription: {
        tier: subscription.tier, // Keep current tier until payment confirms
        billingCycle: subscription.billingCycle,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        nextBillingDate: subscription.nextBillingDate,
        pendingUpgrade: subscription.pendingUpgrade,
      },
      payment: paymentResult,
    });
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    res.status(500).json({ error: 'Failed to upgrade subscription' });
  }
});

/**
 * POST /api/subscriptions/cancel
 * Cancel subscription at end of billing period
 */
router.post('/cancel', ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    
    const subscription = await Subscription.findOne({ userId });
    
    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    if (subscription.tier === 'trial') {
      return res.status(400).json({ error: 'Cannot cancel trial subscription' });
    }

    subscription.cancelAtPeriodEnd = true;
    await subscription.save();

    res.json({
      success: true,
      message: 'Subscription will be canceled at the end of the current billing period',
      subscription: {
        tier: subscription.tier,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

/**
 * POST /api/subscriptions/reactivate
 * Reactivate a canceled subscription
 */
router.post('/reactivate', ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    
    const subscription = await Subscription.findOne({ userId });
    
    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    subscription.cancelAtPeriodEnd = false;
    await subscription.save();

    res.json({
      success: true,
      message: 'Subscription reactivated',
      subscription: {
        tier: subscription.tier,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
    });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
});

/**
 * GET /api/subscriptions/usage
 * Get current usage statistics
 */
router.get('/usage', ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    
    const subscription = await Subscription.findOne({ userId });
    
    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const limits = Subscription.getLimits()[subscription.tier];

    res.json({
      tier: subscription.tier,
      usage: subscription.usage,
      limits,
      percentUsed: {
        invoices: limits.invoices === 'unlimited' ? 0 : ((subscription.usage.invoices || 0) / limits.invoices * 100),
        customers: limits.customers === 'unlimited' ? 0 : ((subscription.usage.customers || 0) / limits.customers * 100),
        ocrScans: limits.ocrScans === 'unlimited' ? 0 : ((subscription.usage.ocrScans || 0) / limits.ocrScans * 100),
        customerOcrScans: limits.customerOcrScans === 'unlimited' ? 0 : ((subscription.usage.customerOcrScans || 0) / limits.customerOcrScans * 100),
        records: limits.records === 'unlimited' ? 0 : ((subscription.usage.records || 0) / limits.records * 100),
      },
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

// Helper function to get features list for each tier
function getFeaturesList(tier) {
  const features = {
    basic: [
      'Up to 50 invoices per month',
      'Up to 25 customers',
      '100 seller OCR scans per month',
      '150 customer OCR scans per month',
      '200 records per month',
      'M-Pesa payments',
      'Email support',
      'Mobile & Desktop apps',
      'Basic analytics',
    ],
    pro: [
      'Up to 500 invoices per month',
      'Up to 250 customers',
      '1,000 seller OCR scans per month',
      '1,500 customer OCR scans per month',
      '2,000 records per month',
      'M-Pesa + Card payments',
      'Priority email support',
      'Mobile & Desktop apps',
      'Advanced analytics',
      'Custom branding',
      'API access',
    ],
    enterprise: [
      'Unlimited invoices',
      'Unlimited customers',
      'Unlimited seller OCR scans',
      'Unlimited customer OCR scans',
      'Unlimited records',
      'All payment methods',
      'Phone + Dedicated support',
      'Mobile & Desktop apps',
      'Advanced analytics',
      'Custom branding',
      'API access',
      'White-label option',
      'Custom integrations',
      'SLA guarantee',
    ],
  };

  return features[tier] || [];
}

module.exports = router;
