-- DDOS & BRUTE FORCE PROTECTION MIGRATION
-- This migration implements server-side rate limiting and anti-spam measures

-- 1. Create a table for tracking request frequency (Rate Limiting)
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
    key TEXT PRIMARY KEY,
    tokens FLOAT NOT NULL,
    max_tokens INTEGER NOT NULL,
    refill_rate FLOAT NOT NULL, -- tokens per second
    last_update TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on rate_limit_buckets (Safety first)
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- 2. Create a function to check and consume tokens (Generic Rate Limiter)
-- Based on the Token Bucket Algorithm
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_key TEXT,
    p_max_tokens INTEGER,
    p_refill_rate FLOAT -- tokens per second
) RETURNS BOOLEAN 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_bucket RECORD;
    v_new_tokens FLOAT;
BEGIN
    -- Get current bucket or create new one
    INSERT INTO public.rate_limit_buckets (key, tokens, max_tokens, refill_rate, last_update)
    VALUES (p_key, p_max_tokens - 1, p_max_tokens, p_refill_rate, v_now)
    ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key
    RETURNING * INTO v_bucket;

    -- Calculate refill since last update
    v_new_tokens := LEAST(
        v_bucket.max_tokens,
        v_bucket.tokens + (EXTRACT(EPOCH FROM (v_now - v_bucket.last_update)) * v_bucket.refill_rate)
    );

    IF v_new_tokens >= 1 THEN
        -- Consume one token
        UPDATE public.rate_limit_buckets 
        SET tokens = v_new_tokens - 1,
            last_update = v_now
        WHERE key = p_key;
        RETURN TRUE;
    ELSE
        -- No tokens available
        RETURN FALSE;
    END IF;
END;
$$;

-- 3. Apply rate limiting to the Signup Trigger
-- This prevents massive automated registration attacks
CREATE OR REPLACE FUNCTION public.apply_signup_rate_limit()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Limit global signup rate to 5 per minute (0.083 per second)
    -- This protects the system from flooding
    IF NOT public.check_rate_limit('global_signup', 5, 0.0833) THEN
        RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED: Too many registration attempts. Please try again in a few minutes.';
    END IF;

    -- Limit per-email signup attempts (preventing targeted spam)
    -- 3 tries per hour (0.000833 per second)
    IF NOT public.check_rate_limit('signup_email_' || LOWER(NEW.email), 3, 0.000833) THEN
        RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED: Too many attempts for this email address.';
    END IF;

    RETURN NEW;
END;
$$;

-- Create a BEFORE trigger for signup rate limiting
-- Note: handle_new_user_signup is AFTER, we want to block BEFORE we do any work
DROP TRIGGER IF EXISTS on_auth_user_created_rate_limit ON auth.users;
CREATE TRIGGER on_auth_user_created_rate_limit
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_signup_rate_limit();

-- 4. Secure the rate limit table
REVOKE ALL ON public.rate_limit_buckets FROM anon, authenticated;
GRANT SELECT ON public.rate_limit_buckets TO service_role;
