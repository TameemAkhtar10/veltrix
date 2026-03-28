import mongoose from "mongoose";

let chatSchema = new mongoose.Schema({
    users:
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        default: 'New Chat 🤗'

    }
},
    {
        timestamps: true
    }
)
const Chatmodel = mongoose.model('Chat', chatSchema)
export default Chatmodel