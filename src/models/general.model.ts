import { IOrder } from "./orders.model";

export interface IOrderForCronTask extends IOrder{
    chatId: number, username: string
}