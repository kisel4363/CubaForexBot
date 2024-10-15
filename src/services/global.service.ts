import { Model, PopulateOptions, QueryOptions, Schema, UpdateWriteOpResult } from "mongoose";
import { DeleteWriteOpResultObject, IMongooseOptions, IUpdateOptions } from "../@types/mongoose";

export abstract class GlobalService {
    protected _model: Model<any> & { aggregatePaginate?: (a, b) => Promise<any>, paginate?: (a, b) => Promise<any> };
    protected _populate: PopulateOptions | Array<PopulateOptions> | string;
    protected _populateOwner: string[] | {};

    protected constructor() {
        // this._populate = [];
    }

    // start:: Create methods
    protected _save<T>(data: T, options?: IMongooseOptions, populate?: string[] | {}): Promise<T> {
        const objectToStore = new this._model(data as any);
        console.log("OBJECT CREATED")
        // if (populate || this._populate) {
        //     return objectToStore.save(options).then(saved => saved.populate(populate || this._populate).execPopulate());
        // } else {
            return objectToStore.save(options);
        // }
    }
    // end:: Create methods

    // start:: Finds methods
    protected _findOne<T>(data: any, select?: string, populate?: string[] | PopulateOptions[] | {}, options?: IMongooseOptions): Promise<T> {
        return this._model.findOne(data, select, options).populate(populate || this._populate) as unknown as Promise<T>;
    }
    protected _find<T>(query: any, select?: any, options?: QueryOptions, populate?: any): Promise<T> {
        return this._model.find(query, select, options)
            .populate(populate ? populate : this._populate) as unknown as Promise<T>;
    }
    // end:: Finds methods

    // start:: Update methods
    protected _updateOne(params: any, data: any, options?: IUpdateOptions): Promise<UpdateWriteOpResult> {
        return this._model.updateOne(params, data, options) as unknown as Promise<UpdateWriteOpResult>;
    }
    protected _updateMany(params: any, data: any, options?: IUpdateOptions | any): Promise<UpdateWriteOpResult> {
        return this._model.updateMany(params, data, options) as unknown as Promise<UpdateWriteOpResult>;
    }
    protected _findOneAndUpdate<T>(params: any, data: any, options?: IMongooseOptions, populate?: string[] | {}): Promise<T> {
        return this._model.findOneAndUpdate(params, data, options).populate(populate || this._populate) as unknown as Promise<T>;
    }
    // end:: Update methods

    // start:: Delete methods
    protected _deleteOne(data: any, options?: IMongooseOptions): Promise<DeleteWriteOpResultObject & { deletedCount?: number }> {
        return this._model.deleteOne(data, options) as unknown as Promise<DeleteWriteOpResultObject & { deletedCount?: number }>;
    }
    // end:: Delete methods

}