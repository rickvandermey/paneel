import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	output,
	signal,
	untracked,
	viewChild,
} from '@angular/core';
import { Deck, MoveRequest, SwipeDirection } from '@sd/deck-ui';
import { HostClient, InstalledApp, NetworkChange, randomId } from '@sd/host-client';
import {
	Action,
	AssistantSettings,
	Button,
	ButtonPatch,
	CustomPalette,
	CustomTheme,
	IconRef,
	locateButton,
	Profile,
	ProfilePatch,
	Settings,
} from '@sd/protocol';
import { AppCatalog } from '../app-catalog/app-catalog';
import { AssistantPanel, PlanApplication } from '../assistant-panel/assistant-panel';
import { ButtonDraft, ButtonEditor } from '../button-editor/button-editor';
import { Catalog } from '../catalog/catalog';
import { LogsPanel } from '../logs-panel/logs-panel';
import { Menu, MenuItem } from '../menu/menu';
import { PagePreset } from '../page-presets/page-presets';
import { PagePresetsPanel } from '../page-presets/page-presets-panel';
import { PaletteEditor } from '../palette-editor/palette-editor';
import { PalettePanel } from '../palette-panel/palette-panel';
import { NO_PALETTE, paletteById, paletteColor, recolorPlan } from '../palette-panel/palettes';
import { PresetButton } from '../presets/presets';
import { ProfilesPanel } from '../profiles-panel/profiles-panel';
import { SettingsPanel } from '../settings-panel/settings-panel';
import { pageForApp } from '../shared/app-match';
import { errorMessage } from '../shared/error-message';
import { Sheet } from '../sheet/sheet';
import { ThemeEditor } from '../theme-editor/theme-editor';
import { applyThemeToDocument, readCachedTheme } from '../theme-panel/document-theme';
import { ThemePanel } from '../theme-panel/theme-panel';
import { DEFAULT_THEME, knownThemeIdOrDefault, resolveTheme } from '../theme-panel/themes';
import { Welcome } from '../welcome/welcome';
import {
	blankPage,
	buttonFromDraft,
	buttonFromPreset,
	buttonPatchFromDraft,
	pageFromPlan,
	pageFromPreset,
	samplePage,
	START_PAGE_NAME,
} from './page-builders';
import { ToastAction, ToastQueue } from './toast';

export type Panel =
	| 'menu'
	| 'button'
	| 'catalog'
	| 'app-catalog'
	| 'profiles'
	| 'page-presets'
	| 'palette'
	| 'palette-editor'
	| 'theme'
	| 'theme-editor'
	| 'settings'
	| 'logs'
	| 'assistant';

/** The button being edited (null for a new one) and the folder it lives in (null for the page root). */
interface EditTarget {
	button: Button | null;
	parentId: string | null;
}

/** The colors a recolor replaced, so it can be undone from the toast or the palette panel. */
interface RecolorUndo {
	pageName: string;
	colors: Map<string, string>;
}

/** How long a pressed key lights up on the deck. */
const PRESS_FLASH_MS = 150;
const PRESS_HAPTIC_MS = 15;

/** The complete deck UI: top bar, deck, hamburger menu and editing panels. */
@Component({
	selector: 'sd-shell',
	imports: [
		Deck,
		Menu,
		Sheet,
		ButtonEditor,
		Catalog,
		AppCatalog,
		ProfilesPanel,
		SettingsPanel,
		LogsPanel,
		AssistantPanel,
		ThemePanel,
		PalettePanel,
		ThemeEditor,
		PaletteEditor,
		PagePresetsPanel,
		Welcome,
	],
	templateUrl: './shell.html',
	styleUrl: './shell.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
	readonly canDisconnect = input(false);
	readonly disconnected = output<void>();

	readonly client = inject(HostClient);
	readonly profileIndex = signal(0);
	readonly editing = signal(false);
	readonly panel = signal<Panel | null>(null);
	readonly activeButtonId = signal<string | null>(null);
	readonly editTarget = signal<EditTarget | null>(null);
	/** Page whose palette is being chosen. */
	readonly paletteProfileId = signal<string | null>(null);
	readonly editingTheme = signal<CustomTheme | null>(null);
	readonly editingPalette = signal<CustomPalette | null>(null);
	/** Apps on the host, loaded once per connection for recommendations and smart pages. */
	readonly installedApps = signal<InstalledApp[] | null>(null);
	readonly recolorUndo = signal<RecolorUndo | null>(null);
	readonly toasts = new ToastQueue();
	readonly toast = this.toasts.current;
	readonly noPalette = NO_PALETTE;

	readonly settings = computed<Settings | null>(() => this.client.config()?.settings ?? null);
	readonly profiles = computed<Profile[]>(() => this.client.config()?.profiles ?? []);
	readonly profile = computed<Profile | null>(() => this.profiles()[this.profileIndex()] ?? null);
	readonly platform = computed(() => this.client.hostInfo()?.platform ?? '');
	readonly isReady = computed(
		() => this.client.status() === 'connected' && !!this.client.config(),
	);
	readonly customThemes = computed(() => this.settings()?.customThemes ?? []);
	readonly customPalettes = computed(() => this.settings()?.customPalettes ?? []);
	readonly palette = computed(() => paletteById(this.profile()?.palette, this.customPalettes()));
	readonly paletteProfile = computed(
		() => this.profiles().find((profile) => profile.id === this.paletteProfileId()) ?? null,
	);
	/** Color for the next new button on the current page, following the palette. */
	readonly nextColor = computed(() => {
		const profile = this.profile();
		return profile
			? paletteColor(profile.palette, profile.buttons.length, this.customPalettes())
			: null;
	});
	/** Before the config arrives the last known theme is used, so a reload does not flash the default. */
	readonly theme = computed(() =>
		knownThemeIdOrDefault(this.settings()?.theme ?? readCachedTheme(), this.customThemes()),
	);
	readonly assetUrl = (hash: string) => this.client.assetUrl(hash);

	/** Live position of the button being edited, so move arrows follow the config. */
	readonly editPosition = computed(() => {
		const config = this.client.config();
		const id = this.editTarget()?.button?.id;
		if (!config || !id) {
			return null;
		}
		return locateButton(config, id);
	});
	readonly canMoveBack = computed(() => (this.editPosition()?.index ?? 0) > 0);
	readonly canMoveForward = computed(() => {
		const position = this.editPosition();
		return !!position && position.index < position.list.length - 1;
	});

	private readonly deck = viewChild(Deck);

	constructor() {
		effect(() => this.keepProfileIndexInRange());
		effect(() => this.followFocusedApp());
		effect(() => {
			if (this.client.status() === 'connected') {
				untracked(() => void this.loadInstalledApps());
			} else {
				this.installedApps.set(null);
			}
		});
		effect(() => {
			const theme = this.theme();
			applyThemeToDocument(theme, resolveTheme(theme, this.customThemes()));
		});
	}

	// Pages

	/** Shows the page without touching the open panel. */
	showProfile(id: string): void {
		const index = this.profiles().findIndex((profile) => profile.id === id);
		if (index >= 0) {
			this.profileIndex.set(index);
		}
	}

	/** Shows the page and closes whatever panel it was chosen from. */
	selectProfile(id: string): void {
		this.showProfile(id);
		this.panel.set(null);
	}

	onProfileSwipe(direction: SwipeDirection): void {
		const count = this.profiles().length;
		if (count < 2) {
			return;
		}
		const delta = direction === 'next' ? 1 : -1;
		this.profileIndex.set((this.profileIndex() + delta + count) % count);
	}

	onProfileCreated(name: string): void {
		const id = randomId();
		void this.client.send({ type: 'profile.create', profile: blankPage(id, name) });
		this.showProfile(id);
		this.panel.set('profiles');
	}

	/** Creates a page from a preset; installed apps from its list become its appMatch. */
	onPagePresetChosen(choice: { preset: PagePreset; installed: string[] }): void {
		const id = randomId();
		const profile = pageFromPreset(
			id,
			choice.preset,
			choice.installed,
			this.platform(),
			this.installedApps() ?? [],
			randomId,
		);
		void this.client.send({ type: 'profile.create', profile });
		this.showProfile(id);
		this.panel.set('profiles');
		this.toasts.show(`Added the ${choice.preset.name} page`);
	}

	restoreSamplePage(): void {
		const id = randomId();
		void this.client.send({
			type: 'profile.create',
			profile: samplePage(id, this.platform(), randomId),
		});
		this.selectProfile(id);
		this.toasts.show('Added the sample page');
	}

	onProfileRenamed(change: { id: string; name: string }): void {
		this.updateProfile(change.id, { name: change.name });
	}

	onProfileIconChanged(change: { id: string; icon: IconRef | null }): void {
		this.updateProfile(change.id, { icon: change.icon });
	}

	onProfileAppMatchChanged(change: { id: string; appMatch: string }): void {
		this.updateProfile(change.id, { appMatch: change.appMatch });
	}

	onProfileMoved(change: { id: string; index: number }): void {
		const activeId = this.profile()?.id ?? null;
		void this.client.send({ type: 'profile.move', ...change });
		// Keep showing the same page after the list was reordered.
		if (activeId) {
			this.showProfile(activeId);
		}
	}

	onProfileDeleted(id: string): void {
		void this.client.send({ type: 'profile.delete', id });
	}

	// Keys on the deck

	onPressed(button: Button): void {
		const switchTo = button.actions.find(
			(action) => action.kind === 'switchProfile',
		)?.profileId;
		if (switchTo) {
			this.selectProfile(switchTo);
		}
		this.activeButtonId.set(button.id);
		navigator.vibrate?.(PRESS_HAPTIC_MS);
		this.client.press(button.id);
		setTimeout(() => this.activeButtonId.set(null), PRESS_FLASH_MS);
	}

	/** Example keys run their actions directly; nothing is stored until the user adds a page. */
	onExamplePressed(button: Button): void {
		navigator.vibrate?.(PRESS_HAPTIC_MS);
		this.client.run(button.actions);
		this.toasts.show(`${button.label} sent to your computer`);
	}

	onMoveRequested(request: MoveRequest): void {
		const profile = this.profile();
		if (!profile) {
			return;
		}
		void this.client.send({
			type: 'button.move',
			id: request.id,
			profileId: profile.id,
			parentId: this.currentFolderId() ?? undefined,
			index: request.index,
		});
	}

	// The button editor

	onEditRequested(button: Button): void {
		this.editTarget.set({ button, parentId: this.currentFolderId() });
		this.panel.set('button');
	}

	onAddRequested(parentId: string | null): void {
		this.editTarget.set({ button: null, parentId });
		this.panel.set('button');
	}

	onDraftSaved(draft: ButtonDraft): void {
		const target = this.editTarget();
		const profile = this.profile();
		if (!target || !profile) {
			return;
		}
		if (target.button) {
			this.updateButton(target.button.id, buttonPatchFromDraft(draft));
		} else {
			void this.client.send({
				type: 'button.create',
				profileId: profile.id,
				parentId: target.parentId ?? undefined,
				button: buttonFromDraft(randomId(), draft),
			});
		}
		this.closePanel();
	}

	/** Try-out from the editor: the host runs the draft's actions, nothing is stored. */
	onDraftTried(actions: Action[]): void {
		this.client.run(actions);
		this.toasts.show('Running the actions on your computer');
	}

	onDraftDeleted(): void {
		const id = this.editTarget()?.button?.id;
		if (id) {
			void this.client.send({ type: 'button.delete', id });
		}
		this.closePanel();
	}

	onDraftMoved(direction: 'back' | 'forward'): void {
		const target = this.editTarget();
		const position = this.editPosition();
		const profile = this.profile();
		if (!target?.button || !position || !profile) {
			return;
		}
		void this.client.send({
			type: 'button.move',
			id: target.button.id,
			profileId: profile.id,
			parentId: target.parentId ?? undefined,
			index: position.index + (direction === 'forward' ? 1 : -1),
		});
	}

	onOpenFolder(): void {
		const id = this.editTarget()?.button?.id;
		if (id) {
			this.deck()?.openFolder(id);
		}
		this.closePanel();
	}

	// Presets and the assistant

	onPresetAdded(preset: PresetButton): void {
		const profile = this.ensurePage();
		if (!profile) {
			return;
		}
		this.addPresetsToPage(profile, [preset]);
		this.toasts.show(`Added "${preset.label}" to ${profile.name}`);
	}

	onPresetsAdded(presets: PresetButton[]): void {
		const profile = this.ensurePage();
		if (!profile || presets.length === 0) {
			return;
		}
		this.addPresetsToPage(profile, presets);
		this.toasts.show(`Added ${presets.length} buttons to ${profile.name}`);
	}

	/** Stores an accepted plan: a new page, or keys on the current one; the toast can undo it. */
	onPlanApplied(application: PlanApplication): void {
		const buttons = application.buttons.map((button) => ({ id: randomId(), ...button }));
		const current = this.profile();
		if (application.plan.target === 'current' && current) {
			this.addPlanToPage(current, buttons);
		} else {
			this.createPageFromPlan(application, buttons);
		}
	}

	private addPlanToPage(profile: Profile, buttons: Button[]): void {
		for (const button of buttons) {
			void this.client.send({ type: 'button.create', profileId: profile.id, button });
		}
		this.panel.set(null);
		this.toasts.show(`Added ${buttons.length} keys to ${profile.name}`, {
			label: 'Undo',
			run: () => {
				for (const button of buttons) {
					void this.client.send({ type: 'button.delete', id: button.id });
				}
			},
		});
	}

	private createPageFromPlan(application: PlanApplication, buttons: Button[]): void {
		const id = randomId();
		void this.client.send({
			type: 'profile.create',
			profile: pageFromPlan(id, application.plan, buttons),
		});
		this.selectProfile(id);
		this.toasts.show(`Added the ${application.plan.name} page`, {
			label: 'Undo',
			run: () => void this.client.send({ type: 'profile.delete', id }),
		});
	}

	// Palettes

	onPaletteRequested(profileId: string): void {
		this.paletteProfileId.set(profileId);
		this.panel.set('palette');
	}

	onPaletteSelected(palette: string): void {
		const id = this.paletteProfileId();
		if (id) {
			this.updateProfile(id, { palette });
		}
	}

	/** Gives every button on the page a palette color in turn, folders included. */
	onRecolorRequested(): void {
		const profile = this.paletteProfile();
		if (!profile) {
			return;
		}
		const plan = recolorPlan(profile.buttons, profile.palette, this.customPalettes());
		if (plan.length === 0) {
			this.toasts.show(`${profile.name} already uses these colors`);
			return;
		}
		const previousColors = new Map<string, string>();
		for (const { button, color } of plan) {
			previousColors.set(button.id, button.color);
			this.updateButton(button.id, { color });
		}
		this.recolorUndo.set({ pageName: profile.name, colors: previousColors });
		this.toasts.show(`Recolored ${plan.length} buttons on ${profile.name}`, {
			label: 'Undo',
			run: () => this.undoRecolor(),
		});
	}

	/** Puts the colors from before the last recolor back; the host receives one update per button. */
	undoRecolor(): void {
		const undo = this.recolorUndo();
		if (!undo) {
			return;
		}
		for (const [id, color] of undo.colors) {
			this.updateButton(id, { color });
		}
		this.recolorUndo.set(null);
		this.toasts.show(`Restored the colors of ${undo.pageName}`);
	}

	openPaletteEditor(palette: CustomPalette | null): void {
		this.editingPalette.set(palette);
		this.panel.set('palette-editor');
	}

	/** Saves a custom palette and assigns it to the page the picker was opened for. */
	onCustomPaletteSaved(palette: CustomPalette): void {
		const others = this.customPalettes().filter((entry) => entry.id !== palette.id);
		this.updateSettings({ customPalettes: [...others, palette] });
		const pageId = this.paletteProfileId();
		if (pageId) {
			this.updateProfile(pageId, { palette: palette.id });
		}
		this.editingPalette.set(null);
		this.panel.set('palette');
	}

	/** Removes a custom palette; pages that used it fall back to none. */
	onCustomPaletteDeleted(palette: CustomPalette): void {
		this.updateSettings({
			customPalettes: this.customPalettes().filter((entry) => entry.id !== palette.id),
		});
		for (const profile of this.profiles()) {
			if (profile.palette === palette.id) {
				this.updateProfile(profile.id, { palette: '' });
			}
		}
	}

	// Themes

	onThemeChanged(theme: string): void {
		this.updateSettings({ theme });
	}

	openThemeEditor(theme: CustomTheme | null): void {
		this.editingTheme.set(theme);
		this.panel.set('theme-editor');
	}

	/** Saves a custom theme (new or edited) and makes it the active one. */
	onCustomThemeSaved(theme: CustomTheme): void {
		const others = this.customThemes().filter((entry) => entry.id !== theme.id);
		this.updateSettings({ customThemes: [...others, theme], theme: theme.id });
		this.editingTheme.set(null);
		this.panel.set('theme');
	}

	onCustomThemeDeleted(theme: CustomTheme): void {
		const remaining = this.customThemes().filter((entry) => entry.id !== theme.id);
		const patch: Partial<Settings> = { customThemes: remaining };
		if (this.settings()?.theme === theme.id) {
			patch.theme = DEFAULT_THEME;
		}
		this.updateSettings(patch);
	}

	// Settings

	onTerminalChanged(terminal: string): void {
		this.updateSettings({ terminal });
	}

	onSmartPagesChanged(smartPages: 'buttons' | 'explicit'): void {
		this.updateSettings({ smartPages });
	}

	onVerboseLoggingChanged(verboseLogging: boolean): void {
		this.updateSettings({ verboseLogging });
	}

	onAssistantSettingsChanged(assistant: AssistantSettings): void {
		this.updateSettings({ assistant });
	}

	async onResetRequested(): Promise<void> {
		try {
			await this.client.resetConfig();
			this.profileIndex.set(0);
			this.toasts.show('Started clean');
		} catch (cause) {
			this.client.error.set(errorMessage(cause, 'Reset failed'));
		}
	}

	async onRestoreRequested(file: File): Promise<void> {
		try {
			const pages = await this.client.restore(file);
			this.profileIndex.set(0);
			this.toasts.show(`Restored ${pages} pages from the backup`);
		} catch (cause) {
			this.client.error.set(errorMessage(cause, 'Restore failed'));
		}
	}

	async onNetworkChanged(change: NetworkChange): Promise<void> {
		try {
			await this.client.updateNetwork(change);
			this.toasts.show('Reconnecting with the new pairing details');
		} catch (cause) {
			this.client.error.set(errorMessage(cause, 'Network change failed'));
		}
	}

	// Panels and toasts

	onMenu(item: MenuItem): void {
		if (item === 'edit') {
			this.editing.update((value) => !value);
			this.panel.set(null);
			return;
		}
		this.panel.set(item);
	}

	closePanel(): void {
		this.panel.set(null);
		this.editTarget.set(null);
		this.paletteProfileId.set(null);
		this.editingTheme.set(null);
		this.editingPalette.set(null);
	}

	showToast(message: string, action?: ToastAction): void {
		this.toasts.show(message, action);
	}

	// Helpers

	private updateSettings(patch: Partial<Settings>): void {
		void this.client.send({ type: 'settings.update', patch });
	}

	private updateProfile(id: string, patch: ProfilePatch): void {
		void this.client.send({ type: 'profile.update', id, patch });
	}

	private updateButton(id: string, patch: ButtonPatch): void {
		void this.client.send({ type: 'button.update', id, patch });
	}

	private addPresetsToPage(profile: Profile, presets: PresetButton[]): void {
		for (const preset of presets) {
			void this.client.send({
				type: 'button.create',
				profileId: profile.id,
				button: buttonFromPreset(randomId(), preset, this.nextColor()),
			});
		}
	}

	/** Adding a button with no page around creates a Start page first. */
	private ensurePage(): Profile | null {
		const current = this.profile();
		if (current) {
			return current;
		}
		const profile = blankPage(randomId(), START_PAGE_NAME);
		void this.client.send({ type: 'profile.create', profile });
		// Select it without closing the panel the user is adding from.
		this.showProfile(profile.id);
		return profile;
	}

	private currentFolderId(): string | null {
		return this.deck()?.folderPath().at(-1) ?? null;
	}

	private keepProfileIndexInRange(): void {
		const count = this.profiles().length;
		if (this.profileIndex() >= count) {
			this.profileIndex.set(Math.max(0, count - 1));
		}
	}

	/** Smart pages: follow the focused app unless the user is busy in the editor. */
	private followFocusedApp(): void {
		const app = this.client.activeApp();
		if (!app || this.editing() || this.panel() !== null) {
			return;
		}
		const mode = this.settings()?.smartPages ?? 'buttons';
		const match = pageForApp(this.profiles(), app, mode);
		if (match) {
			untracked(() => this.selectProfile(match.id));
		}
	}

	private async loadInstalledApps(): Promise<void> {
		try {
			this.installedApps.set(await this.client.listApps());
		} catch {
			this.installedApps.set([]);
		}
	}
}
