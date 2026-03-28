import { useDispatch } from "react-redux";
import { register, login, getme, logout } from '../services/auth.api'
import { clearError, clearUser, setAuthChecked, setUser, setError, setLoading } from "../auth.slice";

const getAuthErrorMessage = (error, fallbackMessage) => {
    if (error?.errors?.length) {
        return error.errors.map((item) => item.msg).join(', ')
    }

    return error?.message || fallbackMessage
}


export const useAuth = () => {
    const dispatch = useDispatch()

    async function handleregister(username, email, password) {
        try {
            dispatch(setLoading(true))
            dispatch(clearError())
            dispatch(setAuthChecked(false))
            let data = await register(username, email, password)

            if (data?.user) {
                dispatch(setUser(data.user))
            } else {
                const me = await getme()
                dispatch(setUser(me.user))
            }

            return { success: true, data }
        }
        catch (error) {
            const message = getAuthErrorMessage(error, "Register failed")
            dispatch(setError(message))
            dispatch(setAuthChecked(true))
            return { success: false, error: message }
        }
        finally {
            dispatch(setLoading(false))
        }
    }

    async function handlelogin(email, password) {
        try {
            dispatch(setLoading(true))
            dispatch(clearError())
            dispatch(setAuthChecked(false))
            let data = await login(email, password)

            if (data?.user) {
                dispatch(setUser(data.user))
            } else {
                const me = await getme()
                dispatch(setUser(me.user))
            }

            return { success: true, data }
        }
        catch (error) {
            const message = getAuthErrorMessage(error, "Login failed")
            dispatch(clearUser())
            dispatch(setError(message))
            return { success: false, error: message }
        }
        finally {
            dispatch(setLoading(false))
        }

    }

    async function handlegetme() {
        try {
            dispatch(setLoading(true))
            dispatch(clearError())
            dispatch(setAuthChecked(false))
            let data = await getme()
            dispatch(setUser(data.user))
            return { success: true, data }
        }
        catch (error) {
            const message = getAuthErrorMessage(error, "Failed to fetch user details")
            dispatch(clearUser())
            dispatch(setError(message))
            return { success: false, error: message }
        }
        finally {
            dispatch(setLoading(false))
        }
    }

    async function handlelogout() {
        try {
            dispatch(clearError())
            dispatch(setLoading(false))
            await logout()
            dispatch(clearUser())
            return { success: true }
        }
        catch (error) {
            const message = getAuthErrorMessage(error, "Logout failed")
            dispatch(setLoading(false))
            dispatch(setError(message))
            return { success: false, error: message }
        }
    }

    return {
        handleregister,
        handlelogin,
        handlegetme,
        handlelogout,
        clearAuthError: () => dispatch(clearError())
    }
}