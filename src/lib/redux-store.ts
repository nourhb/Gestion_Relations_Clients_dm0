import { configureStore, createSlice, combineReducers } from '@reduxjs/toolkit';

// Create a slice for the dummy state
const dummySlice = createSlice({
  name: 'dummy',
  initialState: { 
    initialized: true,
    whereby: {
      connected: false,
      roomId: null,
      participants: [],
      connectionState: 'disconnected'
    }
  },
  reducers: {
    init: (state) => {
      state.initialized = true;
    },
    setWherebyConnected: (state, action) => {
      state.whereby.connected = action.payload;
    },
    setRoomId: (state, action) => {
      state.whereby.roomId = action.payload;
    },
    setParticipants: (state, action) => {
      state.whereby.participants = action.payload;
    },
    setConnectionState: (state, action) => {
      state.whereby.connectionState = action.payload;
    }
  }
});

export const { init, setWherebyConnected, setRoomId, setParticipants, setConnectionState } = dummySlice.actions;

// Create comprehensive reducers for Whereby SDK compatibility
const wherebyReducer = (state = {
  room: {
    id: null,
    url: null,
    state: 'disconnected'
  },
  participants: [],
  media: {
    audio: { enabled: true, muted: false },
    video: { enabled: true, muted: false },
    screenShare: { enabled: false, active: false }
  },
  settings: {
    quality: 'auto',
    bandwidth: 'auto'
  }
}, action: any) => {
  // Let Whereby SDK manage its own state
  return state;
};

const roomReducer = (state = {
  id: null,
  url: null,
  state: 'disconnected',
  participants: [],
  settings: {}
}, action: any) => {
  return state;
};

const participantsReducer = (state = [], action: any) => {
  return state;
};

const mediaReducer = (state = {
  audio: { enabled: true, muted: false },
  video: { enabled: true, muted: false },
  screenShare: { enabled: false, active: false }
}, action: any) => {
  return state;
};

const settingsReducer = (state = {
  quality: 'auto',
  bandwidth: 'auto',
  audio: true,
  video: true
}, action: any) => {
  return state;
};

// Combine all reducers
const rootReducer = combineReducers({
  dummy: dummySlice.reducer,
  whereby: wherebyReducer,
  room: roomReducer,
  participants: participantsReducer,
  media: mediaReducer,
  settings: settingsReducer,
  // Add any other reducers that Whereby might expect
  app: (state = {}, action: any) => state,
  ui: (state = {}, action: any) => state,
  network: (state = {}, action: any) => state,
});

// Create a more comprehensive Redux store for Whereby SDK
const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'persist/PERSIST', 
          'persist/REHYDRATE',
          'whereby/room/join',
          'whereby/room/leave',
          'whereby/participants/add',
          'whereby/participants/remove',
          'whereby/media/update',
          'whereby/settings/update',
          'whereby/network/update',
          'whereby/ui/update'
        ],
        ignoredPaths: [
          'whereby',
          'room',
          'participants', 
          'media',
          'settings',
          'app',
          'ui',
          'network'
        ],
        ignoredActionPaths: ['payload'],
      },
      immutableCheck: false,
    }),
  devTools: process.env.NODE_ENV === 'development',
  preloadedState: {
    dummy: {
      initialized: true,
      whereby: {
        connected: false,
        roomId: null,
        participants: [],
        connectionState: 'disconnected'
      }
    },
    whereby: {
      room: {
        id: null,
        url: null,
        state: 'disconnected'
      },
      participants: [],
      media: {
        audio: { enabled: true, muted: false },
        video: { enabled: true, muted: false },
        screenShare: { enabled: false, active: false }
      },
      settings: {
        quality: 'auto',
        bandwidth: 'auto'
      }
    },
    room: {
      id: null,
      url: null,
      state: 'disconnected',
      participants: [],
      settings: {}
    },
    participants: [],
    media: {
      audio: { enabled: true, muted: false },
      video: { enabled: true, muted: false },
      screenShare: { enabled: false, active: false }
    },
    settings: {
      quality: 'auto',
      bandwidth: 'auto',
      audio: true,
      video: true
    },
    app: {},
    ui: {},
    network: {}
  }
});

// Initialize the store
store.dispatch(init());

// Export the store type
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store; 