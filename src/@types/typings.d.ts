// promise-bluebird.d.ts
import * as Bluebird from 'bluebird';
declare module 'mongoose' {
    type Promise<T> = Bluebird<T>;
}
