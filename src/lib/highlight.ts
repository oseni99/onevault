import { codeToHtml } from "shiki";

// Map a filename to a Shiki language id. Unknowns fall back to plain text.
const EXT: Record<string, string> = {
	ts: "typescript",
	tsx: "tsx",
	js: "javascript",
	jsx: "jsx",
	mjs: "javascript",
	cjs: "javascript",
	json: "json",
	py: "python",
	rb: "ruby",
	go: "go",
	rs: "rust",
	java: "java",
	c: "c",
	h: "c",
	cpp: "cpp",
	cc: "cpp",
	hpp: "cpp",
	cs: "csharp",
	php: "php",
	swift: "swift",
	kt: "kotlin",
	scala: "scala",
	sh: "bash",
	bash: "bash",
	zsh: "bash",
	yml: "yaml",
	yaml: "yaml",
	toml: "toml",
	ini: "ini",
	xml: "xml",
	html: "html",
	css: "css",
	scss: "scss",
	md: "markdown",
	sql: "sql",
	dockerfile: "docker",
	lua: "lua",
};

function langFor(name: string): string {
	const lower = name.toLowerCase();
	if (lower === "dockerfile") return "docker";
	const ext = lower.includes(".") ? lower.split(".").pop() || "" : "";
	return EXT[ext] ?? "text";
}

// Returns Shiki-generated HTML with both GitHub palettes. Shiki emits the
// dark colors as CSS variables, allowing the viewer's persisted data-theme
// preference to switch palettes without highlighting again in the browser.
export async function highlight(
	code: string,
	filename: string,
): Promise<string | null> {
	return highlightByLang(code, langFor(filename));
}

// Same, but the caller already knows the Shiki language id (e.g. a fenced
// code block's info string from GitHub-rendered markdown).
export async function highlightByLang(
	code: string,
	lang: string,
): Promise<string | null> {
	try {
		return await codeToHtml(code, {
			lang: lang || "text",
			themes: { light: "github-light", dark: "github-dark" },
			defaultColor: "light",
		});
	} catch {
		try {
			return await codeToHtml(code, {
				lang: "text",
				themes: { light: "github-light", dark: "github-dark" },
				defaultColor: "light",
			});
		} catch {
			return null;
		}
	}
}
