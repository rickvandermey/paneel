import type { CommandResultMessage } from '@sd/protocol';

/** The revision a result carries when the host never saw the command. */
export const NO_REVISION = -1;

export function failedCommandResult(commandId: string, error: string): CommandResultMessage {
	return { type: 'commandResult', commandId, ok: false, revision: NO_REVISION, error };
}

/** Commands sent to the host whose verdict has not arrived yet, by command id. */
export class PendingCommands {
	private readonly resolvers = new Map<string, (result: CommandResultMessage) => void>();

	/** Resolves once the host answers, or once the connection is given up. */
	waitFor(commandId: string): Promise<CommandResultMessage> {
		return new Promise((resolve) => this.resolvers.set(commandId, resolve));
	}

	has(commandId: string): boolean {
		return this.resolvers.has(commandId);
	}

	settle(result: CommandResultMessage): void {
		const resolve = this.resolvers.get(result.commandId);
		this.resolvers.delete(result.commandId);
		resolve?.(result);
	}

	/** Answers every waiting caller with a failure, for example when the socket closed. */
	failAll(error: string): void {
		for (const [commandId, resolve] of this.resolvers) {
			resolve(failedCommandResult(commandId, error));
		}
		this.resolvers.clear();
	}
}
