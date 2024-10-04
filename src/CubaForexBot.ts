import express, { query } from "express";
import { Bot, CommandContext, Context, InlineKeyboard, webhookCallback } from "grammy";

const TELEGRAM_TOKEN="7489205472:AAErIX--3QpSMZaYqhIRM0cOo76L9FRnsRE";

interface Operator { id: number, first_name: string, last_name: string | undefined, username: string | undefined }
interface Order { operator?: Operator, operation?:string, p_currency?: string, amount?: number, s_currency?: string, price?: number, date?: Date };
export class CubaForexBot{
    private bot: Bot;
    private amounts = [ "5", "10", "20", "100"];
    private currencies = ["USD", "EUR", "CAD", "BTC", "USDT", "ETH"];
    private postedOperations: Order[] = []

    constructor(){
        this.bot = new Bot(TELEGRAM_TOKEN);

        this.setUpBuyCommand( this.bot );

        this.setUpShowOrdersCommand( this.bot )

        this.listenSelectPrincipalCurrency( this.bot );

        this.listenSetPrincipalCurrencyAmount( this.bot );

        this.listenFinishSetPrincipalCurrencyAmount( this.bot );

        this.listenSelectSecundaryCurrency( this.bot );

        this.listenSelectPrice( this.bot );

        this.listenFinishSelectPrice( this.bot );

        this.listenConfirmOperation( this.bot );

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
        Compra divisas: /buy
        Compra divisas: /comprar
        `;
        
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

    // start:: Buy command to post buy offer
    private setUpBuyCommand(bot: Bot){
        bot.command("buy", this.handleBuyCommand );
        bot.command("comprar", this.handleBuyCommand );
    }

    private handleBuyCommand = (ctx: CommandContext<Context>) => {
        const message = "Que moneda desea comprar?";
        
        const options = { reply_markup: new InlineKeyboard() };
      
        const keyboard = options.reply_markup;

        const data = 'op:buy';

        this.selectCurrencyKeyboard( keyboard, data, this.currencies, 'pc' );
        
        ctx.reply( message, options );
    }

    private listenSelectPrincipalCurrency(bot: Bot){
        // op => operation 
        // pc => principal cur

        const trigger = /op:\w+ pc:\w+$/;
        bot.callbackQuery( trigger, ctx => {
            const data = ctx.callbackQuery.data;
            //@ts-ignore
            let [input, op, currency] = data.match(/op:(.*) pc:(.*)/) as string[];
            console.log("listenSelectPrincipalCurrency")

            op = op === "buy"? "comprar" : "vender";
            const message = `Que cantidad de ${currency} desea ${op}?`;
            const options = { reply_markup: new InlineKeyboard() };
        
            const keyboard = options.reply_markup;
            this.selectAmountKeyboard( keyboard, data)
            
            ctx.editMessageText( message, options )
        } )
    }

    private listenSetPrincipalCurrencyAmount( bot: Bot ) {
        const trigger = /op:(\w+) pc:(\w+) d:(\d+(\.)?(\d+)?)$/;
        const queryMatch = /op:(.*) pc:(.*) d:(.*)/;
        bot.callbackQuery( trigger, ctx => {
            const data = ctx.callbackQuery.data;
            let [input, operation, p_currency, digiting] = data.match(queryMatch) as string[];
            
            console.log('listenSetPrincipalCurrencyAmount')

            operation = operation === "buy"? "comprar" : "vender";

            const message = `Quiero ${operation} ${digiting} ${p_currency}!`;
            const options = { reply_markup: new InlineKeyboard() };
        
            const keyboard = options.reply_markup;
            this.selectAmountKeyboard( keyboard, data )
            
            ctx.editMessageText( message, options )
        })
    }

    private listenFinishSetPrincipalCurrencyAmount( bot: Bot ) {
        const trigger = /op:(\w+) pc:(\w+) d:(\d+(\.)?(\d+)?) n/;
        const queryMatch = /op:(.*) pc:(.*) d:(.*) n/;
        bot.callbackQuery( trigger, ctx => {
            let data = ctx.callbackQuery.data;
            let [input, operation, p_currency, digiting] = data.match(queryMatch) as string[];

            data = `op:${operation} pc:${p_currency} am:${digiting}`
            console.log("listenFinishSetPrincipalCurrencyAmount")
            let message;
            if (operation === "buy" )
                message = "Con que moneda va a pagar?";
            else 
                message = "Que moneda desea recibir?";

            const options = { reply_markup: new InlineKeyboard() };
        
            const keyboard = options.reply_markup;

            this.selectCurrencyKeyboard( keyboard, data, this.currencies, 'sc')
            
            ctx.editMessageText( message, options )
        })
    }

    private listenSelectSecundaryCurrency(bot: Bot){
        const trigger = /op:\w+ pc:\w+ am:\d+(\.)?(\d+)? sc:(\w+)$/;
        const queryMatch = /op:(.*) pc:(.*) am:(.*) sc:(.*)/;
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
        const trigger = /op:\w+ pc:\w+ am:\d+(\.)?(\d+)? sc:(\w+) d:(\d+(\.)?(\d+)?)$/;
        const queryMatch = /op:(.*) pc:(.*) am:(.*) sc:(.*) d:(.*)/;

        bot.callbackQuery( trigger, ctx => {
            console.log("listenSelectPrice")
            const data = ctx.callbackQuery.data;
            let [input, operation, p_currency, amount, s_currency, digiting] = data.match(queryMatch) as string[];

            operation = operation === "buy"? "Comprar" : "Vender";

            const message = `${operation} ${p_currency} a ${digiting} ${s_currency}`;

            const options = { reply_markup: new InlineKeyboard() };
        
            const keyboard = options.reply_markup;
            this.selectAmountKeyboard( keyboard, data );

            ctx.editMessageText( message, options )
        })
    }

    private listenFinishSelectPrice( bot: Bot ){
        
        const trigger = /op:\w+ pc:\w+ am:\d+(\.)?(\d+)? sc:(\w+) d:(\d+(\.)?(\d+)?) n/;
        const queryMatch = /op:(.*) pc:(.*) am:(.*) sc:(.*) d:(.*) n/;

        bot.callbackQuery( trigger, ctx => {
            console.log("listenFinishSelectPrice")
            let data = ctx.callbackQuery.data;
            let [input, operation, p_currency, amount, s_currency, digiting] = data.match(queryMatch) as string[];

            data = `op:${operation} pc:${p_currency} am:${amount} sc:${s_currency} pr:${digiting}`
            operation = operation === "buy"? "Comprar" : "Vender";

            const message = `${operation} ${amount} ${p_currency} a ${digiting} ${s_currency}`;

            const options = { reply_markup: new InlineKeyboard() };
        
            const keyboard = options.reply_markup;
            this.confirmKeyboard( keyboard, data );

            ctx.editMessageText( message, options )
        })
    }

    private listenConfirmOperation( bot: Bot ){
        const trigger = /op:\w+ pc:\w+ am:\d+(\.)?(\d+)? sc:(\w+) pr:\d+(\.)?(\d+)? conf:\w+/;
        const queryMatch = /op:(.*) pc:(.*) am:(.*) sc:(.*) pr:(.*) conf:(.*)/;

        bot.callbackQuery( trigger, ctx => {
            console.log("listenConfirmOperation")
            let data = ctx.callbackQuery.data;
            let [input, operation, p_currency, amount, s_currency, price, confirm] = data.match(queryMatch) as string[];

            data = `op:${operation} pc:${p_currency} am:${amount} sc:${s_currency} pr:${price}`
            const opMessage = operation === "buy"? "Compra" : "Venta";


            let message: string;

            if (confirm === "yes"){
                message = `Has publicado una ${opMessage} de ${amount} ${p_currency} a ${price} ${s_currency}`;
                const operator: Operator = {
                    id: ctx.from.id,
                    first_name: ctx.from.first_name,
                    last_name: ctx.from.last_name,
                    username: ctx.from.username
                }
                const order: Order = {operator, operation, p_currency, amount: Number(amount), s_currency, price: Number(price), date: new Date()}
                this.postedOperations.push(order)
            } else {
                message = "Operacion cancelada"
            }

            ctx.editMessageText(message)
        })
    }
    // end:: Buy command to post buy offer

    // start:: Sell command to post sell offer
    private setUpSellCommand(){

    }
    private handleSellCommand = (ctx: CommandContext<Context>) => {
        const message = "Que moneda desea vender?";
        
        const options = { reply_markup: new InlineKeyboard() };
      
        const keyboard = options.reply_markup;

        const data = 'op:sell';

        this.selectCurrencyKeyboard( keyboard, data, this.currencies, 'pc' );
        
        ctx.reply( message, options );
    }
    // end:: Sell command to post sell offer

    // start:: Show ops commad
    private setUpShowOrdersCommand(bot: Bot){
        bot.command("orders", this.handleShowOrdersCommand );
    }

    private handleShowOrdersCommand = (ctx: CommandContext<Context>) => {
        let message = `======== ORDENES ========\n`;

        this.postedOperations.forEach( ( order, index ) => {
            message = `${message} ${index+1}: ${order.operation} ${order.amount} ${order.p_currency} a ${order.price} ${order.s_currency}\n`;
        })
        
        ctx.reply( message );
    }
    // end:: Show ops commad

    // start:: Utils
    private selectCurrencyKeyboard = (keyboard: InlineKeyboard, incData: string, currencies: string[], type: 'pc' | 'sc') => {
        currencies.forEach( (currency, index) => {
            const data = `${incData} ${type}:${currency}`
            
            keyboard.text( currency, data );
            
            if( index === 2 )
                keyboard.row();
        })
    }

    private selectAmountKeyboard( keyboard: InlineKeyboard, incData: string ){
        let data;
        
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '<']
        .forEach( char => {
            const pairs = incData.split(' ');
            const digitPairIndex = pairs.findIndex( p => p.split(':')[0] === 'd' )

            if( digitPairIndex === -1 ){
                data = `${incData} d:${char}`
            } else {
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

        keyboard.row();
        keyboard.text('next', `${incData} n`)
    }

    private confirmKeyboard( keyboard: InlineKeyboard, incData: string ){
        keyboard.text("Confirmar", `${incData} conf:yes`)
        keyboard.text("Descartar", `${incData} conf:no`)
    }
    // end:: Utils

    // start:: Set up bot commands
    private setUpAllCommands(bot: Bot){
        bot.api.setMyCommands([
            // { command: "buy", description: "Comprar divisas"},
            { command: "comprar", description: "Comprar divisas"},
            { command: "orders", description: "Ver ordenes"}
        ]);
    }
    // end:: Set up bot commands
}