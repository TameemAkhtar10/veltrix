
import jwt from 'jsonwebtoken'
import { isRedisConnected, getRedisClient, initRedis } from '../config/redis.js'
import Usermodel from '../models/user.model.js'


export let authUser = async (req, res, next) => {
    let token = req.cookies.TOKEN || req.cookies.token

    if (!token) {
        return res.status(401).json({
            message: "unauthrized",
            success: false,



        })
    }

    try {

        if (!isRedisConnected()) {
            await initRedis()
        }

        if (isRedisConnected()) {
            const redisClient = getRedisClient()
            const isTokenBlocked = await redisClient.get(`blacklist:${token}`)
            if (isTokenBlocked) {
                return res.status(401).json({
                    message: "Session expired. Please login again.",
                    success: false,
                })
            }
        }

        let decoded = jwt.verify(token, process.env.JWT_SECRET)

        req.user = decoded
        next()

    }
    catch (error) {
        return res.status(401).json({
            message: "unauthrized",
            success: false,
            error: error.message
        })
    }
}

export let requireVerifiedUser = async (req, res, next) => {
    try {
        const userId = req.user?.id
        if (!userId) {
            return res.status(401).json({
                message: 'unauthrized',
                success: false,
            })
        }

        const user = await Usermodel.findById(userId).select('verified')
        if (!user) {
            return res.status(401).json({
                message: 'User not found',
                success: false,
            })
        }

        if (!user.verified) {
            return res.status(403).json({
                message: 'Email not verified. Please verify your email to access chats.',
                success: false,
            })
        }

        next()
    }
    catch (error) {
        return res.status(500).json({
            message: 'Failed to validate user verification status',
            success: false,
            error: error.message,
        })
    }
}