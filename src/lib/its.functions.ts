import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  ITSAvailability,
  ITSProduct,
  ITSQuoteResult,
} from "@/types/its";

const ITS_BASE = "https://api.itstechnologygroup.com";

const inputSchema = z.object({
  schoolName: z.string().trim().min(1).max(200),
  postcode: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .regex(/^[A-Z0-9 ]+$/i, "Postcode contains invalid characters"),
});

interface PostcodeIoResult {
  status: number;
  result?: {
    postcode: string;
    latitude: number;
    longitude: number;
    admin_district?: string;
    admin_county?: string | null;
    parish?: string | null;
    region?: string | null;
  };
}

// Carrier label mapping — what we show in the UI
const SUPPLIER_LABEL: Record<string, string> = {
  bt: "Openreach",
  openreach: "Openreach",
  sky: "Sky",
  virgin_media: "Virgin Media",
  cityfibre: "CityFibre",
  glide: "Glide",
  virtual1: "Virtual1",
  zen: "Zen",
  talktalk: "TalkTalk",
};

function labelFor(supplier: string): string {
  const k = supplier?.toLowerCase?.() ?? "";
  return SUPPLIER_LABEL[k] ?? (supplier || "Unknown");
}

function pickCheapest(products: ITSProduct[]): ITSProduct | undefined {
  return [...products].sort(
    (a, b) => Number(a.monthly_cost) - Number(b.monthly_cost),
  )[0];
}

function mockResponse(postcode: string): ITSQuoteResult {
  const products: ITSProduct[] = [
    {
      uuid: "mock-1",
      supplier: "openreach",
      product_code: "MOCK-EAD-100-1000",
      product_name: "EAD 100Mb/1Gb (mock)",
      bearer: 1000,
      speed: 100,
      term_months: 36,
      install_cost: 1500,
      monthly_cost: 195,
      annual_cost: 2340,
      line_type: "leased",
    },
    {
      uuid: "mock-2",
      supplier: "virgin_media",
      product_code: "MOCK-VM-200-1000",
      product_name: "VM Ethernet 200Mb/1Gb (mock)",
      bearer: 1000,
      speed: 200,
      term_months: 36,
      install_cost: 1200,
      monthly_cost: 240,
      annual_cost: 2880,
      line_type: "leased",
    },
    {
      uuid: "mock-3",
      supplier: "sky",
      product_code: "MOCK-SKY-1000-1000",
      product_name: "Sky Ethernet 1Gb/1Gb (mock)",
      bearer: 1000,
      speed: 1000,
      term_months: 36,
      install_cost: 2500,
      monthly_cost: 480,
      annual_cost: 5760,
      line_type: "leased",
    },
  ];
  const cheapest = pickCheapest(products)!;
  return {
    ok: true,
    carrier: labelFor(cheapest.supplier),
    speeds: Array.from(new Set(products.map((p) => p.speed))).sort((a, b) => a - b),
    bearerOptions: Array.from(new Set(products.map((p) => p.bearer))).sort((a, b) => a - b),
    monthlyCost: Number(cheapest.monthly_cost),
    setupCost: Number(cheapest.install_cost),
    contractLength: cheapest.term_months,
    products,
    address: { postcode },
    fetchedAt: new Date().toISOString(),
    isMock: true,
  };
}

export const getItsQuote = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<ITSQuoteResult> => {
    const apiKey = process.env.ITS_API_KEY;
    const allowMock = process.env.ITS_ALLOW_MOCK !== "false";

    const normalizedPostcode = data.postcode.toUpperCase().replace(/\s+/g, " ").trim();

    // 1) Geocode postcode -> lat/long via free postcodes.io (no auth)
    let lat: number | undefined;
    let lng: number | undefined;
    let town: string | undefined;
    let county: string | undefined;
    try {
      const pcRes = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(normalizedPostcode)}`,
      );
      if (pcRes.status === 404) {
        return { ok: false, code: "POSTCODE_NOT_FOUND", error: "Postcode not found" };
      }
      if (!pcRes.ok) {
        return { ok: false, code: "INVALID_POSTCODE", error: `Postcode lookup failed (${pcRes.status})` };
      }
      const pcJson = (await pcRes.json()) as PostcodeIoResult;
      lat = pcJson.result?.latitude;
      lng = pcJson.result?.longitude;
      town = pcJson.result?.admin_district;
      // ITS API quietly excludes some carriers (e.g. Virgin Media) when the
      // `county` field is missing from the request. Always send a string —
      // fall back to admin_district, parish or region when admin_county is null.
      county =
        pcJson.result?.admin_county ??
        pcJson.result?.admin_district ??
        pcJson.result?.parish ??
        pcJson.result?.region ??
        "";
    } catch (err) {
      console.error("[its] postcode lookup failed", err);
      if (allowMock) return mockResponse(normalizedPostcode);
      return { ok: false, code: "INVALID_POSTCODE", error: "Postcode lookup failed" };
    }

    if (!apiKey) {
      console.warn("[its] ITS_API_KEY missing — returning mock data");
      if (allowMock) return mockResponse(normalizedPostcode);
      return { ok: false, code: "MISSING_KEY", error: "ITS API key not configured" };
    }

    if (typeof lat !== "number" || typeof lng !== "number") {
      if (allowMock) return mockResponse(normalizedPostcode);
      return { ok: false, code: "INVALID_POSTCODE", error: "No coordinates for postcode" };
    }

    // 2) Search ITS availability — request all speeds on a 1Gb bearer only, 36-month terms.
    const SPEED_OPTIONS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    const connections = SPEED_OPTIONS.map((speed) => ({ bearer: 1000, speed }));

    const body = {
      postcode: normalizedPostcode,
      address_line_1: data.schoolName.slice(0, 100),
      town,
      county,
      latitude: lat,
      longitude: lng,
      terms: ["3"],
      term_months: ["36"],
      connections,
    };

    let itsJson: { data?: ITSAvailability } | undefined;
    try {
      const res = await fetch(`${ITS_BASE}/api/v1/availability/search/multiple`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.status === 401 || res.status === 403) {
        console.error("[its] auth failed", res.status);
        return { ok: false, code: "MISSING_KEY", error: "ITS API authentication failed" };
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("[its] api error", res.status, txt.slice(0, 500));
        if (allowMock) return mockResponse(normalizedPostcode);
        return { ok: false, code: "API_ERROR", error: `ITS API error (${res.status})` };
      }
      itsJson = (await res.json()) as { data?: ITSAvailability };
    } catch (err) {
      console.error("[its] fetch failed", err);
      if (allowMock) return mockResponse(normalizedPostcode);
      return { ok: false, code: "API_ERROR", error: "ITS API request failed" };
    }

    const avail = itsJson?.data;
    const allQuotes = avail?.quotes ?? [];

    // Enforce 3-year term and 1Gb bearer only.
    const termFiltered = allQuotes.filter(
      (q) => Number(q.term_months) === 36 && Number(q.bearer) === 1000,
    );

    if (!avail || termFiltered.length === 0) {
      return { ok: false, code: "NO_AVAILABILITY", error: "No 3-year connectivity products available at this address" };
    }

    // For each (speed, carrier) keep the cheapest by monthly_cost.
    const cheapestBySpeedCarrier = new Map<string, ITSProduct>();
    for (const q of termFiltered) {
      const carrierKey = (q.supplier || "").toLowerCase();
      const key = `${q.speed}|${carrierKey}`;
      const existing = cheapestBySpeedCarrier.get(key);
      if (!existing || Number(q.monthly_cost) < Number(existing.monthly_cost)) {
        cheapestBySpeedCarrier.set(key, q);
      }
    }
    const products = Array.from(cheapestBySpeedCarrier.values()).sort((a, b) => {
      if (a.speed !== b.speed) return a.speed - b.speed;
      return Number(a.monthly_cost) - Number(b.monthly_cost);
    });

    const cheapest = pickCheapest(products)!;
    return {
      ok: true,
      carrier: labelFor(cheapest.supplier),
      speeds: Array.from(new Set(products.map((q) => q.speed))).sort((a, b) => a - b),
      bearerOptions: Array.from(new Set(products.map((q) => q.bearer))).sort((a, b) => a - b),
      monthlyCost: Number(cheapest.monthly_cost),
      setupCost: Number(cheapest.install_cost),
      contractLength: cheapest.term_months,
      products,
      address: avail.address ?? { postcode: normalizedPostcode },
      fetchedAt: new Date().toISOString(),
    };
  });
