const express = require('express')
const router = express.Router()
const User = require('../models/User')
const jwt = require('jsonwebtoken')

const checkToken = (req, res, next) => {
    const header = req.headers['authorization']
    const token = header && header.split(' ')[1]

    if (!token) return res.status(401).json({ success: false, message: 'No token' })

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Invalid token' })
        req.user = user
        next()
    })
}

router.get('/user/data', checkToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user) return res.status(404).json({ success: false, message: 'User not found' })
        res.json({ success: true, data: user.data, lastSynced: user.lastSynced })
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error fetching data' })
    }
})

router.put('/user/data', checkToken, async (req, res) => {
    try {
        const { pantry, favorites, shoppingList, filters } = req.body
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
        )
        res.json({ success: true, data: user.data, lastSynced: user.lastSynced })
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error updating data' })
    }
})

router.patch('/user/data/:field', checkToken, async (req, res) => {
    try {
        const { field } = req.params
        const allowed = ['pantry', 'favorites', 'shoppingList', 'filters']
        if (!allowed.includes(field)) {
            return res.status(400).json({ success: false, message: 'Invalid field' })
        }
        const update = { [`data.${field}`]: req.body[field], lastSynced: new Date() }
        const user = await User.findByIdAndUpdate(req.user.id, update, { new: true })
        res.json({ success: true, data: user.data, lastSynced: user.lastSynced })
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error updating data' })
    }
})

module.exports = router
