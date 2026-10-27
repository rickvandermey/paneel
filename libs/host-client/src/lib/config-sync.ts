import { applyCommand, type ChangedMessage, type Config } from '@sd/protocol';

/**
 * The config after a 'changed' broadcast, or 'resync' when a revision was missed and the whole
 * config must be fetched again. A command this deck sent was already applied optimistically, so
 * only its revision moves; another deck's command is applied here.
 */
export function configAfterChange(
	current: Config,
	message: ChangedMessage,
	isOwnCommand: boolean,
): Config | 'resync' {
	if (message.revision !== current.revision + 1) {
		return 'resync';
	}
	const updated = isOwnCommand
		? structuredClone(current)
		: applyCommand(current, message.command);
	updated.revision = message.revision;
	return updated;
}
