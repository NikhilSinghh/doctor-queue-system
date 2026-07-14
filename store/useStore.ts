import { create } from 'zustand';

interface UserInfo {
  id: string;
  fullName: string;
  role: 'Patient' | 'Doctor' | 'Receptionist' | 'Super Admin';
  mobileNumber: string;
  email?: string;
  doctorId?: string | null;
  travelTime?: number;
}

interface QueueItem {
  appointmentId: string;
  queueNumber: number;
  priority: 'Routine' | 'Walk-in' | 'Emergency';
  status: 'Waiting' | 'Consulting' | 'Completed' | 'Cancelled';
  predictedConsultationTime?: string | null;
  predictedWaitingTime?: number | null;
  isMine?: boolean;
  avatarSeed?: string;
  patient?: {
    id: string;
    fullName: string;
    mobileNumber: string;
    gender: string;
    age: number;
  };
  chiefComplaint?: string;
}

interface QueueData {
  doctorId: string;
  doctorStatus: string;
  currentServingNumber: number;
  currentQueueLength: number;
  estimatedAverageTime: number;
  doctorDelay: number;
  lunchDelay: number;
  queueList: QueueItem[];
  lunchStart: string;
  lunchEnd: string;
  date?: string;
  maxPatientsPerDay: number;
}

interface StoreState {
  user: UserInfo | null;
  token: string | null;
  theme: 'light' | 'dark';
  activeDoctorId: string | null;
  queueData: QueueData | null;
  notifications: Array<{ _id: string; title: string; message: string; createdAt: string }>;
  login: (user: UserInfo, token: string) => void;
  logout: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setActiveDoctorId: (id: string | null) => void;
  setQueueData: (data: QueueData | null) => void;
  setNotifications: (notifications: any[]) => void;
  addNotification: (notification: any) => void;
}

export const useStore = create<StoreState>((set) => {
  // Safe SSR checking for localStorage
  const getInitialUser = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  };

  const getInitialToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  };

  const getInitialTheme = () => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  };

  return {
    user: getInitialUser(),
    token: getInitialToken(),
    theme: getInitialTheme(),
    activeDoctorId: null,
    queueData: null,
    notifications: [],

    login: (user, token) => {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', token);
      set({ user, token });
    },

    logout: () => {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      set({ user: null, token: null, queueData: null, notifications: [] });
    },

    setTheme: (theme) => {
      localStorage.setItem('theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      set({ theme });
    },

    setActiveDoctorId: (activeDoctorId) => set({ activeDoctorId }),
    setQueueData: (queueData) => set({ queueData }),
    setNotifications: (notifications) => set({ notifications }),
    addNotification: (notif) =>
      set((state) => ({ notifications: [notif, ...state.notifications] })),
  };
});

export const getApiUrl = (path: string) => {
  const productionUrl = process.env.NEXT_PUBLIC_API_URL || 'https://doctor-queue-backend-1eka.onrender.com';
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      const baseUrl = productionUrl.endsWith('/') ? productionUrl.slice(0, -1) : productionUrl;
      return `${baseUrl}${path}`;
    }
    return `http://${hostname}:5000${path}`;
  }
  return `http://localhost:5000${path}`;
};
