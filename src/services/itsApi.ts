// Thin re-export so feature code can import from a stable "service" path.
// All actual API/network work happens server-side in the createServerFn.
export { getItsQuote } from "@/lib/its.functions";
export { useITSQuote } from "@/hooks/useITSQuote";
