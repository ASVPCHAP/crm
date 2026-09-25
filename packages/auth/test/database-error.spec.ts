import { describe, expect, it } from "bun:test";
import { APIError } from "better-auth/api";
import { AUTH_DATABASE_DOWN, authDatabaseError } from "../src/database-error";

describe("authDatabaseError", () => {
	it("turns a dead database into a 503", () => {
		const error = authDatabaseError({
			code: "P1001",
			message: "Can't reach database server",
		});

		expect(error).toBeInstanceOf(APIError);
		expect(error?.status).toBe("SERVICE_UNAVAILABLE");
		expect(error?.message).toBe(AUTH_DATABASE_DOWN);
	});

	it("leaves a real auth failure alone", () => {
		expect(
			authDatabaseError({
				code: "P2002",
				message: "Unique constraint failed",
			}),
		).toBeNull();
	});
});
