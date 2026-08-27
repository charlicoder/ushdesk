import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/uiSlice';
import filtersReducer from './slices/filtersSlice';
import dataReducer from './slices/dataSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    filters: filtersReducer,
    data: dataReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
