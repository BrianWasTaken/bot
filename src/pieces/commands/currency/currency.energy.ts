import { Command, ApplicationCommandRegistry, CommandOptionsRunTypeEnum } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { bold, time, TimestampStyles } from '@discordjs/builders';
import { join, edit, DeferCommandInteraction, InteractionMessageContentBuilder, CustomId, Collector, seconds, minutes } from '#lib/utilities';
import { Constants } from 'discord.js';
import type { PlayerSchema } from '#lib/database';

@ApplyOptions<Command.Options>({
  name: 'energy',
  description: 'Your energy information.',
  runIn: [CommandOptionsRunTypeEnum.GuildText]
})
export default class EnergyCommand extends Command {
  @DeferCommandInteraction()
  public override async chatInputRun(command: Command.ChatInputInteraction<'cached'>) {
    const db = await this.container.db.players.fetch(command.user.id);
    const componentId = new CustomId(new Date(command.createdTimestamp));

    if (!db.energy.isExpired()) {
      await edit(command, EnergyCommand.renderContent(command, db, componentId, true, true));
      return;
    }

    const collector = new Collector({
      message: await edit(command, EnergyCommand.renderContent(command, db, componentId, false, false)),
      componentType: 'BUTTON',
      max: Infinity,
      time: seconds(10),
      actions: {
        [componentId.create('energize')]: async ctx => {
          await db.run((db) => db.energy.subEnergy(1).setExpire(Date.now() + minutes(db.energy.getDefaultDuration(db.upgrades.tier)))).save();
          await edit(ctx.interaction, EnergyCommand.renderContent(command, db, componentId, true, true));
          return ctx.stop();
        }
      },
      filter: async (btn) => {
        const contextual = btn.user.id === command.user.id;
        await btn.deferUpdate();
        return contextual;
      },
      end: async (ctx) => {
        if (ctx.wasInternallyStopped()) {
          await edit(command, EnergyCommand.renderContent(command, db, componentId, false, true));
          return;
        }
      }
    });

    await collector.start();
  }

  private static renderContent(command: Command.ChatInputInteraction<'cached'>, db: PlayerSchema, componentId: CustomId, energized: boolean, ended: boolean) {
    return new InteractionMessageContentBuilder()
      .addEmbed((embed) =>
        embed
          .setTitle(`${command.user.username}'s energy`)
          .setColor(energized && ended ? Constants.Colors.GOLD : Constants.Colors.DARK_BUT_NOT_BLACK)
          .setDescription(
            join(
              `${bold('⭐ Stars:')} ${db.energy.toLocaleString()}`,
              `${bold('⚡ Energy:')} ${db.energy.energy.toLocaleString()}\n`,
              `Expire${db.energy.isExpired() ? 'd' : 's'} ${time(new Date(db.energy.expire), TimestampStyles.RelativeTime)}`
            )
          )
      )
      .addRow((row) =>
        row.addButtonComponent((btn) =>
          btn
            .setCustomId(componentId.create('energize'))
            .setStyle(Constants.MessageButtonStyles.SECONDARY)
            .setEmoji('⚡')
            .setDisabled(ended)
        )
      );
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
      , {
        idHints: ['1050341971127959582']
    });
  }
}
