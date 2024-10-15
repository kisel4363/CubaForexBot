import express from 'express';

export abstract class GlobalController {
    protected _router = express.Router();

    protected constructor(protected _contextPath: string) {
    }

    public getRouter() {
        return this._router;
    }

    protected abstract _initializeRoutes();
}
