CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(254) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(10) NOT NULL DEFAULT 'USER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT users_email_unique
        UNIQUE (email),

    CONSTRAINT users_email_normalized
        CHECK (
            email <> ''
            AND email = lower(email)
            AND email = btrim(email)
        ),

    CONSTRAINT users_password_hash_nonempty
        CHECK (password_hash <> ''),

    CONSTRAINT users_role_allowed
        CHECK (role IN ('USER', 'ADMIN'))
);