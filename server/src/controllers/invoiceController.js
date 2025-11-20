const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Counter = require('../models/Counter');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Atomically finds and increments the invoice counter to get the next unique number.
 * This is a robust, race-condition-safe method for generating sequential numbers.
 */
const getNextInvoiceNumber = async () => {
    const counter = await Counter.findOneAndUpdate(
        { _id: 'invoiceNumber' },
        { $inc: { sequence_value: 1 } },
        { new: true, upsert: true } // `upsert` creates the document if it doesn't exist
    );
    return `INV-${counter.sequence_value}`;
};

/**
 * @desc    Create a new invoice
 * @route   POST /api/invoices
 * @access  Private
 */
exports.createInvoice = asyncHandler(async (req, res) => {
    const { _id, customerId, items, tax, issueDate, dueDate, status } = req.body;
    const userId = req.auth.userId;

    if (!_id || !customerId || !items || !dueDate) {
        res.status(400);
        throw new Error('Please provide _id, customerId, items, and dueDate.');
    }

    // Verify the customer exists and belongs to the user
    // **SECURITY FIX**: Ensure the customer being assigned to the invoice belongs to the logged-in user.
    const customer = await Customer.findOne({ _id: customerId, user: userId }); 
    if (!customer) {
        res.status(404);
        throw new Error('Customer not found.');
    }

    // Calculate totals
    const subTotal = items.reduce((acc, item) => acc + item.total, 0);
    const total = subTotal + (tax || 0);

    const invoiceNumber = await getNextInvoiceNumber();

    const invoice = await Invoice.create({
        _id,
        invoiceNumber,
        customer: customerId,
        customerName: customer.name,
        user: userId,
        items,
        subTotal,
        tax,
        total,
        status,
        issueDate,
        dueDate,
    });

    res.status(201).json(invoice);
});

/**
 * @desc    Get all invoices for the logged-in user
 * @route   GET /api/invoices
 * @access  Private
 */
exports.getInvoices = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;

    // If a 'sync' query parameter is present, return all invoices for offline-first sync.
    if (req.query.sync === 'true') {
        // Return all invoices with customer as a string UUID (no populate needed since it's already in the schema)
        const allInvoices = await Invoice.find({ user: userId })
            .sort({ issueDate: -1 });
        return res.status(200).json({
            invoices: allInvoices,
            total: allInvoices.length,
            pages: 1,
            page: 1,
        });
    } else {
        // Otherwise, use the existing pagination logic.
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const skip = (page - 1) * limit;

        const totalInvoices = await Invoice.countDocuments({ user: userId });
        // Return invoices with customer as a string UUID (no populate needed)
        const invoices = await Invoice.find({ user: userId })
            .sort({ issueDate: -1 }).skip(skip).limit(limit);
            
        return res.status(200).json({
            invoices,
            total: totalInvoices,
            page,
            pages: Math.ceil(totalInvoices / limit)
        });
    }
});

/**
 * @desc    Get a single invoice by ID
 * @route   GET /api/invoices/:id
 * @access  Private
 */
exports.getInvoiceById = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const invoice = await Invoice.findOne({ _id: req.params.id, user: userId });

    if (!invoice) {
        res.status(404);
        throw new Error('Invoice not found.');
    }

    res.status(200).json(invoice);
});

/**
 * @desc    Update an invoice
 * @route   PUT /api/invoices/:id
 * @access  Private
 */
exports.updateInvoice = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    let invoice = await Invoice.findOne({ _id: req.params.id, user: userId });

    if (!invoice) {
        res.status(404);
        throw new Error('Invoice not found.');
    }
    
    // Forbid editing a paid or void invoice
    if (['paid', 'void'].includes(invoice.status)) {
        res.status(400);
        throw new Error(`Cannot update an invoice with status '${invoice.status}'.`);
    }

    const { customerId, items, tax, dueDate, status } = req.body;

    // Recalculate totals if items are being updated
    if (items) {
        invoice.items = items;
        invoice.subTotal = items.reduce((acc, item) => acc + item.total, 0);
        invoice.total = invoice.subTotal + (tax ?? invoice.tax);
    }
    
    invoice.tax = tax ?? invoice.tax;
    invoice.dueDate = dueDate ?? invoice.dueDate;
    invoice.status = status ?? invoice.status;
    
    if (customerId) {
        // **SECURITY FIX**: When updating, re-verify that the new customer also belongs to the user.
        const customer = await Customer.findOne({ _id: customerId, user: userId }); 
        if (!customer) {
            res.status(404);
            throw new Error('Customer not found.');
        }
        invoice.customer = customerId;
        invoice.customerName = customer.name;
    }

    const updatedInvoice = await invoice.save();
    res.status(200).json(updatedInvoice);
});

/**
 * @desc    Delete an invoice
 * @route   DELETE /api/invoices/:id
 * @access  Private
 */
exports.deleteInvoice = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const invoice = await Invoice.findOne({ _id: req.params.id, user: userId });

    if (!invoice) {
        res.status(404);
        throw new Error('Invoice not found.');
    }

    // Optional: Only allow deletion of draft invoices
    if (invoice.status !== 'draft') {
        return res.status(400).json({ message: 'Only draft invoices can be deleted.' });
    }

    await invoice.deleteOne();

    res.status(200).json({ message: 'Invoice removed' });
});

/**
 * @desc    Send an invoice to a customer
 * @route   POST /api/invoices/:id/send
 * @access  Private
 */
exports.sendInvoice = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    // **SECURITY FIX**: Ensure the invoice being sent belongs to the user.
    const invoice = await Invoice.findOne({ _id: req.params.id, user: userId }); 

    if (!invoice) {
        res.status(404);
        throw new Error('Invoice not found.');
    }

    if (invoice.status !== 'draft') {
        res.status(400);
        throw new Error(`Invoice cannot be sent because its status is '${invoice.status}'.`);
    }

    // TODO: Implement actual email sending logic here
    // For now, we just update the status to 'sent'
    invoice.status = 'sent';
    
    const updatedInvoice = await invoice.save();

    res.status(200).json(updatedInvoice);
});
