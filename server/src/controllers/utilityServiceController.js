const UtilityService = require('../models/UtilityService');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get all utility services for the logged-in user
// @route   GET /api/services
// @access  Private (Seller)
exports.getServices = asyncHandler(async (req, res) => {
  const services = await UtilityService.find({ user: req.auth.userId });
  res.status(200).json(services);
});

// @desc    Create a new utility service
// @route   POST /api/services
// @access  Private (Seller)
exports.createService = asyncHandler(async (req, res) => {
  const { _id, name, details, unitPrice, fees } = req.body;
  
  if (!_id) {
    res.status(400);
    throw new Error('Please provide _id.');
  }
  
  const service = new UtilityService({
    _id,
    name,
    details,
    unitPrice,
    fees,
    user: req.auth.userId,
  });
  const createdService = await service.save();
  res.status(201).json(createdService);
});

// @desc    Get a single utility service by ID
// @route   GET /api/services/:id
// @access  Private (Seller)
exports.getServiceById = asyncHandler(async (req, res) => {
  const service = await UtilityService.findOne({ _id: req.params.id, user: req.auth.userId });
  if (!service) {
    res.status(404);
    throw new Error('Service not found');
  }
  res.status(200).json(service);
});

// @desc    Update a utility service
// @route   PUT /api/services/:id
// @access  Private (Seller)
exports.updateService = asyncHandler(async (req, res) => {
  const service = await UtilityService.findOne({ _id: req.params.id, user: req.auth.userId });
  if (!service) {
    res.status(404);
    throw new Error('Service not found');
  }

  const { name, details, unitPrice, fees } = req.body;
  service.name = name || service.name;
  service.details = details || service.details;
  service.unitPrice = unitPrice !== undefined ? unitPrice : service.unitPrice;
  service.fees = fees || service.fees;

  const updatedService = await service.save();
  res.status(200).json(updatedService);
});

// @desc    Delete a utility service
// @route   DELETE /api/services/:id
// @access  Private (Seller)
exports.deleteService = asyncHandler(async (req, res) => {
  const service = await UtilityService.findOne({ _id: req.params.id, user: req.auth.userId });
  if (!service) {
    res.status(404);
    throw new Error('Service not found');
  }
  await service.deleteOne();
  res.status(200).json({ message: 'Service removed' });
});