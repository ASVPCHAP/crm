import { describe, expect, test } from "bun:test";
import { resolveApiUrl } from "../lib/env";

describe("resolveApiUrl", () => {
	test("prefers runtime API_URL over the public build-time fallback", () => {
		expect(
			resolveApiUrl("https://api.rpcrm.app", "http://localhost:3001"),
		).toBe("https://api.rpcrm.app");
	});

	test("uses NEXT_PUBLIC_API_URL when runtime API_URL is unset", () => {
		expect(resolveApiUrl(undefined, "https://api.example.test")).toBe(
			"https://api.example.test",
		);
	});

	test("defaults to localhost for bun", () => {
		expect(resolveApiUrl(undefined, undefined)).toBe("http://localhost:3001");
	});
});
