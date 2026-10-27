export interface EmojiGroup {
	name: string;
	emojis: string[];
}

/** A small curated set; any other emoji can be typed into the free field. */
export const EMOJI_GROUPS: EmojiGroup[] = [
	{
		name: 'Smileys',
		emojis: ['😀', '😄', '😂', '😉', '😎', '🤔', '😴', '🤖', '👻', '💀', '🎃', '🤩'],
	},
	{
		name: 'Gestures',
		emojis: ['👍', '👎', '👋', '🤘', '👏', '🙏', '💪', '👀', '🧠', '❤️', '🔥', '⭐'],
	},
	{
		name: 'Work',
		emojis: ['💻', '🖥️', '⌨️', '🖱️', '📱', '📧', '📝', '📅', '📊', '📁', '🔒', '🔑'],
	},
	{
		name: 'Media',
		emojis: ['🎵', '🎶', '🎧', '🎤', '🎬', '📷', '📹', '🔊', '🔇', '⏯️', '⏭️', '⏮️'],
	},
	{
		name: 'Tools',
		emojis: ['🔧', '🔨', '⚙️', '🧰', '🧪', '🚀', '🛠️', '🧹', '🪄', '💡', '🔍', '🧭'],
	},
	{
		name: 'Symbols',
		emojis: ['✅', '❌', '⚠️', '❓', '➕', '➖', '🔁', '⬆️', '⬇️', '⬅️', '➡️', '🏠'],
	},
];
