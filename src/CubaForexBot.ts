import express, { query } from "express";
import { Bot, CommandContext, Context, InlineKeyboard, webhookCallback } from "grammy";
import { setInterval } from "timers/promises";

const TELEGRAM_TOKEN="7489205472:AAErIX--3QpSMZaYqhIRM0cOo76L9FRnsRE";
interface OperationState { opened: boolean, openedBy: { chatId: number, user: string, date: Date }[], finished: boolean, finishedBy: { user: string, date: Date} }
interface Operator { id: number, first_name: string, last_name: string | undefined, username: string | undefined }
interface Order { _id?: string, operator?: Operator, operation?:string, p_currency?: string, amount?: number, s_currency?: string, price?: number, date?: Date, state?: OperationState };
export class CubaForexBot{
    private bot: Bot;
    private amounts = [ "5", "10", "20", "100"];
    private currencies = ["USD", "EUR", "CAD", "BTC", "USDT", "ETH"];
    private postedOperations: Order[] = [];

    private cronTaskInterval = 20; //hours

    private buyExamples: Order[] = [
        // {   
        //     _id: "alksdj35lkqjerhlkgx",
        //     operator: { id: 1, first_name: "Lazaro", last_name: "Oscar", username: 'lazarito_94'},
        //     operation: 'buy', p_currency: "USD", amount: 4, s_currency: "CUP", price: 320, date: new Date(),
        //     state: { opened: false, openedBy: [], finished: false, finishedBy: { user: "", date: new Date()} }
        // }
    ]

    constructor(){
        this.bot = new Bot(TELEGRAM_TOKEN);

        // start:: Set up commands
        this.setUpPostBuyCommand( this.bot );

        this.setUpPostSellCommand( this.bot );

        this.setUpShowBuyOrdersCommand( this.bot );
        
        this.setUpShowSellOrdersCommand( this.bot );
        // end:: Set up commands

        // start:: Listeners for post buys and sells
        this.listenSelectPrincipalCurrency( this.bot );

        this.listenSetPrincipalCurrencyAmount( this.bot );

        this.listenFinishSetPrincipalCurrencyAmount( this.bot );

        this.listenSelectSecundaryCurrency( this.bot );

        this.listenSelectPrice( this.bot );

        this.listenFinishSelectPrice( this.bot );

        this.listenConfirmOperation( this.bot );
        // end:: Listeners for post buys and sells

        // start:: Listeners for open operations
        this.listenOpenOperation(this.bot)
        // end:: Listeners for open operations

        this.setUpAllCommands(this.bot);

        this.replyAllOtherMessagesAndStartCmd(this.bot);

        this.loadOffersExamples();

        this.setUpCronTasks(this.bot);
    }

    private loadOffersExamples(){
        this.postedOperations = this.buyExamples;
    }

    private async setUpCronTasks(bot: Bot){
        //* 60 * 60 * 1000
        for await (const _ of setInterval( this.cronTaskInterval * 1000)){
            console.log("STARTING CRON")
            const openedOperations = this.postedOperations
                .filter( op => op.state?.opened)
                .flatMap( op => op.state?.openedBy.map( opb => ({chatId: opb.chatId, user: opb.user, _id: op._id})) );
            
            console.log("OPENED", openedOperations)
            openedOperations.forEach( op => {
                const keyboard = new InlineKeyboard()
                keyboard.text('Termine');
                keyboard.text('No Termine');
                //@ts-ignore
                bot.api.sendMessage(op.chatId, `Terminaste la operacion ${op._id}?`, { reply_markup: keyboard })
            })
            console.log("FINISH CRON")
        }
    }

    public startServer(){
        // Start the server
        // if (process.env.NODE_ENV === "production") {
        //     // Use Webhooks for the production server
        //     const app = express();
        //     app.use(express.json());
        //     app.use(webhookCallback(this.bot, "express"));
        
        //     const PORT = process.env.PORT || 3000;
        //     app.listen(PORT, () => {
        //     console.log(`Bot listening on port ${PORT}`);
        //     });
        // } else {
            // Use Long Polling for development
            this.bot.start();
        // }
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

    // start:: Sell command to post sell offer
    private setUpPostSellCommand(bot: Bot){
        bot.command("publica_venta", this.handleSellCommand)
    }
    // end:: Sell command to post sell offer

    // start:: Buy command to post buy offer
    private setUpPostBuyCommand(bot: Bot){
        bot.command("publica_compra", this.handleBuyCommand );
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

            ctx.editMessageText( message, options );
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
                const order: Order = {
                    _id: this.generateUid(),
                    operator, operation, 
                    p_currency, amount: Number(amount), 
                    s_currency, price: Number(price), date: new Date(),
                    state: { opened: false, openedBy: [], finished: false, finishedBy: { user: "", date: new Date()} }
                }
                this.postedOperations.push(order)
            } else {
                message = "Operacion cancelada"
            }

            ctx.editMessageText(message)
        })
    }
    // end:: Buy command to post buy offer

    // start:: Sell command to post sell offer
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
    private setUpShowSellOrdersCommand(bot: Bot){
        // bot.command("ver_vendedores", this.handleShowOrdersCommand );
    }
    private setUpShowBuyOrdersCommand(bot: Bot){
        bot.command("ver_compradores", this.handleShowBuyOrdersCommand );
    }

    private generateUid(){
        const alphabet: string[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'o'];
        const date = new Date();
        const ms = date.valueOf().toString();
        const arrayId: string[] = [];
        for (let pos = 0; pos < ms.length; pos++) {
            const char = ms.charAt(pos);
            const index = Number(char);
            arrayId.push( alphabet[index] );
        }
        return arrayId.join("");
    }

    private handleShowBuyOrdersCommand = (ctx: CommandContext<Context>) => {
        const header = `........................  COMPRADORES  ........................`;
        ctx.reply( header )
            .then( () => {
                this.postedOperations.forEach( ( order, index ) => {
                    //@ts-ignore
                    const offer = `${order.amount} ${order.p_currency} a ${order.price} ${order.s_currency} son ${order.amount * order.price} ${order.s_currency}`;
                    const user = order.operator?.username as string;
                    const keyboard = new InlineKeyboard();
                    console.log("handleShowBuyOrdersCommand", `open_op _id:${order._id} operator:${user}`)
                    keyboard.text("Abrir operacion", `open_op _id:${order._id} operator:${user}`)
                    ctx.reply(offer, { reply_markup: keyboard})
                })
            })
    }

    private listenOpenOperation(bot: Bot){
        const trigger = /open_op _id:\w+ operator:\w+/
        const queryMatch = /open_op _id:(\w+) operator:(\w+)/
        bot.callbackQuery( trigger, ctx => {
            console.log("RECEIVED OPEN OPERATION EVENT")
            const [_, operationId, operatorUsername] = ctx.callbackQuery.data.match(queryMatch) as string[];
            
            const openedBy = ctx.from.username as string;
            const chatId = ctx.chat?.id as number;
            this.markOpenedOperation(operationId, openedBy, chatId)
            const keyboard = new InlineKeyboard();
            keyboard.url( 'Contactar', `t.me/${operatorUsername}`)

            ctx.editMessageReplyMarkup( {reply_markup: keyboard} )
        })
    }

    private markOpenedOperation(operationId: string, openedBy: string, chatId: number){
        const openedOperation = this.postedOperations.find( op => op._id === operationId);
        //@ts-ignore
        openedOperation?.state["opened"] = true;
        openedOperation?.state?.openedBy.push( { chatId, user: openedBy, date: new Date() } );
        console.log("OPENED_OPERATION", openedOperation)
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
            { command: "publica_compra", description: "Publicar oferta de compra"},
            { command: "publica_venta", description: "Publicar oferta de venta"},
            { command: "ver_compradores", description: "Ver compradores"},
            // { command: "ver_vendedores", description: "Ver vendaedores"}
        ]);
    }
    // end:: Set up bot commands
}