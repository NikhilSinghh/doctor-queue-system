import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { useStore } from '../../store/useStore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { RefreshCw, Users, Hourglass, Activity, CheckSquare, Clock } from 'lucide-react';

export default function AnalyticsDashboard() {
  const router = useRouter();
  const { token, user } = useStore();
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  // Route Guard
  useEffect(() => {
    if (token && user && !['Doctor', 'Receptionist', 'Super Admin'].includes(user.role)) {
      router.push('/patient/dashboard');
    }
  }, [token, user]);

  const doctorId = user?.doctorId || '66914b48bcde36814b72648a';

  const fetchAnalytics = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`http://localhost:5000/api/admin/analytics?doctorId=${doctorId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setAnalyticsData(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching analytics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [token]);

  // Mock fallbacks if no history seeded yet
  const weeklyDataset = analyticsData?.weeklyData?.length > 0 
    ? analyticsData.weeklyData.map((d: any) => ({
        day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d._id - 1] || 'Day',
        patients: d.count,
        avgDuration: Math.round(d.avgDuration)
      }))
    : [
        { day: 'Mon', patients: 12, avgDuration: 8 },
        { day: 'Tue', patients: 19, avgDuration: 7 },
        { day: 'Wed', patients: 15, avgDuration: 9 },
        { day: 'Thu', patients: 22, avgDuration: 6 },
        { day: 'Fri', patients: 30, avgDuration: 10 },
        { day: 'Sat', patients: 8, avgDuration: 7 }
      ];

  const hourlyDataset = analyticsData?.hourlyData?.length > 0
    ? analyticsData.hourlyData.map((d: any) => ({
        hour: `${d._id}:00`,
        patients: d.count
      }))
    : [
        { hour: '09:00', patients: 5 },
        { hour: '10:00', patients: 12 },
        { hour: '11:00', patients: 15 },
        { hour: '12:00', patients: 8 },
        { hour: '02:00', patients: 10 },
        { hour: '03:00', patients: 14 },
        { hour: '04:00', patients: 6 }
      ];

  const statusPieData = analyticsData?.statusCounts?.length > 0
    ? analyticsData.statusCounts.map((s: any) => ({ name: s._id, value: s.count }))
    : [
        { name: 'Completed', value: 72 },
        { name: 'Cancelled', value: 14 },
        { name: 'No Show', value: 8 }
      ];

  const COLORS = ['#5A8DEE', '#EC4899', '#F59E0B', '#34D399'];

  return (
    <Layout>
      <div className="space-y-6 max-w-7xl mx-auto">
        
        {/* Sync panel */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-200/50 dark:border-slate-700/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Clinic Analytics</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Review clinical flow rates and duration metrics</p>
          </div>
          <button 
            onClick={fetchAnalytics}
            className="neu-btn px-4 py-2 flex items-center space-x-1.5"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Top metrics grids */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="neu-flat p-6 flex items-center space-x-4">
            <div className="w-12 h-12 bg-primaryBlue/10 rounded-medium flex items-center justify-center text-primaryBlue">
              <Users size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Average Patients / Day</p>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white">18.5</h3>
            </div>
          </div>

          <div className="neu-flat p-6 flex items-center space-x-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-medium flex items-center justify-center text-amber-500">
              <Hourglass size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Avg Consultation Duration</p>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                {analyticsData?.averages?.avgConsultation ? `${Math.round(analyticsData.averages.avgConsultation)} mins` : '7.8 mins'}
              </h3>
            </div>
          </div>

          <div className="neu-flat p-6 flex items-center space-x-4">
            <div className="w-12 h-12 bg-[#34D399]/10 rounded-medium flex items-center justify-center text-[#34D399]">
              <CheckSquare size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Consultations Completed</p>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                {analyticsData?.averages?.avgWaiting ? 'Seeded Data active' : '150+'}
              </h3>
            </div>
          </div>
        </div>

        {/* Visual Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Daily Visitors chart */}
          <div className="neu-flat p-6 space-y-4">
            <h3 className="font-bold text-sm text-slate-600 dark:text-slate-300 flex items-center space-x-2">
              <Activity size={16} className="text-primaryBlue" />
              <span>Weekly Visitor Load & Duration</span>
            </h3>
            <div className="h-72 w-full text-xs font-medium">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyDataset}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="patients" fill="#5A8DEE" name="Patients Count" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="avgDuration" fill="#34D399" name="Avg Duration (Mins)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Peak hour Heatmap line chart */}
          <div className="neu-flat p-6 space-y-4">
            <h3 className="font-bold text-sm text-slate-600 dark:text-slate-300 flex items-center space-x-2">
              <Clock size={16} className="text-primaryBlue" />
              <span>Peak Hours Throughout The Day</span>
            </h3>
            <div className="h-72 w-full text-xs font-medium">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyDataset}>
                  <defs>
                    <linearGradient id="colorPat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5A8DEE" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#5A8DEE" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="patients" stroke="#5A8DEE" strokeWidth={2} fillOpacity={1} fill="url(#colorPat)" name="Patient Count" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Appointment status Pie Breakdown */}
          <div className="neu-flat p-6 space-y-4">
            <h3 className="font-bold text-sm text-slate-600 dark:text-slate-300">Appointment Status Metrics</h3>
            <div className="h-72 w-full flex flex-col sm:flex-row items-center justify-around text-xs font-medium">
              <div className="w-full sm:w-1/2 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusPieData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2.5">
                {statusPieData.map((item: any, idx: number) => (
                  <div key={item.name} className="flex items-center space-x-2">
                    <div className="w-3.5 h-3.5 rounded" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="font-semibold text-slate-600 dark:text-slate-300">{item.name}: {item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

      </div>
    </Layout>
  );
}
