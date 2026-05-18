import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Download, FileText, Save, Trash2, Calculator as CalcIcon, GitCompare, MapPin, Table as TableIcon } from "lucide-react";
import {
  BACKUPS,
  SPEEDS,
  SavedQuote,
  calculate,
  defaultInput,
  deleteQuote,
  fmt,
  loadQuotes,
  saveQuote,
  QuoteInput,
} from "@/lib/calculator";
import { generateCustomerPDF, generateInternalPDF } from "@/lib/pdf";
import { QuoteFetcher } from "@/components/calculator/QuoteFetcher";
import type { ITSQuoteResponse, ITSProduct, ITSAddress } from "@/types/its";

const SUPPLIER_LABEL: Record<string, string> = {
  bt: "Openreach",
  openreach: "Openreach",
  sky: "Sky",
  virgin_media: "Virgin Media",
  cityfibre: "CityFibre",
  virtual1: "Virtual1",
  glide: "Glide",
  zen: "Zen",
  talktalk: "TalkTalk",
};
const labelFor = (s: string) =>
  SUPPLIER_LABEL[(s ?? "").toLowerCase()] ??
  (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "Unknown");

function formatItsReference(schoolName: string, address: ITSAddress): string {
  const parts = [
    schoolName,
    address.address_line_1,
    address.address_line_2,
    address.address_line_3,
    address.town,
    address.county,
    address.postcode,
  ].filter((p): p is string => !!p && String(p).trim().length > 0);
  const base = parts.join(", ");
  return address.uprn ? `${base} - UPRN:${address.uprn}` : base;
}

export const Route = createFileRoute("/")({
  component: CalculatorPage,
  head: () => ({
    meta: [
      { title: "AgileInternet Price Calculator" },
      { name: "description", content: "Build school connectivity quotes for AgileInternet." },
    ],
  }),
});

function CalculatorPage() {
  const [input, setInput] = useState<QuoteInput>(defaultInput);
  const [saved, setSaved] = useState<SavedQuote[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [itsQuote, setItsQuote] = useState<ITSQuoteResponse | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);

  useEffect(() => {
    setSaved(loadQuotes());
  }, []);

  const breakdown = useMemo(() => calculate(input), [input]);

  const update = <K extends keyof QuoteInput>(key: K, value: QuoteInput[K]) =>
    setInput((p) => ({ ...p, [key]: value }));

  const applyProduct = (p: ITSProduct, addr?: ITSAddress) => {
    const carrierLabel = labelFor(p.supplier);
    setInput((prev) => ({
      ...prev,
      carrier: carrierLabel,
      speedMbps: p.speed,
      bearerMbps: p.bearer,
      monthlyLeasedLine: Math.round(Number(p.monthly_cost) * 100) / 100,
      carrierInstallCost: Math.round(Number(p.install_cost) * 100) / 100,
      itsProductUuid: p.uuid,
      itsAddressLine: addr ? formatItsReference(prev.schoolName, addr) : prev.itsAddressLine,
    }));
  };

  const handleItsQuote = (q: ITSQuoteResponse) => {
    setItsQuote(q);
    // Auto-select cheapest product
    const cheapest = [...q.products].sort(
      (a, b) => Number(a.monthly_cost) - Number(b.monthly_cost),
    )[0];
    if (cheapest) {
      applyProduct(cheapest, q.address);
      toast.success(
        `${q.products.length} products loaded · cheapest: ${labelFor(cheapest.supplier)} ${cheapest.speed} Mbps`,
      );
    }
  };

  const handleSave = () => {
    if (!input.schoolName.trim()) {
      toast.error("School name is required to save");
      return;
    }
    const q: SavedQuote = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      input,
      breakdown,
    };
    saveQuote(q);
    setSaved(loadQuotes());
    toast.success("Quote saved");
  };

  const handleDelete = (id: string) => {
    deleteQuote(id);
    setSaved(loadQuotes());
    setCompareIds((p) => p.filter((x) => x !== id));
  };

  const handleLoad = (q: SavedQuote) => {
    setInput(q.input);
    toast.success(`Loaded ${q.input.schoolName}`);
  };

  const toggleCompare = (id: string) => {
    setCompareIds((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );
  };

  const speedComparison = useMemo(() => {
    return SPEEDS.map((s) => {
      const b = calculate({ ...input, speedMbps: s });
      return { speed: s, price: b.finalAnnualPrice, total: b.total3yrPrice, profit: b.profit3yr };
    });
  }, [input]);

  const comparedQuotes = saved.filter((q) => compareIds.includes(q.id));

  const cheapestBySpeed = useMemo<ITSProduct[]>(() => {
    if (!itsQuote) return [];
    const map = new Map<number, ITSProduct>();
    for (const p of itsQuote.products) {
      const cur = map.get(p.speed);
      if (!cur || Number(p.monthly_cost) < Number(cur.monthly_cost)) {
        map.set(p.speed, p);
      }
    }
    const sorted = [...map.values()].sort((a, b) => a.speed - b.speed);
    // Only show a speed when the price changes from the next-higher tier.
    // For runs of consecutive same-price speeds, keep only the highest speed.
    return sorted.filter((p, i) => {
      const next = sorted[i + 1];
      return !next || Number(next.monthly_cost) !== Number(p.monthly_cost);
    });
  }, [itsQuote]);

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <header className="border-b bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
        <div className="mx-auto max-w-7xl px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-primary-foreground/15 flex items-center justify-center">
              <CalcIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">AgileInternet</h1>
              <p className="text-xs opacity-90">School Connectivity Price Calculator</p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-primary-foreground/15 text-primary-foreground border-0">
            v1.0
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Tabs defaultValue="calculator">
          <TabsList className="mb-6">
            <TabsTrigger value="calculator">Calculator</TabsTrigger>
            <TabsTrigger value="saved">Saved Quotes ({saved.length})</TabsTrigger>
            <TabsTrigger value="compare-speeds">Compare Speeds</TabsTrigger>
            <TabsTrigger value="compare-quotes">Compare Quotes</TabsTrigger>
          </TabsList>

          <TabsContent value="calculator">
            <div className="grid lg:grid-cols-[1fr_420px] gap-6">
              {/* Inputs */}
              <Card>
                <CardHeader>
                  <CardTitle>Quote details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <QuoteFetcher
                    schoolName={input.schoolName}
                    postcode={input.postcode}
                    onSchoolNameChange={(v) => update("schoolName", v)}
                    onPostcodeChange={(v) => update("postcode", v)}
                    onQuote={handleItsQuote}
                  >
                    {itsQuote?.address && (
                      <div className="rounded-md border border-primary/20 bg-background/60 p-3 text-sm flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                            ITS reference
                          </p>
                          <p className="font-medium leading-snug">
                            {formatItsReference(input.schoolName, itsQuote.address)}
                          </p>
                        </div>
                      </div>
                    )}

                    {itsQuote && itsQuote.products.length > 0 && (
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setProductModalOpen(true)}
                        >
                          <TableIcon className="h-4 w-4" />
                          Browse ITS results
                        </Button>
                        {input.itsProductUuid ? (
                          <p className="text-xs text-muted-foreground">
                            Selected:{" "}
                            <span className="font-medium text-foreground">{input.carrier}</span> ·{" "}
                            {input.speedMbps} Mbps · £
                            {input.monthlyLeasedLine.toLocaleString("en-GB", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            /mo
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">No product selected.</p>
                        )}
                      </div>
                    )}
                  </QuoteFetcher>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Carrier">
                      <Input value={input.carrier} readOnly className="bg-muted/40" />
                    </Field>
                    <Field label="Speed (Mbps)">
                      <Input value={input.speedMbps} readOnly className="bg-muted/40" />
                    </Field>
                    <Field label="Bearer (Mbps)">
                      <Input value={input.bearerMbps} readOnly className="bg-muted/40" />
                    </Field>
                    <Field label="Monthly leased line cost (£)">
                      <Input value={input.monthlyLeasedLine} readOnly className="bg-muted/40" />
                    </Field>
                    <Field label="Carrier install cost (£)">
                      <Input value={input.carrierInstallCost} readOnly className="bg-muted/40" />
                    </Field>
                    <Field label="Margin (%)">
                      <Input
                        type="number"
                        min={0}
                        value={input.marginPct}
                        onChange={(e) => update("marginPct", Number(e.target.value))}
                      />
                    </Field>
                    <Field label="FortiGate cost (£)">
                      <Input
                        type="number"
                        min={0}
                        value={input.fortigateCost}
                        onChange={(e) => update("fortigateCost", Number(e.target.value))}
                      />
                    </Field>
                    <Field label="Setup cost (£) — internal">
                      <Input
                        type="number"
                        min={0}
                        value={input.setupCost}
                        onChange={(e) => update("setupCost", Number(e.target.value))}
                      />
                    </Field>
                  </div>

                  <Separator />
                  <h3 className="font-semibold">Add-ons</h3>

                  <div className="rounded-lg border p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Netsweeper web filtering</Label>
                        <p className="text-xs text-muted-foreground">£450 setup + £10.80 per pupil (3-year licence)</p>
                      </div>
                      <Switch
                        checked={input.includeNetsweeper}
                        onCheckedChange={(v) => update("includeNetsweeper", v)}
                      />
                    </div>
                    {input.includeNetsweeper && (
                      <Field label="Number of pupils">
                        <Input
                          type="number"
                          min={0}
                          value={input.pupils}
                          onChange={(e) => update("pupils", Number(e.target.value))}
                        />
                      </Field>
                    )}
                  </div>

                  <div className="rounded-lg border p-4">
                    <Field label="Backup internet line">
                      <Select value={input.backup} onValueChange={(v) => update("backup", v as QuoteInput["backup"])}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BACKUPS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                    {input.backup !== "None" && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Cost £650/yr · Sold £950/yr (fixed price, outside margin)
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Summary */}
              <div className="space-y-4">
                <Card className="border-primary/40">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Final annual price</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-primary">{fmt(breakdown.finalAnnualPrice)}</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      3-year total: <span className="font-semibold text-foreground">{fmt(breakdown.total3yrPrice)}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Projected profit: <span className="font-semibold text-foreground">{fmt(breakdown.profit3yr)}</span>
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">Cost breakdown (3 years)</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-1.5">
                    <Row label="Leased line" value={fmt(breakdown.leasedLine3yr)} />
                    <Row label="FortiGate" value={fmt(breakdown.fortigate)} />
                    <Row label="Setup (internal)" value={fmt(breakdown.setup)} />
                    <Row label="Carrier install" value={fmt(breakdown.carrierInstall)} />
                    {input.includeNetsweeper && (
                      <>
                        <Row label="Netsweeper setup" value={fmt(breakdown.netsweeperSetup)} />
                        <Row label="Netsweeper licences" value={fmt(breakdown.netsweeperLicences)} />
                      </>
                    )}
                    {input.backup !== "None" && (
                      <Row label={`Backup (${input.backup})`} value={fmt(breakdown.backupCost3yr)} />
                    )}
                    <Separator className="my-2" />
                    <Row label="Total cost" value={fmt(breakdown.totalCost3yr)} bold />
                    <Row label="Annual marginable cost" value={fmt(breakdown.annualMarginableCost)} muted />
                    <Row label={`+ ${input.marginPct}% margin → annual`} value={fmt(breakdown.annualPriceMarginable)} muted />
                    {input.backup !== "None" && (
                      <Row label="+ Backup annual price" value={fmt(breakdown.backupAnnualPrice)} muted />
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={handleSave} variant="outline"><Save className="h-4 w-4" />Save</Button>
                  <Button onClick={() => setInput(defaultInput())} variant="ghost">Reset</Button>
                  <Button onClick={() => generateInternalPDF(input, breakdown)} variant="secondary">
                    <FileText className="h-4 w-4" />Internal PDF
                  </Button>
                  <Button onClick={() => generateCustomerPDF(input, breakdown)}>
                    <Download className="h-4 w-4" />Customer PDF
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="saved">
            <Card>
              <CardHeader><CardTitle>Saved quotes</CardTitle></CardHeader>
              <CardContent>
                {saved.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No saved quotes yet.</p>
                ) : (
                  <div className="space-y-2">
                    {saved.map((q) => (
                      <div key={q.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/40">
                        <div>
                          <p className="font-medium">{q.input.schoolName}</p>
                          <p className="text-xs text-muted-foreground">
                            {q.input.carrier} · {q.input.speedMbps}/{q.input.bearerMbps} Mbps · {new Date(q.createdAt).toLocaleDateString("en-GB")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right mr-2">
                            <p className="font-semibold text-primary">{fmt(q.breakdown.finalAnnualPrice)}/yr</p>
                            <p className="text-xs text-muted-foreground">{fmt(q.breakdown.total3yrPrice)} total</p>
                          </div>
                          <Button size="sm" variant={compareIds.includes(q.id) ? "default" : "outline"} onClick={() => toggleCompare(q.id)}>
                            <GitCompare className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleLoad(q)}>Load</Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(q.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compare-speeds">
            <Card>
              <CardHeader>
                <CardTitle>Speed comparison</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Annual price at each speed, using current inputs (monthly line cost stays constant — adjust on Calculator tab).
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2">Speed</th>
                        <th className="py-2">Annual price</th>
                        <th className="py-2">3-year total</th>
                        <th className="py-2">Profit (3 yrs)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {speedComparison.map((r) => (
                        <tr key={r.speed} className={`border-b ${r.speed === input.speedMbps ? "bg-primary/5" : ""}`}>
                          <td className="py-2 font-medium">{r.speed} Mbps {r.speed === input.speedMbps && <Badge variant="outline" className="ml-2">current</Badge>}</td>
                          <td className="py-2 text-primary font-semibold">{fmt(r.price)}</td>
                          <td className="py-2">{fmt(r.total)}</td>
                          <td className="py-2">{fmt(r.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compare-quotes">
            <Card>
              <CardHeader>
                <CardTitle>Compare saved quotes</CardTitle>
                <p className="text-sm text-muted-foreground">Select quotes on the Saved tab to add them here.</p>
              </CardHeader>
              <CardContent>
                {comparedQuotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No quotes selected.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="py-2">Field</th>
                          {comparedQuotes.map((q) => (
                            <th key={q.id} className="py-2">{q.input.schoolName}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ["Carrier", (q: SavedQuote) => q.input.carrier],
                          ["Speed", (q: SavedQuote) => `${q.input.speedMbps} Mbps`],
                          ["Bearer", (q: SavedQuote) => `${q.input.bearerMbps} Mbps`],
                          ["Backup", (q: SavedQuote) => q.input.backup],
                          ["Netsweeper", (q: SavedQuote) => q.input.includeNetsweeper ? `${q.input.pupils} pupils` : "—"],
                          ["Margin", (q: SavedQuote) => `${q.input.marginPct}%`],
                          ["Total cost (3 yrs)", (q: SavedQuote) => fmt(q.breakdown.totalCost3yr)],
                          ["Annual price", (q: SavedQuote) => fmt(q.breakdown.finalAnnualPrice)],
                          ["3-year total", (q: SavedQuote) => fmt(q.breakdown.total3yrPrice)],
                          ["Profit", (q: SavedQuote) => fmt(q.breakdown.profit3yr)],
                        ].map(([label, fn]) => (
                          <tr key={label as string} className="border-b">
                            <td className="py-2 font-medium text-muted-foreground">{label as string}</td>
                            {comparedQuotes.map((q) => (
                              <td key={q.id} className="py-2">{(fn as (q: SavedQuote) => string)(q)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>ITS results — cheapest carrier per speed</DialogTitle>
            <DialogDescription>
              1Gb bearer · 36-month term. Click a row to apply it to the calculator.
            </DialogDescription>
          </DialogHeader>
          {cheapestBySpeed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No products available.</p>
          ) : (
            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left">
                    <th className="py-2 pr-2">Speed</th>
                    <th className="py-2 pr-2">Carrier</th>
                    <th className="py-2 pr-2">Product</th>
                    <th className="py-2 pr-2 text-right">Monthly</th>
                    <th className="py-2 pr-2 text-right">Install</th>
                    <th className="py-2 pr-2 text-right">3-yr total</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {cheapestBySpeed.map((p) => {
                    const monthly = Number(p.monthly_cost);
                    const install = Number(p.install_cost);
                    const total3yr = monthly * 36 + install;
                    const isSelected = p.uuid === input.itsProductUuid;
                    return (
                      <tr
                        key={p.uuid}
                        className={`border-b cursor-pointer hover:bg-accent/40 ${isSelected ? "bg-primary/5" : ""}`}
                        onClick={() => {
                          applyProduct(p, itsQuote?.address);
                          setProductModalOpen(false);
                          toast.success(`Applied ${labelFor(p.supplier)} ${p.speed} Mbps`);
                        }}
                      >
                        <td className="py-2 pr-2 font-medium">{p.speed} Mbps</td>
                        <td className="py-2 pr-2">{labelFor(p.supplier)}</td>
                        <td className="py-2 pr-2 text-muted-foreground">{p.product_name}</td>
                        <td className="py-2 pr-2 text-right">{fmt(monthly)}</td>
                        <td className="py-2 pr-2 text-right">{fmt(install)}</td>
                        <td className="py-2 pr-2 text-right">{fmt(total3yr)}</td>
                        <td className="py-2 text-right">
                          <Button size="sm" variant={isSelected ? "default" : "outline"}>
                            {isSelected ? "Selected" : "Use"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""} ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

