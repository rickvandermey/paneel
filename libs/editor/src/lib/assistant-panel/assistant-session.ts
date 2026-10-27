import { Injectable, effect, signal } from '@angular/core';
import { AssistantReply } from '@sd/protocol';
import { readStored, removeStored, writeStored } from '../shared/browser-storage';

export interface Turn {
	role: 'user' | 'assistant';
	text: string;
	reply?: AssistantReply;
}

const STORAGE_KEY = 'sd.assistant';

/**
 * The conversation outlives the panel: closing the sheet keeps it, a reload of the deck keeps
 * it too (sessionStorage), and it clears only on Start over or when a plan was added.
 */
@Injectable({ providedIn: 'root' })
export class AssistantSession {
	readonly turns = signal<Turn[]>(readStoredTurns());
	readonly draft = signal('');
	readonly busy = signal(false);
	readonly failure = signal<string | null>(null);

	constructor() {
		effect(() => {
			const turns = this.turns();
			if (turns.length === 0) {
				removeStored('session', STORAGE_KEY);
			} else {
				writeStored('session', STORAGE_KEY, JSON.stringify(turns));
			}
		});
	}

	reset(): void {
		this.turns.set([]);
		this.failure.set(null);
		this.draft.set('');
	}
}

function readStoredTurns(): Turn[] {
	try {
		const raw = readStored('session', STORAGE_KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed) ? (parsed as Turn[]) : [];
	} catch {
		// A stored conversation that is not valid JSON is simply dropped.
		return [];
	}
}
