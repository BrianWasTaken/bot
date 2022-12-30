import { CommandInteraction, Constants } from 'discord.js';
import { Command, ApplicationCommandRegistry, CommandOptionsRunTypeEnum, Result } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { hasDecimal, edit, DeferCommandInteraction, parseNumber, join } from '#lib/utilities';
import { bold } from '@discordjs/builders';
import { isNullOrUndefined } from '@sapphire/utilities';
import type { PlayerSchema } from '#lib/database';
import { CommandError } from '#lib/framework';

@ApplyOptions<Command.Options>({
  name: 'bet',
  description: 'Edits your bet amount.',
  runIn: [CommandOptionsRunTypeEnum.GuildText]
})
export default class BetCommand extends Command {
  @DeferCommandInteraction()
  public override async chatInputRun(command: CommandInteraction<'cached'>) {
    const db = await this.container.db.players.fetch(command.user.id);
    const amount = command.options.getString('amount');

    if (isNullOrUndefined(amount)) {
      const isSufficient = db.wallet.value >= db.bet.value;

      return await edit(command, (builder) =>
        builder.addEmbed((embed) =>
          embed
            .setColor(isSufficient ? Constants.Colors.DARK_GREEN : Constants.Colors.DARK_RED)
            .setDescription(
              join(`Your bet is ${bold(db.bet.value.toLocaleString())} coins.`, `${bold(`${isSufficient ? 'S' : 'Ins'}ufficient`)} to use on games.`)
            )
        )
      );
    }

    const parsedAmount = this.checkAmount(db, parseNumber(amount, {
      amount: db.bet.value,
      minimum: db.minBet,
      maximum: db.maxBet
    }));

    if (parsedAmount.isErr()) throw new CommandError(parsedAmount.unwrapErr());

    await db.run((db) => db.bet.setValue(parsedAmount.unwrap())).save();
    await edit(command, (builder) =>
      builder.addEmbed((embed) =>
        embed.setColor(Constants.Colors.DARK_BUT_NOT_BLACK).setDescription(`You're now betting ${bold(parsedAmount.unwrap().toLocaleString())} coins.`)
      )
    );

    return;
  }

  public checkAmount(db: PlayerSchema.Document, parsedAmount: ReturnType<typeof parseNumber>): Result<number, string> {
    return Result.from(() => {
      if (isNullOrUndefined(parsedAmount) || hasDecimal(parsedAmount)) throw 'You need to pass an actual number.';
      if (parsedAmount === db.bet.value) throw 'Cannot change your bet to the same one.';
      if (parsedAmount < db.minBet) throw `You can't bet lower than your minimum ${bold(db.minBet.toLocaleString())} limit.`;
      if (parsedAmount > db.maxBet) throw `You can't bet higher than your maximum ${bold(db.maxBet.toLocaleString())} limit.`;
      if (parsedAmount > db.wallet.value) throw `You only have ${bold(db.wallet.value.toLocaleString())} coins.`;

      return parsedAmount;
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption((option) =>
          option.setName('amount').setDescription('Examples: 10k, 2t, 30%, 55.5% (% of max bet), min, max, half, full, 250_000 or 124,000.')
        )
      , {
        idHints: ['1050341969324408902']
      });
  }
}
