
/**
 * trap-interaction.routes.js
 *
 * Records browser-facing interactions with synthetic trap resources.
 *
 * Mounted AFTER CSRF protection in app.js.
 * Uses the existing eventLogger and synthetic backup allowlist.
 */

const express = require('express');
const { getDecoyResponse } = require('./trapData');
const { logTrapAccess } = require('./eventLogger');

const router = express.Router({
  caseSensitive: true,
  strict: true,
});

// Forward async errors to Express error middleware.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Record access to the browser-facing fake admin page.
router.post('/api/internal/admin/page-access', asyncHandler(async (req, res) => {
  await logTrapAccess(req, {
    route: '/internal/admin',
    method: 'POST',
    eventType: 'ADMIN_PAGE_ACCESSED',
  });

  res.set('Cache-Control', 'no-store');

  return res.json({ ok: true });
}));

// Record a click on a synthetic backup's Details button.
router.post('/api/internal/backups/details', asyncHandler(async (req, res) => {
  const filename = req.body?.filename;

  // Validate against the trusted synthetic backup list.
  const backupData = getDecoyResponse('/api/internal/backups');

  const validBackup = backupData?.backups?.find(
    (backup) => backup.filename === filename
  );

  if (!validBackup) {
    return res.status(400).json({
      error: 'Invalid backup selection',
    });
  }

  await logTrapAccess(req, {
    route: '/api/internal/backups/details',
    method: 'POST',
    eventType: 'BACKUP_DETAILS_VIEWED',
    details: {
      filename: validBackup.filename,
    },
  });

  res.set('Cache-Control', 'no-store');

  return res.json({ ok: true });
}));

module.exports = router;