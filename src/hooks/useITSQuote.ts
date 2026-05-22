import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getItsQuote, searchAddresses, getAddressDetails } from "@/lib/its.functions";
import type { ITSQuoteResult, ITSAddressDetails, ITSAddressSuggestion } from "@/types/its";

export function useITSQuote() {
  const fn = useServerFn(getItsQuote);
  return useMutation<
    ITSQuoteResult,
    Error,
    { schoolName: string; postcode: string; address?: ITSAddressDetails }
  >({
    mutationFn: (vars) => fn({ data: vars }) as Promise<ITSQuoteResult>,
  });
}

export function useAddressSearch() {
  const fn = useServerFn(searchAddresses);
  return useMutation<
    | { ok: true; suggestions: ITSAddressSuggestion[] }
    | { ok: false; error: string; code: string },
    Error,
    { postcode: string }
  >({
    mutationFn: (vars) =>
      fn({ data: vars }) as Promise<
        | { ok: true; suggestions: ITSAddressSuggestion[] }
        | { ok: false; error: string; code: string }
      >,
  });
}

export function useAddressDetails() {
  const fn = useServerFn(getAddressDetails);
  return useMutation<
    { ok: true; address: ITSAddressDetails } | { ok: false; error: string },
    Error,
    { id: string }
  >({
    mutationFn: (vars) =>
      fn({ data: vars }) as Promise<
        { ok: true; address: ITSAddressDetails } | { ok: false; error: string }
      >,
  });
}
