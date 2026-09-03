CREATE TYPE public.binary_direction AS ENUM ('up','down');
CREATE TYPE public.binary_status AS ENUM ('open','won','lost','tie');

CREATE TABLE public.binary_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  direction public.binary_direction NOT NULL,
  stake numeric NOT NULL CHECK (stake > 0),
  payout_rate numeric NOT NULL DEFAULT 0.85,
  duration_seconds integer NOT NULL,
  entry_price numeric NOT NULL,
  expiry_price numeric,
  payout numeric,
  status public.binary_status NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX binary_trades_user_idx ON public.binary_trades(user_id, created_at DESC);
CREATE INDEX binary_trades_open_idx ON public.binary_trades(status, expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.binary_trades TO authenticated;
GRANT ALL ON public.binary_trades TO service_role;

ALTER TABLE public.binary_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "binary own" ON public.binary_trades FOR ALL TO authenticated
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));