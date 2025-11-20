const mongoose = require('mongoose');

const salesSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
    },
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment',
        required: true,
    },
    saleDate: {
        type: Date,
        default: Date.now,
    },
    customerId: {
        type: String, // Clerk User ID
        required: true,
    },
});

module.exports = mongoose.model('Sales', salesSchema);