import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HostStatusStore } from '../host-status';

/** Stores an API key for the page builder on this computer; the phone never sees the key. */
@Component({
	selector: 'sd-assistant-key-form',
	imports: [FormsModule],
	templateUrl: './assistant-key-form.html',
	styleUrl: './assistant-key-form.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistantKeyForm {
	readonly hostStatus = inject(HostStatusStore);
	readonly apiKeyDraft = signal('');
	readonly apiKeyProvider = signal('anthropic');
	readonly apiKeyNotice = signal('');

	async saveApiKey(): Promise<void> {
		const key = this.apiKeyDraft().trim();
		try {
			await this.hostStatus.setAssistantKey(this.apiKeyProvider(), key);
			this.apiKeyDraft.set('');
			this.apiKeyNotice.set(key ? 'Key saved on this computer.' : 'Key removed.');
		} catch (cause) {
			const message = cause instanceof Error ? cause.message : '';
			this.apiKeyNotice.set(message || 'Could not save the key');
		}
	}
}
