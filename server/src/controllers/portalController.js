const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const asyncHandler = require('../utils/asyncHandler');
const { clerkClient } = require('@clerk/clerk-sdk-node');

/**
 * @desc    Get all invoices for the logged-in customer
 * @route   GET /api/portal/invoices
 * @access  Private (for the logged-in customer)
 */
exports.getMyInvoices = asyncHandler(async (req, res) => {
    const { userId } = req.auth;
    const user = await clerkClient.users.getUser(userId);

    if (!user || !user.emailAddresses || user.emailAddresses.length === 0) {
        console.warn('Primary email address not found in authentication token. Returning empty array for portal invoices.');
        return res.status(200).json([]);
    }
    const userEmail = user.emailAddresses[0].emailAddress;

    // Find the customer profile that matches the logged-in user's email.
    // A user might be a customer of multiple sellers, so we find all profiles.
    const customerProfiles = await Customer.find({ email: userEmail });

    if (!customerProfiles || customerProfiles.length === 0) {
        // This is a valid case where a user is logged in but hasn't been created as a customer by any seller yet.
        return res.status(200).json([]);
    }

    const customerIds = customerProfiles.map(p => p._id);

    const invoices = await Invoice.find({ 
        customer: { $in: customerIds },
        status: { $in: ['sent', 'paid', 'overdue'] } 
    }).sort({ issueDate: -1 });
    
    res.status(200).json(invoices);
});

/**
 * @desc    Get a single invoice by ID for the logged-in customer
 * @route   GET /api/portal/invoices/:id
 * @access  Private (for the logged-in customer)
 */
exports.getMyInvoiceById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { userId } = req.auth;
    const user = await clerkClient.users.getUser(userId);
    
    if (!user || !user.emailAddresses || user.emailAddresses.length === 0) {
        res.status(404);
        throw new Error('Customer profile not found.');
    }
    const userEmail = user.emailAddresses[0].emailAddress;

    // Find all customer profiles associated with this email
    const customerProfiles = await Customer.find({ email: userEmail });

    if (!customerProfiles || customerProfiles.length === 0) {
        res.status(404);
        throw new Error('Customer profile not found.');
    }

    const customerIds = customerProfiles.map(p => p._id);

    const invoice = await Invoice.findOne({
        _id: id,
        customer: { $in: customerIds },
        status: { $in: ['sent', 'paid', 'overdue'] } // Customers can only see sent invoices
    });

    if (!invoice) {
        res.status(404);
        throw new Error('Invoice not found or access denied.');
    }

    res.status(200).json(invoice);
});