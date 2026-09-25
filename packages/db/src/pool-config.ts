const SECOND_MS = 1_000;

export const DB_POOL = {
	max: 10,
	connectTimeoutMs: 10 * SECOND_MS,
	queryTimeoutMs: 15 * SECOND_MS,
	idleTimeoutMs: 5 * SECOND_MS,
	allowExitOnIdle: true,
} as const;
