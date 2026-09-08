import { safeFetch } from "@crm/db/safe-fetch";

const NPI_API = "https://npiregistry.cms.hhs.gov/api/";

const TIMEOUT_MS = 15_000;

export type NpiEnumerationType = "individual" | "organization";

export type NpiProspect = {
	npi: string;
	enumerationType: NpiEnumerationType;
	name: string;
	taxonomyDescription: string | null;
	addressLine: string | null;
	city: string | null;
	stateCode: string | null;
	postalCode: string | null;
	phone: string | null;
};

export type NpiSearchInput = {
	taxonomyDescription: string;
	city?: string;
	state?: string;
	postalCode?: string;
	enumerationType?: NpiEnumerationType;
	limit?: number;
};

export type NpiSearchResult =
	| { outcome: "found"; prospects: NpiProspect[]; resultCount: number }
	| { outcome: "empty" }
	| { outcome: "failed"; reason: string };

type NpiApiAddress = {
	address_purpose?: string;
	address_1?: string;
	city?: string;
	state?: string;
	postal_code?: string;
	telephone_number?: string;
};

type NpiApiResult = {
	number: string;
	enumeration_type?: string;
	basic?: {
		organization_name?: string;
		name_prefix?: string;
		first_name?: string;
		last_name?: string;
		credential?: string;
	};
	other_names?: { organization_name?: string; type?: string }[];
	addresses?: NpiApiAddress[];
	practiceLocations?: NpiApiAddress[];
	taxonomies?: { desc?: string; primary?: boolean }[];
};

type NpiApiResponse = {
	result_count?: number;
	results?: NpiApiResult[];
	Errors?: { description: string; field: string; number: string }[];
};

/**
 * The free, public NPPES NPI Registry — every licensed prescriber and
 * healthcare organization in the US, searchable by specialty and geography.
 * No key, no rate limit worth worrying about at CRM-prospecting volumes.
 */
export async function searchNpiRegistry(
	input: NpiSearchInput,
): Promise<NpiSearchResult> {
	const params = new URLSearchParams({
		version: "2.1",
		taxonomy_description: input.taxonomyDescription,
		limit: String(Math.min(Math.max(input.limit ?? 25, 1), 200)),
	});
	if (input.city) params.set("city", input.city);
	if (input.state) params.set("state", input.state.toUpperCase());
	if (input.postalCode) params.set("postal_code", input.postalCode);
	if (input.enumerationType) {
		params.set(
			"enumeration_type",
			input.enumerationType === "organization" ? "NPI-2" : "NPI-1",
		);
	}

	return runQuery(params, input.city, input.state);
}

/** Authoritative single-record lookup, used before writing a prospect in. */
export async function lookupNpiNumber(npi: string): Promise<NpiSearchResult> {
	return runQuery(new URLSearchParams({ version: "2.1", number: npi }));
}

async function runQuery(
	params: URLSearchParams,
	wantCity?: string,
	wantState?: string,
): Promise<NpiSearchResult> {
	const fetched = await safeFetch(`${NPI_API}?${params.toString()}`, {
		timeoutMs: TIMEOUT_MS,
	});

	if (!fetched) {
		return { outcome: "failed", reason: "Could not reach the NPI Registry." };
	}
	if (!fetched.response.ok) {
		return {
			outcome: "failed",
			reason: `NPI Registry returned ${fetched.response.status}.`,
		};
	}

	let body: NpiApiResponse;
	try {
		body = (await fetched.response.json()) as NpiApiResponse;
	} catch {
		return {
			outcome: "failed",
			reason: "NPI Registry returned an unreadable response.",
		};
	}

	if (body.Errors && body.Errors.length > 0) {
		return {
			outcome: "failed",
			reason: body.Errors.map((error) => error.description).join("; "),
		};
	}

	const results = body.results ?? [];
	if (results.length === 0) return { outcome: "empty" };

	return {
		outcome: "found",
		resultCount: body.result_count ?? results.length,
		prospects: results.map((result) => toProspect(result, wantCity, wantState)),
	};
}

function toProspect(
	result: NpiApiResult,
	wantCity: string | undefined,
	wantState: string | undefined,
): NpiProspect {
	const enumerationType: NpiEnumerationType =
		result.enumeration_type === "NPI-2" ? "organization" : "individual";

	const dba = result.other_names?.find(
		(entry) => entry.type === "Doing Business As" && entry.organization_name,
	)?.organization_name;

	const person = [
		result.basic?.name_prefix,
		result.basic?.first_name,
		result.basic?.last_name,
		result.basic?.credential,
	]
		.filter(Boolean)
		.join(" ");

	const name =
		dba ?? result.basic?.organization_name ?? person ?? "Unnamed provider";

	const address = pickAddress(result, wantCity, wantState);
	const primary =
		result.taxonomies?.find((taxonomy) => taxonomy.primary) ??
		result.taxonomies?.[0];

	return {
		npi: result.number,
		enumerationType,
		name,
		taxonomyDescription: primary?.desc ?? null,
		addressLine: address?.address_1 ?? null,
		city: address?.city ?? null,
		stateCode: address?.state ?? null,
		postalCode: address?.postal_code ? address.postal_code.slice(0, 5) : null,
		phone: address?.telephone_number ?? null,
	};
}

/**
 * NPPES matches city/state against every practice location, not just the
 * primary one — a Dallas search can return a result whose primary address is
 * elsewhere. Prefer whichever location actually matches what was asked for.
 */
function pickAddress(
	result: NpiApiResult,
	wantCity: string | undefined,
	wantState: string | undefined,
): NpiApiAddress | undefined {
	const candidates = [
		...(result.addresses ?? []).filter(
			(address) => address.address_purpose === "LOCATION",
		),
		...(result.practiceLocations ?? []),
	];

	const matches = (address: NpiApiAddress) =>
		(!wantState || address.state?.toUpperCase() === wantState.toUpperCase()) &&
		(!wantCity || address.city?.toLowerCase() === wantCity.toLowerCase());

	return candidates.find(matches) ?? candidates[0] ?? result.addresses?.[0];
}
