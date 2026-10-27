import {
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	inject,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DeckKey } from '@sd/deck-ui';
import { HostClient, InstalledApp } from '@sd/host-client';
import { AssistantPlan, AssistantStatus, Button, Profile } from '@sd/protocol';
import { PresetButton } from '../presets/helpers';
import { errorMessage } from '../shared/error-message';
import { scrollToBottomOnChange } from '../shared/scroll-to-bottom';
import { buildAssistantRequest, resolvePlanButtons } from './assistant-plan';
import { AssistantSession } from './assistant-session';

/** A plan the user accepted, resolved to buttons the shell can store. */
export interface PlanApplication {
	plan: AssistantPlan;
	buttons: PresetButton[];
}

/** A conversation is a request and a reply per turn; the host refuses longer ones. */
const MAX_TURNS = 12;
const MAX_MESSAGES = MAX_TURNS * 2;

const SUGGESTIONS = [
	'A page for coding: git, tests and Claude',
	'A music page for Spotify',
	'Meeting controls: mute, camera, leave',
];

/** A short conversation that ends in a page; nothing else fits through this panel. */
@Component({
	selector: 'sd-assistant-panel',
	imports: [FormsModule, DeckKey],
	templateUrl: './assistant-panel.html',
	styleUrl: './assistant-panel.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistantPanel {
	private readonly client = inject(HostClient);
	private readonly session = inject(AssistantSession);
	private readonly log = viewChild<ElementRef<HTMLElement>>('log');

	readonly platform = input('');
	readonly profiles = input<Profile[]>([]);
	readonly currentProfile = input<Profile | null>(null);
	readonly installedApps = input<InstalledApp[] | null>(null);
	readonly assetUrl = input<(hash: string) => string>(() => '');
	readonly applied = output<PlanApplication>();
	readonly settingsRequested = output<void>();

	readonly status = signal<AssistantStatus | null>(null);
	readonly turns = this.session.turns;
	readonly draft = this.session.draft;
	readonly busy = this.session.busy;
	readonly failure = this.session.failure;
	readonly suggestions = SUGGESTIONS;

	/** The latest plan, as long as nothing newer was said. */
	readonly plan = computed<AssistantPlan | null>(() => {
		const last = this.turns().at(-1);
		return last?.reply?.kind === 'plan' ? (last.reply.plan ?? null) : null;
	});
	readonly preview = computed<Button[]>(() => {
		const plan = this.plan();
		if (!plan) {
			return [];
		}
		return this.resolve(plan).map((button, index) => ({ id: `plan-${index}`, ...button }));
	});
	readonly canSend = computed(
		() => !this.busy() && this.draft().trim().length > 0 && this.turns().length < MAX_MESSAGES,
	);

	constructor() {
		void this.loadStatus();
		scrollToBottomOnChange(this.turns, this.log);
	}

	sendSuggestion(text: string): void {
		this.draft.set(text);
		void this.send();
	}

	async send(): Promise<void> {
		const text = this.draft().trim();
		if (!text || this.busy()) {
			return;
		}
		this.draft.set('');
		this.failure.set(null);
		this.turns.update((turns) => [...turns, { role: 'user', text }]);
		this.busy.set(true);
		try {
			const reply = await this.client.assistant(
				buildAssistantRequest({
					turns: this.turns(),
					platform: this.platform(),
					profiles: this.profiles(),
					currentProfile: this.currentProfile(),
					installedApps: this.installedApps() ?? [],
				}),
			);
			this.turns.update((turns) => [
				...turns,
				{ role: 'assistant', text: reply.message, reply },
			]);
		} catch (cause) {
			this.failure.set(errorMessage(cause, 'The assistant did not answer'));
		} finally {
			this.busy.set(false);
		}
	}

	applyPlan(): void {
		const plan = this.plan();
		if (!plan) {
			return;
		}
		this.applied.emit({ plan, buttons: this.resolve(plan) });
		this.session.reset();
	}

	startOver(): void {
		this.session.reset();
	}

	private resolve(plan: AssistantPlan): PresetButton[] {
		return resolvePlanButtons(plan, this.platform(), this.installedApps() ?? []);
	}

	private async loadStatus(): Promise<void> {
		try {
			this.status.set(await this.client.assistantStatus());
		} catch {
			this.status.set({ provider: '', model: '', configured: false, shareApps: false });
		}
	}
}
