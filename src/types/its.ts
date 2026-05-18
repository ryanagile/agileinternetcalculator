// Types for the ITS Technology Group Partner Portal API
// Docs: https://api.itstechnologygroup.com/api/docs

export interface ITSAddress {
  uuid?: string;
  address_line_1?: string | null;
  address_line_2?: string | null;
  address_line_3?: string | null;
  town?: string | null;
  county?: string | null;
  postcode: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  uprn?: string | null;
  premise?: string | null;
  thoroughfare?: string | null;
}

export interface ITSProduct {
  uuid: string;
  supplier: string;
  supplier_id?: number;
  product_code: string;
  product_name: string;
  bearer: number;
  speed: number;
  term_months: number;
  install_cost: string | number;
  monthly_cost: number;
  annual_cost: number;
  total_contract_value?: number;
  is_offnet?: boolean;
  is_managed?: boolean;
  line_type?: string;
  logo?: string | null;
  additionalInformation?: Array<{ id: number; title: string; content: string }>;
}

export interface ITSAvailability {
  uuid: string;
  address: ITSAddress;
  total_quotes: number;
  total_on_net_quotes: number;
  total_off_net_quotes: number;
  quotes: ITSProduct[];
}

// Shape returned to the frontend from our server function
export interface ITSQuoteResponse {
  ok: true;
  carrier: string;
  speeds: number[];
  bearerOptions: number[];
  monthlyCost: number;
  setupCost: number;
  contractLength: number;
  products: ITSProduct[];
  address: ITSAddress;
  fetchedAt: string;
  isMock?: boolean;
  raw?: unknown;
}

export interface ITSQuoteError {
  ok: false;
  error: string;
  code:
    | "INVALID_POSTCODE"
    | "POSTCODE_NOT_FOUND"
    | "NO_AVAILABILITY"
    | "API_ERROR"
    | "MISSING_KEY"
    | "UNKNOWN";
}

export type ITSQuoteResult = ITSQuoteResponse | ITSQuoteError;
