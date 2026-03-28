import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';



let userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    verified: {
        type: Boolean,
        default: false

    }



},
    {
        timestamps: true
    })
userSchema.pre('save', async function () {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10)
    }
})
userSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password)
}
const Usermodel = mongoose.model('User', userSchema)
export default Usermodel