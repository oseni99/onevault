import { describe, expect, it } from "vitest";
import { highlight } from "./highlight";

describe("highlight", () => {
	it("emits colors for both viewer themes", async () => {
		const html = await highlight('const answer = "yes";', "theme.ts");

		expect(html).toContain('class="shiki');
		expect(html).toContain("--shiki-dark:");
	});
});
