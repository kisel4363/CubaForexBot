export const GLOBAL_CONFIG = {
    develop:{
        port: 8082,
        // telegram_token: "7489205472:AAErIX--3QpSMZaYqhIRM0cOo76L9FRnsRE", //CUBAN_FOREX
        telegram_token: "7195160484:AAHEuIBkuvQy15wRfcampK6gtbVw_6PhOuU", //CUBA_FOREX
        local_db: "mongodb://yourUsername:yourPassword@localhost:27017/?tls=false&directConnection=true&appName=CubaForex",
        hosted_db: "mongodb+srv://puentes9512:ZIomJoPqDlOURbUk@cubaforex.bc0em.mongodb.net/CubaForexBotBD?retryWrites=true&w=majority&appName=CubaForex",
    },
    production: {
        port: 8082,
        // telegram_token: "7489205472:AAErIX--3QpSMZaYqhIRM0cOo76L9FRnsRE", //CUBAN_FOREX
        telegram_token: "7195160484:AAHEuIBkuvQy15wRfcampK6gtbVw_6PhOuU", //CUBA_FOREX
        local_db: "mongodb://yourUsername:yourPassword@localhost:27017/?tls=false&directConnection=true&appName=CubaForex",
        hosted_db: "mongodb+srv://puentes9512:ZIomJoPqDlOURbUk@cubaforex.bc0em.mongodb.net/CubaForexBotBD?retryWrites=true&w=majority&appName=CubaForex",
    }
}