import express, { query } from "express";
import { default as bluebird} from 'bluebird';
import { setInterval } from "timers/promises";
import mongooseMiddleware from 'mongoose-middleware';
import {default as mongoose, MongooseOptions, ConnectOptions} from 'mongoose';
import { Bot, CallbackQueryContext, CommandContext, Context, InlineKeyboard, webhookCallback } from "grammy";
import { IOrder } from "./models/orders.model";
import { IUser } from "./models/user.model";
import { UserService } from "./services/user.service";
import { OrdersService } from "./services/orders.service";
import { GLOBAL_CONFIG } from "./configs/global.configs";
import { IOrderForCronTask } from "./models/general.model";



export class CubaForexBot{
    private bot: Bot;
    private amounts = [ "5", "10", "20", "100"];
    private currencies = ["USD", "EUR", "CAD", "BTC", "USDT", "ETH"];
    private postedOperations: IOrder[] = [];

    private cronTaskInterval = 20; //seconds

    // start:: Declare services
    private userService: UserService;
    private ordersService: OrdersService;
    // start:: Declare services

    constructor(){
        this.bot = new Bot(GLOBAL_CONFIG.production.telegram_token);

        // start:: Initialize services
        this.initializeServices()
        // end:: Initialize services

        // start:: Set up commands
        this.setUpAdvancePost(this.bot);
        
        this.setUpListMyOrders( this.bot );

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

        // start:: Listeners for change operations state
        this.listenOpenOperation(this.bot);

        this.listenDoneOperation(this.bot);

        this.listenWaitOperation(this.bot);

        this.listenCancelledOperation(this.bot);
        // end:: Listeners for change operations state

        this.setUpAllCommands(this.bot);

        this.replyAllOtherMessagesAndStartCmd(this.bot);

        this.setUpCronTasks(this.bot);
    }

    private initializeServices(){
        this.userService = new UserService();
        this.ordersService = new OrdersService();
    }

    private async setUpCronTasks(bot: Bot){
        //* 60 * 60 * 1000
        for await (const _ of setInterval( this.cronTaskInterval * 1000)){
            const params = { 'state.opened': true }
            this.ordersService.findOrders(params)
                .then( orders => {
                    const openedOperations: IOrderForCronTask[] = orders
                        //@ts-ignore
                        .flatMap<IOrderForCronTask>( op => op.state.openedBy.map<IOrderForCronTask>( opb => {
                            return {
                                _id: op._id, 
                                price: op.price,
                                amount: op.amount, 
                                chatId: opb.chatId, 
                                username: opb.username, 
                                operation: op.operation,
                                p_currency: op.p_currency,
                                s_currency: op.s_currency,
                            }
                        }));
                    
                    openedOperations.forEach( op => {
                        console.log("CRON OP", op)
                        console.log(`d opId:${op?._id} usr:${op?.username} chat:${op.chatId}`)
                        const keyboard = new InlineKeyboard()
                        keyboard.text('Completada', `d opId:${op?._id} usr:${op?.username} chat:${op.chatId}`);
                        keyboard.text('Esperando', `w opId:${op?._id} usr:${op?.username} chat:${op.chatId}`);
                        keyboard.text('Cancelar', `c opId:${op?._id} usr:${op?.username} chat:${op.chatId}`);
                        // Este mensaje es para el usuario q abrio la operacion por tanto
                        // la operacion del mensaje q se envia es la contraria a la operacion
                        // del que la publico
                        const operation = op.operation === 'buy'? 'venta' : 'compra';
                        //@ts-ignore
                        const finalPay = op.price*op.amount;
                        const message = `Tienes una ${operation} de ${op.amount}${op.p_currency} a ${op.username} por ${finalPay}${op.s_currency}\n\nLa completaste?   Estas esperando?   o   Quieres cancelar?`;
                        bot.api.sendMessage(op.chatId, message, { reply_markup: keyboard });
                    })

                })
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

    public startServerWithMongo(){
        // Initialiting express app for mongo
        const app = express();
        app.use(express.json());
        app.use(webhookCallback(this.bot, "express"));
        // this.bot.start();
        // start:: Set up mongo
        (mongoose as any).Promise = bluebird;

        const connectionOptions: ConnectOptions = {
            autoIndex: true,
            useNewUrlParser: true,
            useUnifiedTopology: true
        };
        const connectionString = GLOBAL_CONFIG.production.hosted_db;
        return mongoose.connect(connectionString, connectionOptions )
            .then( () => {
                console.log("Connected to mongo db")
                const PORT = process.env.PORT || GLOBAL_CONFIG.production.port;
                app.listen(PORT, () => { console.log(`Bot listening on port ${PORT}`); });
            })
            .catch( error => console.log("Error connecting to mongo db"))
        // end:: Set up mongo
    }

    private replyAllOtherMessagesAndStartCmd(bot: Bot){
        bot.command("start", this.replyWithIntro);
        bot.on("message", this.replyRest);
        
    }

    private replyWithIntro = (ctx: CommandContext<Context>) => {
        // end:: Get user info

        // start:: Reply to start
        const introductionMessage = `Este bot te permitira obtener la mejor oferta del mercado de divisas`;
        const aboutUrlKeyboard = new InlineKeyboard()
            .url( "Host your own bot for free.",
                "https://cyclic.sh/" );
        ctx.reply(introductionMessage, {
            reply_markup: aboutUrlKeyboard,
            parse_mode: "HTML",
        });
        // end:: Reply to start
    }

    private replyRest = ( ctx: Context ) => {
        console.log(ctx.message?.text)
    }

    // start:: Sell command to post sell offer
    private setUpPostSellCommand(bot: Bot){
        bot.command("vender", this.handleSellCommand)
    }
    // end:: Sell command to post sell offer

    // start:: Buy command to post buy offer
    private setUpPostBuyCommand(bot: Bot){
        bot.command("comprar", this.handleBuyCommand );
    }

    private handleBuyCommand = (ctx: CommandContext<Context>) => {
        const message = "Que moneda desea comprar?";
        
        const options = { reply_markup: new InlineKeyboard() };
      
        const keyboard = options.reply_markup;

        const data = 'op:buy';

        this.selectCurrencyKeyboard( keyboard, data, this.currencies, 'pc' );
        
        ctx.reply( message, options )
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

        //op:buy pc:USD am:20 sc:CUP pr:320 conf:yes

        bot.callbackQuery( trigger, ctx => {
            console.log("listenConfirmOperation")
            let data = ctx.callbackQuery.data;
            let [input, operation, p_currency, amount, s_currency, price, confirm] = data.match(queryMatch) as string[];

            data = `op:${operation} pc:${p_currency} am:${amount} sc:${s_currency} pr:${price}`
            const opMessage = operation === "buy"? "Compra" : "Venta";

            if (confirm === "yes"){
                const operator: IUser = {
                    chatId: ctx.chat?.id,
                    telegramId: ctx.from.id,
                    username: ctx.from.username,
                    last_name: ctx.from.last_name,
                    first_name: ctx.from.first_name,
                }
                const order: IOrder = {
                    operator, operation, 
                    p_currency, amount: Number(amount), 
                    s_currency, price: Number(price), date: new Date(),
                    state: {
                        openedBy: [], cancelledBy: [], completedBy: [],
                        opened: false, completed: false, cancelled: false
                    }
                }
                this.userService.checkIfExistAndSaveOrUpdate(operator)
                    .then( user => {
                        //@ts-ignore
                        order.operator = user._id
                        return this.ordersService.saveOrder(order)
                    })
                    .then( order => {
                        const message = "Orden guardada"
                        ctx.editMessageText(message)
                    })
                    .catch( err => {
                        console.log("ERROR", err)
                        const message = 'Error salvando la operacion'
                        ctx.editMessageText(message)
                    })
            } else {
                const message = "Operacion cancelada";
                ctx.editMessageText(message)
            }
        })
    }
    // end:: Buy command to post buy offer

    // start:: Set up advance post
    private setUpAdvancePost(bot: Bot){
        bot.command("adv_op", this.handleAdvanceCommand );
    }
    private handleAdvanceCommand = (ctx: CommandContext<Context>) => {
        let [ _, operation, p_currency, amount, s_currency, price] = ctx.message?.text.split(" ") as string[]
        console.log("/adv_op", {operation, p_currency, amount, s_currency, price})

        const data = `op:${operation} pc:${p_currency} am:${amount} sc:${s_currency} pr:${price}`
        operation = operation === "buy"? "Comprar" : "Vender";

        const message = `${operation} ${amount} ${p_currency} a ${price} ${s_currency}`;

        const options = { reply_markup: new InlineKeyboard() };
    
        const keyboard = options.reply_markup;
        this.confirmKeyboard( keyboard, data );

        ctx.reply( message, options );
    }
    // end::Set up advance post

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
        bot.command("vendedores", this.handleShowSellOrdersCommand );
    }
    private handleShowSellOrdersCommand = async (ctx: CommandContext<Context>) => {
        const header = `........................  VENDEDORES  ........................`;
        await ctx.reply( header )
        const params = {
            operation: 'sell',
            'state.cancelled': false,
            'state.completed': false
        }
        this.ordersService.findOrders(params, { price: -1 })
            .then( operations => {
                operations.forEach( ( order, index ) => {
                    //@ts-ignore
                    const offer = `Vendo ${order.amount} ${order.p_currency} a ${order.price} ${order.s_currency} son ${order.amount * order.price} ${order.s_currency}`;
                    const user = order.operator?.username as string;
                    const keyboard = new InlineKeyboard();
                    keyboard.text("Abrir operacion", `open_op _id:${order._id} operator:${user}`)
                    ctx.reply(offer, { reply_markup: keyboard } )
                })
            })
    }

    private setUpShowBuyOrdersCommand(bot: Bot){
        bot.command("compradores", this.handleShowBuyOrdersCommand );
    }
    private handleShowBuyOrdersCommand = async (ctx: CommandContext<Context>) => {
        const header = `........................  COMPRADORES  ........................`;
        await ctx.reply( header )
        const params = {
            operation: 'buy',
            'state.cancelled': false,
            'state.completed': false
        }
        this.ordersService.findOrders(params, { price: 1 })
            .then( operations => {
                operations.forEach( ( order, index ) => {
                    //@ts-ignore
                    const offer = `Compro ${order.amount} ${order.p_currency} a un precio de ${order.price} ${order.s_currency}, en total son ${order.amount * order.price} ${order.s_currency}`;
                    const user = order.operator?.username as string;
                    const keyboard = new InlineKeyboard();
                    keyboard.text("Abrir operacion", `open_op _id:${order._id} operator:${user}`)
                    ctx.reply(offer, { reply_markup: keyboard})
                })
            })
    }
    // end:: Show ops commad

    // start:: Set up list my orders
    private setUpListMyOrders(bot: Bot){
        bot.command("mis_ordenes", this.handleListMyOrders );
    }
    private handleListMyOrders = async (ctx: CommandContext<Context>) => {
        const header = `........................  MIS ORDENES  ........................`;
        await ctx.reply( header )
        
        const params = { username: ctx.from?.username };
        this.userService.findOneUser(params).then( user => {
            if( !user )
                throw 'Publica una compra o una venta'
            const params = {
                'operator': user._id,
                'state.cancelled': false,
                'state.completed': false,
            }
            return this.ordersService.findOrders(params, { price: 1 })
        })
        .then( operations => {
            operations.forEach( ( order, index ) => {
                const operation = order.operation === 'buy' ? 'Compro' : 'Vendo';
                //@ts-ignore
                const offer = `${operation} ${order.amount} ${order.p_currency} a un precio de ${order.price} ${order.s_currency}, en total son ${order.amount * order.price} ${order.s_currency}`;
                const user = order.operator?.username as string;
                const keyboard = new InlineKeyboard();
                keyboard.text("Completada", `comp_op _id:${order._id} operator:${user}`)
                keyboard.text("Eliminar", `del_op _id:${order._id} operator:${user}`)
                ctx.reply(offer, { reply_markup: keyboard})
            })
        })
        .catch( err => {
            if( typeof err === 'string')
                ctx.reply(err)
            else
                console.log("ERROR", err)
        })
    }
    // end:: Set up list my orders

    // start:: Listeners for change operations state
    private listenOpenOperation(bot: Bot){
        const trigger = /open_op _id:\w+ operator:\w+/
        const queryMatch = /open_op _id:(\w+) operator:(\w+)/
        bot.callbackQuery( trigger, ctx => {
            const [_, operationId, operatorUsername] = ctx.callbackQuery.data.match(queryMatch) as string[];

            console.log("RECEIVED OPEN OPERATION EVENT", {operationId, operatorUsername})
            
            const openedBy = ctx.from.username as string;
            const chatId = ctx.chat?.id as number;
            this.markOpenedOperation(operationId, openedBy, chatId)
                .then( () => {
                    console.log("Marked open successfull")
                })
                .catch( err => {
                    console.log("Error opening operation", err)
                })
            const keyboard = new InlineKeyboard();
            keyboard.url( 'Contactar', `t.me/${operatorUsername}`)

            ctx.editMessageReplyMarkup( {reply_markup: keyboard} )
        })
    }
    private markOpenedOperation(operation: string, openedBy: string, chatId: number){
        return this.ordersService.findOrder( { _id: operation } )
            .then( order => {
                const params = { _id: order._id };
                const data = {
                    $set: { 'state.opened': true },
                    $push: { 'state.openedBy': { chatId, username: openedBy, date: new Date() } }
                }
                const options =  { new: true, runValidators: true };
                console.log("MARK OPERATION OPEN", data, typeof openedBy)
                return this.ordersService.updateOrder(params, data, options)
            })
            .then( () =>{})
    }

    private listenDoneOperation(bot: Bot){
        const trigger = /d opId:.*? usr:.*? chat:.*/;
        const queryMatch = /d opId:(.*?) usr:(.*?) chat:(.*)/;
        bot.callbackQuery(trigger, ctx => {
            const data = ctx.callbackQuery.data;
            //@ts-ignore
            let [ input, opId, user, chat] = data.match(queryMatch) as string[];
            this.markOperationDone(ctx, opId, user, chat)
        })
    }
    private markOperationDone(ctx: CallbackQueryContext<Context>, operation: string, username: string, chatId: string){
        let orderFinded;
        this.ordersService.findOrder( { _id: operation } )
            .then( order => {
                orderFinded = order;
                const params = { _id: order._id };
                const data = {
                    $set: {
                        'state.opened': false,
                        'state.completed': true
                    },
                    $push: { 'state.completedBy': { chatId, username, date: new Date() } }
                }
                return this.ordersService.updateOrder(params, data)
            })
            .then( () => {
                ctx.editMessageText('Gracias, tu respuesta mejora el servicio que te brindamos')
                setTimeout( () => {
                    ctx.deleteMessage()
                }, 20000)
            })
    }
    
    private listenWaitOperation(bot: Bot){
        const trigger = /w opId:.*? usr:.*? chat:.*/;
        const queryMatch = /w opId:(.*?) chat:(.*)/;
        bot.callbackQuery(trigger, ctx => {
            const data = ctx.callbackQuery.data;
            //@ts-ignore
            ctx.editMessageText('Gracias, tu respuesta mejora el servicio que te brindamos')
            setTimeout( () => {
                ctx.deleteMessage()
            }, 20000)
        })
    }

    private listenCancelledOperation(bot: Bot){
        const trigger = /c opId:.*? usr:.*? chat:.*/;
        const queryMatch = /c opId:(.*?) usr:(.*?) chat:(.*)/;
        bot.callbackQuery(trigger, ctx => {
            const data = ctx.callbackQuery.data;
            //@ts-ignore
            let [ input, opId, user, chat] = data.match(queryMatch) as string[];
            console.log({input, opId, user, chat})
            this.markOperationCancelled(ctx, opId, user, chat)
        })
    }
    private markOperationCancelled(ctx: CallbackQueryContext<Context>, operation: string, username: string, chatId: string){
        let orderFinded;
        this.ordersService.findOrder( { _id: operation } )
            .then( order => {
                orderFinded = order;
                const params = { _id: order._id };
                const data = {
                    $pull: { 'state.openedBy': { username } },
                    $push: { 'state.cancelledBy': { chatId, username, date: new Date() } }
                }
                console.log("PARAMS", params, data)
                return this.ordersService.updateOrder(params, data)
            })
            .then( () => {
                ctx.editMessageText('Gracias, tu respuesta mejora el servicio que te brindamos')
                setTimeout( () => {
                    ctx.deleteMessage()
                }, 20000)
            })
    }
    // end:: Listeners for change operations state

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
            { command: "comprar", description: "Publicar compra"},
            { command: "vender", description: "Publicar venta"},
            { command: "compradores", description: "Ver compradores"},
            { command: "vendedores", description: "Ver vendaedores"},
            { command: "adv_op", description: "Publica oferta con solo un mensaje" },
            { command: "mis_ordenes", description: "Lista las ordenes que publicaste" }
        ]);
    }
    // end:: Set up bot commands

    // start:: Testing bd
    public createUser(){
        const user: IUser = {
            chatId: 4353,
            username: "omar",
            last_name: "Puentes",
            telegramId: 34623,
            first_name: "Omar"
        }
        this.userService.saveUser(user)
            .then( () => console.log("User saved"))
    }
    // end:: Testing bd
}