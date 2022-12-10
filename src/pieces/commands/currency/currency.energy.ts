import type { CommandInteraction } from 'discord.js';
import { Command, ApplicationCommandRegistry, CommandOptionsRunTypeEnum } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { bold, time, TimestampStyles } from '@discordjs/builders';
import { join, edit, DeferCommandInteraction, InteractionMessageContentBuilder, ComponentId, Collector, seconds } from '#lib/utilities';
import { Constants } from 'discord.js';
import type { PlayerSchema } from '#lib/database';

@ApplyOptions<Command.Options>({
  name: 'energy',
  description: 'Your energy information.',
  runIn: [CommandOptionsRunTypeEnum.GuildText]
})
export default class EnergyCommand extends Command {
  @DeferCommandInteraction()
  public override async chatInputRun(command: CommandInteraction<'cached'>) {
    const db = await this.container.db.players.fetch(command.user.id);
    const componentId = new ComponentId(new Date(command.createdTimestamp));
    const collector = new Collector({
      message: await edit(command, EnergyCommand.renderContent(command, db, componentId, false, false)),
      componentType: 'BUTTON',
      max: Infinity,
      time: seconds(10),
      filter: async btn => {
        const contextual = btn.user.id === command.user.id;
        await btn.deferUpdate();
        return contextual;
      },
      end: async ctx => {
        if (ctx.wasInternallyStopped()) {
          await edit(command, EnergyCommand.renderContent(command, db, componentId, false, true));
          return;
        }
      }
    });

    collector.actions.add(componentId.create('recharge').id, async ctx => {
      await db.run(db => db.energy.subEnergy(1)).save();
      await edit(ctx.interaction, EnergyCommand.renderContent(command, db, componentId, true, true));
      return ctx.collector.stop(ctx.interaction.customId);
    });

    await collector.start();
  }

  public static renderContent(command: CommandInteraction<'cached'>, db: PlayerSchema, componentId: ComponentId, recharged: boolean, ended: boolean) {
    return new InteractionMessageContentBuilder()
      .addEmbed(embed => 
        embed  
          .setTitle(`${command.user.username}'s energy`)
          .setColor(Constants.Colors.GOLD)
          .setDescription(
            join(
              `${bold('⭐ Stars:')} ${db.energy.value.toLocaleString()}`,
              `${bold('⚡ Energy:')} ${db.energy.energy.toLocaleString()}\n`,
              `${bold(`Expire${db.energy.isExpired() ? 'd' : 's'} ${time(new Date(db.energy.expire), TimestampStyles.RelativeTime)}`)}`
            )
          )
      )
      .addRow(row => 
        row.addButtonComponent(btn => 
          btn  
            .setCustomId(componentId.create('recharge').id)
            .setStyle(!recharged && !ended ? Constants.MessageButtonStyles.PRIMARY : Constants.MessageButtonStyles.SECONDARY)
            .setLabel('Recharge')
            .setEmoji('⚡')
            .setDisabled(ended)
        )
      )
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
    registry.registerChatInputCommand((builder) => builder.setName(this.name).setDescription(this.description));
  }
}
