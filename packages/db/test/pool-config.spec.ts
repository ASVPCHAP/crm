import { describe, expect, it } from "bun:test";
import { DB_POOL } from "../src/pool-config";

describe("DB_POOL", () => {
	it("fails a hung connect or query before the function timeout", () => {
		expect(DB_POOL.connectTimeoutMs).toBeLessThan(60_000);
		expect(DB_POOL.queryTimeoutMs).toBeLessThan(60_000);
		expect(DB_POOL.connectTimeoutMs).toBeGreaterThan(0);
		expect(DB_POOL.queryTimeoutMs).toBeGreaterThan(0);
	});

	it("drops idle clients so a warm process does not hold the database", () => {
		expect(DB_POOL.allowExitOnIdle).toBe(true);
		expect(DB_POOL.idleTimeoutMs).toBeLessThan(60_000);
		expect(DB_POOL.max).toBeGreaterThan(0);
	});
});
