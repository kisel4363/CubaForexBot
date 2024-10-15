export interface IMongooseOptions {
    session?: any;
    new?: boolean;
    limit?: number;
    ordered?: boolean; // default true: respeta el orden de los items a la hora de crearlos en insertMany. Poner en false para mejorar perfomance
    arrayFilters?: any;
    passRawResult?: boolean;
    rawResult?: boolean;

    // Only for Find
    sort?: any;

    // The following options are only for write operations: update(), updateOne(), updateMany(), replaceOne(), findOneAndUpdate(), and findByIdAndUpdate():
    upsert?: boolean;
    writeConcern?: any;
    timestamps?: any;

    // The following options are only for find(), findOne(), findById(), findOneAndUpdate(), and findByIdAndUpdate():
    lean?: boolean; // default false: mongoose evalua los items y los valida, en true se omite la validacion y  se mejora el perfomance
    populate?: any;
    projection?: any; // selector attribute '_id ean -code'

    // for aggregate
    cursor?: any;
    allowDiskUse?: boolean;
    wtimeout?: number;
    setDefaultsOnInsert?: boolean;
}

export interface IUpdateOptions {
    session?: any;
    new?: boolean;
    upsert?: boolean;
    arrayFilters?: any;
    passRawResult?: boolean;
}

export interface DeleteWriteOpResultObject {
    //The raw result returned from MongoDB, field will vary depending on server version.
    result: {
        //Is 1 if the command executed correctly.
        ok?: number | undefined;
        //The total count of documents deleted.
        n?: number | undefined;
    };
    //The connection object used for the operation.
    connection?: any;
    //The number of documents deleted.
    deletedCount?: number | undefined;
}