import { PopulateOptions } from "mongoose";
import { IMongooseOptions } from "../@types/mongoose";
import { IOrder } from "../models/orders.model";
import { IUser, User } from "../models/user.model";
import { GlobalService } from "./global.service";

export class UserService extends GlobalService {
    
    constructor(){
        super();
        this._model = User;
        this._populate = [];
    }

    saveUser(user: IUser, options?: IMongooseOptions, populate?: string[] | {}){
        return this._save<IUser>( user, options, populate )
    }

    findOneUser(data: any, select?: string, populate?: string[] | PopulateOptions[] | {}, options?: IMongooseOptions){
        return this._findOne<IUser>( data, select, populate, options )
    }

    checkIfExistAndSaveOrUpdate(operator: IUser): Promise<IUser>{
        const params = { username: operator.username };
        return this.findOneUser( params )
            .then( user => {
                if ( user ) return user

                // Save operator
                return this.saveUser(operator)
            })
    }

}