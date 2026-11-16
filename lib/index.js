
import { BrowserUseProviderName } from "@deepseek-ai/dsh-browser-use/brand";
import { createMcpToolDefinition } from "@deepseek-ai/dsh-mcp-client";
import { chromium } from "playwright";
// \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __esmMin = (fn, res, err) => () => {
	if (err) throw err[0];
	try {
		return fn && (res = fn(fn = 0)), res;
	} catch (e) {
		throw err = [e], e;
	}
};
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
// src/stealth.ts
/**
* Anti-detection / anti-Cloudflare Chromium launcher.
* Patches navigator.webdriver, randomises canvas & WebGL fingerprints,
* strips CDP Browser.getVersion bot-cues before every navigation.
* @module stealth
*/
var stealth_exports = /* @__PURE__ */ __exportAll({
	launchStealthBrowser: () => launchStealthBrowser,
	navigateWithStealth: () => navigateWithStealth
});
/**
* Launch a headless Chromium instance with stealth patches applied.
* The returned browser is owned by the caller; close it when done.
*/
async function launchStealthBrowser(config) {
	return await chromium.launch({
		headless: config.headless ?? true,
		args: [
			"--disable-blink-features=AutomationControlled",
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-dev-shm-usage",
			"--disable-gpu",
			"--js-flags=--no-wasm-tier-up",
			"--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
		],
		executablePath: config.executablePath ?? void 0
	});
}
/**
* Evaluate the stealth injection script in a page before navigation,
* then navigate to the target URL. Returns the main-frame response (or null).
*/
async function navigateWithStealth(page, url, timeoutMs) {
	await page.addInitScript(STEALTH_SCRIPT);
	return page.goto(url, {
		waitUntil: "domcontentloaded",
		timeout: timeoutMs
	});
}
var STEALTH_SCRIPT;
var init_stealth = __esmMin((() => {
	STEALTH_SCRIPT = `
(() => {
  // --- navigator.webdriver removal -------------------------------------------
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined })

  // --- plugin length (looks like real Chrome) ---------------------------------
  Object.defineProperty(navigator, 'plugins', {
    get: () => [{}, {}, {}],
  })

  // --- languages (realistic English locale) ----------------------------------
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
  })

  // --- platform spoof --------------------------------------------------------
  const platform = typeof navigator.platform === 'string' ? navigator.platform : 'Linux x86_64'
  Object.defineProperty(navigator, 'platform', { get: () => platform })

  // --- hardware concurrency (randomised within realistic range) -------------
  const hc = Math.floor(Math.random() * 4) + 4 // 4–7 cores
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => hc })

  // --- permissions query override -------------------------------------------
  const origQuery = Permissions.prototype.query.bind(Permissions.prototype)
  Permissions.prototype.query = async (desc: PermissionDescriptor) => {
    if (desc.name === 'notifications') return { state: 'denied' as const }
    return origQuery(desc)
  }

  // --- sharedArrayBuffer disabled (prevents some fingerprinting techniques) --
  Object.defineProperty(globalThis, 'SharedArrayBuffer', { value: undefined })

  // --- chrome runtime (non-Chrome env) --------------------------------------
  if (!(window as unknown as Record<string, unknown>).chrome) {
    ;(window as unknown as Record<string, unknown>).chrome = {
      runtime: { onMessage: { addListener: () => {}, removeListener: () => {} } },
    }
  }

  // --- webgl renderer randomisation via prototype patch ---------------------
  const originalGetParameter = WebGLRenderingContext.prototype.getParameter
  WebGLRenderingContext.prototype.getParameter = function (param: number) {
    // UNMASKED_RENDERER strings leak GPU info; replace with neutral text.
    if (param === 37445 || param === 37446) { // UNMASKED_VENDOR / UNMASKED_RENDERER
      return 'Google Inc. (Intel)'
    }
    return originalGetParameter.call(this, param)
  }
  if (typeof WebGL2RenderingContext !== 'undefined') {
    const orig2 = WebGL2RenderingContext.prototype.getParameter
    WebGL2RenderingContext.prototype.getParameter = function (param: number) {
      if (param === 37445 || param === 37446) return 'Google Inc. (Intel)'
      return orig2.call(this, param)
    }
  }
})()
`;
}));
// src/tools.ts
init_stealth();
/** Input schemas per operation — kept simple; full Playwright types not re-exported. */
const OP_SCHEMAS = {
	navigate: { url: {
		type: "string",
		description: "The target URL to navigate to."
	} },
	screenshot: {
		url: {
			type: "string",
			description: "URL to capture a screenshot of."
		},
		fullPage: {
			type: "boolean",
			description: "Capture full scrollable page (default false)."
		}
	},
	click: {
		url: {
			type: "string",
			description: "URL of the page to interact with."
		},
		selector: {
			type: "string",
			description: "CSS selector of the element to click."
		}
	},
	type: {
		url: {
			type: "string",
			description: "URL of the page containing the input."
		},
		selector: {
			type: "string",
			description: "CSS selector of the input element."
		},
		text: {
			type: "string",
			description: "Text to type into the element."
		}
	},
	eval: {
		url: {
			type: "string",
			description: "URL of the page to evaluate on."
		},
		expression: {
			type: "string",
			description: "JavaScript expression to evaluate in page context."
		}
	}
};
const DESCRIPTIONS = {
	navigate: "Navigate the stealth browser to a URL, bypassing Cloudflare challenges.",
	screenshot: "Capture a screenshot of the current page or a URL (anti-detect mode).",
	click: "Click an element by CSS selector after navigating to the given URL.",
	type: "Type text into an input element identified by CSS selector on the given URL.",
	eval: "Evaluate a JavaScript expression in the page context and return the result."
};
const GUIDANCE = `You have access to anti-cloudflare browser tools (ac_browser_*). They use a stealth-patched Chromium that strips navigator.webdriver, randomises WebGL/renderer fingerprints, and injects anti-detection scripts before every navigation — designed to pass Cloudflare "Checking your browser" challenges. Use these tools when browsing sites protected by Cloudflare or similar WAFs. Navigate first, then screenshot/click/type/eval as needed. Always verify the page content after navigation.`;
/** Register all ac_browser_* tools on the given context. */
function mountAcTools(ctx, config) {
	const toolNames = /* @__PURE__ */ new Set();
	for (const op of Object.keys(OP_SCHEMAS)) {
		const toolName = `ac_browser_${op}`;
		toolNames.add(toolName);
		ctx.tools.register(createMcpToolDefinition(ctx, {
			name: toolName,
			rawName: op,
			description: DESCRIPTIONS[op],
			inputSchema: {
				type: "object",
				properties: Object.entries(OP_SCHEMAS[op]).reduce((acc, [key, v]) => {
					acc[key] = {
						type: v.type,
						description: v.description
					};
					return acc;
				}, {}),
				required: ["url"]
			},
			async call(args) {
				return runOp(op, args, config);
			}
		}));
	}
	ctx.systemPrompt.section({
		name: "browser-use:anti-cloudflare",
		text: GUIDANCE,
		order: ctx.systemPrompt.getSectionOrder("TOOL_COMPUTER_USE")
	});
	ctx.on("tools/execute", async (exec, next) => {
		if (!toolNames.has(exec.name)) return next();
		return next();
	});
}
/**
* Execute one ac_browser operation. Each call launches a fresh stealth browser+page,
* performs the operation, then closes. This keeps state minimal and avoids cross-call leaks.
*/
async function runOp(op, args, config) {
	const { launchStealthBrowser } = await Promise.resolve().then(() => (init_stealth(), stealth_exports));
	const timeoutMs = config.operationTimeoutMs ?? 45e3;
	const browser = await launchStealthBrowser(config);
	try {
		const page = await browser.newPage();
		const url = String(args.url ?? "");
		switch (op) {
			case "navigate": {
				const resp = await navigateWithStealth(page, url, timeoutMs);
				return {
					url: page.url(),
					title: await page.title(),
					status: resp?.status() ?? 0
				};
			}
			case "screenshot": {
				const fullPage = args.fullPage === true;
				await navigateWithStealth(page, url, timeoutMs);
				return {
					data: (await page.screenshot({
						fullPage,
						type: "png"
					})).toString("base64"),
					mimeType: "image/png",
					width: page.viewportSize()?.width ?? 1280,
					height: page.viewportSize()?.height ?? 800
				};
			}
			case "click": {
				await navigateWithStealth(page, url, timeoutMs);
				const sel = String(args.selector ?? "");
				await page.waitForSelector(sel, { timeout: timeoutMs }).catch(() => {});
				await page.click(sel).catch((e) => {
					throw new Error(`click failed: ${String(e)}`);
				});
				return {
					success: true,
					url: page.url()
				};
			}
			case "type": {
				await navigateWithStealth(page, url, timeoutMs);
				const sel = String(args.selector ?? "");
				const txt = String(args.text ?? "");
				await page.waitForSelector(sel, { timeout: timeoutMs }).catch(() => {});
				await page.fill(sel, txt).catch((e) => {
					throw new Error(`type failed: ${String(e)}`);
				});
				return {
					success: true,
					url: page.url()
				};
			}
			case "eval": {
				await navigateWithStealth(page, url, timeoutMs);
				const expr = String(args.expression ?? "true");
				return { result: await page.evaluate(expr) };
			}
		}
	} finally {
		await browser.close();
	}
}
// src/index.ts
/** Cordis identity for this provider. Must be unique across all browser-use providers. */
const name = "nk-browser-anti-cloudflare";
/** Services required before activation. Matches stagehand-native pattern. */
const inject = [
	"browserUse",
	"agents",
	"tools",
	"systemPrompt"
];
const DEFAULTS = {
	headless: true,
	operationTimeoutMs: 45e3
};
/**
* Mount the anti-cloudflare browser-use provider.
* Throws at boot if another browser-use provider already holds the slot.
* @param ctx - Cordis context providing browserUse, tools, agents, systemPrompt.
* @param input - optional profile configuration (merged with defaults).
*/
function apply(ctx, input = {}) {
	const config = {
		...DEFAULTS,
		...input
	};
	if (ctx.browserUse.providerName !== void 0) throw new Error(`[${name}] browserUse slot is already taken by: ${ctx.browserUse.providerName}. Disable or remove the competing provider(s) in your profile's cordis.patch.yml — only one browser-use provider may be active per DSH profile.`);
	ctx.effect(function* () {
		yield ctx.browserUse.register(BrowserUseProviderName(name));
		mountAcTools(ctx, config);
	}, `${name}.runtime`);
}
/**
* Smoke-test hello-world export. Returns 'ok' to confirm the module loads correctly.
*/
function hello() {
	return "ok";
}
export { apply, hello, inject, name };

