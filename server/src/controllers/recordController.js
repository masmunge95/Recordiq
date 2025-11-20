const Record = require('../models/Record');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @desc    Create a new record (sale or expense)
 * @route   POST /api/records
 * @access  Private
 */
exports.createRecord = asyncHandler(async (req, res) => {
    // The form sends `customerId`, but the model expects `customer`. We handle this here.
    const { _id, type, amount, description, customerId, recordDate, recordType, ocrData, modelSpecs } = req.body;
    const userId = req.auth.userId;

    if (!_id || !type || !amount || !recordType) {
        res.status(400);
        throw new Error('Please provide _id, type, amount, and recordType.');
    }

    const record = await Record.create({
        _id,
        type,
        recordType,
        amount,
        description,
        customer: customerId, // Map frontend `customerId` to backend `customer`
        recordDate,
        user: userId,
        imagePath: req.file ? req.file.path : undefined,
        ocrData: ocrData ? JSON.parse(ocrData) : undefined,
        modelSpecs: modelSpecs ? JSON.parse(modelSpecs) : undefined,
    });

    res.status(201).json(record);
});

/**
 * @desc    Get all records for the logged-in user
 * @route   GET /api/records
 * @access  Private
 */
exports.getRecords = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const records = await Record.find({ user: userId }).sort({ recordDate: -1 });
    res.status(200).json(records);
});

/**
 * @desc    Get a single record by ID
 * @route   GET /api/records/:id
 * @access  Private
 */
exports.getRecordById = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const record = await Record.findOne({ _id: req.params.id, user: userId });

    if (!record) {
        res.status(404);
        throw new Error('Record not found.');
    }

    res.status(200).json(record);
});

/**
 * @desc    Update a record
 * @route   PUT /api/records/:id
 * @access  Private
 */
exports.updateRecord = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    let record = await Record.findOne({ _id: req.params.id, user: userId });

    if (!record) {
        res.status(404);
        throw new Error('Record not found.');
    }

    const { type, amount, description, customer, recordDate } = req.body;

    record.type = type ?? record.type;
    record.amount = amount ?? record.amount;
    record.description = description ?? record.description;
    record.customer = customer ?? record.customer;
    record.recordDate = recordDate ?? record.recordDate;

    const updatedRecord = await record.save();

    res.status(200).json(updatedRecord);
});

/**
 * @desc    Delete a record
 * @route   DELETE /api/records/:id
 * @access  Private
 */
exports.deleteRecord = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const record = await Record.findOne({ _id: req.params.id, user: userId });

    if (!record) {
        res.status(404);
        throw new Error('Record not found.');
    }

    await record.deleteOne(); // Using deleteOne() on the document

    res.status(200).json({ message: 'Record removed' });
});
