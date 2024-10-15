import { QueryOptions } from "mongoose";
import { IMongooseOptions, IUpdateOptions } from "../@types/mongoose";
import { IOrder, Order } from "../models/orders.model";
import { GlobalService } from "./global.service";


export class OrdersService extends GlobalService {
    
    constructor(){
        super();
        this._model = Order;
        this._populate = [ { path: 'operator' } ];
    }

    saveOrder(order: IOrder, options?: IMongooseOptions, populate?: string[] | {}){
        return this._save<IOrder>( order, options, populate )
    }

    findOrders(params: any, sort?: any){
        const options: QueryOptions = { lean: true, sort };
        return this._find<IOrder[]>( params, "" , options)
    }

    findOrder(params: IOrder){
        return this._findOne<IOrder>(params)
    }

    updateOrder(params: any, data: any, options?: IUpdateOptions){
        return this._updateOne(params, data, options)
    }



}