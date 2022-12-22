import { Game } from '#lib/framework';
import { Collector, percent, getUserAvatarURL, join, seconds, checkClientReadyStatus, createEmbed, createButton, InteractionMessageContentBuilder } from '#lib/utilities';
import { bold, inlineCode } from '@discordjs/builders';
import { ApplyOptions } from '@sapphire/decorators';
import { Constants } from 'discord.js';

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
  public async play(context: Game.Context) {
    checkClientReadyStatus(context.command.client);

    const game = new DiceRoll.Logic(context.command.user, context.command.client.user);
    const collector = new Collector({
      message: await context.respond(DiceRollGame.renderContentAndUpdate(context, game, false)),
      componentType: 'BUTTON',
      max: Infinity,
      time: seconds(10),
      actions: {
        [context.customId.create('roll')]: async (ctx) => {
          game.roll.call(game);

          await ctx.interaction.editReply(DiceRollGame.renderContentAndUpdate(context, game, true));
          await context.db.save();
          ctx.collector.stop(ctx.interaction.customId);
        }
      },
      filter: async (button) => {
        const contextual = button.user.id === context.command.user.id;
        await button.deferUpdate();
        return contextual;
      },
      end: async (ctx) => {
        if (ctx.wasInternallyStopped()) {
          await context.db.run(db => db.wallet.subValue(db.bet.value)).save();
          await context.edit(DiceRollGame.renderContentAndUpdate(context, game, false));
          await context.end(true);
          return;
        }

        await context.end();
      }
    });

    await collector.start();
  }

  private static renderContentAndUpdate(ctx: Game.Context, game: DiceRoll.Logic, ended: boolean) {
    const embed = createEmbed(embed => embed.setAuthor({ name: `${ctx.command.user.username}'s dice roll game`, iconURL: getUserAvatarURL(ctx.command.user) }));
    const button = createButton(button => button.setCustomId(ctx.customId.create('roll')).setDisabled(game.hasBothRolled() || ended));

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
        button
          .setLabel('Roll')
          .setStyle(Constants.MessageButtonStyles.PRIMARY);
        embed
          .setColor(Constants.Colors.BLURPLE)
          .setDescription(`Your bet is ${bold(ctx.db.bet.value.toLocaleString())} coins.`);
        break;
      }

      case !game.hasBothRolled() && ended: {
        ctx.db.run(db => {
          ctx.lose(db.bet.value);
          db.wallet.subValue(db.bet.value);
          db.energy.subValue();
        });

        button
          .setLabel('Timed Out')
          .setStyle(Constants.MessageButtonStyles.SECONDARY)
          .setDisabled(true);
        embed
          .setColor(Constants.Colors.NOT_QUITE_BLACK)
          .setDescription(join(`You didn't respond in time. You lost your bet.\n`, `${bold('New Balance:')} ${ctx.db.wallet.value.toLocaleString()}`))
          .setFooter(ctx.dbGame.loses.streak.isActive() ? { text: `Lose Streak: ${ctx.dbGame.loses.streak.display}` } : null);

        break;
      }

      case game.isWin(): {
        const { final } = Game.calculateWinnings({
          base: 0.5,
          multiplier: ctx.db.multiplier.value,
          bet: ctx.db.bet.value,
          random: Math.random()
        });

        ctx.db.run((db) => {
          ctx.win(final);
          db.wallet.addValue(final);
          db.energy.addValue();
        });

        button
          .setLabel('Winner Winner')
          .setStyle(Constants.MessageButtonStyles.SUCCESS);
        embed
          .setColor(Constants.Colors.GREEN)
          .setDescription(
            join(
              `You won ${bold(final.toLocaleString())} coins.\n`,
              `${bold('Percent Won:')} ${percent(final, ctx.db.bet.value)}`,
              `${bold('New Balance:')} ${ctx.db.wallet.value.toLocaleString()}`
            )
          )
          .setFooter(
            ctx.dbGame.wins.streak.isActive()
              ? { text: `Win Streak: ${ctx.dbGame.wins.streak.display}` }
              : null
          );

        break;
      }

      case game.isTie(): {
        button
          .setLabel('You Tied')
          .setStyle(Constants.MessageButtonStyles.SECONDARY);
        embed
          .setColor(Constants.Colors.YELLOW)
          .setDescription(`Tie! You have ${bold(ctx.db.wallet.value.toLocaleString())} coins still.`)

        break;
      }

      case game.isLose(): {
        ctx.db.run(db => {
          ctx.lose(db.bet.value);
          db.wallet.subValue(db.bet.value);
          db.energy.subValue();
        });

        button
          .setLabel('Sucks to Suck')
          .setStyle(Constants.MessageButtonStyles.DANGER);
        embed
          .setColor(Constants.Colors.RED)
          .setDescription(
            join(`You lost ${bold(ctx.db.bet.value.toLocaleString())} coins.\n`, `${bold('New Balance:')} ${ctx.db.wallet.value.toLocaleString()}`)
          )
          .setFooter(ctx.dbGame.loses.streak.isActive() ? { text: `Lose Streak: ${ctx.dbGame.loses.streak.display}` } : null);

        break;
      }
    }

    return new InteractionMessageContentBuilder()
      .addEmbed(() => embed)
      .addRow(row => row.addButtonComponent(() => button));
  }
}
