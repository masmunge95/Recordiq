const Customer = require('../models/Customer');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @desc    Create a new customer
 * @route   POST /api/customers
 * @access  Private
 */
exports.createCustomer = asyncHandler(async (req, res) => {
    const { _id, name, phone, email } = req.body;
    const userId = req.auth.userId;

    if (!name) {
        res.status(400);
        throw new Error('Please provide a customer name.');
    }

    // Check if customer with the same phone or email already exists for this user
    const query = { user: userId, $or: [] };
    if (phone) query.$or.push({ phone });
    if (email) query.$or.push({ email });

    if (query.$or.length > 0) {
        const existingCustomer = await Customer.findOne(query);
        if (existingCustomer) {
            res.status(400);
            throw new Error('Customer with this phone or email already exists.');
        }
    }

    const customer = await Customer.create({
        _id: _id || undefined,
        name,
        phone,
        email,
        user: userId,
    });

    res.status(201).json(customer);
});

/**
 * @desc    Get all customers for the logged-in user
 * @route   GET /api/customers
 * @access  Private
 */
exports.getCustomers = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const customers = await Customer.find({ user: userId, isActive: true }).sort({ name: 1 });
    res.status(200).json(customers);
});

/**
 * @desc    Get a single customer by ID
 * @route   GET /api/customers/:id
 * @access  Private
 */
exports.getCustomerById = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const customer = await Customer.findOne({ _id: req.params.id, user: userId, isActive: true });

    if (!customer) {
        res.status(404);
        throw new Error('Customer not found.');
    }

    res.status(200).json(customer);
});

/**
 * @desc    Update a customer
 * @route   PUT /api/customers/:id
 * @access  Private
 */
exports.updateCustomer = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    let customer = await Customer.findOne({ _id: req.params.id, user: userId });

    if (!customer) {
        res.status(404);
        throw new Error('Customer not found.');
    }

    const { name, phone, email } = req.body;
    customer.name = name ?? customer.name;
    customer.phone = phone ?? customer.phone;
    customer.email = email ?? customer.email;

    const updatedCustomer = await customer.save();

    res.status(200).json(updatedCustomer);
});

/**
 * @desc    Delete a customer
 * @route   DELETE /api/customers/:id
 * @access  Private
 */
exports.deleteCustomer = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const customer = await Customer.findOne({ _id: req.params.id, user: userId });

    if (!customer) {
        res.status(404);
        throw new Error('Customer not found.');
    }

    // Soft delete the customer by setting isActive to false
    customer.isActive = false;
    await customer.save();

    res.status(200).json({ message: 'Customer deactivated' });
});
