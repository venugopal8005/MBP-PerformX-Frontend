import api from "../../api/axios";
import { authStart, authSuccess, authLogout } from "./UserSlice";

export const checkAuth = () => async (dispatch) => {
  dispatch(authStart());

  try {
    console.log("checking auth");
    const res = await api.get("/auth/me", {
      withCredentials: true,
    });
      console.log(res);
    dispatch(authSuccess(res.data.user));
  } catch {
    dispatch(authLogout());
  }
};
