
const express = require('express');
const db = require('./db');
const { requireRole } = require('./auth');

const router = express.Router();

router.use(requireRole('DEFENDER'));

// GET /api/defender/events?limit=50&offset=0
router.get('/events', async (req, res, next) => {
  try {
    const result = await db.listSecurityEvents({
      limit: req.query.limit,
      offset: req.query.offset,
    });

    res.set('Cache-Control', 'no-store');
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
