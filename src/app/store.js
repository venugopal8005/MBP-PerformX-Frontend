import { configureStore } from "@reduxjs/toolkit";
import UserReducer from "../Features/Auth/UserSlice"
// import TaskReducer from "../Features/Myspace/Dashboard/Kanban/taskSlice"
export const store = configureStore({
    reducer:{
        user:UserReducer,
        // tasks:TaskReducer
    }
})