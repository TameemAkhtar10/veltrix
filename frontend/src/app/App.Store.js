import {configureStore} from "@reduxjs/toolkit";
import authReducer from "../features/auth/auth.slice";
import chatReducer from "../features/chats/chat.slice";




export const store = configureStore({
    reducer: {
        auth: authReducer,
        chat: chatReducer
        
    }   
})
