import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { useStore } from '../../store/useStore';
import { Calendar, Clock, Clipboard, FileText, CheckCircle2, Ticket, QrCode, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function BookAppointment() {
  const router = useRouter();
  const { token } = useStore();

  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('11:00 AM');
  const [complaint, setComplaint] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmedAppt, setConfirmedAppt] = useState<any>(null);

  // New patient and emergency states
  const [isBookingForSelf, setIsBookingForSelf] = useState(true);
  const [patientName, setPatientName] = useState('');
  const [patientMobile, setPatientMobile] = useState('');
  const [patientGender, setPatientGender] = useState('Male');
  const [patientAge, setPatientAge] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);

  // Doctor configuration variables
  const doctorId = '66914b48bcde36814b72648a'; 
  const [doctorProfile, setDoctorProfile] = useState<any>(null);
  const [dateValidationError, setDateValidationError] = useState('');
  const [selectedDateQueueLength, setSelectedDateQueueLength] = useState(0);

  // Calendar states
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());

  const getDaysArray = () => {
    const days = [];
    const dateHelper = new Date(currentYear, currentMonth, 1);
    const startDay = dateHelper.getDay();
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Fill blank cells
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    // Fill days
    for (let d = 1; d <= totalDays; d++) {
      days.push(d);
    }

    return days;
  };

  const handleDayClick = (dayNum: number) => {
    const today = new Date();
    today.setHours(0,0,0,0);

    const targetDateObj = new Date(currentYear, currentMonth, dayNum);
    const targetDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

    if (targetDateObj < today) {
      setDateValidationError('Past dates are not allowed.');
      setError('Past dates are not allowed.');
      return;
    }

    const dayOfWeek = targetDateObj.getDay();
    const isWeeklyOff = doctorProfile?.weeklyOff?.includes(dayOfWeek);
    const isHoliday = doctorProfile?.specialHolidays?.some((hDate: string) => {
      return hDate.split('T')[0] === targetDateStr;
    });

    if (isWeeklyOff || isHoliday) {
      const reason = isWeeklyOff ? 'weekend off' : 'Doctor on leave';
      setDateValidationError(`Selected date is a ${reason}.`);
      setError(`Selected date is a ${reason}.`);
      return;
    }

    setDate(targetDateStr);
    setDateValidationError('');
    setError('');
  };

  const changeMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  useEffect(() => {
    const fetchDoctor = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/patient/doctor/${doctorId}`);
        if (res.data.success) {
          setDoctorProfile(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load doctor configurations.');
      }
    };
    fetchDoctor();
  }, []);

  useEffect(() => {
    if (!token) {
      setIsBookingForSelf(false);
    }
  }, [token]);

  useEffect(() => {
    if (!date) return;
    const fetchSelectedDateQueue = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/patient/queue/public?doctorId=${doctorId}&date=${date}`);
        if (res.data.success) {
          setSelectedDateQueueLength(res.data.data.queueList?.length || 0);
        }
      } catch (err) {
        console.error('Failed to fetch queue list for date:', date);
      }
    };
    fetchSelectedDateQueue();
  }, [date]);





  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (doctorProfile?.bookingsEnabled === false) {
      setError('Online bookings are temporarily suspended by the clinic.');
      return;
    }

    if (!date || !slot) {
      setError('Please select an appointment date and time slot.');
      return;
    }

    setLoading(true);

    try {
      const bookingPayload: any = {
        doctorId,
        appointmentDate: date,
        appointmentTime: slot,
        chiefComplaint: complaint,
        notes: notes || undefined,
        isEmergency,
      };

      if (!isBookingForSelf) {
        bookingPayload.patientName = patientName;
        bookingPayload.patientMobile = patientMobile;
        bookingPayload.patientGender = patientGender;
        bookingPayload.patientAge = patientAge;
      }

      const res = await axios.post('http://localhost:5000/api/patient/book', bookingPayload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setConfirmedAppt(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error booking appointment slot.');
    } finally {
      setLoading(false);
    }
  };

  if (confirmedAppt) {
    return (
      <Layout>
        <div className="max-w-md mx-auto space-y-6">
          <div className="neu-flat p-8 text-center space-y-6">
            
            {/* Header animation */}
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/20 rounded-full flex items-center justify-center text-emerald-500 mx-auto">
              <CheckCircle2 size={36} className="animate-bounce" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Booking Confirmed!</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Appointment scheduled with {doctorProfile?.doctorName || 'Dr. Avinash Singh'}</p>
            </div>

            {/* Token Badge */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-medium border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between">
              <div className="text-left space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Queue Token</p>
                <p className="text-2xl font-black text-primaryBlue">#{confirmedAppt.queueNumber}</p>
              </div>
              <Ticket className="text-primaryBlue opacity-60" size={32} />
            </div>

            {/* Details table */}
            <div className="space-y-3.5 text-sm border-t border-slate-100 dark:border-slate-700 pt-4 text-left">
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{new Date(confirmedAppt.appointmentDate).toDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Time Slot:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{confirmedAppt.appointmentTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Department:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{doctorProfile?.specialization || 'Neurology (MBBS, MD, DM (Neurology))'}</span>
              </div>
            </div>

            {/* Visual Mock QR Code block */}
            <div className="p-5 bg-white dark:bg-slate-700 rounded-medium border border-slate-200/50 dark:border-slate-600 flex flex-col items-center space-y-2.5">
              <QrCode size={120} className="text-slate-700 dark:text-white" />
              <span className="text-[10px] text-slate-400 dark:text-slate-300 font-bold uppercase tracking-widest">Scan at Clinic Reception</span>
            </div>

            <div className="flex flex-col gap-3">
              <Link href="/patient/dashboard" className="neu-btn bg-primaryBlue text-white text-center py-3">
                Track Live Queue
              </Link>
              <button onClick={() => setConfirmedAppt(null)} className="text-sm text-slate-500 hover:text-slate-700">
                Book Another Appointment
              </button>
            </div>

          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="neu-flat p-8 space-y-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100 dark:border-slate-700/80">
            <div className="w-10 h-10 bg-primaryBlue/10 rounded-medium flex items-center justify-center text-primaryBlue">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Book Doctor Slot</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Fill in symptoms to get dynamic duration calculation</p>
            </div>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-medium text-xs font-semibold border border-rose-100/50">
              {error}
            </div>
          )}

          {doctorProfile && doctorProfile.bookingsEnabled === false && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-medium text-xs font-bold text-rose-500 space-y-1">
              <p className="text-sm">🛑 Online Bookings Suspended</p>
              <p className="font-semibold text-slate-500 dark:text-slate-400">The clinic is temporarily not accepting online bookings. Please contact the clinic receptionist directly.</p>
            </div>
          )}

          <form onSubmit={handleBooking} className="space-y-6">
            
            {/* Doctor detail panel */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-medium border border-slate-200/50 dark:border-slate-700/40 flex flex-col space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-sm text-slate-800 dark:text-white">{doctorProfile?.doctorName || 'Dr. Avinash Singh'}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {doctorProfile?.specialization || 'Neurology'} ({doctorProfile?.qualification || 'MBBS, MD, DM'}) • {doctorProfile?.experience || 13} Years Exp.
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 text-[10px] font-bold rounded-full uppercase shrink-0">Active</span>
              </div>
              <div className="text-[11px] text-slate-500 border-t border-slate-200/50 dark:border-slate-700/30 pt-2 flex flex-wrap gap-x-4">
                <span>Normal: <b className="text-slate-700 dark:text-slate-200">₹{doctorProfile?.feesNormal || 600}</b></span>
                <span>Emergency: <b className="text-slate-700 dark:text-slate-200">₹{doctorProfile?.feesEmergency || 1000}</b></span>
                <span>Follow-up: <b className="text-slate-700 dark:text-slate-200">₹{doctorProfile?.feesFollowUp || 500}</b></span>
              </div>
            </div>

            {/* Who is this booking for? */}
            {token ? (
              <div className="flex flex-col space-y-3.5 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-medium border border-slate-200/50 dark:border-slate-700/40">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Appointment For</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setIsBookingForSelf(true)}
                    className={`py-2 px-3 text-xs font-bold rounded-medium transition-all ${
                      isBookingForSelf
                        ? 'bg-primaryBlue text-white shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Book for Myself
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBookingForSelf(false)}
                    className={`py-2 px-3 text-xs font-bold rounded-medium transition-all ${
                      !isBookingForSelf
                        ? 'bg-primaryBlue text-white shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Book for Family / Other
                  </button>
                </div>

                {/* Conditional Patient Details */}
                {!isBookingForSelf && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4 pt-3.5 border-t border-slate-200/40 dark:border-slate-700/30 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold"
                  >
                    <div className="flex flex-col space-y-1.5 sm:col-span-2">
                      <label className="text-slate-400 uppercase">Patient Full Name *</label>
                      <input 
                        type="text" 
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="e.g. Marie Vance"
                        className="neu-input w-full p-2.5"
                        required={!isBookingForSelf}
                      />
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <label className="text-slate-400 uppercase">Mobile Number *</label>
                      <input 
                        type="tel" 
                        value={patientMobile}
                        onChange={(e) => setPatientMobile(e.target.value)}
                        placeholder="e.g. 9876543210"
                        className="neu-input w-full p-2.5"
                        required={!isBookingForSelf}
                      />
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <label className="text-slate-400 uppercase">Age *</label>
                      <input 
                        type="number" 
                        min={1}
                        max={120}
                        value={patientAge}
                        onChange={(e) => setPatientAge(e.target.value)}
                        placeholder="e.g. 45"
                        className="neu-input w-full p-2.5"
                        required={!isBookingForSelf}
                      />
                    </div>

                    <div className="flex flex-col space-y-1.5 sm:col-span-2">
                      <label className="text-slate-400 uppercase">Gender *</label>
                      <select
                        value={patientGender}
                        onChange={(e) => setPatientGender(e.target.value)}
                        className="neu-input w-full"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </motion.div>
                )}
              </div>
            ) : (
              <div className="flex flex-col space-y-3.5 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-medium border border-slate-200/50 dark:border-slate-700/40">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Patient Registration Information</label>
                <div className="space-y-4 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
                  <div className="flex flex-col space-y-1.5 sm:col-span-2">
                    <label className="text-slate-400 uppercase">Patient Full Name *</label>
                    <input 
                      type="text" 
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="e.g. Marie Vance"
                      className="neu-input w-full p-2.5"
                      required
                    />
                  </div>

                  <div className="flex flex-col space-y-1.5">
                    <label className="text-slate-400 uppercase">Mobile Number *</label>
                    <input 
                      type="tel" 
                      value={patientMobile}
                      onChange={(e) => setPatientMobile(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="neu-input w-full p-2.5"
                      required
                    />
                  </div>

                  <div className="flex flex-col space-y-1.5">
                    <label className="text-slate-400 uppercase">Age *</label>
                    <input 
                      type="number" 
                      min={1}
                      max={120}
                      value={patientAge}
                      onChange={(e) => setPatientAge(e.target.value)}
                      placeholder="e.g. 45"
                      className="neu-input w-full p-2.5"
                      required
                    />
                  </div>

                  <div className="flex flex-col space-y-1.5 sm:col-span-2">
                    <label className="text-slate-400 uppercase">Gender *</label>
                    <select
                      value={patientGender}
                      onChange={(e) => setPatientGender(e.target.value)}
                      className="neu-input w-full"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Interactive Calendar */}
            <div className="flex flex-col space-y-3.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Choose Appointment Date</label>
              
              <div className="p-4 bg-white dark:bg-slate-800/40 rounded-large border border-slate-200/50 dark:border-slate-700/50 shadow-sm space-y-4">
                {/* Month/Year selector header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60">
                  <button 
                    type="button" 
                    onClick={() => changeMonth('prev')}
                    className="p-1.5 rounded bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600"
                  >
                    ◀
                  </button>
                  <span className="text-xs font-bold text-slate-750 dark:text-white uppercase tracking-wider">
                    {new Date(currentYear, currentMonth).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <button 
                    type="button" 
                    onClick={() => changeMonth('next')}
                    className="p-1.5 rounded bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600"
                  >
                    ▶
                  </button>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="py-1">{d}</div>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1.5 text-xs font-semibold">
                  {getDaysArray().map((dayNum, index) => {
                    if (dayNum === null) {
                      return <div key={`empty-${index}`} />;
                    }

                    const today = new Date();
                    today.setHours(0,0,0,0);
                    const cellDate = new Date(currentYear, currentMonth, dayNum);
                    const cellDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    
                    const isSelected = date === cellDateStr;
                    const isPast = cellDate < today;
                    const dayOfWeek = cellDate.getDay();
                    const isWeeklyOff = doctorProfile?.weeklyOff?.includes(dayOfWeek);
                    const isHoliday = doctorProfile?.specialHolidays?.some((hDate: string) => {
                      return hDate.split('T')[0] === cellDateStr;
                    });

                    const isClosed = isWeeklyOff || isHoliday;

                    let btnClass = "py-2 text-center rounded transition-all ";
                    if (isPast) {
                      btnClass += "text-slate-300 dark:text-slate-600 cursor-not-allowed";
                    } else if (isClosed) {
                      btnClass += "bg-rose-50 dark:bg-rose-950/20 text-rose-500 border border-rose-200/50 dark:border-rose-900/35 hover:bg-rose-100 dark:hover:bg-rose-900/30";
                    } else if (isSelected) {
                      btnClass += "bg-primaryBlue text-white shadow-md";
                    } else {
                      btnClass += "bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600";
                    }

                    return (
                      <button
                        key={`day-${dayNum}`}
                        type="button"
                        onClick={() => handleDayClick(dayNum)}
                        className={btnClass}
                        disabled={isPast}
                      >
                        {dayNum}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Validation alert block */}
              {dateValidationError && (
                <p className="text-xs text-rose-500 font-semibold mt-1">⚠️ {dateValidationError}</p>
              )}
              {date && !dateValidationError && (
                <div>
                  {selectedDateQueueLength >= (doctorProfile?.maxPatientsPerDay || 30) ? (
                    <p className="text-xs text-rose-500 font-bold mt-1">
                      🛑 Booking limit reached. The doctor accepts a maximum of {doctorProfile?.maxPatientsPerDay || 30} appointments per day. Online bookings are closed.
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-500 font-semibold mt-1">
                      ✓ Date Selected: {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  )}
                </div>
              )}
            </div>



            {/* Emergency Checkbox */}
            <div className="p-4 bg-rose-50/50 dark:bg-rose-950/10 rounded-medium border border-rose-100 dark:border-rose-900/35 flex items-start space-x-3">
              <input 
                type="checkbox" 
                id="emergencyBook"
                checked={isEmergency}
                onChange={(e) => setIsEmergency(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-rose-500 rounded focus:ring-rose-500 border-slate-300 accent-rose-500 cursor-pointer"
              />
              <div className="flex-1 space-y-0.5 select-none cursor-pointer" onClick={() => setIsEmergency(!isEmergency)}>
                <label htmlFor="emergencyBook" className="text-rose-600 font-bold text-xs uppercase tracking-wider flex items-center space-x-1 cursor-pointer">
                  <span>Emergency Priority Placement</span>
                </label>
                <p className="text-[10px] text-rose-500/80 leading-normal">
                  Checking this books the appointment as a high-priority emergency. Emergency consultation fee is <b>₹1,000</b>. The queue engine will prioritize your placement.
                </p>
              </div>
            </div>

            {/* Chief Complaint */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Chief Complaint (Symptoms)</label>
              <div className="relative">
                <Clipboard size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
                <textarea 
                  value={complaint}
                  onChange={(e) => setComplaint(e.target.value)}
                  placeholder="e.g. Chest tightness, mild fatigue since yesterday morning..."
                  className="neu-input w-full pl-icon-input min-h-[90px] !pt-3.5 resize-none"
                  required
                />
              </div>
            </div>

            {/* Notes */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Additional Notes (Optional)</label>
              <div className="relative">
                <FileText size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Please note I have a previous cardiac reports copy to show..."
                  className="neu-input w-full pl-icon-input min-h-[70px] !pt-3.5 resize-none"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading || !!dateValidationError || doctorProfile?.bookingsEnabled === false || selectedDateQueueLength >= (doctorProfile?.maxPatientsPerDay || 30)}
              className={`neu-btn w-full text-white flex items-center justify-center space-x-2 py-4 ${
                (dateValidationError || doctorProfile?.bookingsEnabled === false || selectedDateQueueLength >= (doctorProfile?.maxPatientsPerDay || 30)) ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-50' : 'bg-primaryBlue hover:bg-opacity-95'
              }`}
            >
              <Sparkles size={18} className="animate-pulse" />
              <span>{loading ? 'Confirming with AI Engine...' : 'Confirm Book Appointment'}</span>
            </button>

          </form>
        </div>
      </div>
    </Layout>
  );
}
