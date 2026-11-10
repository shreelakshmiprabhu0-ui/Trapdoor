// portal.routes.js - normal (real) portal endpoints (Student B).
const express = require('express');
const db = require('./db');
const { requireAuth, sendError } = require('./auth');

const router = express.Router();
router.use(requireAuth);

const toNote = (r) => ({
  id: r.id,
  title: r.title,
  body: r.content,
  createdAt: new Date(r.created_at).toISOString(),
});

// GET /api/portal - current user + their real notes
router.get('/', async (req, res, next) => {
  try {
    const rows = await db.query(
      'SELECT id, title, content, created_at FROM notes WHERE user_id = ? ORDER BY id DESC',
      [req.session.user.id]
    );
    res.json({ user: req.session.user, items: rows.map(toNote) });
  } catch (err) {
    next(err);
  }
});

// POST /api/portal/notes  { title, content }
router.post('/notes', async (req, res, next) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    if (title.length < 1 || title.length > 100) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Title must be 1-100 characters.');
    }
    if (content.length > 1000) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Content must be at most 1000 characters.');
    }
    const [result] = await db.pool.execute(
      'INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)',
      [req.session.user.id, title, content]
    );
    const rows = await db.query(
      'SELECT id, title, content, created_at FROM notes WHERE id = ? AND user_id = ?',
      [result.insertId, req.session.user.id]
    );
    res.status(201).json({ note: toNote(rows[0]) });
  } catch (err) {
    next(err);
  }
});


// PUT /api/portal/notes/:id { title, content } - owner only
router.put('/notes/:id', async (req, res, next) => {
  try {
    if (!/^\d{1,10}$/.test(req.params.id)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid note id.');
    }
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    if (title.length < 1 || title.length > 100) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Title must be 1-100 characters.');
    }
    if (content.length > 1000) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Content must be at most 1000 characters.');
    }
    const [result] = await db.pool.execute(
      'UPDATE notes SET title = ?, content = ? WHERE id = ? AND user_id = ?',
      [title, content, Number(req.params.id), req.session.user.id]
    );
    if (result.affectedRows === 0) return sendError(res, 404, 'NOT_FOUND', 'Note not found.');
    const rows = await db.query(
      'SELECT id, title, content, created_at FROM notes WHERE id = ? AND user_id = ?',
      [Number(req.params.id), req.session.user.id]
    );
    res.json({ note: toNote(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/portal/notes/:id - owner only
router.delete('/notes/:id', async (req, res, next) => {
  try {
    if (!/^\d{1,10}$/.test(req.params.id)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid note id.');
    }
    const [result] = await db.pool.execute(
      'DELETE FROM notes WHERE id = ? AND user_id = ?',
      [Number(req.params.id), req.session.user.id]
    );
    if (result.affectedRows === 0) return sendError(res, 404, 'NOT_FOUND', 'Note not found.');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
