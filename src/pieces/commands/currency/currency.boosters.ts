import type { PlayerSchema } from '#lib/database';
import { Booster, BoosterOffer, BoosterOfferType, BoosterOfferUnit } from '#lib/framework';
import { Collector, CustomId, edit, EmbedTemplates, InteractionMessageContentBuilder, join, minutes, send } from '#lib/utilities';
import { bold } from '@discordjs/builders';
import { ApplyOptions } from '@sapphire/decorators';
import { Command, ApplicationCommandRegistry, CommandOptionsRunTypeEnum, container } from '@sapphire/framework';
import { DurationFormatter } from '@sapphire/time-utilities';
import { isFunction, isNullOrUndefined, toTitleCase } from '@sapphire/utilities';
import { ButtonStyle } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'boosters',
	description: 'View or use game boosters.',
	runIn: [CommandOptionsRunTypeEnum.GuildText]
})
export default class BoostersCommand extends Command {
	public override async chatInputRun(command: Command.ChatInputCommandInteraction<'cached'>) {
		const db = await this.container.db.players.fetch(command.user.id);
		const customId = new CustomId(command.createdAt);

		let booster: Booster | null = null;
		let boosterShopOffer: BoosterOffer | null = null;

		const collector = new Collector({
			message: await send(command, BoostersCommand.renderBoosterPickerContent(db, customId, booster, boosterShopOffer, false)),
			max: Infinity,
			time: minutes(1),
			actions: {
				[customId.create('picker')]: async (ctx) => {
					if (!ctx.interaction.isStringSelectMenu()) return;

					const selectedBoosterId = ctx.interaction.values.at(0) ?? null;
					const selectedBooster = selectedBoosterId ? container.stores.get('boosters').get(selectedBoosterId) ?? null : null;

					await edit(ctx.interaction, BoostersCommand.renderBoosterPickerContent(db, customId, (booster = selectedBooster), null, false));
				},
				[customId.create('shop-offer')]: async (ctx) => {
					if (!ctx.interaction.isStringSelectMenu()) return;
					if (isNullOrUndefined(booster)) return;

					const selectedBoosterShopOfferId = ctx.interaction.values.at(0) ?? null;
					const selectedBoosterShopOffer = selectedBoosterShopOfferId
						? booster.offers.find((so) => so.id === selectedBoosterShopOfferId) ?? null
						: null;

					await edit(
						ctx.interaction,
						BoostersCommand.renderBoosterPickerContent(db, customId, booster, (boosterShopOffer = selectedBoosterShopOffer), false)
					);
				},
				[customId.create('buy')]: async (ctx) => {
					if (!ctx.interaction.isButton()) return;
					if (isNullOrUndefined(booster) || isNullOrUndefined(boosterShopOffer)) return;

					const schema = db.boosters.resolve(booster.id) ?? db.boosters.create(booster.id, { expire: 0 });

					const { unit, cost, type, value } = boosterShopOffer;
					const { name } = booster;

					switch (unit) {
						case BoosterOfferUnit.Coins: {
							db.wallet.subValue(cost);
							break;
						}

						case BoosterOfferUnit.Energy: {
							db.energy.subEnergy(cost);
							break;
						}

						case BoosterOfferUnit.Star: {
							db.energy.subValue(cost);
							break;
						}
					}

					const finalValue = isFunction(value) ? value() : value;

					switch (type) {
						case BoosterOfferType.Duration: {
							schema.setExpire(Date.now() + finalValue);
							break;
						}

						case BoosterOfferType.Quantity: {
							schema.quantity.addValue(finalValue);
							break;
						}
					}

					await db.save();

					const unitEmoji = unit === BoosterOfferUnit.Star ? '⭐' : unit === BoosterOfferUnit.Energy ? '⚡' : '🪙';

					await send(ctx.interaction, (builder) =>
						builder.addEmbed(() =>
							EmbedTemplates.createSimple(`Successfully bought ${bold(name)} for ${unitEmoji} ${bold(cost.toLocaleString())}.`)
						)
					);

					return ctx.stop();
				}
			},
			filter: (component) => component.user.id === command.user.id,
			end: async () => {
				await edit(command, BoostersCommand.renderBoosterPickerContent(db, customId, booster, boosterShopOffer, true));
			}
		});

		await collector.start();
	}

	private static renderBoosterPickerContent(
		db: PlayerSchema,
		customId: CustomId,
		selectedBooster: Booster | null,
		selectedShopOffer: BoosterOffer | null,
		ended: boolean
	) {
		const content = new InteractionMessageContentBuilder()
			.addRow((row) =>
				row.addSelectMenuComponent((menu) => {
					menu.setCustomId(customId.create('picker')).setPlaceholder('Select Booster').setMaxValues(1).setDisabled(ended);

					return container.stores.get('boosters').reduce(
						(menu, booster) =>
							menu.addOption((option) =>
								option
									.setLabel(booster.name)
									.setValue(booster.id)
									.setDescription(booster.description)
									.setDefault(selectedBooster?.id === booster.id)
							),
						menu
					);
				})
			)
			.addEmbed(() =>
				EmbedTemplates.createCamouflaged((embed) => {
					embed.setTitle('Booster Shop').setDescription('Select a booster to purchase.');

					if (!isNullOrUndefined(selectedBooster)) {
						embed.setTitle(selectedBooster.name);
						embed.setDescription('Select an offer to accept.');

						for (const [index, shopOffer] of selectedBooster.offers.entries()) {
							embed.addFields({
								name: `Offer #${index + 1}`,
								value: join(
									`${bold(`${shopOffer.type === BoosterOfferType.Duration ? 'Duration' : 'Quantity'}:`)} ${
										isFunction(shopOffer.value)
											? 'Random'
											: shopOffer.type === BoosterOfferType.Duration
											? new DurationFormatter().format(shopOffer.value, Infinity, { right: ', ' })
											: `x${shopOffer.value.toLocaleString()}`
									}`,
									`${bold('Price:')} ${
										shopOffer.unit === BoosterOfferUnit.Star ? '⭐' : shopOffer.unit === BoosterOfferUnit.Energy ? '⚡' : '🪙'
									} ${shopOffer.cost.toLocaleString()}`
								)
							});
						}

						if (!isNullOrUndefined(selectedShopOffer)) {
							embed.setFields(
								{
									name: 'Price',
									value: `${
										selectedShopOffer.unit === BoosterOfferUnit.Star
											? '⭐'
											: selectedShopOffer.unit === BoosterOfferUnit.Energy
											? '⚡'
											: '🪙'
									} ${selectedShopOffer.cost.toLocaleString()}`
								},
								{
									name: selectedShopOffer.type === BoosterOfferType.Duration ? 'Duration' : 'Quantity',
									value: isFunction(selectedShopOffer.value)
										? 'Random'
										: selectedShopOffer.type === BoosterOfferType.Duration
										? new DurationFormatter().format(selectedShopOffer.value, Infinity, { right: ', ' })
										: `x${selectedShopOffer.value.toLocaleString()}`
								}
							);
						}
					}

					return embed;
				})
			);

		if (!isNullOrUndefined(selectedBooster)) {
			content.addRow((row) =>
				row.addSelectMenuComponent((menu) => {
					menu.setCustomId(customId.create('shop-offer')).setPlaceholder('Select Offer').setDisabled(ended).setMaxValues(1);

					return selectedBooster.offers.reduce(
						(menu, shopOffer) =>
							menu.addOption((option) =>
								option
									.setLabel(shopOffer.cost.toLocaleString())
									.setEmoji({
										name:
											shopOffer.unit === BoosterOfferUnit.Star ? '⭐' : shopOffer.unit === BoosterOfferUnit.Energy ? '⚡' : '🪙'
									})
									.setValue(shopOffer.id)
									.setDefault(selectedShopOffer?.id === shopOffer.id)
									.setDescription(
										`${shopOffer.type === BoosterOfferType.Duration ? 'Duration' : 'Quantity'}: ${
											isFunction(shopOffer.value)
												? 'Random Value'
												: shopOffer.type === BoosterOfferType.Duration
												? new DurationFormatter().format(shopOffer.value, Infinity, { right: ', ' })
												: shopOffer.value.toLocaleString()
										}`
									)
							),
						menu
					);
				})
			);

			content.addRow((row) => {
				for (const control of ['buy', 'cancel'] as const) {
					row.addButtonComponent((btn) =>
						btn
							.setCustomId(customId.create(control))
							.setLabel(toTitleCase(control))
							.setStyle(ButtonStyle.Secondary)
							.setDisabled(
								control === 'buy'
									? isNullOrUndefined(selectedShopOffer) ||
											(selectedShopOffer.unit === BoosterOfferUnit.Star
												? db.energy.value
												: selectedShopOffer.unit === BoosterOfferUnit.Energy
												? db.energy.energy
												: db.wallet.value) < selectedShopOffer.cost ||
											ended
									: ended
							)
					);
				}

				return row;
			});
		}

		return content;
	}

	public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand((builder) => builder.setName(this.name).setDescription(this.description), {
			idHints: ['1064906213562798080']
		});
	}
}
