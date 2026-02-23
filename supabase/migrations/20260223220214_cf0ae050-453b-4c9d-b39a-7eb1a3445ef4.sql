-- Clean up stuck matches older than 15 minutes
UPDATE matches SET status = 'finished' WHERE status = 'playing' AND created_at < now() - interval '15 minutes';

-- Clean up matchmaking queue
DELETE FROM matchmaking_queue;