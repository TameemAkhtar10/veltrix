import { Router } from "express";
import { authUser, requireVerifiedUser } from "../middleware/auth.middleware.js";
import { sendMessage, getMessages, getChats, deleteChat, createChat } from "../controller/chat.controller.js";

let chatRouter = Router();
chatRouter.post('/create', authUser, requireVerifiedUser, createChat);
chatRouter.post('/message', authUser, requireVerifiedUser, sendMessage);
chatRouter.get('/messages/:chatId', authUser, requireVerifiedUser, getMessages);
chatRouter.get('/chats', authUser, requireVerifiedUser, getChats);
chatRouter.delete('/delete/:chatId', authUser, requireVerifiedUser, deleteChat);
export default chatRouter;
