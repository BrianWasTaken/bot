import type { ChatInputCommandInteraction } from 'discord.js';
import type { ChatInputCommand } from '@sapphire/framework';
import { Listener, Events } from '@sapphire/framework';
import chalk from 'chalk-template';

export class ChatInputCommandFinishListener extends Listener<typeof Events.ChatInputCommandFinish> {
	public constructor(context: Listener.Context) {
		super(context, { event: Events.ChatInputCommandFinish });
	}

	public async run(interaction: ChatInputCommandInteraction, command: ChatInputCommand) {
		this.container.logger.info(
			chalk`{whiteBright [LISTENER]}`,
			chalk`{whiteBright "${interaction.user.tag} (${interaction.user.id})" used the command "${command.name}" in channel ${interaction.channelId}}`
		);
	}
}
