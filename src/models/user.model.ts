import { model, Schema } from "mongoose";

export interface IUser {
    _id?: string;
    chatId?: number,
    username?: string,
    last_name?: string,
    telegramId?: number,
    first_name?: string,
}

const UserSchema = new Schema({
    chatId: { type: Number },
    username: { type: String },
    last_name: { type: String },
    first_name: { type: String },
    telegramId: { type: Number },
})

const User = model('User', UserSchema);
export { User };