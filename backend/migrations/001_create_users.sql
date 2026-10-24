CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid(),
    email VARCHAR(254),
    password_hash TEXT,
    role VARCHAR(10) DEFAULT 'USER',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);