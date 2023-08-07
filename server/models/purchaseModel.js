const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
    customerName: {
        type: String,
        required: true
    },
    purchaseDate: {
        type: Date,
        default: Date.now
    },
    items: [
        {
            itemName: {
                type: String,
                required: true
            },
            category: {
                type: String,
                required: true
            },
            brand: {
                type: String,
                required: true
            },
            quantity: {
                type: Number,
                required: true
            },
            model: String,
            size: String
        }
    ]
});

const Purchase = mongoose.model('Purchase', purchaseSchema);

module.exports = Purchase;
