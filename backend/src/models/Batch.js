const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
    farmer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // A batch can consist of one or multiple products
    products: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        },
        quantity: {
            type: Number,
            required: true
        },
        priceShare: {
            type: Number // Portion of total price attributed to this product
        }
    }],
    totalWeight: {
        type: Number,
        required: true
    },
    totalPrice: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['draft', 'active', 'sold', 'canceled'],
        default: 'active'
    },
    destination: {
        type: String,
        default: 'Kigali Central Aggregator'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    soldAt: {
        type: Date
    }
});

module.exports = mongoose.model('Batch', batchSchema);
