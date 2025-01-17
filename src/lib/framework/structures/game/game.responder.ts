import { BuilderCallback, InteractionMessageContentBuilder, Responder } from '#lib/utilities';
import type { ChatInputCommandInteraction, GuildCacheMessage } from 'discord.js';

/**
 * Represents the game's responder utility.
 */
export class GameResponder extends Responder<'cached', ChatInputCommandInteraction<'cached'>> {
	protected messageId: string | null = null;

	public override async send(builder: BuilderCallback<InteractionMessageContentBuilder>) {
		const message = await super.send(builder);
		this.messageId = message.id;
		return message;
	}

	public override async edit(builder: BuilderCallback<InteractionMessageContentBuilder>): Promise<GuildCacheMessage<'cached'>> {
		const message = await super.edit(builder);
		this.messageId = message.id;
		return message;
	}
}
