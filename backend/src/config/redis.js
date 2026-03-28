import { createClient } from 'redis'

let redisClient = null
let redisReady = false

const getRedisEnv = () => {
    const redisHost = (process.env.Redis_HOST || process.env.REDIS_HOST || '').trim()
    const redisPort = Number(process.env.Redis_PORT || process.env.REDIS_PORT || 6379)
    const redisPassword = process.env.Redis_PASSWORD || process.env.REDIS_PASSWORD
    const redisUsername = process.env.Redis_USERNAME || process.env.REDIS_USERNAME || 'default'
    const redisTlsRaw = (process.env.Redis_TLS || process.env.REDIS_TLS || '').toLowerCase()
    const shouldUseTls = redisTlsRaw ? redisTlsRaw === 'true' : false

    return {
        redisHost,
        redisPort,
        redisPassword,
        redisUsername,
        shouldUseTls,
    }
}

export const initRedis = async () => {
    if (redisClient?.isOpen) return redisClient

    const { redisHost, redisPort, redisPassword, redisUsername, shouldUseTls } = getRedisEnv()

    if (!redisHost) {
        console.warn('Redis host is not configured. Logout token blacklist is disabled.')
        return null
    }

    redisClient = createClient({
        username: redisUsername,
        password: redisPassword,
        socket: {
            host: redisHost,
            port: redisPort,
            tls: shouldUseTls,
        },
    })

    redisClient.on('error', (error) => {
        redisReady = false
        console.error('Redis connection error:', error.message)
    })

    redisClient.on('ready', () => {
        redisReady = true
        console.log('Redis connected successfully')
    })

    try {
        await redisClient.connect()
        return redisClient
    } catch (error) {
        console.error('Failed to connect Redis:', error.message)
        redisClient = null
        redisReady = false
        return null
    }
}

export const getRedisClient = () => redisClient

export const isRedisConnected = () => redisReady && redisClient?.isOpen
