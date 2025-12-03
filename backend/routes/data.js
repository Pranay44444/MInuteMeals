const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Get user data
router.get('/user/data', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            data: user.data,
            lastSynced: user.lastSynced
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching data' });
    }
});

// Update user data (sync)
router.put('/user/data', verifyToken, async (req, res) => {
    try {
        const { pantry, favorites, shoppingList, filters } = req.body;

        const user = await User.findByIdAndUpdate(
            req.user.id,
            {
                'data.pantry': pantry,
                'data.favorites': favorites,
                'data.shoppingList': shoppingList,
                'data.filters': filters,
                lastSynced: new Date()
            },
            { new: true }
        );

        res.json({
            success: true,
            data: user.data,
            lastSynced: user.lastSynced
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating data' });
    }
});

// Partial update (for individual syncs)
router.patch('/user/data/:field', verifyToken, async (req, res) => {
    try {
        const { field } = req.params;
        const allowedFields = ['pantry', 'favorites', 'shoppingList', 'filters'];

        if (!allowedFields.includes(field)) {
            return res.status(400).json({ success: false, message: 'Invalid field' });
        }

        const updateData = {
            [`data.${field} `]: req.body[field],
            lastSynced: new Date()
        };

        const user = await User.findByIdAndUpdate(
            req.user.id,
            updateData,
            { new: true }
        );

        res.json({
            success: true,
            data: user.data,
            lastSynced: user.lastSynced
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating data' });
    }
});

module.exports = router;
