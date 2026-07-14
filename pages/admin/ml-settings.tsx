import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { useStore } from '../../store/useStore';
import { 
  Cpu, Award, BarChart3, AlertTriangle, Play, CheckCircle2, 
  HelpCircle, Settings, Check, X, ShieldCheck 
} from 'lucide-react';

export default function MLConfig() {
  const router = useRouter();
  const { token, user } = useStore();
  const [loading, setLoading] = useState(true);

  // Route Guard
  useEffect(() => {
    if (token && user && !['Doctor', 'Receptionist', 'Super Admin'].includes(user.role)) {
      router.push('/patient/dashboard');
    }
  }, [token, user]);
  const [mlData, setMlData] = useState<any>(null);
  const [training, setTraining] = useState(false);
  const [trainMsg, setTrainMsg] = useState('');
  const [showPrompt, setShowPrompt] = useState(true);

  // Settings states
  const [maxPatients, setMaxPatients] = useState(30);
  const [weeklyOff, setWeeklyOff] = useState<number[]>([0]); // 0 = Sunday
  const [specialHolidays, setSpecialHolidays] = useState<string[]>([]);
  const [newHoliday, setNewHoliday] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [bookingsEnabled, setBookingsEnabled] = useState(true);
  const [consultationDuration, setConsultationDuration] = useState(7);
  const [consultationDurationManualOverride, setConsultationDurationManualOverride] = useState(false);
  const [hospitalOpeningTime, setHospitalOpeningTime] = useState('09:00');
  const [hospitalClosingTime, setHospitalClosingTime] = useState('17:00');
  const [lunchStart, setLunchStart] = useState('13:00');
  const [lunchEnd, setLunchEnd] = useState('14:00');

  const doctorId = user?.doctorId || '66914b48bcde36814b72648a';

  const fetchMLStatus = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`http://localhost:5000/api/admin/ml/status?doctorId=${doctorId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setMlData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load ML metrics');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`http://localhost:5000/api/admin/doctor/settings?doctorId=${doctorId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setMaxPatients(res.data.data.maxPatientsPerDay);
        setWeeklyOff(res.data.data.weeklyOff || [0]);
        setSpecialHolidays(res.data.data.specialHolidays.map((h: any) => new Date(h).toISOString().split('T')[0]) || []);
        setBookingsEnabled(res.data.data.bookingsEnabled !== false);
        setConsultationDuration(res.data.data.consultationDurationDefault || 7);
        setConsultationDurationManualOverride(res.data.data.consultationDurationManualOverride || false);
        setHospitalOpeningTime(res.data.data.hospitalOpeningTime || '09:00');
        setHospitalClosingTime(res.data.data.hospitalClosingTime || '17:00');
        setLunchStart(res.data.data.lunchStart || '13:00');
        setLunchEnd(res.data.data.lunchEnd || '14:00');
      }
    } catch (err) {
      console.error('Failed to load doctor settings');
    }
  };

  useEffect(() => {
    fetchMLStatus();
    fetchSettings();
  }, [token]);

  // Trigger manual model retrain
  const handleRetrain = async () => {
    setTraining(true);
    setTrainMsg('Running offline Python scikit-learn models...');
    try {
      const res = await axios.post('http://localhost:5000/api/admin/ml/train', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setTrainMsg('Retraining complete. Metrics updated.');
        fetchMLStatus();
      }
    } catch (err: any) {
      setTrainMsg(err.response?.data?.message || 'Offline Python training failed.');
    } finally {
      setTimeout(() => {
        setTraining(false);
        setTrainMsg('');
      }, 3000);
    }
  };

  // Accept ML Recommendation
  const handleAcceptRecommendation = async () => {
    try {
      const res = await axios.post('http://localhost:5000/api/admin/ml/recommendation/accept', {
        doctorId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setShowPrompt(false);
        fetchMLStatus();
        alert('Consultation default updated successfully.');
      }
    } catch (err) {
      alert('Error updating default duration');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await axios.put('http://localhost:5000/api/admin/doctor/settings', {
        doctorId,
        maxPatientsPerDay: maxPatients,
        weeklyOff,
        specialHolidays,
        bookingsEnabled,
        consultationDurationDefault: consultationDuration,
        consultationDurationManualOverride,
        hospitalOpeningTime,
        hospitalClosingTime,
        lunchStart,
        lunchEnd
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        alert('Doctor configurations saved successfully!');
        fetchSettings();
      }
    } catch (err) {
      alert('Failed to update settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddHoliday = () => {
    if (!newHoliday) return;
    if (specialHolidays.includes(newHoliday)) {
      alert('This date is already configured as off.');
      return;
    }
    setSpecialHolidays([...specialHolidays, newHoliday]);
    setNewHoliday('');
  };

  const handleRemoveHoliday = (dateStr: string) => {
    setSpecialHolidays(specialHolidays.filter(h => h !== dateStr));
  };

  const handleToggleWeeklyOff = (dayNum: number) => {
    if (weeklyOff.includes(dayNum)) {
      setWeeklyOff(weeklyOff.filter(d => d !== dayNum));
    } else {
      setWeeklyOff([...weeklyOff, dayNum]);
    }
  };

  const metrics = mlData?.mlMetrics?.metrics;
  const bestModel = mlData?.mlMetrics?.bestModel || 'WMA (Weighted Moving Average) Baseline';

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl mx-auto">
        
        {/* Weekly Recommendation Prompt */}
        {mlData?.recommendation && showPrompt && (
          <div className="neu-flat p-6 border-l-4 border-[#5A8DEE] bg-gradient-to-r from-blue-50/50 to-indigo-50/5 dark:from-slate-800 dark:to-slate-800/40 space-y-4">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-primaryBlue/10 rounded-medium flex items-center justify-center text-primaryBlue shrink-0">
                <Cpu className="animate-spin" style={{ animationDuration: '6s' }} />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center space-x-1.5">
                  <span>AI Timeline Recommendation</span>
                  <HelpCircle size={14} className="text-slate-400" />
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Based on your last <span className="font-bold text-primaryBlue">{mlData.recommendation.totalSamples}</span> consultations, 
                  your average consultation duration appears to be <span className="font-bold text-slate-800 dark:text-white">{mlData.recommendation.exactSuggested} Minutes</span>. 
                  Would you like to update the default consultation duration to <span className="font-bold text-[#34D399]">{mlData.recommendation.suggested} Minutes</span>?
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4 pt-2">
              <button 
                onClick={handleAcceptRecommendation}
                className="neu-btn bg-[#5A8DEE] text-white hover:bg-opacity-95 flex items-center space-x-1 py-2 text-xs"
              >
                <Check size={14} />
                <span>Accept Recommendation</span>
              </button>
              <button 
                onClick={() => setShowPrompt(false)}
                className="px-3.5 py-2 rounded-medium text-xs font-semibold text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                Reject / Remind Later
              </button>
            </div>
          </div>
        )}

        {/* Configurations Dashboard grids */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* ML Stats panel */}
          <div className="neu-flat p-6 space-y-5">
            <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider flex items-center space-x-2">
              <Award size={16} className="text-primaryBlue" />
              <span>Offline Learning Engine Status</span>
            </h3>

            <div className="space-y-4 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-slate-400">Current Default Target:</span>
                <span className="font-bold text-slate-800 dark:text-white">{mlData?.currentDefault || 7} Minutes</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-slate-400">Active Model Selected:</span>
                <span className="font-bold text-primaryBlue uppercase text-xs tracking-wider">{bestModel.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-slate-400">Total Seeding Samples:</span>
                <span className="font-bold text-slate-800 dark:text-white">{mlData?.totalSamples || 0} Consultations</span>
              </div>
            </div>

            <button 
              onClick={handleRetrain}
              disabled={training}
              className="neu-btn w-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center space-x-1.5"
            >
              <Play size={14} className="text-primaryBlue" />
              <span>{training ? 'Training Model...' : 'Retrain Offline Models'}</span>
            </button>
            {trainMsg && <p className="text-[10px] text-slate-400 text-center font-bold">{trainMsg}</p>}
          </div>

          {/* Model Accuracy Breakdown table */}
          <div className="neu-flat p-6 space-y-4">
            <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider flex items-center space-x-2">
              <BarChart3 size={16} className="text-primaryBlue" />
              <span>Model Accuracy Benchmark</span>
            </h3>

            {metrics ? (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-700">
                      <th className="py-2">Algorithm</th>
                      <th className="py-2">MAE</th>
                      <th className="py-2">RMSE</th>
                      <th className="py-2">R² Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {Object.keys(metrics).map((key) => (
                      <tr key={key} className={key === bestModel ? 'font-bold text-primaryBlue bg-primaryBlue/5' : ''}>
                        <td className="py-2.5 capitalize">{key.replace('_', ' ')}</td>
                        <td className="py-2.5">{metrics[key].mae.toFixed(3)}</td>
                        <td className="py-2.5">{metrics[key].rmse.toFixed(3)}</td>
                        <td className="py-2.5">{metrics[key].r2.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs space-y-2">
                <AlertTriangle size={24} className="mx-auto text-amber-500" />
                <p>Not enough training records to compute benchmark.</p>
                <p className="max-w-[280px] mx-auto text-[10px]">ML pipelines activate automatically at 100+ Completed consultations. Fallbacks active.</p>
              </div>
            )}
          </div>
        </div>

        {/* Clinic Hours & Booking Parameters */}
        <div className="neu-flat p-6 space-y-6">
          <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-100 dark:border-slate-700 pb-3">
            <Settings size={16} className="text-primaryBlue" />
            <span>Clinic Hours & Patient Scheduling Configuration</span>
          </h3>

          <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            {/* Left inputs */}
            <div className="space-y-4">
              {/* Consultation Duration */}
              <div className="flex flex-col space-y-2.5 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-medium border border-slate-200/50 dark:border-slate-700/50">
                <label className="text-xs font-bold text-slate-500 uppercase">Consultation Duration (Minutes)</label>
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox"
                    id="autoMlDuration"
                    checked={!consultationDurationManualOverride}
                    onChange={(e) => setConsultationDurationManualOverride(!e.target.checked)}
                    className="w-4 h-4 text-primaryBlue rounded focus:ring-primaryBlue accent-primaryBlue"
                  />
                  <label htmlFor="autoMlDuration" className="text-xs font-bold select-none text-slate-700 dark:text-slate-200 cursor-pointer">
                    Use AI-predicted consultation duration
                  </label>
                </div>
                {!consultationDurationManualOverride ? (
                  <div className="text-xs text-primaryBlue font-semibold bg-primaryBlue/5 p-2 rounded">
                    🤖 Currently using: <b>{consultationDuration} minutes</b> (Managed by Machine Learning Engine)
                  </div>
                ) : (
                  <div className="flex items-center space-x-2.5">
                    <input 
                      type="number"
                      min={1}
                      max={120}
                      value={consultationDuration}
                      onChange={(e) => setConsultationDuration(parseInt(e.target.value))}
                      className="neu-input w-24 py-1.5 text-xs text-center"
                      required
                    />
                    <span className="text-xs text-slate-400">minutes (Manual Override)</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Maximum Patient Appointments Per Day</label>
                <input 
                  type="number"
                  min={1}
                  max={200}
                  value={maxPatients}
                  onChange={(e) => setMaxPatients(parseInt(e.target.value))}
                  className="neu-input w-full"
                  required
                />
                <p className="text-[10px] text-slate-400">Limits patient bookings on a single calendar date. Prevents doctor overload.</p>
              </div>

              <div className="flex flex-col space-y-1.5 pt-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Booking Reception Status</label>
                <div className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-medium">
                  <input 
                    type="checkbox"
                    id="bookingsEnabled"
                    checked={bookingsEnabled}
                    onChange={(e) => setBookingsEnabled(e.target.checked)}
                    className="w-4 h-4 text-primaryBlue rounded focus:ring-primaryBlue accent-primaryBlue"
                  />
                  <label htmlFor="bookingsEnabled" className="text-xs font-bold select-none text-slate-700 dark:text-slate-200 cursor-pointer">
                    {bookingsEnabled ? '✓ Accepting Online Bookings' : '🛑 Bookings Blocked/Stopped'}
                  </label>
                </div>
                <p className="text-[10px] text-slate-400">Toggle to temporarily suspend or resume patient online bookings instantly.</p>
              </div>

              {/* Weekly Off Checkboxes */}
              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Weekly Off Days</label>
                <div className="grid grid-cols-4 gap-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                    const isChecked = weeklyOff.includes(idx);
                    return (
                      <label key={day} className="flex items-center space-x-1.5 cursor-pointer bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1.5 rounded text-xs select-none text-slate-700 dark:text-slate-200">
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleWeeklyOff(idx)}
                          className="rounded text-primaryBlue focus:ring-primaryBlue"
                        />
                        <span>{day}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Holiday settings */}
            <div className="space-y-4 flex flex-col">
              {/* Working Hours */}
              <div className="flex flex-col space-y-2 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-medium border border-slate-200/50 dark:border-slate-700/50">
                <label className="text-xs font-bold text-slate-500 uppercase">Clinic Working Hours (From - To)</label>
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div className="flex flex-col space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Opening Time</span>
                    <input 
                      type="time"
                      value={hospitalOpeningTime}
                      onChange={(e) => setHospitalOpeningTime(e.target.value)}
                      className="neu-input w-full px-3 py-2 text-xs"
                      required
                    />
                  </div>
                  <div className="flex flex-col space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Closing Time</span>
                    <input 
                      type="time"
                      value={hospitalClosingTime}
                      onChange={(e) => setHospitalClosingTime(e.target.value)}
                      className="neu-input w-full px-3 py-2 text-xs"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Lunch Break Hours */}
              <div className="flex flex-col space-y-2 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-medium border border-slate-200/50 dark:border-slate-700/50">
                <label className="text-xs font-bold text-slate-500 uppercase">Daily Lunch Break Hours (From - To)</label>
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div className="flex flex-col space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Lunch Start</span>
                    <input 
                      type="time"
                      value={lunchStart}
                      onChange={(e) => setLunchStart(e.target.value)}
                      className="neu-input w-full px-3 py-2 text-xs"
                      required
                    />
                  </div>
                  <div className="flex flex-col space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Lunch End</span>
                    <input 
                      type="time"
                      value={lunchEnd}
                      onChange={(e) => setLunchEnd(e.target.value)}
                      className="neu-input w-full px-3 py-2 text-xs"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col space-y-1.5 flex-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Manage Holidays / Off Dates</label>
                <div className="flex space-x-2">
                  <input 
                    type="date"
                    value={newHoliday}
                    onChange={(e) => setNewHoliday(e.target.value)}
                    className="neu-input flex-1 px-3 py-2 text-xs pl-icon-input"
                  />
                  <button 
                    type="button" 
                    onClick={handleAddHoliday}
                    className="neu-btn bg-[#5A8DEE] text-white px-4 text-xs hover:bg-opacity-95 shrink-0"
                  >
                    Add Off Day
                  </button>
                </div>

                {/* Holiday Scrollable List */}
                <div className="mt-3 flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded p-2.5 min-h-[110px] max-h-[140px] overflow-y-auto space-y-1.5">
                  {specialHolidays.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic text-center pt-8">No special holiday off-days configured.</p>
                  ) : (
                    specialHolidays.map((hDate) => (
                      <div key={hDate} className="flex items-center justify-between text-xs bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded border border-slate-200/50 dark:border-slate-700/50">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{new Date(hDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        <button 
                          type="button"
                          onClick={() => handleRemoveHoliday(hDate)}
                          className="text-rose-500 hover:text-rose-700 transition animate-pulse"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Submit Bar */}
            <div className="md:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <button 
                type="submit" 
                disabled={savingSettings}
                className="neu-btn bg-[#34D399] text-white hover:bg-opacity-95 px-8 font-bold text-xs"
              >
                {savingSettings ? 'Saving Settings...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </Layout>
  );
}
