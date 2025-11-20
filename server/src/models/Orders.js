const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    customerId: {
        type: String, // Clerk User ID
        required: true,
    },
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment', // Will be set after successful payment
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
    },
    orderDate: {
        type: Date,
        default: Date.now,
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending',
    },
});

module.exports = mongoose.model('Order', orderSchema);