const express = require('express');
const passport = require('passport');
const router = express.Router();

// Google OAuth login
router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth callback
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        // Successful authentication - create JWT
        const jwt = require('jsonwebtoken');

        const user = {
            id: req.user._id.toString(),
            email: req.user.email,
            name: req.user.name
        };

        // Generate JWT token
        const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '30d' });

        // Redirect to app with token
        // The app will catch this URL and extract the token
        res.send(`
      <html>
        <head>
          <meta http-equiv="refresh" content="0; url=exp://172.20.10.3:8081/--/auth/callback?token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify(user))}" />
        </head>
        <body>
          <h2>✅ Sign in successful!</h2>
          <p>Redirecting back to app...</p>
          <script>
            // Redirect immediately
            window.location.href = 'exp://172.20.10.3:8081/--/auth/callback?token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify(user))}';
          </script>
        </body>
      </html>
    `);
    }
);

// Get current user
router.get('/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            success: true,
            user: {
                id: req.user._id,
                email: req.user.email,
                name: req.user.name
            }
        });
    } else {
        res.status(401).json({ success: false, message: 'Not authenticated' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Logout failed' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

module.exports = router;
