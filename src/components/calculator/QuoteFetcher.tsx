import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, RefreshCw, Search, AlertCircle, CheckCircle2, MapPin } from "lucide-react";
import { toast } from "sonner";
import {
  useITSQuote,
  useAddressSearch,
  useAddressDetails,
} from "@/hooks/useITSQuote";
import type {
  ITSAddressDetails,
  ITSAddressSuggestion,
  ITSQuoteResponse,
} from "@/types/its";

interface Props {
  schoolName: string;
  postcode: string;
  onSchoolNameChange: (v: string) => void;
  onPostcodeChange: (v: string) => void;
  onQuote: (quote: ITSQuoteResponse) => void;
  children?: React.ReactNode;
}

export function QuoteFetcher({
  schoolName,
  postcode,
  onSchoolNameChange,
  onPostcodeChange,
  onQuote,
  children,
}: Props) {
  const quoteMutation = useITSQuote();
  const addressSearch = useAddressSearch();
  const addressDetails = useAddressDetails();
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<ITSAddressSuggestion[]>([]);
  const [chosen, setChosen] = useState<{ id: string; address: string } | null>(null);

  const fetchQuoteWithAddress = async (addr: ITSAddressDetails) => {
    const result = await quoteMutation.mutateAsync({
      schoolName: schoolName.trim(),
      postcode: postcode.trim().toUpperCase(),
      address: addr,
    });
    if (result.ok) {
      onQuote(result);
      setLastFetched(result.fetchedAt);
      setIsMock(!!result.isMock);
    }
  };

  const startLookup = async () => {
    if (!schoolName.trim() || !postcode.trim()) return;
    setChosen(null);
    const res = await addressSearch.mutateAsync({
      postcode: postcode.trim().toUpperCase(),
    });
    if (!res.ok) {
      // Address lookup failed. Offer a fallback: query ITS without an address.
      toast.error(res.error);
      if (res.code === "MISSING_KEY" || res.code === "UNAUTHORIZED") {
        // Run a postcode-only quote so the user still gets results.
        await fetchQuoteWithAddress({
          postcode: postcode.trim().toUpperCase(),
          line_1: schoolName.trim(),
          line_2: "",
          line_3: "",
          town: "",
          county: "",
          premise: "",
          thoroughfare: "",
        });
      }
      return;
    }
    setSuggestions(res.suggestions);
    // Always open the picker — the user must explicitly choose, even when one
    // result is returned, to confirm 100% correct address selection.
    setPickerOpen(true);
  };

  const pickAddress = async (s: ITSAddressSuggestion) => {
    setChosen(s);
    const res = await addressDetails.mutateAsync({ id: s.id });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setPickerOpen(false);
    await fetchQuoteWithAddress(res.address);
  };

  const result = quoteMutation.data;
  const error = quoteMutation.error;
  const isLoading =
    quoteMutation.isPending || addressSearch.isPending || addressDetails.isPending;
  const disabled =
    isLoading || !schoolName.trim() || postcode.trim().length < 5;

  return (
    <div className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div>
        <h3 className="font-semibold text-sm">Live pricing — ITS Technology Group</h3>
        <p className="text-xs text-muted-foreground">
          Enter the school name and postcode, then pick the exact site address.
        </p>
      </div>

      <div className="grid sm:grid-cols-[1fr_180px_auto] gap-3">
        <div>
          <Label className="text-xs">School name</Label>
          <Input
            value={schoolName}
            onChange={(e) => onSchoolNameChange(e.target.value)}
            placeholder="St Mary's Primary"
          />
        </div>
        <div>
          <Label className="text-xs">Postcode</Label>
          <Input
            value={postcode}
            onChange={(e) => onPostcodeChange(e.target.value.toUpperCase())}
            placeholder="SW1A 1AA"
          />
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            onClick={startLookup}
            disabled={disabled}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />{" "}
                {addressSearch.isPending
                  ? "Finding addresses…"
                  : addressDetails.isPending
                    ? "Loading address…"
                    : "Fetching…"}
              </>
            ) : lastFetched ? (
              <>
                <RefreshCw className="h-4 w-4" /> Re-pick address
              </>
            ) : (
              <>
                <Search className="h-4 w-4" /> Find address & get pricing
              </>
            )}
          </Button>
        </div>
      </div>

      {chosen && (
        <div className="flex items-start gap-2 text-xs">
          <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <span className="text-muted-foreground">Selected site:</span>{" "}
            <span className="font-medium">{chosen.address}</span>
          </div>
        </div>
      )}

      {quoteMutation.isPending && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      )}

      {!quoteMutation.isPending && result && !result.ok && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {result.code === "POSTCODE_NOT_FOUND"
              ? "Postcode not found"
              : result.code === "NO_AVAILABILITY"
                ? "No services available"
                : result.code === "MISSING_KEY"
                  ? "API not configured"
                  : "Couldn't fetch pricing"}
          </AlertTitle>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      )}

      {!quoteMutation.isPending && error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Network error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {!quoteMutation.isPending && result?.ok && lastFetched && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <div>
              {result.products.length} product{result.products.length === 1 ? "" : "s"} from{" "}
              <span className="font-medium text-foreground">{result.carrier}</span>
              {isMock && (
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                  MOCK DATA
                </span>
              )}
            </div>
            <div>Last updated: {new Date(lastFetched).toLocaleString("en-GB")}</div>
          </div>
        </div>
      )}

      {children}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select the correct site</DialogTitle>
            <DialogDescription>
              {suggestions.length} address{suggestions.length === 1 ? "" : "es"} found for{" "}
              <span className="font-medium">{postcode.toUpperCase()}</span>. Pick the exact
              property to ensure ITS returns accurate carrier pricing.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
            <ul className="divide-y">
              {suggestions.map((s) => {
                const isBusy = addressDetails.isPending && chosen?.id === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      disabled={addressDetails.isPending}
                      onClick={() => pickAddress(s)}
                      className="w-full text-left py-2.5 px-2 hover:bg-accent/40 rounded text-sm flex items-center justify-between gap-3 disabled:opacity-50"
                    >
                      <span className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <span>{s.address}</span>
                      </span>
                      {isBusy && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
