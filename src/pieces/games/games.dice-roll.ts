import { Game } from '#lib/framework';
import {
	Collector,
	percent,
	getUserAvatarURL,
	join,
	seconds,
	checkClientReadyStatus,
	createButton,
	InteractionMessageContentBuilder,
	roundZero,
	EmbedTemplates
} from '#lib/utilities';
import { bold, inlineCode } from '@discordjs/builders';
import { ApplyOptions } from '@sapphire/decorators';
import { Colors, ButtonStyle, ComponentType } from 'discord.js';

import * as DiceRoll from '#lib/utilities/games/dice-roll/index.js';

declare module '#lib/framework/structures/game/game.types' {
	interface Games {
		diceroll: never;
	}
}

@ApplyOptions<Game.Options>({
	id: 'diceroll',
	name: 'Dice Roll',
	description: 'Roll a dice to win coins!',
	detailedDescription: 'Roll a dice to win coins. Whoever gets the highest rolled value wins.'
})
export default class DiceRollGame extends Game {
	public async currencyPlay(context: Game.Context) {
		checkClientReadyStatus(context.command.client);

		const game = new DiceRoll.Logic(context.command.user, context.command.client.user);
		const collector = new Collector({
			message: await context.responder.send(() => DiceRollGame.renderContentAndUpdate(context, game, false)),
			componentType: ComponentType.Button,
			max: Infinity,
			time: seconds(10),
			actions: {
				[context.customId.create('roll')]: async (ctx) => {
					game.roll.call(game);

					await ctx.interaction.editReply(DiceRollGame.renderContentAndUpdate(context, game, true));
					await context.db.save();
					return ctx.stop();
				}
			},
			filter: async (button) => {
				const contextual = button.user.id === context.command.user.id;
				await button.deferUpdate();
				return contextual;
			},
			end: async (ctx) => {
				if (ctx.wasInternallyStopped()) {
					await context.responder.edit(() => DiceRollGame.renderContentAndUpdate(context, game, true));
					await context.end(true);
					return;
				}

				await context.end();
			}
		});

		await collector.start();
	}

	private static renderContentAndUpdate(ctx: Game.Context, game: DiceRoll.Logic, ended: boolean) {
		const embed = EmbedTemplates.createCamouflaged().setAuthor({
			name: `${ctx.command.user.username}'s dice roll game`,
			iconURL: getUserAvatarURL(ctx.command.user)
		});
		const button = createButton((button) => button.setCustomId(ctx.customId.create('roll')).setDisabled(game.hasBothRolled() || ended));

		for (const user of [game.player.user, game.opponent.user]) {
			embed.addFields({
				name: `${user.username} (${user.id === game.player.user.id ? 'Player' : 'Opponent'})`,
				value: `Rolled a ${inlineCode(
					game.hasBothRolled() ? (user.id === ctx.command.user.id ? game.player.value : game.opponent.value).toString() : '?'
				)}`,
				inline: true
			});
		}

		switch (true) {
			case !game.hasBothRolled() && !ended: {
				button.setLabel('Roll').setStyle(ButtonStyle.Primary);
				embed.setColor(Colors.Blurple).setDescription(`Your bet is ${bold(ctx.db.bet.value.toLocaleString())} coins.`);
				break;
			}

			case !game.hasBothRolled() && ended: {
				button.setLabel('Timed Out').setStyle(ButtonStyle.Secondary).setDisabled(true);
				embed
					.setDescription(
						join(
							`You didn't respond in time. You are keeping your money.\n`,
							`${bold('Your Balance:')} ${ctx.db.wallet.value.toLocaleString()}`
						)
					)
					.setFooter(null);

				break;
			}

			case game.isWin(): {
				const winnings = roundZero(
					ctx.winnings
						.setBase(0.1)
						.setMultiplier(ctx.db.multiplier.value)
						.setRandom(Math.random() * 1.8)
						.calculate(ctx.db.bet.value)
				);

				ctx.db.run((db) => {
					ctx.schema.win(winnings);
					db.wallet.addValue(winnings);
					db.bank.space.addValue(winnings);
					db.energy.addValue();
				});

				button.setLabel('Winner Winner').setStyle(ButtonStyle.Success);
				embed
					.setColor(Colors.Green)
					.setDescription(
						join(
							`You won ${bold(winnings.toLocaleString())}.\n`,
							`${bold('Percent Won:')} ${percent(winnings, ctx.db.bet.value)}`,
							`${bold('New Balance:')} ${ctx.db.wallet.value.toLocaleString()}`
						)
					)
					.setFooter(ctx.schema.wins.streak.isActive() ? { text: `Win Streak: ${ctx.schema.wins.streak.display}` } : null);

				break;
			}

			case game.isTie(): {
				button.setLabel('You Tied').setStyle(ButtonStyle.Secondary);
				embed.setColor(Colors.Yellow).setDescription(`Tie! You have ${bold(ctx.db.wallet.value.toLocaleString())} coins still.`);

				break;
			}

			case game.isLose(): {
				ctx.db.run((db) => {
					ctx.schema.lose(db.bet.value);
					db.wallet.subValue(db.bet.value);
					db.energy.subValue();
				});

				button.setLabel('Sucks to Suck').setStyle(ButtonStyle.Danger);
				embed
					.setColor(Colors.Red)
					.setDescription(
						join(
							`You lost ${bold(ctx.db.bet.value.toLocaleString())}.\n`,
							`${bold('New Balance:')} ${ctx.db.wallet.value.toLocaleString()}`
						)
					)
					.setFooter(ctx.schema.loses.streak.isActive() ? { text: `Lose Streak: ${ctx.schema.loses.streak.display}` } : null);

				break;
			}
		}

		return new InteractionMessageContentBuilder().addEmbed(() => embed).addRow((row) => row.addButtonComponent(() => button));
	}
}
