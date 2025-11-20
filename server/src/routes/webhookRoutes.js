const express = require('express');
const { Webhook } = require('svix');
const { clerkClient } = require('@clerk/clerk-sdk-node');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Use express.raw for the webhook endpoint
router.post(
  '/clerk', asyncHandler(async (req, res) => {
    // Choose the correct webhook secret based on the environment
    const WEBHOOK_SECRET =
      process.env.NODE_ENV === 'production'
        ? process.env.CLERK_WEBHOOK_SECRET_PUBLISHED
        : process.env.CLERK_WEBHOOK_SECRET_LOCAL;

    if (!WEBHOOK_SECRET) {
      throw new Error('You need a Clerk Webhook Secret in your .env file for the current environment.');
    }

    // Get the headers
    const svix_id = req.headers['svix-id'];
    const svix_timestamp = req.headers['svix-timestamp'];
    const svix_signature = req.headers['svix-signature'];

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return res.status(400).send('Error occurred -- no svix headers');
    }

    const payload = req.body;
    const wh = new Webhook(WEBHOOK_SECRET);

    let evt;
    try {
      evt = wh.verify(payload, { 'svix-id': svix_id, 'svix-timestamp': svix_timestamp, 'svix-signature': svix_signature });
    } catch (err) {
      console.error('Error verifying webhook:', err);
      return res.status(400).send('Error occurred');
    }

    // Handle the user.created event
    if (evt.type === 'user.created') {
      console.log('[Webhook] Received user.created event. Full data:', JSON.stringify(evt.data, null, 2));
      
      const { id } = evt.data;
      // Correctly access unsafe_metadata from the event data
      const unsafeMetadata = evt.data.unsafe_metadata || {};
      const role = unsafeMetadata.role || 'customer'; // Default to 'customer'

      await clerkClient.users.updateUser(id, {
        publicMetadata: { role },
      });

      console.log(`[Webhook] User ${id} successfully created and assigned role: '${role}'`);
    } else {
      console.log(`[Webhook] Received unhandled event type: ${evt.type}`);
    }

    res.status(200).send('Webhook received');
  })
);

module.exports = router;