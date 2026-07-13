import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { useStore } from '../../store/useStore';
import { History, Calendar, Clock, RefreshCw, Search, CheckCircle, XCircle, Clock4 } from 'lucide-react';

interface AppointmentRecord {
  _id: string;
  appointmentDate: string;
  appointmentTime: string;
  queueNumber: number;
  actualConsultationDuration?: number;
  predictedWaitingTime?: number;
  status: 'Waiting' | 'Consulting' | 'Completed' | 'Cancelled' | 'No Show' | 'Skipped';
  chiefComplaint?: string;
  doctorId?: {
    doctorName: string;
    specialization: string;
    hospitalName: string;
  };
}

export default function PatientHistory() {
  const { token } = useStore();
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const fetchHistory = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('http://localhost:5000/api/patient/appointments', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setAppointments(res.data.data);
      }
    } catch (err) {
      setError('Failed to retrieve appointment history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [token]);

  // Filter logic
  const filteredAppointments = appointments.filter((appt) => {
    const doctorName = appt.doctorId?.doctorName || '';
    const matchesSearch = doctorName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (appt.chiefComplaint && appt.chiefComplaint.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'All' || appt.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'Cancelled':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'Waiting':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse';
      case 'Consulting':
        return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
      default:
        return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-6xl mx-auto">
        
        {/* Search and Filters row */}
        <div className="neu-flat p-6 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full max-w-md">
            <Search size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by doctor or symptoms..."
              className="neu-input w-full pl-icon-input"
            />
          </div>

          <div className="flex w-full md:w-auto items-center space-x-3.5">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="neu-input min-w-[140px]"
            >
              <option value="All">All Statuses</option>
              <option value="Waiting">Waiting</option>
              <option value="Consulting">Consulting</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="No Show">No Show</option>
            </select>

            <button 
              onClick={fetchHistory}
              className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-medium shadow hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* History Table/List */}
        {loading ? (
          <div className="neu-flat p-12 text-center text-slate-500">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-primaryBlue" />
            <span>Retrieving clinical history...</span>
          </div>
        ) : error ? (
          <div className="neu-flat p-8 text-center text-rose-500 font-semibold">
            {error}
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="neu-flat p-12 text-center text-slate-400 space-y-2">
            <History size={36} className="mx-auto text-slate-300" />
            <p>No appointment records found matching your filters.</p>
          </div>
        ) : (
          <div className="neu-flat p-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-700">
                    <th className="py-3 px-4 font-semibold">Date / Time</th>
                    <th className="py-3 px-4 font-semibold">Doctor</th>
                    <th className="py-3 px-4 font-semibold">Queue #</th>
                    <th className="py-3 px-4 font-semibold">Consultation Duration</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Symptoms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {filteredAppointments.map((appt) => (
                    <tr key={appt._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <Calendar size={14} className="text-slate-400" />
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {new Date(appt.appointmentDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-1">
                          <Clock size={12} />
                          <span>Slot: {appt.appointmentTime}</span>
                        </div>
                      </td>
                       <td className="py-4 px-4">
                        <p className="font-bold text-slate-800 dark:text-white">
                          {appt.doctorId?.doctorName || 'Dr. Avinash Singh'}
                        </p>
                        <p className="text-[10px] text-slate-400">{appt.doctorId?.specialization || 'Neurology'}</p>
                      </td>
                      <td className="py-4 px-4 font-bold text-primaryBlue">#{appt.queueNumber}</td>
                      <td className="py-4 px-4">
                        {appt.status === 'Completed' ? (
                          <div className="flex items-center space-x-1.5 text-xs text-slate-600 dark:text-slate-300">
                            <Clock4 size={14} className="text-emerald-500" />
                            <span>{appt.actualConsultationDuration || 7} mins</span>
                          </div>
                        ) : appt.status === 'Waiting' ? (
                          <span className="text-xs text-slate-400 font-medium">Est: {appt.predictedWaitingTime || 0}m</span>
                        ) : (
                          <span className="text-xs text-slate-400">--</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getStatusBadgeClass(appt.status)}`}>
                          {appt.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 max-w-[180px] truncate text-xs text-slate-500" title={appt.chiefComplaint}>
                        {appt.chiefComplaint || 'No symptoms noted'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
