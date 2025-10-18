-- Add block mappings table to cache blockTime -> blockId mappings
-- This avoids repeated public API calls for the same blocks

CREATE TABLE IF NOT EXISTS public.block_mappings (
    block_time bigint NOT NULL,
    block_id text NOT NULL,
    production_time bigint,
    cached_at timestamp DEFAULT NOW(),
    CONSTRAINT block_mappings_pkey PRIMARY KEY (block_time),
    CONSTRAINT block_mappings_block_id_unique UNIQUE (block_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_block_mappings_block_time ON public.block_mappings (block_time);
CREATE INDEX IF NOT EXISTS idx_block_mappings_cached_at ON public.block_mappings (cached_at DESC);

COMMENT ON TABLE public.block_mappings IS 'Cached blockTime to blockId mappings to avoid repeated public API calls';