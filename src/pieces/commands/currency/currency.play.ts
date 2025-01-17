import { Command, ApplicationCommandRegistry, CommandOptionsRunTypeEnum, Result } from '@sapphire/framework';
import { ButtonStyle, Colors, ComponentType } from 'discord.js';
import { ApplyOptions } from '@sapphire/decorators';

import {
	Collector,
	seconds,
	minutes,
	StringSelectMenuComponentBuilder,
	InteractionMessageContentBuilder,
	ButtonComponentBuilder,
	edit,
	CustomId,
	send,
	EmbedTemplates
} from '#lib/utilities';
import { type Game, GameContext, Games } from '#lib/framework';
import { isNullish, isNullOrUndefined } from '@sapphire/utilities';
import type { PlayerSchema } from '#lib/database';
import type { PlayerGamesSchema } from '#lib/database/models/economy/player/player.game.schema';
import { time, TimestampStyles } from '@discordjs/builders';

enum PickerControl {
	Dropdown = 'picker_list',
	Proceed = 'picker_proceed',
	Cancel = 'picker_cancel'
}

enum EnergyControl {
	Energize = 'energy_energize',
	Cancel = 'energy_cancel'
}

@ApplyOptions<Command.Options>({
	name: 'play',
	description: 'Play games to earn coins.',
	runIn: [CommandOptionsRunTypeEnum.GuildText]
})
export default class PlayCommand extends Command {
	public override async chatInputRun(command: Command.ChatInputCommandInteraction<'cached'>) {
		const db = await this.container.db.players.fetch(command.user.id);
		const customId = Reflect.construct(CustomId, [command.createdAt]);
		const game = await Result.fromAsync(this.chooseGame(command, db, customId));

		return game.inspectAsync(async (game) => {
			if (isNullOrUndefined(game)) return;

			const energized = await Result.fromAsync(this.checkEnergy(command, db, customId));
			const context = Reflect.construct(GameContext, [{ command, db, game }]);
			if (energized.isOk() && energized.unwrap()) return await context.play();
		});
	}

	private renderGamePickerContent(
		command: Command.ChatInputCommandInteraction<'cached'>,
		componentId: CustomId,
		game: Game,
		schema: PlayerGamesSchema,
		ended?: boolean
	): InteractionMessageContentBuilder<ButtonComponentBuilder | StringSelectMenuComponentBuilder>;
	private renderGamePickerContent(
		command: Command.ChatInputCommandInteraction<'cached'>,
		componentId: CustomId,
		game: Game | null,
		schema: PlayerGamesSchema | null,
		ended?: boolean
	): InteractionMessageContentBuilder<ButtonComponentBuilder | StringSelectMenuComponentBuilder>;
	private renderGamePickerContent(
		_command: Command.ChatInputCommandInteraction<'cached'>,
		componentId: CustomId,
		game: Game | null,
		schema: PlayerGamesSchema | null,
		ended = false
	) {
		return new InteractionMessageContentBuilder<ButtonComponentBuilder | StringSelectMenuComponentBuilder>()
			.addRow((row) =>
				row.addSelectMenuComponent((menu) =>
					menu
						.setCustomId(componentId.create(PickerControl.Dropdown))
						.setPlaceholder('Select Game')
						.setDisabled(ended)
						.setMaxValues(1)
						.setOptions(
							this.container.stores.get('games').map((g) => ({
								label: g.name,
								value: g.id,
								description: g.description ?? void 0,
								default: g.id === game?.id
							}))
						)
				)
			)
			.addRow((row) =>
				row
					.addButtonComponent((btn) =>
						btn
							.setCustomId(componentId.create(PickerControl.Proceed))
							.setStyle(ButtonStyle.Secondary)
							.setEmoji('✅')
							.setDisabled(isNullish(game) || ended)
					)
					.addButtonComponent((btn) =>
						btn.setCustomId(componentId.create(PickerControl.Cancel)).setStyle(ButtonStyle.Secondary).setEmoji('❌').setDisabled(ended)
					)
			)
			.addEmbed(() =>
				EmbedTemplates.createCamouflaged((embed) =>
					embed
						.setTitle(isNullish(game) ? 'Select Game to Play' : game.name)
						.setDescription(
							isNullish(game)
								? 'Choose a game to play from the dropdown below.'
								: game.detailedDescription ?? 'No description provided.'
						)
						.setFields(
							!isNullish(schema)
								? [
										{
											name: 'Last Played',
											value: time(new Date(schema.lastPlayedTimestamp), TimestampStyles.RelativeTime),
											inline: true
										},
										{
											name: 'Win Rate',
											value: `${(schema.winRate * 100).toFixed(2)}%`,
											inline: true
										},
										{
											name: 'Net Profit',
											value: schema.profit.toLocaleString(),
											inline: true
										}
								  ]
								: []
						)
				)
			);
	}

	private async chooseGame(
		command: Command.ChatInputCommandInteraction<'cached'>,
		db: PlayerSchema.Document,
		componentId: CustomId
	): Promise<Game | null> {
		return new Promise(async (resolve) => {
			const gamesStore = this.container.stores.get('games');

			let selectedGame: Game | null = !isNullOrUndefined(db.games.lastGamePlayed) ? gamesStore.get(db.games.lastGamePlayed.id) : null;
			let selectedGameSchema: PlayerGamesSchema | null = !isNullOrUndefined(selectedGame)
				? db.games.resolve(selectedGame.id) ?? db.games.create(selectedGame.id)
				: null;

			const collector = new Collector({
				message: await send(command, this.renderGamePickerContent(command, componentId, selectedGame, selectedGameSchema)),
				max: Infinity,
				time: seconds(10),
				filter: (component) => component.user.id === command.user.id,
				end: async (ctx) => {
					if (ctx.wasInternallyStopped()) {
						await edit(command, this.renderGamePickerContent(command, componentId, selectedGame, selectedGameSchema, true));
						return resolve(null);
					}
				}
			});

			for (const customId of Object.values(PickerControl)) {
				collector.actions.add(componentId.create(customId), async (ctx) => {
					if (ctx.interaction.isSelectMenu()) {
						const gameId = (ctx.interaction.values.at(0) as Games.Keys) ?? null;
						const game = !isNullOrUndefined(gameId) ? gamesStore.get(gameId) : null;
						const schema = !isNullOrUndefined(game) ? db.games.resolve(game.id) : null;

						if (!isNullOrUndefined(game) && !isNullOrUndefined(schema)) {
							await edit(
								ctx.interaction,
								this.renderGamePickerContent(command, componentId, (selectedGame = game), (selectedGameSchema = schema))
							);
							return ctx.collector.resetTimer();
						}
					}

					if (ctx.interaction.isButton()) {
						const game = selectedGame;
						const schema = selectedGameSchema;

						if (isNullOrUndefined(game) || isNullOrUndefined(schema)) return;

						switch (ctx.interaction.customId) {
							case componentId.create(PickerControl.Proceed): {
								ctx.stop();
								await db.run((db) => db.games.setLastPlayed(game.id, command.createdAt)).save();
								await edit(ctx.interaction, this.renderGamePickerContent(command, componentId, game, schema, true));
								return resolve(game);
							}

							case componentId.create(PickerControl.Cancel): {
								ctx.stop();
								await edit(ctx.interaction, this.renderGamePickerContent(command, componentId, game, schema, true));
								return resolve(null);
							}
						}
					}
				});
			}

			await collector.start();
		});
	}

	private renderEnergyPrompterMessage(customId: CustomId, energized: null | boolean) {
		return new InteractionMessageContentBuilder()
			.addEmbed(() =>
				EmbedTemplates.createCamouflaged((embed) =>
					embed
						.setTitle(isNullish(energized) || !energized ? 'Energy Expired' : 'Energy Recharged')
						.setColor(isNullish(energized) ? embed.data.color! : energized ? Colors.DarkGold : embed.data.color!)
						.setDescription(
							isNullish(energized)
								? 'Your energy expired! Convert the stars you currently have into energy.'
								: energized
								? 'Your energy has been recharged. Goodluck playing!'
								: 'Okay then. Come back next time, I guess.'
						)
				)
			)
			.addRow((row) =>
				row
					.addButtonComponent((btn) =>
						btn
							.setDisabled(!isNullish(energized))
							.setCustomId(customId.create(EnergyControl.Energize))
							.setEmoji('⚡')
							.setStyle(ButtonStyle.Secondary)
					)
					.addButtonComponent((btn) =>
						btn
							.setDisabled(!isNullish(energized))
							.setCustomId(customId.create(EnergyControl.Cancel))
							.setEmoji('❌')
							.setStyle(ButtonStyle.Secondary)
					)
			);
	}

	private renderNoEnergyMessage() {
		return new InteractionMessageContentBuilder().addEmbed(() => EmbedTemplates.createSimple('You have no energy left to energize.'));
	}

	private checkEnergy(command: Command.ChatInputCommandInteraction<'cached'>, db: PlayerSchema.Document, customId: CustomId): Promise<boolean> {
		return new Promise(async (resolve) => {
			if (!db.energy.isExpired()) return resolve(true);
			if (db.energy.energy < 1) {
				await edit(command, this.renderNoEnergyMessage());
				return resolve(false);
			}

			const collector = new Collector({
				message: await send(command, this.renderEnergyPrompterMessage(customId, null)),
				componentType: ComponentType.Button,
				max: Infinity,
				time: seconds(60),
				actions: {
					[customId.create(EnergyControl.Energize)]: async (ctx) => {
						await db
							.run((db) => db.energy.subEnergy(1).setExpire(Date.now() + minutes(db.energy.getDefaultDuration(db.upgrades.tier))))
							.save();
						await edit(ctx.interaction, this.renderEnergyPrompterMessage(customId, true));
						ctx.collector.stop(ctx.interaction.customId);
						resolve(true);
					},
					[customId.create(EnergyControl.Cancel)]: async (ctx) => {
						await edit(ctx.interaction, this.renderEnergyPrompterMessage(customId, false));
						ctx.collector.stop(ctx.interaction.customId);
						resolve(false);
					}
				},
				filter: async (button) => {
					const context = button.user.id === command.user.id;
					await button.deferUpdate();
					return context;
				},
				end: async (ctx) => {
					if (ctx.wasInternallyStopped()) {
						await edit(command, this.renderEnergyPrompterMessage(customId, false));
						return resolve(false);
					}
				}
			});

			await collector.start();
		});
	}

	public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand((builder) => builder.setName(this.name).setDescription(this.description));
	}
}
