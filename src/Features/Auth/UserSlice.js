import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api/axios";

export const signup = createAsyncThunk(
  "user/signup",
  async (formData, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/register", formData);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Signup failed");
    }
  },
);
export const signin = createAsyncThunk(
  "user/signin",
  async (formData, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/login", formData);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Signin failed");
    }
  },
);

export const googleAuth = createAsyncThunk(
  "user/google",
  async (formData, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/google", formData);
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data || { message: "Google authentication failed" },
      );
    }
  },
);

export const signout = createAsyncThunk(
  "user/signout",
  async (_, { rejectWithValue }) => {
    try {
      await api.post("/auth/logout");
      return true;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Logout failed");
    }
  },
);

const initialState = {
  user: null,
  status: "idle", // idle | loading | success | error
  error: null,
  isAuthenticated: false,
};
const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },

    authStart(state) {
      state.status = "loading";
    },

    authSuccess(state, action) {
      state.status = "success";
      state.isAuthenticated = true;
      state.user = action.payload;
      state.error = null;
    },

    authLogout(state) {
      state.status = "idle";
      state.isAuthenticated = false;
      state.user = null;
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(signup.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(signup.fulfilled, (state, action) => {
        state.status = "success";
        state.isAuthenticated = true;
        state.user = action.payload.user;
      })
      .addCase(signup.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload;
      })
      .addCase(signin.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(signin.fulfilled, (state, action) => {
        state.status = "success";
        state.isAuthenticated = true;
        state.user = action.payload.user;
      })
      .addCase(signin.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload;
      })
      .addCase(googleAuth.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(googleAuth.fulfilled, (state, action) => {
        state.status = "success";
        state.isAuthenticated = true;
        state.user = action.payload.user;
      })
      .addCase(googleAuth.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload?.message || action.payload;
      })
      .addCase(signout.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(signout.fulfilled, (state) => {
        state.status = "idle";
        state.isAuthenticated = false;
        state.user = null;
        state.error = null;
      })
      .addCase(signout.rejected, (state, action) => {
        state.status = "idle";
        state.isAuthenticated = false;
        state.user = null;
        state.error = action.payload;
      });
  },
});
export const { clearError, authStart, authSuccess, authLogout } =
  userSlice.actions;

export default userSlice.reducer;
