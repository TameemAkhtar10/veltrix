import { createSlice } from "@reduxjs/toolkit"
let chatSlice = createSlice({
    name: 'chat',
    initialState: {
        conversations: [],
        chatList: [],
        currentchatId: null,
        error: null,
        isloading: false
    },
    reducers: {
        setchats: (state, action) => {
            state.conversations = action.payload
        },
        setcurrentchatId: (state, action) => {
            state.currentchatId = action.payload
        },
        setchatlist: (state, action) => {
            state.chatList = action.payload
        },
        seterror: (state, action) => {
            state.error = action.payload
        },
        setisloading: (state, action) => {
            state.isloading = action.payload
        }
    }
})

export const { setchats, setchatlist, setcurrentchatId, seterror, setisloading } = chatSlice.actions
export default chatSlice.reducer