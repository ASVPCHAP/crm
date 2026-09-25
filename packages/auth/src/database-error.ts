import type { Db } from "@crm/db";
import { isDatabaseUnavailable } from "@crm/db/database-unavailable";
import { APIError } from "better-auth/api";

export const AUTH_DATABASE_DOWN =
	"The database is unreachable. Sign-in cannot continue.";

export function authDatabaseError(cause: unknown): APIError | null {
	if (!isDatabaseUnavailable(cause)) return null;
	return new APIError("SERVICE_UNAVAILABLE", {
		message: AUTH_DATABASE_DOWN,
	});
}

export function withAuthDatabaseErrors(client: Db): Db {
	return client.$extends({
		query: {
			$allModels: {
				async $allOperations({ args, query }) {
					try {
						return await query(args);
					} catch (error) {
						const mapped = authDatabaseError(error);
						if (mapped) throw mapped;
						throw error;
					}
				},
			},
		},
	}) as Db;
}

export async function readAuthDatabase<T>(work: () => Promise<T>): Promise<T> {
	try {
		return await work();
	} catch (error) {
		const mapped = authDatabaseError(error);
		if (mapped) throw mapped;
		throw error;
	}
}
