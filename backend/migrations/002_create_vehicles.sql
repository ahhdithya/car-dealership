CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT vehicles_make_nonblank
        CHECK (btrim(make) <> ''),

    CONSTRAINT vehicles_model_nonblank
        CHECK (btrim(model) <> ''),

    CONSTRAINT vehicles_category_nonblank
        CHECK (btrim(category) <> ''),

    CONSTRAINT vehicles_price_valid
        CHECK (price > 0 AND price <= 9999999999.99),

    CONSTRAINT vehicles_stock_nonnegative
        CHECK (stock >= 0)
);