const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'stock-analytics-secret-key';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.userId = null;
    return next(); // Allow unauthenticated access for public routes
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    req.userId = null;
    next();
  }
}

function requireAuth(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

module.exports = { authenticateToken, requireAuth };
