import { parseScopes } from "@crm/auth/scopes";

export function userIdsMissingSync(input: {
	accounts: readonly { userId: string; scope: string | null }[];
	rows: readonly { userId: string; source: string }[];
	scopeForSource: Readonly<Record<string, string>>;
}): string[] {
	const known = new Set(input.rows.map((row) => `${row.userId}:${row.source}`));
	const missing = new Set<string>();

	for (const account of input.accounts) {
		const granted = parseScopes(account.scope);
		for (const [source, scope] of Object.entries(input.scopeForSource)) {
			if (!granted.has(scope)) continue;
			if (known.has(`${account.userId}:${source}`)) continue;
			missing.add(account.userId);
		}
	}

	return [...missing];
}
