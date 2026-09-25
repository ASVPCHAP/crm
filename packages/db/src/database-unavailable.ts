import { z } from "zod";

const PRISMA_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

const DRIVER_CODES = new Set([
	"08000",
	"08001",
	"08003",
	"08004",
	"08006",
	"08007",
	"53300",
	"57P01",
	"57P02",
	"57P03",
	"ECONNREFUSED",
	"ECONNRESET",
	"EAI_AGAIN",
	"EPIPE",
	"ETIMEDOUT",
	"ENOTFOUND",
]);

const MESSAGE_MARKERS = [
	"timeout exceeded when trying to connect",
	"query read timeout",
	"timed out fetching a new connection",
	"can't reach database server",
	"server has closed the connection",
	"connection terminated",
	"connection timeout",
	"compute time quota",
	"exceeded the compute",
	"the database system is starting up",
	"the database system is shutting down",
];

const MAX_CAUSE_DEPTH = 5;

const thrownError = z.object({
	code: z.string().min(1).optional(),
	errorCode: z.string().min(1).optional(),
	message: z.string().optional(),
	cause: z.unknown().optional(),
});

export function isDatabaseUnavailable(cause: unknown): boolean {
	return matches(cause, 0);
}

function matches(cause: unknown, depth: number): boolean {
	if (depth > MAX_CAUSE_DEPTH) return false;

	const parsed = thrownError.safeParse(cause);
	if (!parsed.success) return false;

	const code = parsed.data.code ?? parsed.data.errorCode;
	if (code && (PRISMA_CODES.has(code) || DRIVER_CODES.has(code))) return true;

	const message = parsed.data.message?.toLowerCase();
	if (message && MESSAGE_MARKERS.some((marker) => message.includes(marker))) {
		return true;
	}

	return matches(parsed.data.cause, depth + 1);
}
