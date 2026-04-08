import { create } from 'zustand';

/**
 * UI store - manages UI state: modals, notifications, sidebar, etc.
 */
export const useUIStore = create((set) => ({
  // Modals
  modals: {
    mfaSetup: false,
    upgrade: false,
    deleteJob: false,
    sessions: false,
    commandPalette: false,
  },

  // Modal data
  modalData: {},

  // Notifications (toast messages)
  notifications: [],

  // Sidebar state
  sidebarOpen: true,
  theme: 'light',

  // Command palette
  commandPaletteOpen: false,

  // Modal actions
  openModal: (modalName, data = {}) =>
    set((state) => ({
      modals: { ...state.modals, [modalName]: true },
      modalData: { ...state.modalData, [modalName]: data },
    })),

  closeModal: (modalName) =>
    set((state) => ({
      modals: { ...state.modals, [modalName]: false },
      modalData: { ...state.modalData, [modalName]: {} },
    })),

  closeAllModals: () =>
    set({
      modals: {
        mfaSetup: false,
        upgrade: false,
        deleteJob: false,
        sessions: false,
        commandPalette: false,
      },
      modalData: {},
    }),

  // Notification actions
  addNotification: (message, type = 'info', duration = 5000) => {
    const id = `notif-${Date.now()}`;
    set((state) => ({
      notifications: [
        ...state.notifications,
        { id, message, type, duration },
      ],
    }));

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      }, duration);
    }

    return id;
  },

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  success: (message, duration) =>
    set((state) => {
      const id = `notif-${Date.now()}`;
      const newNotif = { id, message, type: 'success', duration: duration || 3000 };
      if (duration !== false) {
        setTimeout(() => {
          set((s) => ({
            notifications: s.notifications.filter((n) => n.id !== id),
          }));
        }, duration || 3000);
      }
      return { notifications: [...state.notifications, newNotif] };
    }),

  error: (message, duration) =>
    set((state) => {
      const id = `notif-${Date.now()}`;
      const newNotif = { id, message, type: 'error', duration: duration || 5000 };
      if (duration !== false) {
        setTimeout(() => {
          set((s) => ({
            notifications: s.notifications.filter((n) => n.id !== id),
          }));
        }, duration || 5000);
      }
      return { notifications: [...state.notifications, newNotif] };
    }),

  info: (message, duration) =>
    set((state) => {
      const id = `notif-${Date.now()}`;
      const newNotif = { id, message, type: 'info', duration: duration || 4000 };
      if (duration !== false) {
        setTimeout(() => {
          set((s) => ({
            notifications: s.notifications.filter((n) => n.id !== id),
          }));
        }, duration || 4000);
      }
      return { notifications: [...state.notifications, newNotif] };
    }),

  // Sidebar
  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open) =>
    set({ sidebarOpen: open }),

  // Theme
  setTheme: (theme) =>
    set({ theme }),

  // Command palette
  setCommandPaletteOpen: (open) =>
    set({ commandPaletteOpen: open }),

  toggleCommandPalette: () =>
    set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
}));
