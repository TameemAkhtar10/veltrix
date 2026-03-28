import mongoose from "mongoose";
let messageSchema = new mongoose.Schema({
    chat: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chat',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['user', 'assistant'],
        required: true
    }


},
    {
        timestamps: true
    })
const Messagemodel = mongoose.model('Message', messageSchema)
export default Messagemodel