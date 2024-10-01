import express, { query } from "express";
import { Bot, CommandContext, Context, InlineKeyboard, webhookCallback } from "grammy";

const TELEGRAM_TOKEN="7489205472:AAErIX--3QpSMZaYqhIRM0cOo76L9FRnsRE";

export class CubaForexBot{
    private bot: Bot;
    private amounts = [ "5", "10", "20", "100"];
    private currencies = ["USD", "EUR", "CAD", "BTC", "USDT", "ETH"];
    private storedMessage = ""
    constructor(){
        this.bot = new Bot(TELEGRAM_TOKEN);

        this.setUpBuyCommand( this.bot );

        this.listenSelectPrincipalCurrency( this.bot );

        this.listenSetPrincipalCurrencyAmount( this.bot );

        this.listenFinishSetPrincipalCurrencyAmount( this.bot );

        this.listenSelectSecundaryCurrency( this.bot );

        this.listenSelectPrice( this.bot );

        this.setUpAllCommands(this.bot);

        this.replyAllOtherMessagesAndStartCmd(this.bot);
    }

    public startServer(){
        // Start the server
        if (process.env.NODE_ENV === "production") {
            // Use Webhooks for the production server
            const app = express();
            app.use(express.json());
            app.use(webhookCallback(this.bot, "express"));
        
            const PORT = process.env.PORT || 3000;
            app.listen(PORT, () => {
            console.log(`Bot listening on port ${PORT}`);
            });
        } else {
            // Use Long Polling for development
            this.bot.start();
        }
    }

    private replyAllOtherMessagesAndStartCmd(bot: Bot){
        const introductionMessage = `
        Hello! I'm a Telegram bot.
        I'm powered by Cyclic, the next-generation serverless computing platform.
            <b>Commands</b>
            /buy
            /comprar`;
        
        const aboutUrlKeyboard = new InlineKeyboard().url(
            "Host your own bot for free.",
            "https://cyclic.sh/"
            );

        const replyWithIntro = (ctx: any) =>
        ctx.reply(introductionMessage, {
            reply_markup: aboutUrlKeyboard,
            parse_mode: "HTML",
        });

        bot.command("start", replyWithIntro);
        bot.on("message", replyWithIntro);
    }

    // start:: Buy command
    private setUpBuyCommand(bot: Bot){
        bot.command("buy", this.handleBuyCommand );
        bot.command("comprar", this.handleBuyCommand );
    }

    private handleBuyCommand = (ctx: CommandContext<Context>) => {
        const message = "Que moneda desea comprar?";
        
        const options = { reply_markup: new InlineKeyboard() };
      
        const keyboard = options.reply_markup;

        const data = 'operation:buy';

        this.selectCurrencyKeyboard( keyboard, data, this.currencies, 'p_currency' );
        
        ctx.reply( message, options );
    }

    private selectCurrencyKeyboard = (keyboard: InlineKeyboard, incData: string, currencies: string[], type: 'p_currency' | 's_currency') => {
        currencies.forEach( (currency, index) => {
            const data = `${incData} ${type}:${currency}`
            
            keyboard.text( currency, data );
            
            if( index === 2 )
                keyboard.row();
        })
    }

    private listenSelectPrincipalCurrency(bot: Bot){
        const trigger = /operation:.* p_currency:(\w+)$/;
        bot.callbackQuery( trigger, ctx => {
            const data = ctx.callbackQuery.data;
            //@ts-ignore
            let [input, operation, currency] = data.match(/operation:(.*) p_currency:(.*)/) as string[];
            console.log("listenSelectPrincipalCurrency")
            this.storedMessage = "Message in first listener";
            operation = operation === "buy"? "comprar" : "vender";
            const message = `Que cantidad de ${currency} desea ${operation}?`;
            const options = { reply_markup: new InlineKeyboard() };
        
            const keyboard = options.reply_markup;
            this.selectAmountKeyboard( keyboard, data)
            
            ctx.editMessageText( message, options )
        } )
    }

    private listenSelectSecundaryCurrency(bot: Bot){
        const trigger = /operation:.* p_currency:.* amount:.* s_currency:(\w+)$/;
        const queryMatch = /operation:(.*) p_currency:(.*) amount:(.*) s_currency:(.*)/;
        bot.callbackQuery( trigger, ctx => {
            const data = ctx.callbackQuery.data;
            //@ts-ignore
            let [input, operation, p_currency, amount, s_currency] = data.match(queryMatch) as string[];
            console.log("listenSelectSecundaryCurrency")

            let message;
            if( operation === "buy")
                message = "A que precio desea comprar?"
            else
                message = "A que precio desea vender?"
            
            const options = { reply_markup: new InlineKeyboard() };
        
            const keyboard = options.reply_markup;
            this.selectAmountKeyboard( keyboard, data)
            ctx.editMessageText( message, options )
        } )
    }

    private listenSelectPrice( bot: Bot ){
        // (\d+(\.)?(\d+)?)$
        const trigger = /operation:.* p_currency:.* amount:.* s_currency:.* digiting:.*/;
        const queryMatch = /operation:(.*) p_currency:(.*) amount:(.*) s_currency:(.*) digiting:(.*)/;

        bot.callbackQuery( trigger, ctx => {
            console.log("listenSelectPrice")
            const data = ctx.callbackQuery.data;
            let [input, operation, p_currency, amount, s_currency, digiting] = data.match(queryMatch) as string[];

            console.log({operation, p_currency, amount, s_currency, digiting})

            operation = operation === "buy"? "comprar" : "vender";

            const message = `Quiero ${operation} ${amount} ${p_currency} a un precio de ${digiting} ${s_currency}!`;

            console.log("MESSAGE", message)
            const options = { reply_markup: new InlineKeyboard() };
        
            const keyboard = options.reply_markup;
            // this.selectAmountKeyboard( keyboard, data)
            ctx.reply(`Price ${digiting} selected` )
            
            // ctx.editMessageText( message, options )
        })
    }

    // private parseQueryDataToObjec(data: string){
    //     // example: data = 'operation:buy p_currency:USD amount:50.984 s_currency:CUP price:93.423'
    //     const obj = data.split(' ')
    //         .reduce( ( obj, pair ) => {
    //             const [key, value] = pair.split(':'); 
    //             obj[key] = value;  
    //             return obj; 
    //         }, {} );
        
    //     return obj
    // }

    private selectAmountKeyboard( keyboard: InlineKeyboard, incData: string){
        let data;
        
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '<']
        .forEach( char => {
            const pairs = incData.split(' ');
            const digitPairIndex = pairs.findIndex( p => p.split(':')[0] === 'digiting' )

            if( digitPairIndex === -1 )
                data = `${incData} digiting:${char}`
            else {
                let digitingPair = pairs.splice(digitPairIndex, 1)[0];
                let [key, value] = digitingPair.split(':');

                if(char === '<')
                    value = value.slice(0, value.length - 1)
                else
                    value = `${value}${char}`;

                digitingPair = `${key}:${value}`;
                pairs.push(digitingPair)
                data = pairs.join(' ');
            }

            keyboard.text( char, data );
            if( ['3', '6', '9'].includes(char) )
                keyboard.row();
        })

        keyboard.row()
        keyboard.text('next', `${incData} next`)
    }

    private listenSetPrincipalCurrencyAmount( bot: Bot ) {
        const trigger = /operation:.* p_currency:(\w+) digiting:(\d+(\.)?(\d+)?)$/;
        const queryMatch = /operation:(.*) p_currency:(.*) digiting:(.*)/;
        bot.callbackQuery( trigger, ctx => {
            const data = ctx.callbackQuery.data;
            let [input, operation, p_currency, digiting] = data.match(queryMatch) as string[];
            
            console.log('listenSetPrincipalCurrencyAmount')
            console.log("SOTRED_MESSAGE", this.storedMessage)

            operation = operation === "buy"? "comprar" : "vender";

            const message = `Quiero ${operation} ${digiting} ${p_currency}!`;
            const options = { reply_markup: new InlineKeyboard() };
        
            const keyboard = options.reply_markup;
            this.selectAmountKeyboard( keyboard, data)
            
            ctx.editMessageText( message, options )
        })
    }

    private listenFinishSetPrincipalCurrencyAmount( bot: Bot ) {
        const trigger = /operation:.* p_currency:.* digiting:.* next/;
        const queryMatch = /operation:(.*) p_currency:(.*) digiting:(.*) next/;
        bot.callbackQuery( trigger, ctx => {
            let data = ctx.callbackQuery.data;
            let [input, operation, p_currency, digiting] = data.match(queryMatch) as string[];

            data = `operation:${operation} p_currency:${p_currency} amount:${digiting}`
            console.log("listenFinishSetPrincipalCurrencyAmount")
            let message;
            if (operation === "buy" )
                message = "Con que moneda va a pagar?";
            else 
                message = "Que moneda desea recibir?";

            const options = { reply_markup: new InlineKeyboard() };
        
            const keyboard = options.reply_markup;

            this.selectCurrencyKeyboard( keyboard, data, this.currencies, 's_currency')
            
            ctx.editMessageText( message, options )
        })
    }
    // end:: Buy command

    // start:: Set up bot commands
    private setUpAllCommands(bot: Bot){
        bot.api.setMyCommands([
            { command: "buy", description: "Comprar divisas"},
            { command: "comprar", description: "Comprar divisas"}
        ]);
    }
    // end:: Set up bot commands
}