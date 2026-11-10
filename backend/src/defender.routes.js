// defender.routes.js - protected event-view endpoints (Student B).
// Authorization is enforced HERE on the server; hiding the React page is not security.
const express = require('express');
const db = require('./db');
const { requireRole } = require('./auth');

const router = express.Router();
router.use(requireRole('DEFENDER'));

// GET /api/defender/events?limit=50&offset=0
router.get('/events', async (req, res, next) => {
  try {
    const { events, total } = await db.listSecurityEvents({
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json({ events, total });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
