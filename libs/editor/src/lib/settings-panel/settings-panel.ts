import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	input,
	output,
	signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConnectionStatus, NetworkChange } from '@sd/host-client';
import {
	ActiveAppMessage,
	AssistantProvider,
	AssistantSettings,
	Settings,
	WelcomeMessage,
} from '@sd/protocol';

/** The terminal apps the host can drive per platform; Linux uses the system default only. */
const TERMINALS: Record<string, { value: string; label: string }[]> = {
	darwin: [
		{ value: '', label: 'Default (Terminal)' },
		{ value: 'Terminal', label: 'Terminal' },
		{ value: 'iTerm', label: 'iTerm2' },
	],
	windows: [
		{ value: '', label: 'Default (Windows Terminal)' },
		{ value: 'wt', label: 'Windows Terminal' },
		{ value: 'cmd', label: 'Command Prompt' },
	],
};
const DEFAULT_TERMINALS = [{ value: '', label: 'Default' }];

/** Ports below 1024 need root on the host; above 65535 does not exist. */
const MIN_PORT = 1024;
const MAX_PORT = 65535;

const DEFAULT_ASSISTANT_PROVIDER: AssistantProvider = 'anthropic';

/**
 * The settings sheet, in the order a user meets them: the connection and its pairing, how the
 * deck behaves (smart pages, terminal, the page builder), then diagnostics, backup and reset.
 */
@Component({
	selector: 'sd-settings-panel',
	imports: [FormsModule],
	templateUrl: './settings-panel.html',
	styleUrl: './settings-panel.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPanel {
	// Connection
	readonly host = input<WelcomeMessage | null>(null);
	readonly status = input<ConnectionStatus>('idle');
	readonly networkMs = input<number | null>(null);
	readonly executionMs = input<number | null>(null);
	readonly revision = input(-1);
	readonly port = input(0);
	readonly networkChanged = output<NetworkChange>();

	// Behaviour
	readonly settings = input<Settings | null>(null);
	readonly activeApp = input<ActiveAppMessage | null>(null);
	readonly smartPagesChanged = output<'buttons' | 'explicit'>();
	readonly terminalChanged = output<string>();
	readonly assistantChanged = output<AssistantSettings>();

	// Diagnostics, backup and reset
	readonly logsRequested = output<void>();
	readonly backupUrl = input('');
	readonly restoreRequested = output<File>();
	readonly resetRequested = output<void>();
	/** Shown on the phone, where forgetting the pairing makes sense. */
	readonly canDisconnect = input(false);
	readonly disconnected = output<void>();

	readonly portDraft = signal('');
	readonly confirmingRotate = signal(false);
	readonly confirmingReset = signal(false);

	readonly portValid = computed(() => {
		const value = Number(this.portDraft());
		return Number.isInteger(value) && value >= MIN_PORT && value <= MAX_PORT;
	});
	readonly portChanged = computed(
		() => this.portValid() && Number(this.portDraft()) !== this.port(),
	);
	readonly terminals = computed(
		() => TERMINALS[this.host()?.platform ?? ''] ?? DEFAULT_TERMINALS,
	);
	readonly assistant = computed<AssistantSettings>(() => this.settings()?.assistant ?? {});
	readonly assistantProvider = computed<AssistantProvider>(
		() => this.assistant().provider ?? DEFAULT_ASSISTANT_PROVIDER,
	);

	constructor() {
		effect(() => this.portDraft.set(String(this.port() || '')));
	}

	// Connection

	applyPort(): void {
		if (this.portChanged()) {
			this.networkChanged.emit({ port: Number(this.portDraft()) });
		}
	}

	/** The first press asks for confirmation, the second one rotates the token. */
	requestTokenRotation(): void {
		if (!this.confirmingRotate()) {
			this.confirmingRotate.set(true);
			return;
		}
		this.confirmingRotate.set(false);
		this.networkChanged.emit({ rotateToken: true });
	}

	// Behaviour

	updateAssistant(patch: Partial<AssistantSettings>): void {
		this.assistantChanged.emit({ ...this.assistant(), ...patch });
	}

	// Backup and reset

	onRestoreFile(event: Event): void {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			this.restoreRequested.emit(file);
		}
		// Clear the input so the same file can be chosen again.
		input.value = '';
	}

	/** The first press asks for confirmation, the second one resets. */
	requestReset(): void {
		if (!this.confirmingReset()) {
			this.confirmingReset.set(true);
			return;
		}
		this.confirmingReset.set(false);
		this.resetRequested.emit();
	}

	reloadDeck(): void {
		location.reload();
	}
}
