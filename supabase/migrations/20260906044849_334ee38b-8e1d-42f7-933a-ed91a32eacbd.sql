CREATE TABLE public.deposit_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network text NOT NULL,
  address text NOT NULL,
  memo text,
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.deposit_addresses TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.deposit_addresses TO authenticated;
GRANT ALL ON public.deposit_addresses TO service_role;

ALTER TABLE public.deposit_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deposit addresses readable" ON public.deposit_addresses
  FOR SELECT TO authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "deposit addresses admin write" ON public.deposit_addresses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_deposit_addresses_updated
  BEFORE UPDATE ON public.deposit_addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.deposit_addresses (network, address, memo, instructions, sort_order) VALUES
  ('USDT (TRC20)', 'TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', NULL, 'Send only USDT on the TRON network. Simulated environment — no real funds are moved.', 1),
  ('Bitcoin (BTC)', 'bc1qxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', NULL, 'Send only BTC on the Bitcoin network.', 2),
  ('Ethereum (ERC20)', '0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', NULL, 'Send only USDT/ETH on the Ethereum network.', 3);