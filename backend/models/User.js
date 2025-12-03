const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    googleId: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    data: {
        pantry: [String], // Array of ingredient names
        favorites: [mongoose.Schema.Types.Mixed], // Array of full recipe objects
        shoppingList: [mongoose.Schema.Types.Mixed], // Array of shopping items
        filters: {
            isVegetarian: Boolean,
            difficulty: String,
            maxTime: Number,
            searchQuery: String
        }
    },
    lastSynced: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', userSchema);
