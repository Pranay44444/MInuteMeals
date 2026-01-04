const express = require('express')
const passport = require('passport')
const router = express.Router()

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    const jwt = require('jsonwebtoken')

    const user = {
      id: req.user._id.toString(),
      email: req.user.email,
      name: req.user.name
    }

    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '30d' })

    const agent = req.get('User-Agent') || ''
    const isMobile = /iPhone|iPad|iPod|Android/i.test(agent)

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081'
    const mobileDeepLink = process.env.MOBILE_DEEP_LINK || 'exp://172.20.10.3:8081/--/auth/callback'

    const webUrl = `${frontendUrl}?token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify(user))}`
    const mobileUrl = `${mobileDeepLink}?token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify(user))}`
    const url = isMobile ? mobileUrl : webUrl

    res.send(`
      <html>
        <head><meta http-equiv="refresh" content="0; url=${url}" /></head>
        <body>
          <h2>Sign in successful!</h2>
          <p>Redirecting back to app...</p>
          <script>window.location.href = '${url}'</script>
        </body>
      </html>
    `)
  }
)

router.get('/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      success: true,
      user: { id: req.user._id, email: req.user.email, name: req.user.name }
    })
  } else {
    res.status(401).json({ success: false, message: 'Not authenticated' })
  }
})

router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ success: false, message: 'Logout failed' })
    res.json({ success: true, message: 'Logged out' })
  })
})

module.exports = router
