const express = require('express')
const passport = require('passport')
const router = express.Router()

router.get('/google', (req, res, next) => {
  const platform = req.query.platform || 'web'
  const returnUrl = req.query.returnUrl
  const state = JSON.stringify({ platform, returnUrl })
  passport.authenticate('google', { scope: ['profile', 'email'], state })(req, res, next)
})

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

    let platform = 'web'
    let returnUrl = null

    try {
      const state = JSON.parse(req.query.state)
      platform = state.platform
      returnUrl = state.returnUrl
    } catch (e) {
      platform = req.query.state || 'web'
    }

    const isMobileApp = (platform === 'ios' || platform === 'android')

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081'
    let targetUrl = ''

    if (isMobileApp && returnUrl) {
      targetUrl = `${returnUrl}?token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify(user))}`
    } else if (isMobileApp) {
      // Fallback if no returnUrl provided (Legacy support)
      const mobileDeepLink = process.env.MOBILE_DEEP_LINK || 'minutemeals://'
      targetUrl = `${mobileDeepLink}?token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify(user))}`
    } else {
      targetUrl = `${frontendUrl}?token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify(user))}`
    }

    res.send(`
      <html>
        <head><meta http-equiv="refresh" content="0; url=${targetUrl}" /></head>
        <body>
          <h2>Sign in successful!</h2>
          <p>Redirecting back to app...</p>
          <script>window.location.href = '${targetUrl}'</script>
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
