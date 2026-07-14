import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import LiveQueue from '../../components/LiveQueue';
import { useStore } from '../../store/useStore';
import { User, Clock, Calendar, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export default function PatientDashboard() {
  const { token, user, queueData, setQueueData } = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [localTravelTime, setLocalTravelTime] = useState(15);
  const [savingTravelTime, setSavingTravelTime] = useState(false);

  useEffect(() => {
    if (user?.travelTime !== undefined) {
      setLocalTravelTime(user.travelTime);
    }
  }, [user]);

  const handleUpdateTravelTime = async (newVal: number) => {
    setLocalTravelTime(newVal);
    if (!token) return;
    setSavingTravelTime(true);
    try {
      const res = await axios.put('http://localhost:5000/api/patient/profile', {
        travelTime: newVal
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        // Sync local storage / Zustand store
        const { login } = useStore.getState();
        if (user) {
          login({ ...user, travelTime: newVal }, token);
        }
      }
    } catch (err) {
      console.error('Failed to save travel time', err);
    } finally {
      setSavingTravelTime(false);
    }
  };
  
  // Seed doctor id for demo purposes. In real system fetched from list or selected during booking.
  const doctorId = '66914b48bcde36814b72648a'; 

  const fetchLiveQueueData = async () => {
    if (!token) return;
    setError('');
    try {
      const res = await axios.get(`http://localhost:5000/api/admin/queue/live?doctorId=${doctorId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setQueueData(res.data.data);
      }
    } catch (err: any) {
      setError('Could not establish real-time connection to queue database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveQueueData();
  }, [token]);

  // Find user's active appointment in the queue list
  const myQueueItem = queueData?.queueList?.find(item => item.isMine);
  
  // Calculate position & patients ahead
  const myIndex = queueData?.queueList ? queueData.queueList.findIndex(item => item.isMine) : -1;
  const patientsAhead = myIndex > 0 ? myIndex : 0;
  
  // Calculate waiting details
  const myApptTime = myQueueItem?.predictedConsultationTime 
    ? new Date(myQueueItem.predictedConsultationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--';
  const myWaitingTime = (myQueueItem?.predictedWaitingTime !== undefined && myQueueItem?.predictedWaitingTime !== null) 
    ? myQueueItem.predictedWaitingTime 
    : null;

  return (
    <Layout>
      <div className="space-y-6 max-w-6xl mx-auto">
        
        {/* Top Info Header Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Welcome Card */}
          <div className="neu-flat p-6 flex items-center space-x-4">
            <div className="w-12 h-12 bg-primaryBlue/10 rounded-medium flex items-center justify-center text-primaryBlue shrink-0">
              <User size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Patient Name</p>
              <h3 className="font-bold text-lg text-slate-800 dark:text-white truncate max-w-[200px]">{user?.fullName}</h3>
              <p className="text-xs text-emerald-500 font-semibold">Active Session Connected</p>
            </div>
          </div>

          {/* Doctor Status Card */}
          <div className="neu-flat p-6 flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-medium flex items-center justify-center shrink-0 ${
              queueData?.doctorStatus === 'Available' || queueData?.doctorStatus === 'Consulting'
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-amber-500/10 text-amber-500'
            }`}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Doctor Status</p>
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">{queueData?.doctorStatus || 'Offline'}</h3>
              {queueData && queueData.doctorStatus === 'Running Late' && queueData.doctorDelay > 0 ? (
                <p className="text-xs text-amber-500 font-semibold flex items-center space-x-1">
                  <AlertTriangle size={12} />
                  <span>Running Late: {queueData.doctorDelay} mins</span>
                </p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Currently on schedule</p>
              )}
            </div>
          </div>

          {/* Sync Trigger Card */}
          <div className="neu-flat p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Lobby Updates</p>
              <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">Live Queue Streaming</h3>
              <p className="text-[10px] text-slate-400">Updates instantly via websockets</p>
            </div>
            <button onClick={fetchLiveQueueData} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-medium shadow hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 hover:rotate-180 transition-all duration-300">
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {/* Dynamic Personal Appointment Tracker */}
        {myQueueItem ? (
          <div className="neu-flat p-6 bg-gradient-to-r from-blue-50/50 to-indigo-50/10 dark:from-slate-800 dark:to-indigo-950/20 border-l-4 border-primaryBlue space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center sm:text-left">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Position</p>
                <p className="text-3xl font-extrabold text-primaryBlue">{myIndex + 1}</p>
                <p className="text-[10px] text-slate-400">Token Number #{myQueueItem.queueNumber}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Patients Ahead</p>
                <p className="text-3xl font-extrabold text-slate-700 dark:text-slate-300">{patientsAhead}</p>
                <p className="text-[10px] text-slate-400">Arrival queue lineup</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Est. Waiting Time</p>
                <p className="text-3xl font-extrabold text-slate-700 dark:text-slate-300 flex items-baseline justify-center sm:justify-start">
                  <span>{myWaitingTime !== null ? myWaitingTime : '--'}</span>
                  {myWaitingTime !== null && <span className="text-xs font-bold text-slate-400 ml-1">mins</span>}
                </p>
                <p className="text-[10px] text-slate-400">Predicted duration speed</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expected Turn</p>
                <p className="text-3xl font-extrabold text-[#34D399]">{myApptTime}</p>
                <p className="text-[10px] text-slate-400">Calculated consultation start</p>
              </div>
            </div>

            {/* Travel Time Settings and Leave warning alerts */}
            <div className="border-t border-slate-200/60 dark:border-slate-700/50 pt-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center space-x-3">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Your Travel Time:</span>
                <select
                  value={localTravelTime}
                  disabled={savingTravelTime}
                  onChange={(e) => handleUpdateTravelTime(parseInt(e.target.value))}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-primaryBlue"
                >
                  <option value={5}>5 Mins</option>
                  <option value={10}>10 Mins</option>
                  <option value={15}>15 Mins</option>
                  <option value={20}>20 Mins</option>
                  <option value={30}>30 Mins</option>
                  <option value={45}>45 Mins</option>
                  <option value={60}>60 Mins</option>
                </select>
              </div>

              {myWaitingTime !== null && (
                <div className="flex-1 w-full md:w-auto text-right">
                  {myWaitingTime <= localTravelTime ? (
                    <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded border border-rose-500/20 text-xs font-bold text-center md:text-left flex items-center justify-center space-x-1 animate-pulse">
                      <span>⚠️ Leave now! Your travel time is {localTravelTime} mins, and estimated wait is only {myWaitingTime} mins.</span>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-[#34D399] rounded border border-emerald-500/20 text-xs font-bold text-center md:text-left flex items-center justify-center space-x-1">
                      <span>🚗 Leave in {myWaitingTime - localTravelTime} mins to arrive exactly on time (Travel: {localTravelTime}m).</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="neu-flat p-8 text-center space-y-4">
            <p className="text-slate-500 dark:text-slate-400 font-medium">You do not have any active appointments for today.</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">Book a doctor appointment slot to get your queue tracking position and start prediction waiting diagnostics.</p>
          </div>
        )}

        {/* Live Queue Canvas Visualization */}
        {loading ? (
          <div className="neu-flat p-12 text-center text-slate-500">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-primaryBlue" />
            <span>Establishing live queue stream...</span>
          </div>
        ) : (
          <LiveQueue 
            queueList={queueData?.queueList || []} 
            currentServingNumber={queueData?.currentServingNumber || 0} 
          />
        )}

      </div>
    </Layout>
  );
}
