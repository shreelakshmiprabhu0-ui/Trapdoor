// Fake data used while the backend is being built (VITE_USE_MOCK=true).
// Shapes follow the agreed API contract in docs/API_CONTRACT.md.

export const mockUsers = {
  'demo@trapdoor.test': {
    password: 'demo123',
    user: { id: 1, name: 'Demo User', email: 'demo@trapdoor.test', role: 'USER' },
  },
  'defender@trapdoor.test': {
    password: 'defender123',
    user: { id: 2, name: 'Dana Defender', email: 'defender@trapdoor.test', role: 'DEFENDER' },
  },
};

export const mockPortal = {
  items: [
    { id: 1, title: 'Welcome to the portal', body: 'This is your workspace. Notes you add here are only visible to you.', createdAt: '2026-11-01T09:00:00Z' },
    { id: 2, title: 'Quarterly checklist', body: 'Review access list, update contact details, confirm backup owner.', createdAt: '2026-11-03T14:30:00Z' },
    { id: 3, title: 'Team meeting notes', body: 'Agree API contract on Monday. Merge integration branch twice a week.', createdAt: '2026-11-04T11:15:00Z' },
  ],
};

export const mockEvents = {
  events: [
    { id: 14, eventType: 'TRAP_ROUTE_ACCESSED', route: '/api/internal/backups', method: 'GET', sessionRef: 'sess_a91f', createdAt: '2026-11-05T10:20:00Z', details: { userAgent: 'curl/8.4.0' } },
    { id: 13, eventType: 'TRAP_ROUTE_ACCESSED', route: '/api/internal/config', method: 'GET', sessionRef: 'sess_a91f', createdAt: '2026-11-05T10:18:42Z', details: { userAgent: 'curl/8.4.0' } },
    { id: 12, eventType: 'TRAP_ROUTE_ACCESSED', route: '/api/internal/admin', method: 'GET', sessionRef: 'sess_77c2', createdAt: '2026-11-05T09:02:10Z' },
  ],
};
