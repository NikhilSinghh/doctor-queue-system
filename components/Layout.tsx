import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import io from 'socket.io-client';
import { useStore } from '../store/useStore';
import { 
  Home, Calendar, History, User, Bell, LogOut, Sun, Moon, 
  Menu, X, ShieldAlert, BarChart3, Settings, Users 
} from 'lucide-react';
import axios from 'axios';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const { 
    user, token, theme, setTheme, logout, 
    queueData, setQueueData, addNotification, notifications, setNotifications 
  } = useStore();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync dark mode class with state
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Handle Socket.IO connection
  useEffect(() => {
    if (!token || !user) return;

    const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const socket = io(BACKEND_URL, {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Connected to socket gateway');
      
      // Join room for active doctor
      const activeDocId = user.doctorId || 'default_seed_doctor_id'; // Fallback
      if (user.role === 'Doctor') {
        socket.emit('joinDoctorRoom', user.doctorId);
      } else {
        // Patients join first doctor in system or active doctor
        socket.emit('joinDoctorRoom', '66914b48bcde36814b72648a'); // standard seed doctor placeholder or dynamically updated
      }
    });

    // Real-time Queue Updates
    socket.on('queueUpdated', (data) => {
      console.log('Socket Queue Updated:', data);
      if (queueData && queueData.doctorId === data.doctorId) {
        const queueDateStr = new Date(queueData.date || Date.now()).toDateString();
        const eventDateStr = new Date(data.date).toDateString();
        if (queueDateStr !== eventDateStr) {
          console.log('Ignoring live queue update for a different date:', eventDateStr);
          return;
        }
        setQueueData({
          ...queueData,
          currentServingNumber: data.currentServingNumber,
          currentQueueLength: data.queueLength,
          estimatedAverageTime: data.estimatedAverageTime,
          doctorDelay: data.doctorDelay,
          queueList: data.activePatients,
        });
      }
    });

    // Real-time Doctor Status Updates
    socket.on('doctorStatusChanged', (data) => {
      console.log('Socket Doctor Status Changed:', data);
      addNotification({
        _id: Date.now().toString(),
        title: 'Doctor Status Update',
        message: `Doctor status is now ${data.status}${data.delayMinutes > 0 ? ` with a delay of ${data.delayMinutes} mins` : ''}.`,
        createdAt: new Date().toISOString(),
      });
      setUnreadCount(prev => prev + 1);
    });

    // Personal Notifications
    socket.on(`notification_${user.id}`, (data) => {
      console.log('Socket Personal Notif:', data);
      addNotification({
        _id: Date.now().toString(),
        title: data.title,
        message: data.message,
        createdAt: new Date().toISOString(),
      });
      setUnreadCount(prev => prev + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, [token, user, queueData]);

  // Load Initial Notifications from backend
  useEffect(() => {
    if (!token) return;
    const fetchNotifs = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/patient/notifications', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.success) {
          setNotifications(res.data.data);
          // Set unread if needed
          setUnreadCount(res.data.data.filter((n: any) => !n.isRead).length);
        }
      } catch (err) {
        console.error('Failed to load notifications', err);
      }
    };
    fetchNotifs();
  }, [token]);

  if (!mounted) {
    return <div className="min-h-screen bg-background-light dark:bg-background-dark"></div>;
  }

  if (!token) {
    return <div className="min-h-screen bg-background-light dark:bg-background-dark">{children}</div>;
  }

  const navItems = ['Doctor', 'Receptionist', 'Super Admin'].includes(user?.role || '') ? [
    { name: 'Queue Board', path: '/admin/dashboard', icon: Users },
    { name: 'Analytics Reports', path: '/admin/analytics', icon: BarChart3 },
    { name: 'Patient History', path: '/admin/patient-history', icon: History },
    { name: 'AI Prediction Settings', path: '/admin/ml-settings', icon: Settings },
  ] : [
    { name: 'Dashboard', path: '/patient/dashboard', icon: Home },
    { name: 'Book Appointment', path: '/patient/book', icon: Calendar },
    { name: 'My History', path: '/patient/history', icon: History },
  ];

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className={`fixed inset-y-0 left-0 z-20 flex flex-col w-64 p-5 transition-transform duration-300 transform bg-white dark:bg-slate-800 border-r border-slate-200/50 dark:border-slate-700/50 lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primaryBlue rounded-medium flex items-center justify-center text-white font-bold text-xl shadow-md">
              A
            </div>
            <span className="font-bold text-sm text-slate-800 dark:text-white tracking-wide leading-tight">Asha Neurology Center</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-500 dark:text-slate-400">
            <X size={20} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = router.pathname === item.path;
            return (
              <Link key={item.name} href={item.path} onClick={() => setSidebarOpen(false)} className={`flex items-center space-x-4 px-4 py-3 rounded-medium font-medium transition-all duration-200 ${isActive ? 'bg-primaryBlue text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                <Icon size={20} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
          <div className="flex items-center space-x-3 px-4 py-2">
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-semibold text-slate-700 dark:text-slate-300">
              {(user?.fullName === 'Dr. Elena Vance' ? 'Dr. Avinash Singh' : (user?.fullName || 'Dr. Avinash Singh')).charAt(0)}
            </div>
            <div className="flex-1 truncate">
              <p className="font-semibold text-sm text-slate-800 dark:text-white truncate">
                {user?.fullName === 'Dr. Elena Vance' ? 'Dr. Avinash Singh' : (user?.fullName || 'Dr. Avinash Singh')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.role || 'Doctor'}</p>
            </div>
          </div>

          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="flex items-center space-x-4 px-4 py-3 w-full rounded-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </button>

          <button onClick={handleLogout} className="flex items-center space-x-4 px-4 py-3 w-full rounded-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20">
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-background-light dark:bg-background-dark">
        {/* Header Bar */}
        <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-800 border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center space-x-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-600 dark:text-slate-300">
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white capitalize">
              {router.pathname.split('/').pop()?.replace('-', ' ') || 'Home'}
            </h1>
          </div>

          {/* Right Header Panel */}
          <div className="flex items-center space-x-4">
            {/* Notification Bell */}
            <div className="relative">
              <button onClick={() => { setNotifOpen(!notifOpen); setUnreadCount(0); }} className="p-2.5 rounded-medium bg-slate-50 dark:bg-slate-700/30 text-slate-600 dark:text-slate-300 hover:shadow-neumorphic-pressed dark:hover:shadow-neumorphic-pressed-dark transition-all duration-200">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-5 h-5 bg-rose-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-slate-800 animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Drawer */}
              {notifOpen && (
                <div className="absolute right-0 mt-3 w-80 max-h-96 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 rounded-medium shadow-xl z-30 p-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700 mb-3">
                    <span className="font-bold text-slate-800 dark:text-white">Notifications</span>
                    <button onClick={() => setNotifOpen(false)} className="text-slate-400 hover:text-slate-600">
                      <X size={16} />
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-6">No new notifications</p>
                  ) : (
                    <div className="space-y-3">
                      {notifications.map((n) => (
                        <div key={n._id} className="p-3 bg-slate-50 dark:bg-slate-700/20 rounded-medium border border-slate-100/50 dark:border-slate-700/55">
                          <p className="font-semibold text-xs text-primaryBlue mb-1">{n.title}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{n.message}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
