export type Carrier = string;
export type BackupType = "None" | "SoGEA" | "FTTP";

export interface QuoteInput {
  schoolName: string;
  postcode: string;
  carrier: Carrier;
  speedMbps: number;
  bearerMbps: number;
  monthlyLeasedLine: number;
  marginPct: number;
  fortigateCost: number;
  setupCost: number;
  carrierInstallCost: number;
  includeNetsweeper: boolean;
  pupils: number;
  backup: BackupType;
  itsProductUuid?: string;
  itsAddressLine?: string;
}

export interface CostBreakdown {
  leasedLine3yr: number;
  fortigate: number;
  setup: number;
  carrierInstall: number;
  netsweeperSetup: number;
  netsweeperLicences: number;
  backupCost3yr: number;
  totalCost3yr: number;
  marginableCost3yr: number;
  annualMarginableCost: number;
  annualPriceMarginable: number;
  backupAnnualPrice: number;
  finalAnnualPrice: number;
  total3yrPrice: number;
  profit3yr: number;
}

const NETSWEEPER_SETUP = 450;
const NETSWEEPER_PER_PUPIL_3YR = 10.8;
const BACKUP_ANNUAL_COST = 650;
const BACKUP_ANNUAL_PRICE = 950;

export function roundUpTo5(n: number): number {
  return Math.ceil(n / 5) * 5;
}

export function calculate(input: QuoteInput): CostBreakdown {
  const leasedLine3yr = input.monthlyLeasedLine * 36;
  const fortigate = input.fortigateCost;
  const setup = input.setupCost;
  const netsweeperSetup = input.includeNetsweeper ? NETSWEEPER_SETUP : 0;
  const netsweeperLicences = input.includeNetsweeper
    ? input.pupils * NETSWEEPER_PER_PUPIL_3YR
    : 0;
  const backupCost3yr = input.backup !== "None" ? BACKUP_ANNUAL_COST * 3 : 0;

  // marginable cost = everything except backup (backup sold at fixed price)
  const marginableCost3yr =
    leasedLine3yr + fortigate + setup + netsweeperSetup + netsweeperLicences;
  const annualMarginableCost = marginableCost3yr / 3;
  const annualPriceMarginable = roundUpTo5(
    annualMarginableCost * (1 + input.marginPct / 100),
  );

  const backupAnnualPrice = input.backup !== "None" ? BACKUP_ANNUAL_PRICE : 0;
  const finalAnnualPrice = annualPriceMarginable + backupAnnualPrice;
  const total3yrPrice = finalAnnualPrice * 3;
  const totalCost3yr = marginableCost3yr + backupCost3yr;
  const profit3yr = total3yrPrice - totalCost3yr;

  return {
    leasedLine3yr,
    fortigate,
    setup,
    netsweeperSetup,
    netsweeperLicences,
    backupCost3yr,
    totalCost3yr,
    marginableCost3yr,
    annualMarginableCost,
    annualPriceMarginable,
    backupAnnualPrice,
    finalAnnualPrice,
    total3yrPrice,
    profit3yr,
  };
}

export const fmt = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(n);

export const SPEEDS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
export const CARRIERS: string[] = ["Virgin Media", "Sky", "Openreach", "CityFibre", "Virtual1"];
export const BACKUPS: BackupType[] = ["None", "SoGEA", "FTTP"];

export function defaultInput(): QuoteInput {
  return {
    schoolName: "",
    postcode: "",
    carrier: "Openreach",
    speedMbps: 100,
    bearerMbps: 1000,
    monthlyLeasedLine: 0,
    marginPct: 30,
    fortigateCost: 1000,
    setupCost: 500,
    includeNetsweeper: false,
    pupils: 0,
    backup: "None",
  };
}

export interface SavedQuote {
  id: string;
  createdAt: string;
  input: QuoteInput;
  breakdown: CostBreakdown;
}

const STORAGE_KEY = "agile_internet_quotes_v1";

export function loadQuotes(): SavedQuote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedQuote[]) : [];
  } catch {
    return [];
  }
}

export function saveQuote(q: SavedQuote) {
  const all = loadQuotes();
  all.unshift(q);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function deleteQuote(id: string) {
  const all = loadQuotes().filter((q) => q.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
