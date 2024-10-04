import { Bot, CommandContext, CommandMiddleware, Context, InlineKeyboard, InlineQueryContext, Keyboard, webhookCallback } from "grammy";
import { chunk } from "lodash";
import express from "express";
import { applyTextEffect, Variant } from "./textEffects";

import type { Variant as TextEffectVariant } from "./textEffects";
import { InlineKeyboardButton } from "grammy/out/types";

const TELEGRAM_TOKEN="7489205472:AAErIX--3QpSMZaYqhIRM0cOo76L9FRnsRE";

// Create a bot using the Telegram token
const bot = new Bot(TELEGRAM_TOKEN || "");

// Handle the /yo command to greet the user
bot.command("yo", (ctx: CommandContext<Context>) => ctx.reply(`Yo ${ctx.from?.username}`));

// Handle the /effect command to apply text effects using an inline keyboard
type Effect = { code: TextEffectVariant; label: string };
const allEffects: Effect[] = [
  { code: "w", label: "Monospace" },
  { code: "b", label: "Bold" },
  { code: "i", label: "Italic" },
  { code: "d", label: "Doublestruck" },
  { code: "o", label: "Circled" },
  { code: "q", label: "Squared" },
];

const effectCallbackCodeAccessor = (effectCode: TextEffectVariant) =>{
  console.log("INLINE KEYBOARD RESPONSE", effectCode)
  return `effect-${effectCode}`;
}

const effectsKeyboardAccessor = (effectCodes: string[]) => {
  const effectsAccessor = (effectCodes: string[]) =>
    effectCodes.map((code) =>
      allEffects.find((effect) => effect.code === code)
    );
  const effects = effectsAccessor(effectCodes);

  const keyboard = new InlineKeyboard();

  const chunkedEffects = chunk(effects, 3);
  
  for (const effectsChunk of chunkedEffects) {
    for (const effect of effectsChunk) {
      effect &&
        keyboard.text(effect.label, effectCallbackCodeAccessor(effect.code));
    }
    keyboard.row();
  }

  return keyboard;
};

const textEffectResponseAccessor = ( originalText: string, modifiedText?: string ) =>
  `Original: ${originalText}` +
  (modifiedText ? `\nModified: ${modifiedText}` : "");

const parseTextEffectResponse = ( response: string): { originalText: string; modifiedText?: string; } => {

  let originalText;
  const originalTextMatch = (response.match(/Original: (.*)/) as any);
  console.log('Original match', originalTextMatch)
  if( originalTextMatch )
    originalText = originalTextMatch[1];
  else
    originalText = "No se introdujo texto";

  let modifiedText;
  const modifiedTextMatch = response.match(/Modified: (.*)/);
  console.log('Modified match', modifiedTextMatch)
  if (modifiedTextMatch) 
    modifiedText = modifiedTextMatch[1];
  else 
    modifiedText = "No se introdujo texto";
  
  return { originalText, modifiedText };
};

bot.command("effect", (ctx) => {
  ctx.reply(textEffectResponseAccessor(ctx.match), {
    reply_markup: effectsKeyboardAccessor(
      allEffects.map((effect) => effect.code)
    ),
  })
  }
);

// ++++++++++++++ OMAR SECTION +++++++++++++++++
// START BUY COMMAND SETUP
const amounts = [ "10", "20", "50", "100"];

const createSelectCoinsKeyboard = (keyboard: InlineKeyboard, coins: string[]) => {
  coins.forEach( (coin, index) => {
    keyboard.text( coin, coin )
    if( index === 2 )
      keyboard.row();
  })
}
const setUpSelectCoinsKeyboardListener = (bot: Bot, coins: string[]) => {
  coins.forEach( coin => {
    bot.callbackQuery( coin, ctx => {
      const message = "Que cantidad?";
      const options = { reply_markup: new InlineKeyboard() };

      const keyboard = options.reply_markup;
      createSelectAmountKeyboard( keyboard, amounts)
      
      ctx.editMessageText( message, options )
    })
  })
};

const setUpSelectAmountKeyboardListeners = ( bot: Bot, amounts: string[] ) => {
  amounts.forEach( amount => {
    bot.callbackQuery( amount, ctx => {
      ctx.reply( "Vas a comprar " + amount)
    } )
  })
}
const createSelectAmountKeyboard = ( keyboard: InlineKeyboard, amounts: string[]) => {
  amounts.forEach( amount => {
    keyboard.text( amount, amount )
  })
}

const coins = ["USD", "EUR", "CAD", "BTC", "ETH", "USDT"];

let handleBuyCommand: CommandMiddleware<Context> = (ctx) => {
  const message = "Que moneda?";
  
  const options = { reply_markup: new InlineKeyboard() };

  const keyboard = options.reply_markup;
  createSelectCoinsKeyboard( keyboard, coins );
  
  ctx.reply( message, options );
}

bot.command("buy", handleBuyCommand);
bot.command("comprar", handleBuyCommand);
setUpSelectCoinsKeyboardListener( bot, coins );
setUpSelectAmountKeyboardListeners( bot, amounts );
// END BUY COMMAND SETUP

// Handle inline queries
const queryRegEx = /effect (monospace|bold|italic) (.*)/;
bot.inlineQuery(queryRegEx, async (ctx: InlineQueryContext<Context>) => {
  const fullQuery = ctx.inlineQuery.query;
  const fullQueryMatch = fullQuery.match(queryRegEx);
  if (!fullQueryMatch) return;

  const effectLabel = fullQueryMatch[1];
  const originalText = fullQueryMatch[2];

  const effectCode = allEffects.find(
    (effect) => effect.label.toLowerCase() === effectLabel.toLowerCase()
  )?.code;
  const modifiedText = applyTextEffect(originalText, effectCode as Variant);

  await ctx.answerInlineQuery(
    [
      {
        type: "article",
        id: "text-effect",
        title: "Text Effects",
        input_message_content: {
          message_text: `Original: ${originalText}
Modified: ${modifiedText}`,
          parse_mode: "HTML",
        },
        reply_markup: new InlineKeyboard().switchInline("Share", fullQuery),
        url: "http://t.me/CubanForexBot",
        description: "Create stylish Unicode text, all within Telegram.",
      },
    ],
    { cache_time: 30 * 24 * 3600 } // one month in seconds
  );
});

// Return empty result list for other queries.
bot.on("inline_query", (ctx) => ctx.answerInlineQuery([]));

// Handle text effects from the effect keyboard
for (const effect of allEffects) {
  const allEffectCodes = allEffects.map((effect) => effect.code);

  bot.callbackQuery(effectCallbackCodeAccessor(effect.code), async (ctx) => {
    const { originalText } = parseTextEffectResponse(ctx.msg?.text || "");
    const modifiedText = applyTextEffect(originalText, effect.code);

    await ctx.editMessageText(
      textEffectResponseAccessor(originalText, modifiedText),
      {
        reply_markup: effectsKeyboardAccessor(
          allEffectCodes.filter((code) => code !== effect.code)
        ),
      }
    );
  });
}

// Handle the /about command
const aboutUrlKeyboard = new InlineKeyboard().url(
  "Host your own bot for free.",
  "https://cyclic.sh/"
);

// Suggest commands in the menu
bot.api.setMyCommands([
  // { command: "yo", description: "Be greeted" },
  // {
  //   command: "effect",
  //   description: "Text effects. (usage: /effect [text])",
  // },
  { command: "buy", description: "Comprar divisas"},
  { command: "comprar", description: "Comprar divisas"}
]);

// Handle all other messages and the /start command
const introductionMessage = `Hello! I'm a Telegram bot.
I'm powered by Cyclic, the next-generation serverless computing platform.

<b>Commands</b>
/yo - Be greeted by me
/effect [text] - Show a keyboard to apply text effects to [text]`;

const replyWithIntro = (ctx: any) =>
  ctx.reply(introductionMessage, {
    reply_markup: aboutUrlKeyboard,
    parse_mode: "HTML",
  });

bot.command("start", replyWithIntro);
bot.on("message", replyWithIntro);

// Start the server
if (process.env.NODE_ENV === "production") {
  // Use Webhooks for the production server
  const app = express();
  app.use(express.json());
  app.use(webhookCallback(bot, "express"));

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Bot listening on port ${PORT}`);
  });
} else {
  // Use Long Polling for development
  bot.start();
}