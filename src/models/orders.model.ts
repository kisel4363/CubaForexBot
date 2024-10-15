import { model, Schema, Types } from "mongoose";
import { IUser } from "./user.model";

export interface IOperationState {
    cancelled: boolean,
    opened: boolean, 
    completed: boolean, 
    openedBy: { chatId: number, username: string, date: Date }[],
    cancelledBy: { chatId: number, username: string, date: Date }[],
    /* 
    El completedBy se puede usar para hacer una doble verificacion
        -Si el dueño de la operacion la marca como completada se agrega aqui
        -Si el user q le interesa la operacion la marca como completada se agrega aqui
    Por tanto si en completedBy hay 2 usuarios es mejor confirmacion que si hay 1
    */
    completedBy: [ { chatId: number, username: string, date: Date}?, { chatId: number, username: string, date: Date}? ]
}
const OperationStateSchema = new Schema({
    opened: { type: Boolean }, // when at least one user open the operation
    cancelled: { type: Boolean}, // true when the order creator close the operatio
    completed: { type: Boolean }, // when the operation is completed
    openedBy: [{
        date: { type: Date, required: true },
        chatId: { type: Number, required: true},
        username: { type: String, required: true },
    }],
    cancelledBy:[{
        date: { type: Date, required: true },
        chatId: { type: Number, required: true},
        username: { type: String, required: true },
    }],
    completedBy: [{
        date: { type: Date, required: true },
        chatId: { type: Number, required: true },
        username: { type: String, required: true },
    }]
})

export interface IOrder {
    date?: Date,
    _id?: string, 
    price?: number, 
    amount?: number, 
    operation?:string, 
    operator?: IUser, 
    p_currency?: string, 
    s_currency?: string, 
    state?: IOperationState
};
const OrderSchema = new Schema({
    date: { type: Date, required: true },
    price: { type: Number, required: true },
    amount: { type: Number, required: true }, 
    operation: { type: String, required: true },
    s_currency: { type: String, required: true },
    p_currency: { type: String, required: true },
    operator: { type: Types.ObjectId, ref: "User"},
    state: { type: OperationStateSchema }
})

const Order = model('Order', OrderSchema);
export {Order};