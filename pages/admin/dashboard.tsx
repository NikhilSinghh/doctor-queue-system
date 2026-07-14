import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import LiveQueue from '../../components/LiveQueue';
import { useStore } from '../../store/useStore';
import { 
  Play, CheckSquare, PlusCircle, AlertOctagon, Coffee, Clock, 
  RefreshCw, CheckCircle2, UserCheck, Trash2 
} from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const { token, user, queueData, setQueueData } = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Route Guard
  useEffect(() => {
    if (token && user && !['Doctor', 'Receptionist', 'Super Admin'].includes(user.role)) {
      router.push('/patient/dashboard');
    }
  }, [token, user]);
  
  // Walk-in Form State
  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [walkinName, setWalkinName] = useState('');
  const [walkinMobile, setWalkinMobile] = useState('');
  const [walkinGender, setWalkinGender] = useState('Male');
  const [walkinComplaint, setWalkinComplaint] = useState('');
  const [walkinIsEmergency, setWalkinIsEmergency] = useState(false);
  const [walkinAge, setWalkinAge] = useState('');
  const [walkinDate, setWalkinDate] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  // Doctor Delay / Lunch status state
  const [delay, setDelay] = useState(0);
  const [isLunch, setIsLunch] = useState(false);
  const [doctorStatus, setDoctorStatus] = useState('Available');
  
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const doctorId = user?.doctorId || '66914b48bcde36814b72648a'; 

  const fetchQueue = async (dateStr?: string) => {
    if (!token) return;
    const targetDate = dateStr || selectedDate;
    try {
      const res = await axios.get(`http://localhost:5000/api/admin/queue/live?doctorId=${doctorId}&date=${targetDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setQueueData(res.data.data);
        setDelay(res.data.data.doctorDelay);
        setIsLunch(res.data.data.lunchDelay > 0);
        setDoctorStatus(res.data.data.doctorStatus);
      }
    } catch (err) {
      setError('Failed to fetch queue list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [token, selectedDate]);

  useEffect(() => {
    if (showWalkinModal) {
      setWalkinDate(selectedDate);
    }
  }, [showWalkinModal, selectedDate]);

  // Handle Start Consultation
  const handleStartConsultation = async (apptId: string) => {
    try {
      const res = await axios.post('http://localhost:5000/api/admin/consultation/start', {
        appointmentId: apptId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        fetchQueue();
      }
    } catch (err) {
      alert('Error starting consultation');
    }
  };

  // Handle Complete Consultation
  const handleCompleteConsultation = async (apptId: string) => {
    try {
      const res = await axios.post('http://localhost:5000/api/admin/consultation/complete', {
        appointmentId: apptId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        fetchQueue();
      }
    } catch (err) {
      alert('Error completing consultation');
    }
  };

  // Handle Cancellation
  const handleCancelAppointment = async (apptId: string) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      const res = await axios.put(`http://localhost:5000/api/patient/cancel/${apptId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        fetchQueue();
      }
    } catch (err) {
      alert('Error cancelling appointment');
    }
  };

  // Update Status / Delay / Lunch
  const handleUpdateDoctorStatus = async (newStatus: string, delayMinutes: number, lunchValue: boolean) => {
    try {
      const res = await axios.post('http://localhost:5000/api/admin/doctor/status', {
        doctorId,
        status: newStatus,
        delayMinutes,
        isLunch: lunchValue
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setDoctorStatus(newStatus);
        setDelay(delayMinutes);
        setIsLunch(lunchValue);
        fetchQueue();
      }
    } catch (err) {
      alert('Error updating doctor settings');
    }
  };

  // Submit Walk-in / Emergency
  const handleWalkinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);

    try {
      const birthYear = new Date().getFullYear() - (parseInt(walkinAge) || 30);
      const dob = `${birthYear}-01-01`;

      const res = await axios.post('http://localhost:5000/api/admin/walkin', {
        fullName: walkinName,
        mobileNumber: walkinMobile,
        gender: walkinGender,
        dateOfBirth: dob,
        chiefComplaint: walkinComplaint,
        isEmergency: walkinIsEmergency,
        doctorId,
        appointmentDate: walkinDate
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setShowWalkinModal(false);
        setWalkinName('');
        setWalkinMobile('');
        setWalkinAge('');
        setWalkinComplaint('');
        setWalkinIsEmergency(false);
        fetchQueue();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to register walk-in patient.');
    } finally {
      setModalLoading(false);
    }
  };

  const consultingPatient = queueData?.queueList?.find(p => p.status === 'Consulting');
  const waitingPatients = queueData?.queueList?.filter(p => p.status === 'Waiting') || [];

  return (
    <Layout>
      <div className="space-y-6 max-w-7xl mx-auto">
        
        {/* Top Control Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Quick Actions Panel */}
          <div className="neu-flat p-6 space-y-4">
            <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider">Lobby Controls</h3>
            <div className="grid grid-cols-2 gap-3.5">
              <button 
                onClick={() => setShowWalkinModal(true)}
                className="neu-btn bg-white dark:bg-slate-800 text-slate-800 dark:text-white flex flex-col items-center justify-center p-4 hover:bg-slate-50 space-y-2 h-24"
              >
                <PlusCircle size={20} className="text-primaryBlue" />
                <span className="text-xs font-bold">Add Walk-In</span>
              </button>

              <button 
                onClick={() => {
                  const targetStatus = isLunch ? 'Available' : 'Lunch Break';
                  handleUpdateDoctorStatus(targetStatus, delay, !isLunch);
                }}
                className={`neu-btn flex flex-col items-center justify-center p-4 space-y-2 h-24 ${
                  isLunch ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white'
                }`}
              >
                <Coffee size={20} className={isLunch ? 'text-white' : 'text-amber-500'} />
                <span className="text-xs font-bold">{isLunch ? 'End Lunch' : 'Lunch Break'}</span>
              </button>
            </div>
          </div>

          {/* Delay Manager */}
          <div className="neu-flat p-6 space-y-4">
            <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider">Report Clinic Delays</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-500">Current Delay:</span>
                <span className="text-lg font-black text-rose-500">{delay} mins</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="60" 
                step="5"
                value={delay} 
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setDelay(val);
                  handleUpdateDoctorStatus(doctorStatus, val, isLunch);
                }}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primaryBlue"
              />
              <p className="text-[10px] text-slate-400">Drag to instantly shift all waiting patient timelines.</p>
            </div>
          </div>

          {/* Status Monitor */}
          <div className="neu-flat p-6 flex justify-between items-center">
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider">Clinical Status</h3>
              <p className="text-2xl font-black text-slate-800 dark:text-white capitalize">{doctorStatus}</p>
              <p className="text-[10px] text-slate-400">Updates live for all patient devices</p>
            </div>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => {
                  setDelay(0);
                  handleUpdateDoctorStatus('Available', 0, false);
                }} 
                className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded text-xs font-bold border border-emerald-500/20"
              >
                Available
              </button>
              <button 
                onClick={() => handleUpdateDoctorStatus('Running Late', delay, false)} 
                className="px-3 py-1 bg-amber-500/10 text-amber-500 rounded text-xs font-bold border border-amber-500/20"
              >
                Running Late
              </button>
            </div>
          </div>
        </div>

        {/* Live Queue Representation */}
        <LiveQueue 
          queueList={queueData?.queueList || []} 
          currentServingNumber={queueData?.currentServingNumber || 0} 
        />

        {/* Patients Orchestration List */}
        <div className="neu-flat p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 dark:border-slate-700/80 mb-5 gap-3">
            <div className="flex items-center space-x-4">
              <h3 className="font-bold text-slate-800 dark:text-white">Active Queue Registry</h3>
              
              {/* Date selector to check bookings for other days */}
              <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-medium border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Target Date:</span>
                <input 
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-xs font-semibold bg-transparent border-none outline-none text-slate-700 dark:text-slate-200 cursor-pointer"
                />
              </div>
            </div>
            
            <button onClick={() => fetchQueue(selectedDate)} className="p-2 text-slate-400 hover:text-slate-650 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm">
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-700">
                  <th className="py-3 px-4 font-semibold">Token</th>
                  <th className="py-3 px-4 font-semibold">Patient Name</th>
                  <th className="py-3 px-4 font-semibold">Type</th>
                  <th className="py-3 px-4 font-semibold">Est. Wait</th>
                  <th className="py-3 px-4 font-semibold">Symptoms</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {queueData?.queueList?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">No active queue entries.</td>
                  </tr>
                ) : (
                  queueData?.queueList?.map((appt) => (
                    <tr key={appt.appointmentId} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 ${appt.status === 'Consulting' ? 'bg-primaryBlue/5 dark:bg-primaryBlue/10 font-medium' : ''}`}>
                      <td className="py-4 px-4 font-bold text-primaryBlue">#{appt.queueNumber || '--'}</td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-bold text-slate-800 dark:text-white">{appt.patient?.fullName || 'Walk-in Patient'}</p>
                          <p className="text-[10px] text-slate-400">{appt.patient?.gender}, Age {appt.patient?.age || '--'}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          appt.priority === 'Emergency'
                            ? 'bg-rose-500 text-white animate-pulse'
                            : appt.priority === 'Walk-in'
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                        }`}>
                          {appt.priority}
                        </span>
                      </td>
                      <td className="py-4 px-4">{appt.predictedWaitingTime !== null ? `${appt.predictedWaitingTime} mins` : '--'}</td>
                      <td className="py-4 px-4 max-w-[200px] truncate text-xs text-slate-500">{appt.chiefComplaint || 'No symptoms noted'}</td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex justify-end space-x-2">
                          {appt.status === 'Waiting' ? (
                            <>
                              <button 
                                onClick={() => handleStartConsultation(appt.appointmentId)}
                                className="p-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors"
                                title="Start Consultation"
                              >
                                <Play size={14} />
                              </button>
                              <button 
                                onClick={() => handleCancelAppointment(appt.appointmentId)}
                                className="p-2 bg-rose-500 text-white rounded hover:bg-rose-600 transition-colors"
                                title="Cancel"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={() => handleCompleteConsultation(appt.appointmentId)}
                              className="p-2.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 flex items-center space-x-1"
                            >
                              <CheckSquare size={14} />
                              <span className="text-xs font-bold">Complete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Walk-in Form Modal */}
        {showWalkinModal && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-40">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-large max-w-md w-full shadow-2xl border border-slate-200/50 dark:border-slate-700 space-y-6">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-700">
                <h3 className="font-bold text-slate-800 dark:text-white">Register Walk-In Patient</h3>
                <button onClick={() => setShowWalkinModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleWalkinSubmit} className="space-y-4 text-xs font-semibold">
                
                {queueData && queueData.queueList && queueData.maxPatientsPerDay && queueData.queueList.length >= queueData.maxPatientsPerDay && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-600 rounded-medium text-[11px] font-bold border border-amber-200 dark:border-amber-900/50 flex items-start space-x-2">
                    <AlertOctagon size={16} className="shrink-0 text-amber-500 mt-0.5" />
                    <span>
                      ⚠️ Reminder: The maximum daily booking limit of {queueData.maxPatientsPerDay} patients has already been reached. Staff can override, but please confirm with the patient.
                    </span>
                  </div>
                )}

                <div className="flex flex-col space-y-1">
                  <label className="text-slate-400 uppercase">Patient Full Name *</label>
                  <input 
                    type="text" 
                    value={walkinName}
                    onChange={(e) => setWalkinName(e.target.value)}
                    placeholder="e.g. John Watson"
                    className="neu-input w-full p-2.5"
                    required
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-slate-400 uppercase">Mobile Number *</label>
                  <input 
                    type="tel" 
                    value={walkinMobile}
                    onChange={(e) => setWalkinMobile(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="neu-input w-full p-2.5"
                    required
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-slate-400 uppercase">Patient Age *</label>
                  <input 
                    type="number" 
                    min={1}
                    max={120}
                    value={walkinAge}
                    onChange={(e) => setWalkinAge(e.target.value)}
                    placeholder="e.g. 35"
                    className="neu-input w-full p-2.5"
                    required
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-slate-400 uppercase">Appointment Date *</label>
                  <input 
                    type="date" 
                    value={walkinDate}
                    onChange={(e) => setWalkinDate(e.target.value)}
                    className="neu-input w-full p-2.5"
                    required
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-slate-400 uppercase">Gender</label>
                  <select 
                    value={walkinGender}
                    onChange={(e) => setWalkinGender(e.target.value)}
                    className="neu-input w-full"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-slate-400 uppercase">Chief Complaint Symptoms *</label>
                  <textarea 
                    value={walkinComplaint}
                    onChange={(e) => setWalkinComplaint(e.target.value)}
                    placeholder="Brief description of clinical complaints..."
                    className="neu-input w-full p-2.5 min-h-[70px] resize-none"
                    required
                  />
                </div>

                <div className="flex items-center space-x-2.5 pt-2">
                  <input 
                    type="checkbox" 
                    id="emergency"
                    checked={walkinIsEmergency}
                    onChange={(e) => setWalkinIsEmergency(e.target.checked)}
                    className="w-4 h-4 text-rose-500 rounded focus:ring-rose-500 border-slate-300 accent-rose-500"
                  />
                  <label htmlFor="emergency" className="text-rose-500 font-bold uppercase select-none flex items-center space-x-1 cursor-pointer">
                    <AlertOctagon size={14} className="animate-pulse" />
                    <span>Emergency Case (Queue Priority High)</span>
                  </label>
                </div>

                <button 
                  type="submit" 
                  disabled={modalLoading}
                  className="neu-btn w-full bg-primaryBlue text-white hover:bg-opacity-95 py-3 mt-4"
                >
                  {modalLoading ? 'Registering...' : 'Register and Insert to Queue'}
                </button>

              </form>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
