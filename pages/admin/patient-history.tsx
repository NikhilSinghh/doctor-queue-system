import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useStore } from '../../store/useStore';
import Layout from '../../components/Layout';
import { Calendar, Search, History, User, Phone, Clipboard, ArrowLeft, ArrowRight } from 'lucide-react';

interface Patient {
  fullName: string;
  mobileNumber: string;
  gender: string;
  age: number | string;
}

interface Appointment {
  appointmentId: string;
  queueNumber: number;
  priority: string;
  status: string;
  chiefComplaint: string;
  patient: Patient;
}

export default function PatientHistoryPage() {
  const { token, user } = useStore();
  const doctorId = user?.doctorId || '66914b48bcde36814b72648a';

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchHistory = async (dateStr: string) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`http://localhost:5000/api/admin/patients/history?doctorId=${doctorId}&date=${dateStr}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setAppointments(res.data.data);
      } else {
        setError('Failed to load patient history.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error connecting to the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(selectedDate);
  }, [token, selectedDate]);

  const handleDateChange = (daysOffset: number) => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + daysOffset);
    const yyyy = currentDate.getFullYear();
    const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dd = String(currentDate.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Consulting':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'Completed':
      case 'Consulted':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'Waiting':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'Cancelled':
      case 'No Show':
      case 'Skipped':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const filteredAppointments = appointments.filter((appt) => {
    const query = searchQuery.toLowerCase();
    return (
      appt.patient.fullName.toLowerCase().includes(query) ||
      appt.patient.mobileNumber.includes(query) ||
      appt.chiefComplaint.toLowerCase().includes(query) ||
      appt.queueNumber.toString().includes(query)
    );
  });

  return (
    <Layout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header Title Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primaryBlue font-bold text-sm uppercase tracking-wider">
              <History size={16} />
              <span>Clinical Registry</span>
            </div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
              Patient History Logs
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Browse, filter, and audit all past and scheduled consultations
            </p>
          </div>

          {/* Date Picker Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDateChange(-1)}
              className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              title="Previous Day"
            >
              <ArrowLeft size={16} />
            </button>

            <div className="relative">
              <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-primaryBlue"
              />
            </div>

            <button
              onClick={() => handleDateChange(1)}
              className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              title="Next Day"
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Search Bar Section */}
        <div className="relative max-w-md">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, phone, token, or symptoms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primaryBlue placeholder-slate-400 shadow-sm"
          />
        </div>

        {/* Loader/Errors */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="w-10 h-10 border-4 border-primaryBlue border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">Retrieving clinical registry logs...</p>
          </div>
        ) : error ? (
          <div className="neu-flat p-6 border border-rose-500/20 text-rose-500 bg-rose-500/5 text-center rounded-xl font-bold text-sm">
            {error}
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="neu-flat py-16 text-center rounded-xl text-slate-500 dark:text-slate-400 space-y-2">
            <Clipboard size={40} className="mx-auto text-slate-300 dark:text-slate-600" />
            <p className="font-bold text-base">No Patient Logs Found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              There are no appointments registered or matching filters on this day.
            </p>
          </div>
        ) : (
          /* Patients Registry Table */
          <div className="neu-flat overflow-hidden rounded-xl border border-slate-200/50 dark:border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <th className="py-4 px-6 text-center w-24">Token No.</th>
                    <th className="py-4 px-6">Patient Profile</th>
                    <th className="py-4 px-6">Contact details</th>
                    <th className="py-4 px-6">Age / Gender</th>
                    <th className="py-4 px-6">Reported Symptoms</th>
                    <th className="py-4 px-6 text-center w-36">Consultation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {filteredAppointments.map((appt) => (
                    <tr
                      key={appt.appointmentId}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all"
                    >
                      {/* Token Number */}
                      <td className="py-4 px-6 text-center font-black text-primaryBlue text-base">
                        #{appt.queueNumber}
                      </td>

                      {/* Patient Name */}
                      <td className="py-4 px-6 font-bold text-slate-800 dark:text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            <User size={16} />
                          </div>
                          <span>{appt.patient.fullName}</span>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="py-4 px-6 text-slate-600 dark:text-slate-300 font-semibold">
                        <div className="flex items-center gap-2">
                          <Phone size={14} className="text-slate-400" />
                          <span>{appt.patient.mobileNumber}</span>
                        </div>
                      </td>

                      {/* Age / Gender */}
                      <td className="py-4 px-6 text-slate-600 dark:text-slate-300 font-semibold capitalize">
                        {appt.patient.age} yrs • {appt.patient.gender.toLowerCase()}
                      </td>

                      {/* Symptoms */}
                      <td className="py-4 px-6 text-slate-600 dark:text-slate-300 italic font-medium max-w-xs truncate">
                        {appt.chiefComplaint}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex px-3 py-1.5 rounded-full text-xs font-bold border capitalize shadow-sm ${getStatusBadgeClass(appt.status)}`}>
                          {appt.status}
                        </span>
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
