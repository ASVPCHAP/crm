import { describe, expect, it } from "bun:test";
import { GMAIL_SCOPE, OUTLOOK_MAIL_SCOPE } from "@crm/auth/scopes";
import { userIdsMissingSync } from "../src/mailbox/missing-sync";

const googleScopes = {
	gmail: GMAIL_SCOPE,
	calendar: "https://www.googleapis.com/auth/calendar.readonly",
};

describe("userIdsMissingSync", () => {
	it("returns nobody when every granted source already has a row", () => {
		expect(
			userIdsMissingSync({
				accounts: [{ userId: "u1", scope: GMAIL_SCOPE }],
				rows: [{ userId: "u1", source: "gmail" }],
				scopeForSource: googleScopes,
			}),
		).toEqual([]);
	});

	it("returns a user who granted a source with no row", () => {
		expect(
			userIdsMissingSync({
				accounts: [{ userId: "u1", scope: `${GMAIL_SCOPE} openid` }],
				rows: [],
				scopeForSource: googleScopes,
			}),
		).toEqual(["u1"]);
	});

	it("skips a second query for a user whose rows are complete", () => {
		expect(
			userIdsMissingSync({
				accounts: [
					{ userId: "ready", scope: GMAIL_SCOPE },
					{ userId: "new", scope: GMAIL_SCOPE },
				],
				rows: [{ userId: "ready", source: "gmail" }],
				scopeForSource: googleScopes,
			}),
		).toEqual(["new"]);
	});

	it("reads a fully qualified Microsoft scope", () => {
		expect(
			userIdsMissingSync({
				accounts: [
					{
						userId: "u1",
						scope: `https://graph.microsoft.com/${OUTLOOK_MAIL_SCOPE}`,
					},
				],
				rows: [],
				scopeForSource: { outlook: OUTLOOK_MAIL_SCOPE },
			}),
		).toEqual(["u1"]);
	});

	it("does nothing when no account is connected", () => {
		expect(
			userIdsMissingSync({
				accounts: [],
				rows: [],
				scopeForSource: googleScopes,
			}),
		).toEqual([]);
	});
});
