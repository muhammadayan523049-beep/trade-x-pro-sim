
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE TYPE public.account_type AS ENUM ('demo','live');
CREATE TYPE public.order_side AS ENUM ('buy','sell');
CREATE TYPE public.order_kind AS ENUM ('market','limit','stop');
CREATE TYPE public.order_status AS ENUM ('pending','filled','cancelled','rejected');
CREATE TYPE public.position_status AS ENUM ('open','closed');
CREATE TYPE public.txn_type AS ENUM ('deposit','withdrawal','trade','fee','adjustment');
CREATE TYPE public.txn_status AS ENUM ('pending','completed','rejected');
CREATE TYPE public.kyc_status AS ENUM ('not_started','pending','approved','rejected');
CREATE TYPE public.instrument_category AS ENUM ('forex','stocks','crypto','indices','commodities');

-- UPDATED_AT HELPER
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  phone text,
  country text,
  language text NOT NULL DEFAULT 'en',
  theme text NOT NULL DEFAULT 'light',
  two_factor_enabled boolean NOT NULL DEFAULT false,
  notify_email boolean NOT NULL DEFAULT true,
  notify_push boolean NOT NULL DEFAULT true,
  notify_trade_alerts boolean NOT NULL DEFAULT true,
  default_lots numeric NOT NULL DEFAULT 0.10,
  default_leverage integer NOT NULL DEFAULT 100,
  is_suspended boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "profiles own read" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles own update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles own insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "roles read" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- ACCOUNTS
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type public.account_type NOT NULL DEFAULT 'demo',
  currency text NOT NULL DEFAULT 'USD',
  balance numeric(18,2) NOT NULL DEFAULT 0,
  leverage integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, type)
);
CREATE INDEX idx_accounts_user ON public.accounts(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "accounts own" ON public.accounts FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- INSTRUMENTS (public read)
CREATE TABLE public.instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL UNIQUE,
  name text NOT NULL,
  category public.instrument_category NOT NULL,
  base_price numeric(18,6) NOT NULL,
  spread numeric(12,6) NOT NULL DEFAULT 0.0002,
  volatility numeric(8,5) NOT NULL DEFAULT 0.004,
  digits integer NOT NULL DEFAULT 2,
  contract_size numeric(18,2) NOT NULL DEFAULT 100000,
  is_tradable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_instruments_category ON public.instruments(category);
GRANT SELECT ON public.instruments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instruments TO authenticated;
GRANT ALL ON public.instruments TO service_role;
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "instruments public read" ON public.instruments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "instruments admin write" ON public.instruments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ORDERS
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  side public.order_side NOT NULL,
  kind public.order_kind NOT NULL DEFAULT 'market',
  quantity numeric(12,2) NOT NULL,
  limit_price numeric(18,6),
  stop_price numeric(18,6),
  stop_loss numeric(18,6),
  take_profit numeric(18,6),
  status public.order_status NOT NULL DEFAULT 'pending',
  filled_price numeric(18,6),
  filled_at timestamptz,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_user ON public.orders(user_id, created_at DESC);
CREATE INDEX idx_orders_status ON public.orders(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "orders own" ON public.orders FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- POSITIONS
CREATE TABLE public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  symbol text NOT NULL,
  side public.order_side NOT NULL,
  quantity numeric(12,2) NOT NULL,
  entry_price numeric(18,6) NOT NULL,
  close_price numeric(18,6),
  stop_loss numeric(18,6),
  take_profit numeric(18,6),
  margin numeric(18,2) NOT NULL DEFAULT 0,
  realized_pl numeric(18,2),
  status public.position_status NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_positions_user ON public.positions(user_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positions TO authenticated;
GRANT ALL ON public.positions TO service_role;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_positions_updated BEFORE UPDATE ON public.positions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "positions own" ON public.positions FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- TRANSACTIONS
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  type public.txn_type NOT NULL,
  amount numeric(18,2) NOT NULL,
  status public.txn_status NOT NULL DEFAULT 'pending',
  method text,
  reference text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_txn_user ON public.transactions(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_txn_updated BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "txn own" ON public.transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- PAYMENT METHODS
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'card',
  last4 text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pm_user ON public.payment_methods(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pm own" ON public.payment_methods FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- KYC
CREATE TABLE public.kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  first_name text,
  last_name text,
  date_of_birth date,
  nationality text,
  address_line1 text,
  address_line2 text,
  city text,
  postal_code text,
  country text,
  document_type text,
  document_number text,
  document_ref text,
  proof_of_address_ref text,
  status public.kyc_status NOT NULL DEFAULT 'not_started',
  review_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kyc_submissions TO authenticated;
GRANT ALL ON public.kyc_submissions TO service_role;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_kyc_updated BEFORE UPDATE ON public.kyc_submissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "kyc own" ON public.kyc_submissions FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- WATCHLIST
CREATE TABLE public.watchlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist_items TO authenticated;
GRANT ALL ON public.watchlist_items TO service_role;
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watchlist own" ON public.watchlist_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON public.notifications(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif own" ON public.notifications FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity text,
  entity_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit admin read" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "audit insert own" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- NEW USER BOOTSTRAP: profile + roles (first user is admin) + demo/live accounts + kyc row
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first boolean;
  demo_id uuid;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, COALESCE(NEW.email,''), COALESCE(NEW.raw_user_meta_data->>'full_name',''))
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO is_first;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first THEN 'admin'::public.app_role ELSE 'user'::public.app_role END)
  ON CONFLICT DO NOTHING;
  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.accounts (user_id, type, balance, leverage)
  VALUES (NEW.id, 'demo', 100000, 100) ON CONFLICT DO NOTHING RETURNING id INTO demo_id;
  INSERT INTO public.accounts (user_id, type, balance, leverage)
  VALUES (NEW.id, 'live', 0, 100) ON CONFLICT DO NOTHING;

  INSERT INTO public.kyc_submissions (user_id, status) VALUES (NEW.id, 'not_started')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.watchlist_items (user_id, symbol)
  SELECT NEW.id, s FROM unnest(ARRAY['EURUSD','BTCUSD','AAPL','XAUUSD','SPX500']) s
  ON CONFLICT DO NOTHING;

  INSERT INTO public.notifications (user_id, title, body)
  VALUES (NEW.id, 'Welcome to TradeX', 'Your demo account is funded with $100,000 of simulated capital. All prices and trades are simulated.');

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SEED INSTRUMENTS
INSERT INTO public.instruments (symbol,name,category,base_price,spread,volatility,digits,contract_size) VALUES
('EURUSD','Euro / US Dollar','forex',1.0842,0.00012,0.0025,5,100000),
('GBPUSD','British Pound / US Dollar','forex',1.2714,0.00016,0.0028,5,100000),
('USDJPY','US Dollar / Japanese Yen','forex',157.32,0.014,0.0026,3,100000),
('AUDUSD','Australian Dollar / US Dollar','forex',0.6642,0.00018,0.0030,5,100000),
('USDCAD','US Dollar / Canadian Dollar','forex',1.3688,0.00019,0.0024,5,100000),
('GBPJPY','British Pound / Japanese Yen','forex',199.64,0.028,0.0038,3,100000),
('USDCHF','US Dollar / Swiss Franc','forex',0.8974,0.00020,0.0023,5,100000),
('AAPL','Apple Inc.','stocks',189.44,0.02,0.0090,2,100),
('MSFT','Microsoft Corp.','stocks',441.12,0.04,0.0085,2,100),
('TSLA','Tesla Inc.','stocks',248.60,0.05,0.0220,2,100),
('AMZN','Amazon.com Inc.','stocks',186.72,0.03,0.0110,2,100),
('NVDA','NVIDIA Corp.','stocks',124.80,0.03,0.0250,2,100),
('GOOGL','Alphabet Inc.','stocks',178.35,0.03,0.0100,2,100),
('META','Meta Platforms','stocks',503.21,0.05,0.0130,2,100),
('BTCUSD','Bitcoin / US Dollar','crypto',67240.50,6.50,0.0180,2,1),
('ETHUSD','Ethereum / US Dollar','crypto',3512.40,1.20,0.0210,2,1),
('SOLUSD','Solana / US Dollar','crypto',148.62,0.18,0.0320,2,1),
('XRPUSD','Ripple / US Dollar','crypto',0.5218,0.0008,0.0290,4,1),
('ADAUSD','Cardano / US Dollar','crypto',0.3914,0.0006,0.0300,4,1),
('DOGEUSD','Dogecoin / US Dollar','crypto',0.1284,0.0004,0.0400,4,1),
('SPX500','S&P 500 Index','indices',5431.20,0.45,0.0060,2,10),
('NAS100','Nasdaq 100 Index','indices',18204.60,1.20,0.0075,2,10),
('DJ30','Dow Jones 30','indices',38912.40,2.00,0.0055,2,10),
('GER40','DAX 40 Index','indices',18344.10,1.60,0.0065,2,10),
('UK100','FTSE 100 Index','indices',8215.30,1.10,0.0050,2,10),
('JP225','Nikkei 225','indices',38765.00,6.00,0.0070,2,10),
('XAUUSD','Gold / US Dollar','commodities',2331.20,0.28,0.0070,2,100),
('XAGUSD','Silver / US Dollar','commodities',29.42,0.02,0.0140,3,5000),
('USOIL','WTI Crude Oil','commodities',78.36,0.03,0.0150,2,1000),
('UKOIL','Brent Crude Oil','commodities',82.14,0.04,0.0145,2,1000),
('NATGAS','Natural Gas','commodities',2.684,0.006,0.0260,3,10000);
