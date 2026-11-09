-- TRAPDOOR demo seed data (owned by Student B). DEMO ONLY - bcrypt hashes, cost 12.
--   demo@trapdoor.local      / Demo#User123     (role USER)
--   defender@trapdoor.local  / Defend#Trap123   (role DEFENDER)
-- Change these before any shared deployment.

INSERT INTO users (name, email, password_hash, role) VALUES
 ('Demo User',     'demo@trapdoor.local',     '$2b$12$4.9nqWJsE3sptHh0M2OROeh4YsdRRqUrX5ON.YOpvls1ypb/ywly6', 'USER'),
 ('Demo Defender', 'defender@trapdoor.local', '$2b$12$6k.iE/NArksxgjmf7FLun.Fh9.idr61XrPa3n1HAtrgB7u0J00fVu', 'DEFENDER');

INSERT INTO notes (user_id, title, content)
SELECT id, 'Welcome to TRAPDOOR', 'This is a real note stored in the real MySQL database.'
FROM users WHERE email = 'demo@trapdoor.local';

INSERT INTO notes (user_id, title, content)
SELECT id, 'Project checklist', 'Log in, view notes, add a note, log out.'
FROM users WHERE email = 'demo@trapdoor.local';
