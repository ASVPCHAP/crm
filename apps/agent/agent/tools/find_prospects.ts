import {
	ActivityType,
	db,
	FieldEntity,
	FieldType,
	RecordSource,
} from "@crm/db";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { lookupNpiNumber, searchNpiRegistry } from "../lib/npi";

const NPI_FIELD_KEY = "npi_number";

async function ensureNpiField(): Promise<string> {
	const last = await db.fieldDefinition.findFirst({
		where: { entity: FieldEntity.COMPANY },
		orderBy: { position: "desc" },
		select: { position: true },
	});

	const definition = await db.fieldDefinition.upsert({
		where: { entity_key: { entity: FieldEntity.COMPANY, key: NPI_FIELD_KEY } },
		create: {
			entity: FieldEntity.COMPANY,
			key: NPI_FIELD_KEY,
			label: "NPI Number",
			type: FieldType.TEXT,
			agentFilled: true,
			showOnTable: true,
			showOnFilter: false,
			position: (last?.position ?? -1) + 1,
		},
		update: {},
	});

	return definition.id;
}

async function alreadyImported(
	fieldId: string,
	npis: string[],
): Promise<Set<string>> {
	if (npis.length === 0) return new Set();

	const rows = await db.fieldValue.findMany({
		where: { fieldId, text: { in: npis }, companyId: { not: null } },
		select: { text: true },
	});

	return new Set(
		rows.map((row) => row.text).filter((text): text is string => text !== null),
	);
}

const searchInput = z.object({
	action: z.literal("search"),
	taxonomyDescription: z
		.string()
		.min(2)
		.describe(
			'The NPI taxonomy or specialty to match, e.g. "Cardiovascular Disease", "Pharmacy", "Family Medicine".',
		),
	city: z.string().optional().describe("City to search within."),
	state: z
		.string()
		.length(2)
		.optional()
		.describe(
			"Two-letter state code, e.g. TX. Required unless postalCode is given.",
		),
	postalCode: z
		.string()
		.optional()
		.describe("5-digit ZIP. Required unless state is given."),
	kind: z
		.enum(["individual", "organization"])
		.optional()
		.describe(
			"Narrow to individual prescribers or organizations like pharmacies and clinics. Omit to search both.",
		),
	limit: z.number().int().min(1).max(50).default(25),
});

const importInput = z.object({
	action: z.literal("import"),
	npis: z
		.array(z.string())
		.min(1)
		.max(25)
		.describe(
			"NPI numbers from a prior search that the rep chose to add to the CRM.",
		),
});

export default defineTool({
	description:
		"Prospect for new accounts by specialty and geography against the free public NPI Registry — the government's own directory of every licensed US prescriber and healthcare organization. 'search' returns real candidates without writing anything to the CRM. 'import' creates companies from NPI numbers a search already returned, re-checked against the registry so nothing is written from memory. Never invents a company. Free — no vendor key, no credits.",
	inputSchema: z.discriminatedUnion("action", [searchInput, importInput]),
	async execute(input) {
		if (input.action === "search") {
			if (!input.state && !input.postalCode) {
				return {
					ok: false as const,
					reason:
						"Give a state or a ZIP code first — an unscoped nationwide search is not useful to a rep working a territory.",
				};
			}

			const result = await searchNpiRegistry({
				taxonomyDescription: input.taxonomyDescription,
				city: input.city,
				state: input.state,
				postalCode: input.postalCode,
				enumerationType: input.kind,
				limit: input.limit,
			});

			if (result.outcome === "failed") {
				return { ok: false as const, reason: result.reason };
			}

			if (result.outcome === "empty") {
				return {
					ok: true as const,
					candidates: [],
					note: "No NPI records matched. Try a broader taxonomy description or a wider area, not a higher limit.",
				};
			}

			const fieldId = await ensureNpiField();
			const existing = await alreadyImported(
				fieldId,
				result.prospects.map((prospect) => prospect.npi),
			);

			return {
				ok: true as const,
				resultCount: result.resultCount,
				candidates: result.prospects.map((prospect) => ({
					...prospect,
					alreadyInCrm: existing.has(prospect.npi),
				})),
				note:
					result.resultCount > result.prospects.length
						? `Showing ${result.prospects.length} of ${result.resultCount} matches — narrow the search (add a city, or a more specific taxonomy) rather than raising the limit to see the rest.`
						: 'Show these to the rep with alreadyInCrm marked. Only call this tool again with action "import" for the NPIs the rep actually chooses — never import a whole search on your own judgment.',
			};
		}

		const fieldId = await ensureNpiField();
		const existing = await alreadyImported(fieldId, input.npis);
		const author = await db.user.findFirst({ select: { id: true } });

		const outcomes: (
			| { npi: string; created: true; companyId: string }
			| { npi: string; created: false; reason: string }
		)[] = [];

		for (const npi of input.npis) {
			if (existing.has(npi)) {
				outcomes.push({ npi, created: false, reason: "Already in the CRM." });
				continue;
			}

			const looked = await lookupNpiNumber(npi);
			const prospect =
				looked.outcome === "found" ? looked.prospects[0] : undefined;

			if (!prospect) {
				outcomes.push({
					npi,
					created: false,
					reason: looked.outcome === "failed" ? looked.reason : "No such NPI.",
				});
				continue;
			}

			const company = await db.company.create({
				data: {
					name: prospect.name,
					city: prospect.city,
					stateCode: prospect.stateCode,
					country: "United States",
					countryCode: "US",
					phone: prospect.phone,
					industry: prospect.taxonomyDescription,
					source: RecordSource.IMPORT,
					fieldValues: { create: { fieldId, text: prospect.npi } },
				},
				select: { id: true },
			});

			if (author) {
				await db.activity.create({
					data: {
						type: ActivityType.ENRICHMENT,
						subject: "Found via NPI prospecting",
						body: [
							prospect.taxonomyDescription,
							prospect.addressLine,
							[prospect.city, prospect.stateCode].filter(Boolean).join(", "),
						]
							.filter(Boolean)
							.join(" — "),
						occurredAt: new Date(),
						companyId: company.id,
						createdById: author.id,
						meta: { source: "npi-registry", npi: prospect.npi },
					},
				});
			}

			outcomes.push({ npi, created: true, companyId: company.id });
		}

		return {
			ok: true as const,
			imported: outcomes.filter((outcome) => outcome.created).length,
			outcomes,
		};
	},
});
