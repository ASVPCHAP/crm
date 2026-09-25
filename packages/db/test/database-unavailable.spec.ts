import { describe, expect, it } from "bun:test";
import { isDatabaseUnavailable } from "../src/database-unavailable";

describe("isDatabaseUnavailable", () => {
	it("matches a Prisma connection failure", () => {
		expect(isDatabaseUnavailable({ code: "P1001", message: "no" })).toBe(true);
		expect(isDatabaseUnavailable({ code: "P2024" })).toBe(true);
	});

	it("matches a driver timeout on the cause", () => {
		expect(
			isDatabaseUnavailable({
				message: "Invalid invocation",
				cause: { message: "timeout exceeded when trying to connect" },
			}),
		).toBe(true);
	});

	it("matches a Neon compute quota error", () => {
		expect(
			isDatabaseUnavailable({
				message:
					"Your project has exceeded the compute time quota. Upgrade your plan to increase the quota.",
			}),
		).toBe(true);
	});

	it("ignores a constraint failure", () => {
		expect(
			isDatabaseUnavailable({
				code: "P2002",
				message: "Unique constraint failed on the fields: (`key`)",
			}),
		).toBe(false);
	});

	it("ignores a missing record", () => {
		expect(isDatabaseUnavailable({ code: "P2025" })).toBe(false);
		expect(isDatabaseUnavailable(null)).toBe(false);
		expect(isDatabaseUnavailable("down")).toBe(false);
	});
});
