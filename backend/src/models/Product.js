const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    farmer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    unit: {
        type: String,
        required: true,
        default: 'kg'
    },
    pricePerUnit: {
        type: Number,
        required: false
    },
    image: {
        type: String, // URL or path
        required: false
    },
    status: {
        type: String,
        enum: ['In storage', 'Selling fast', 'Low stock', 'Out of stock'],
        default: 'In storage'
    },
    dateAdded: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Product', productSchema);
