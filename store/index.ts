import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/uiSlice';
import filtersReducer from './slices/filtersSlice';
import dataReducer from './slices/dataSlice';
import authReducer from './slices/authSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    filters: filtersReducer,
    data: dataReducer,
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

