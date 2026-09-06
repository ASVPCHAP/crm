export function resolveApiUrl(
	runtimeUrl = process.env.API_URL,
	publicUrl = process.env.NEXT_PUBLIC_API_URL,
): string {
	return runtimeUrl ?? publicUrl ?? "http://localhost:3001";
}

export const API_URL = resolveApiUrl();

export function isMarketing(): boolean {
	return process.env.IS_MARKETING === "true";
}
