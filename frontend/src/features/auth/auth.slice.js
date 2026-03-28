import { createSlice } from "@reduxjs/toolkit";


const authSlice = createSlice({
    name: "auth",
    initialState: {
        user: null,
        loading: false,
        error: null,
        authChecked: false,
    },
    reducers: {
        setUser(state, action) {
            state.user = action.payload;
            state.authChecked = true;
        },
        clearUser(state) {
            state.user = null;
            state.authChecked = true;
        },
        setLoading(state, action) {
            state.loading = action.payload;
        },
        setError(state, action) {
            state.error = action.payload;
        },
        clearError(state) {
            state.error = null;
        },
        setAuthChecked(state, action) {
            state.authChecked = action.payload;
        }
    }
})
export const { setUser, clearUser, setLoading, setError, clearError, setAuthChecked } = authSlice.actions;
export default authSlice.reducer;
