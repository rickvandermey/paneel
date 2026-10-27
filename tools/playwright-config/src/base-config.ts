import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { devices, type PlaywrightTestConfig } from '@playwright/test';
import { cucumberReporter, defineBddConfig } from 'playwright-bdd';

const presetPath = join(workspaceRoot, 'tools/playwright-config/src');

// playwright-bdd 9.2 calls its own registerESMLoader() before loading step files; Playwright 1.61
// removed the internal it reads, so bddgen crashes. Neutralize the call until upstream ships the fix.
function neutralizeRedundantBddEsmLoader(): void {
	const requireFromRoot = createRequire(join(workspaceRoot, 'noop.cjs'));
	const playwrightVersion = (
		requireFromRoot('@playwright/test/package.json') as { version: string }
	).version;
	if (playwrightVersion < '1.61.0') {
		return;
	}
	const esmLoaderPath = join(
		dirname(requireFromRoot.resolve('playwright-bdd')),
		'playwright/esmLoader.js',
	);
	const esmLoader = requireFromRoot(esmLoaderPath) as {
		registerESMLoader: () => void;
	};
	esmLoader.registerESMLoader = (): void => {
		// Playwright 1.61+ registers the ESM loader itself.
	};
}

neutralizeRedundantBddEsmLoader();

/** Tags that name a platform; scenarios carrying one only run on that host platform. */
const PLATFORM_TAGS: Record<string, string> = {
	darwin: '@mac',
	win32: '@windows',
	linux: '@linux',
};

/** Scenarios tagged for other platforms, plus @manual ones, never run automatically. */
export function excludedTagsPattern(platform: string = process.platform): RegExp {
	const others = Object.entries(PLATFORM_TAGS)
		.filter(([key]) => key !== platform)
		.map(([, tag]) => tag);
	return new RegExp(['@manual', ...others].join('|'));
}

export interface DeckE2EOptions {
	appName: string;
	baseURL: string;
	/** Starts the host; the config dir and port belong to the suite only. */
	webServer: PlaywrightTestConfig['webServer'];
}

// The generated specs live in a non-dot folder so the @nx/playwright plugin can enumerate them.
const generatedTestDir = 'src/features-gen';

/**
 * Shared Playwright + BDD configuration. Every scenario talks to one real host whose config it
 * mutates, so the suite runs with a single worker and each feature starts from a reset host.
 */
export function baseConfig(options: DeckE2EOptions): PlaywrightTestConfig {
	defineBddConfig({
		features: ['./src/features/**/*.feature'],
		steps: ['./src/steps/**/*.ts'],
		outputDir: `./${generatedTestDir}`,
	});
	const outputDir = process.env['OUTPUT'] || `../../test-reports/apps/${options.appName}`;
	const reporter: PlaywrightTestConfig['reporter'] = process.env['CI']
		? [['dot'], ['blob', { outputFile: `${outputDir}/blob-report/${options.appName}.zip` }]]
		: [
				['list'],
				['html', { open: 'never', outputFolder: `${outputDir}/ui` }],
				cucumberReporter('html', {
					outputFile: `${outputDir}/cucumber-report/index.html`,
					externalAttachments: true,
				}),
			];
	const excluded = excludedTagsPattern();

	return {
		...nxE2EPreset(presetPath, { testDir: './src' }),
		testDir: generatedTestDir,
		forbidOnly: !!process.env['CI'],
		fullyParallel: false,
		workers: 1,
		retries: process.env['CI'] ? 1 : 0,
		timeout: 45_000,
		expect: { timeout: 7_000 },
		outputDir: `${outputDir}/artifacts`,
		reporter,
		metadata: {
			app: options.appName,
			platform: process.platform,
			environment: process.env['CI'] ? 'ci' : 'local',
		},
		use: {
			baseURL: options.baseURL,
			headless: true,
			screenshot: 'only-on-failure',
			trace: 'on-first-retry',
			video: 'retain-on-failure',
		},
		projects: [
			{
				name: 'phone',
				grepInvert: new RegExp(`${excluded.source}|@desktop`),
				use: { ...devices['Pixel 7'], hasTouch: false },
			},
			{
				name: 'desktop',
				grep: /@desktop/,
				grepInvert: excluded,
				use: {
					...devices['Desktop Chrome'],
					viewport: { width: 1280, height: 800 },
				},
			},
		],
		webServer: options.webServer,
	};
}
