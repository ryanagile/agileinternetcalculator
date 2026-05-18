import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, RefreshCw, Search, AlertCircle, CheckCircle2 } from "lucide-react";
import { useITSQuote } from "@/hooks/useITSQuote";
import type { ITSQuoteResponse } from "@/types/its";

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
}: Props) {
  const mutation = useITSQuote();
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);

  const fetchPricing = async () => {
    if (!schoolName.trim() || !postcode.trim()) return;
    const result = await mutation.mutateAsync({
      schoolName: schoolName.trim(),
      postcode: postcode.trim().toUpperCase(),
    });
    if (result.ok) {
      onQuote(result);
      setLastFetched(result.fetchedAt);
      setIsMock(!!result.isMock);
    }
  };

  const result = mutation.data;
  const error = mutation.error;
  const disabled =
    mutation.isPending || !schoolName.trim() || postcode.trim().length < 5;

  return (
    <div className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div>
        <h3 className="font-semibold text-sm">Live pricing — ITS Technology Group</h3>
        <p className="text-xs text-muted-foreground">
          Enter the school name and postcode, then fetch live carrier pricing.
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
            onClick={fetchPricing}
            disabled={disabled}
            className="w-full sm:w-auto"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Fetching…
              </>
            ) : lastFetched ? (
              <>
                <RefreshCw className="h-4 w-4" /> Refresh
              </>
            ) : (
              <>
                <Search className="h-4 w-4" /> Get pricing
              </>
            )}
          </Button>
        </div>
      </div>

      {mutation.isPending && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      )}

      {!mutation.isPending && result && !result.ok && (
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
          <AlertDescription>
            {result.error}
            <Button
              variant="link"
              size="sm"
              onClick={fetchPricing}
              className="ml-1 h-auto p-0 text-destructive underline"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!mutation.isPending && error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Network error</AlertTitle>
          <AlertDescription>
            {error.message}
            <Button
              variant="link"
              size="sm"
              onClick={fetchPricing}
              className="ml-1 h-auto p-0 text-destructive underline"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!mutation.isPending && result?.ok && lastFetched && (
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
    </div>
  );
}
