import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  ITSAvailability,
  ITSProduct,
  ITSQuoteResult,
  ITSAddressSuggestion,
  ITSAddressDetails,
} from "@/types/its";

const ITS_BASE = "https://api.itstechnologygroup.com";
const GETADDRESS_BASE = "https://api.getaddress.io";

const addressInputSchema = z
  .object({
    postcode: z.string().min(2).max(10),
    line_1: z.string().optional().default(""),
    line_2: z.string().optional().default(""),
    line_3: z.string().optional().default(""),
    town: z.string().optional().default(""),
    county: z.string().optional().default(""),
    premise: z.string().optional().default(""),
    thoroughfare: z.string().optional().default(""),
    uprn: z.string().optional().default(""),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  })
  .optional();

const inputSchema = z.object({
  schoolName: z.string().trim().min(1).max(200),
  postcode: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .regex(/^[A-Z0-9 ]+$/i, "Postcode contains invalid characters"),
  address: addressInputSchema,
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

interface GetAddressExpandedAddress {
  formatted_address?: string[];
  thoroughfare?: string;
  building_number?: string;
  building_name?: string;
  sub_building_name?: string;
  sub_building_number?: string;
  line_1?: string;
  line_2?: string;
  line_3?: string;
  line_4?: string;
  locality?: string;
  town_or_city?: string;
  county?: string;
  district?: string;
  postcode?: string;
  latitude?: number;
  longitude?: number;
  uprn?: string | number;
}

interface GetAddressFindResponse {
  postcode: string;
  latitude?: number;
  longitude?: number;
  addresses?: Array<GetAddressExpandedAddress | string>;
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
  return [...products].sort((a, b) => Number(a.monthly_cost) - Number(b.monthly_cost))[0];
}

function normaliseAddressLabel(
  address: GetAddressExpandedAddress | string,
  postcode: string,
): string {
  if (typeof address === "string") {
    return address
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .join(", ");
  }

  const formatted = address.formatted_address?.filter((part) => part?.trim()) ?? [];
  const parts =
    formatted.length > 0
      ? formatted
      : [
          address.line_1,
          address.line_2,
          address.line_3,
          address.line_4,
          address.locality,
          address.town_or_city,
          address.county,
          address.postcode ?? postcode,
        ];

  return parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function toAddressDetails(
  address: GetAddressExpandedAddress | string,
  findResult: GetAddressFindResponse,
): ITSAddressDetails {
  const postcode = findResult.postcode;
  if (typeof address === "string") {
    const [line1 = "", line2 = "", line3 = "", line4 = "", town = "", county = ""] = address
      .split(",")
      .map((part) => part.trim());
    return {
      postcode,
      line_1: line1,
      line_2: line2,
      line_3: line3 || line4,
      town,
      county,
      premise: line1,
      thoroughfare: line2,
      latitude: findResult.latitude,
      longitude: findResult.longitude,
    };
  }

  const premise = [
    address.sub_building_name,
    address.sub_building_number,
    address.building_name,
    address.building_number,
  ]
    .filter((part) => part && String(part).trim())
    .join(" ")
    .trim()
    .slice(0, 100);

  return {
    postcode: address.postcode ?? postcode,
    line_1: address.line_1 ?? address.formatted_address?.[0] ?? "",
    line_2: address.line_2 ?? address.formatted_address?.[1] ?? "",
    line_3: address.line_3 ?? address.line_4 ?? address.formatted_address?.[2] ?? "",
    town: address.town_or_city ?? address.district ?? address.locality ?? "",
    county: address.county ?? address.district ?? "",
    premise,
    thoroughfare: address.thoroughfare ?? "",
    latitude: typeof address.latitude === "number" ? address.latitude : findResult.latitude,
    longitude: typeof address.longitude === "number" ? address.longitude : findResult.longitude,
    uprn: address.uprn ? String(address.uprn) : undefined,
  };
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

// ---------------- Address search (getAddress.io) ----------------

const postcodeSchema = z.object({
  postcode: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .regex(/^[A-Z0-9 ]+$/i, "Postcode contains invalid characters"),
});

export const searchAddresses = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => postcodeSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; suggestions: ITSAddressSuggestion[] }
      | {
          ok: false;
          error: string;
          code: "MISSING_KEY" | "UNAUTHORIZED" | "NO_RESULTS" | "API_ERROR";
        }
    > => {
      const apiKey = process.env.GETADDRESS_API_KEY;
      if (!apiKey) {
        return { ok: false, code: "MISSING_KEY", error: "Address lookup API key not configured" };
      }
      const pc = data.postcode.toUpperCase().replace(/\s+/g, "");
      const url = `${GETADDRESS_BASE}/find/${encodeURIComponent(pc)}?api-key=${encodeURIComponent(
        apiKey,
      )}&expand=true&sort=true`;
      try {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (res.status === 401 || res.status === 403) {
          return {
            ok: false,
            code: "UNAUTHORIZED",
            error:
              "Address lookup is unauthorized — check the getAddress.io API key allows postcode find requests.",
          };
        }
        if (res.status === 404) {
          return { ok: false, code: "NO_RESULTS", error: "No addresses found for that postcode" };
        }
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          return {
            ok: false,
            code: "API_ERROR",
            error: `Address API error (${res.status}) ${txt.slice(0, 200)}`,
          };
        }
        const json = (await res.json()) as GetAddressFindResponse;
        const suggestions = (json.addresses ?? []).map((address, index) => ({
          id: String(index),
          address: normaliseAddressLabel(address, json.postcode),
          details: toAddressDetails(address, json),
        }));
        if (suggestions.length === 0) {
          return { ok: false, code: "NO_RESULTS", error: "No addresses found for that postcode" };
        }
        return { ok: true, suggestions };
      } catch (err) {
        console.error("[getAddress] search failed", err);
        return { ok: false, code: "API_ERROR", error: "Address lookup request failed" };
      }
    },
  );

export const getAddressDetails = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().min(1).max(200), address: addressInputSchema }).parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; address: ITSAddressDetails } | { ok: false; error: string }> => {
      if (data.address) {
        return { ok: true, address: data.address };
      }

      const apiKey = process.env.GETADDRESS_API_KEY;
      if (!apiKey) return { ok: false, error: "Address lookup API key not configured" };
      try {
        const res = await fetch(
          `${GETADDRESS_BASE}/get/${encodeURIComponent(data.id)}?api-key=${encodeURIComponent(apiKey)}`,
        );
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          return {
            ok: false,
            error: `Failed to fetch address (${res.status}) ${txt.slice(0, 200)}`,
          };
        }
        const j = (await res.json()) as {
          postcode: string;
          latitude?: number;
          longitude?: number;
          line_1?: string;
          line_2?: string;
          line_3?: string;
          line_4?: string;
          thoroughfare?: string;
          building_number?: string;
          building_name?: string;
          sub_building_name?: string;
          sub_building_number?: string;
          town_or_city?: string;
          county?: string;
          district?: string;
          locality?: string;
        };
        const premise = [
          j.sub_building_name,
          j.sub_building_number,
          j.building_name,
          j.building_number,
        ]
          .filter((p) => p && String(p).trim())
          .join(" ")
          .trim()
          .slice(0, 100);
        return {
          ok: true,
          address: {
            postcode: j.postcode,
            line_1: j.line_1 ?? "",
            line_2: j.line_2 ?? "",
            line_3: j.line_3 ?? "",
            town: j.town_or_city ?? j.district ?? j.locality ?? "",
            county: j.county ?? j.district ?? "",
            premise,
            thoroughfare: j.thoroughfare ?? "",
            latitude: typeof j.latitude === "number" ? j.latitude : undefined,
            longitude: typeof j.longitude === "number" ? j.longitude : undefined,
          },
        };
      } catch (err) {
        console.error("[getAddress] get failed", err);
        return { ok: false, error: "Address lookup request failed" };
      }
    },
  );

// ---------------- ITS quote ----------------

export const getItsQuote = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<ITSQuoteResult> => {
    const apiKey = process.env.ITS_API_KEY;
    const allowMock = process.env.ITS_ALLOW_MOCK !== "false";

    const normalizedPostcode = data.postcode.toUpperCase().replace(/\s+/g, " ").trim();

    // Source address fields: prefer the user-selected address payload, otherwise
    // fall back to a postcode-only lookup via postcodes.io (centroid).
    let lat: number | undefined;
    let lng: number | undefined;
    let town: string = "";
    let county: string = "";
    let addressLine1: string = data.schoolName.slice(0, 100);
    let premise = "";
    let thoroughfare = "";
    let uprn = "";

    if (data.address) {
      lat = data.address.latitude;
      lng = data.address.longitude;
      town = data.address.town || "";
      county = data.address.county || "";
      if (data.address.line_1) addressLine1 = data.address.line_1.slice(0, 100);
      premise = (data.address.premise || "").slice(0, 100);
      thoroughfare = (data.address.thoroughfare || "").slice(0, 100);
      uprn = data.address.uprn || "";
    }

    if (typeof lat !== "number" || typeof lng !== "number") {
      try {
        const pcRes = await fetch(
          `https://api.postcodes.io/postcodes/${encodeURIComponent(normalizedPostcode)}`,
        );
        if (pcRes.status === 404) {
          return { ok: false, code: "POSTCODE_NOT_FOUND", error: "Postcode not found" };
        }
        if (!pcRes.ok) {
          return {
            ok: false,
            code: "INVALID_POSTCODE",
            error: `Postcode lookup failed (${pcRes.status})`,
          };
        }
        const pcJson = (await pcRes.json()) as PostcodeIoResult;
        lat = pcJson.result?.latitude;
        lng = pcJson.result?.longitude;
        if (!town) town = pcJson.result?.admin_district ?? "";
        if (!county) {
          county =
            pcJson.result?.admin_county ??
            pcJson.result?.admin_district ??
            pcJson.result?.parish ??
            pcJson.result?.region ??
            "";
        }
      } catch (err) {
        console.error("[its] postcode lookup failed", err);
        return { ok: false, code: "INVALID_POSTCODE", error: "Postcode lookup failed" };
      }
    }

    if (!apiKey) {
      console.warn("[its] ITS_API_KEY missing — returning mock data");
      if (allowMock) return mockResponse(normalizedPostcode);
      return { ok: false, code: "MISSING_KEY", error: "ITS API key not configured" };
    }

    if (typeof lat !== "number" || typeof lng !== "number") {
      return { ok: false, code: "INVALID_POSTCODE", error: "No coordinates for postcode" };
    }

    const SPEED_OPTIONS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    const connections = SPEED_OPTIONS.map((speed) => ({ bearer: 1000, speed }));

    const body: Record<string, unknown> = {
      postcode: normalizedPostcode,
      address_line_1: addressLine1,
      town,
      county,
      latitude: lat,
      longitude: lng,
      terms: ["3"],
      term_months: ["36"],
      connections,
    };
    if (premise) body.premise = premise;
    if (thoroughfare) body.thoroughfare = thoroughfare;
    if (uprn) body.uprn = uprn;

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
        return { ok: false, code: "API_ERROR", error: `ITS API error (${res.status})` };
      }
      itsJson = (await res.json()) as { data?: ITSAvailability };
    } catch (err) {
      console.error("[its] fetch failed", err);
      return { ok: false, code: "API_ERROR", error: "ITS API request failed" };
    }

    const avail = itsJson?.data;
    const allQuotes = avail?.quotes ?? [];

    const termFiltered = allQuotes.filter(
      (q) => Number(q.term_months) === 36 && Number(q.bearer) === 1000,
    );

    if (!avail || termFiltered.length === 0) {
      return {
        ok: false,
        code: "NO_AVAILABILITY",
        error: "No 3-year connectivity products available at this address",
      };
    }

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
      address: avail.address ?? { postcode: normalizedPostcode, uprn: uprn || null },
      fetchedAt: new Date().toISOString(),
    };
  });
