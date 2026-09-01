import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getTradingState } from "@/lib/trading.functions";

export function useTradingState(accountId: string | null = null) {
  const fetchState = useServerFn(getTradingState);
  return useQuery({
    queryKey: ["trading-state", accountId],
    queryFn: () => fetchState({ data: { accountId } }),
    refetchInterval: 6000,
  });
}
