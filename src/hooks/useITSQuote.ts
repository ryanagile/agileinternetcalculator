import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getItsQuote } from "@/lib/its.functions";
import type { ITSQuoteResult } from "@/types/its";

export function useITSQuote() {
  const fn = useServerFn(getItsQuote);
  return useMutation<ITSQuoteResult, Error, { schoolName: string; postcode: string }>({
    mutationFn: (vars) => fn({ data: vars }) as Promise<ITSQuoteResult>,
  });
}
