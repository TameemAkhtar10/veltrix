import Usermodel from "../models/user.model.js"
import jwt from "jsonwebtoken"
import { sendEmail } from "../services/mail.service.js"
import { getRedisClient, initRedis, isRedisConnected } from "../config/redis.js"

const BACKEND_PUBLIC_URL = process.env.BACKEND_PUBLIC_URL || 'https://veltrix-bn4b.onrender.com'
const FRONTEND_PUBLIC_URL = process.env.FRONTEND_URL || 'https://veltrix-bn4b.onrender.com'

export const userregister = async (req, res) => {
    console.log(req.body);
    try {

        const { username, email, password } = req.body

        const isuserexisted = await Usermodel.findOne({
            $or: [
                { username },
                { email }
            ]
        })

        if (isuserexisted) {
            return res.status(400).json({
                message: "User already exists",
                success: false,
                err: "user already exists"
            })
        }
        const user = await Usermodel.create({
            username,
            email,
            password
        })

        let emailverificationtoken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" })
        res.cookie("TOKEN", emailverificationtoken, {
            httpOnly: true
        })






        try {

            await sendEmail(
                email,
                "Verify your account",
                '<p>Hii ' + username + `,</p>`
                + '<p>Thank you for registering on our website. Please click the link below to verify your email address:</p>'
                + `<a href="${BACKEND_PUBLIC_URL}/api/auth/verify-email?token=${emailverificationtoken}">Verify Email</a>`



            )

        } catch (mailError) {

            console.error("Email failed but user created:", mailError)

        }

        return res.status(201).json({
            message: "User registered successfully",
            success: true,
            user: {
                username: user.username,
                email: user.email,
                id: user._id
            }
        })

    } catch (error) {

        console.error("Error in user registration:", error)

        return res.status(500).json({
            message: "Internal server error",
            success: false,
            err: error.message
        })

    }
}
export const verifyemail = async (req, res) => {
    try {
        const token =
            req.query?.token ||
            req.body?.token ||
            req.headers?.authorization?.replace("Bearer ", "")

        if (!token) {
            return res.status(400).json({
                message: "Verification token is required",
                success: false
            })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const user = await Usermodel.findById(decoded.id)

        if (!user) {
            return res.status(404).json({
                message: "User not found",
                success: false
            })
        }

        if (user.verified) {
            return res.status(200).send(`
                <h1>Email already verified</h1>
                <p>Your account is already verified. You can log in now.</p>
                <a href="${FRONTEND_PUBLIC_URL}/#/login">Go to Login</a>
            `)
        }

        user.verified = true
        await user.save()

        return res.status(200).send(`
            <h1>Email verified successfully</h1>
            <p>Thank you for verifying your email address. You can now log in to your account.</p>
            <a href="${FRONTEND_PUBLIC_URL}/#/login">Go to Login</a>
        `)
    } catch (error) {
        return res.status(400).json({
            message: "Invalid or expired token",
            success: false,
            err: error.message
        })
    }
}

export const userlogin = async (req, res) => {
    console.log(req.body);
    try {
        const { username, email, password } = req.body

        const user = await Usermodel.findOne({
            $or: [
                { username },
                { email }
            ]
        })
        if (!user) {
            return res.status(404).json({
                message: "User not found",
                success: false
            })
        }
        if (!user.verified) {
            return res.status(403).json({
                message: "Email not verified",
                success: false
            })
        }
        const ispasswordmatched = await user.comparePassword(password)
        if (!ispasswordmatched) {
            return res.status(400).json({
                message: "Invalid credentials",
                success: false
            })
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" })
        res.cookie("TOKEN", token, {
            httpOnly: true
        })


        return res.status(200).json({
            message: "User logged in successfully",
            success: true,
            user: {
                username: user.username,
                email: user.email,
                id: user._id
            }
        })
    } catch (error) {
        console.error("Error in user login:", error)
        return res.status(500).json({
            message: "Internal server error",
            success: false,
            err: error.message
        })
    }

}
export const getme = async (req, res) => {
    let userid = req.user.id

    let user = await Usermodel.findById(userid).select('-password')

    res.status(200).json({
        message: "User details fetched successfully",
        success: true,
        user
    })
}

export const userlogout = async (req, res) => {
    try {
        const token = req.cookies.TOKEN || req.cookies.token

        if (!isRedisConnected()) {
            await initRedis()
        }

        if (token && isRedisConnected()) {
            const redisClient = getRedisClient()
            const decoded = jwt.decode(token)
            const expInSeconds = decoded?.exp
            const nowInSeconds = Math.floor(Date.now() / 1000)
            const ttl = expInSeconds ? Math.max(expInSeconds - nowInSeconds, 1) : 60 * 60 * 24 * 7

            await redisClient.set(`blacklist:${token}`, '1', {
                EX: ttl,
            })
        } else if (token) {
            console.warn('Logout called but Redis is not connected. Token blacklist was not saved.')
        }

        res.clearCookie('TOKEN', {
            httpOnly: true,
            sameSite: 'lax',
        })
        res.clearCookie('token', {
            httpOnly: true,
            sameSite: 'lax',
        })

        return res.status(200).json({
            message: 'User logout successfully',
            success: true,
        })
    } catch (error) {
        return res.status(500).json({
            message: 'Failed to logout user',
            success: false,
            err: error.message,
        })
    }
}