import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useStore } from '../store/useStore';
import { CalendarRange, Clock, Users, MapPin, Phone, ShieldCheck, Activity, Award, LogIn } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { token, user } = useStore();
  const [publicQueue, setPublicQueue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const doctorId = '66914b48bcde36814b72648a'; 

  const fetchPublicQueue = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/patient/queue/public?doctorId=${doctorId}`);
      if (res.data.success) {
        setPublicQueue(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load public queue status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchPublicQueue();
    // Poll every 30 seconds for live landing page updates
    const timer = setInterval(fetchPublicQueue, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleBookClick = () => {
    if (token) {
      router.push('/patient/book');
    } else {
      router.push('/login?redirect=book');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available':
      case 'Consulting':
        return 'bg-emerald-500';
      case 'Lunch Break':
        return 'bg-amber-500';
      case 'Running Late':
        return 'bg-orange-500';
      default:
        return 'bg-rose-500';
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col justify-between transition-colors duration-300">
      
      {/* Top Header Bar */}
      <header className="px-6 py-4 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          
          {/* Brand Info & Staff Login link at TOP LEFT */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
            <Link href="/" className="flex items-center space-x-3.5">
              <img 
                src="https://assets.lybrate.com/img/documents/clinic/logo/e1ab75cbd67a9c9e75107672edb03084/Dr.-AvinashSingh-Varanasi-9107d0" 
                alt="Asha Neurology Center" 
                className="w-10 h-10 rounded-medium shadow-md object-cover border border-white/50"
              />
              <div>
                <span className="font-extrabold text-base tracking-wide text-slate-800 dark:text-white block">Asha Neurology</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block -mt-1">Varanasi, India</span>
              </div>
            </Link>
            
            {/* Top Left Staff Login link */}
            <Link href="/login" className="inline-flex items-center space-x-1 text-[11px] font-bold text-primaryBlue hover:underline bg-blue-50/50 dark:bg-blue-950/20 px-2 py-1 rounded">
              <LogIn size={11} />
              <span>Doctor / Staff Console Login</span>
            </Link>
          </div>

          {/* Right Header Navigation */}
          <div className="flex items-center space-x-4">
            {mounted && token && user ? (
              <Link href={user.role === 'Patient' ? '/patient/dashboard' : '/admin/dashboard'} className="bg-[#5A8DEE] hover:bg-opacity-95 text-white px-5 py-2.5 rounded-medium font-bold text-xs shadow-md transition-all">
                Staff Dashboard
              </Link>
            ) : (
              <Link href="/login" className="bg-[#5A8DEE] hover:bg-opacity-95 text-white px-5 py-2.5 rounded-medium font-bold text-xs shadow-md transition-all flex items-center space-x-1">
                <LogIn size={13} />
                <span>Staff Login</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-12 flex-1 flex flex-col space-y-16">
        
        {/* Intro Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Details */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center space-x-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-full text-xs font-bold"
            >
              <Activity size={14} />
              <span>AI Queue waiting diagnostics</span>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight text-slate-800 dark:text-white"
            >
              Asha Neurology <br />
              <span className="text-[#5A8DEE]">Center</span>
            </motion.h1>

            <div className="space-y-2 max-w-xl mx-auto lg:mx-0">
              <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">Dr. Avinash Singh</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Neurologist • MBBS, MD, DM • 13 Years Experience</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed pt-2">
                Providing state-of-the-art neurological consultations and diagnostics. Powered by our local smart queue prediction engine, patients can monitor clinic flow live, plan travel times, and eliminate lobby wait times entirely.
              </p>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button 
                onClick={handleBookClick}
                className="bg-[#5A8DEE] hover:bg-opacity-95 text-white font-bold px-8 py-4 rounded-medium transition-all shadow-md text-center flex items-center justify-center space-x-2"
              >
                <CalendarRange size={18} />
                <span>Book Appointment</span>
              </button>
              
              <a 
                href="#live-status" 
                className="border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/20 text-slate-700 dark:text-slate-300 font-bold px-8 py-4 rounded-medium transition-all text-center flex items-center justify-center space-x-2"
              >
                <Clock size={18} />
                <span>See Live Queue</span>
              </a>
            </div>
          </div>

          {/* Right Doctor Image */}
          <div className="lg:col-span-5 flex justify-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="relative p-4 bg-white dark:bg-slate-800 rounded-large shadow-neumorphic-flat dark:shadow-neumorphic-flat-dark max-w-sm w-full"
            >
              <div className="relative h-[320px] w-full rounded-medium overflow-hidden border border-slate-100 dark:border-slate-700">
                <img 
                  src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQB-1ct1k7kw5xtq4fuGdyt88eBT6vK7bHNVoGIUoDrKomHDh16zRFiEuo&s=10" 
                  alt="Dr. Avinash Singh" 
                  className="w-full h-full object-cover object-top"
                />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent p-4 text-white">
                  <p className="font-bold text-base">Dr. Avinash Singh</p>
                  <p className="text-[11px] text-slate-300">Senior Neuro Consultant</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Live Clinic Status Widget */}
        <section id="live-status" className="space-y-6 pt-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Live Clinic Status Dashboard</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Arrive at the clinic exactly when needed. Track waiting parameters live.</p>
          </div>

          {loading ? (
            <div className="neu-flat p-12 text-center text-slate-400">
              <Clock className="animate-spin mx-auto mb-2 text-primaryBlue" size={24} />
              <span>Fetching live waiting status from clinic...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Availability widget */}
              <div className="neu-flat p-6 flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Availability Status</span>
                  <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-100 dark:border-slate-800">
                    <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(publicQueue?.doctorStatus || 'Offline')} animate-pulse`} />
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">{publicQueue?.doctorStatus || 'Offline'}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">Dr. Avinash Singh</h3>
                  {publicQueue?.doctorDelay > 0 ? (
                    <p className="text-xs text-orange-500 font-semibold">⚠️ Running Late: Delayed by {publicQueue.doctorDelay} mins</p>
                  ) : publicQueue?.doctorStatus === 'Lunch Break' ? (
                    <p className="text-xs text-amber-500 font-semibold">☕ On Lunch Break: {publicQueue.lunchStart || '13:00'} - {publicQueue.lunchEnd || '13:30'}</p>
                  ) : (
                    <p className="text-xs text-emerald-500 font-semibold">✓ Doctor on schedule. Arrive per slot times.</p>
                  )}
                </div>
              </div>

              {/* Waiting time widget */}
              <div className="neu-flat p-6 flex flex-col justify-between space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estimated Wait Time</span>
                  <Clock size={16} className="text-primaryBlue" />
                </div>
                <div>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-3xl font-black text-slate-800 dark:text-white">
                      {publicQueue?.currentQueueLength > 0 ? (publicQueue?.estimatedAverageTime * publicQueue?.currentQueueLength) : 0}
                    </span>
                    <span className="text-xs font-bold text-slate-400">minutes</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Based on {publicQueue?.currentQueueLength || 0} patients ahead in queue.</p>
                </div>
              </div>

              {/* Lobby load widget */}
              <div className="neu-flat p-6 flex flex-col justify-between space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lobby Load</span>
                  <Users size={16} className="text-[#34D399]" />
                </div>
                <div>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-3xl font-black text-slate-800 dark:text-white">
                      {publicQueue?.currentQueueLength || 0}
                    </span>
                    <span className="text-xs font-bold text-slate-400">Patients Waiting</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Current serving token: #{publicQueue?.currentServingNumber || 0}</p>
                </div>
              </div>

            </div>
          )}
        </section>

        {/* Location & Map Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-8">
          {/* Address Details */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Clinic Location</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Asha Neurology Center is easily accessible in Varanasi.</p>
            </div>
            
            <div className="space-y-4 text-sm font-semibold">
              <div className="flex items-start space-x-3.5 text-slate-600 dark:text-slate-300">
                <MapPin size={20} className="text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-slate-800 dark:text-white font-bold">Asha Neurology Center</p>
                  <p className="text-xs font-medium text-slate-500 mt-1 leading-relaxed">
                    Brij Enclave Colony, Sundarpur, Nagwa,<br />
                    Varanasi, Uttar Pradesh 221005, India
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3.5 text-slate-600 dark:text-slate-300">
                <Phone size={16} className="text-primaryBlue shrink-0" />
                <span className="text-xs font-medium">+91 98765 43210 / 0542-234567</span>
              </div>

              <div className="flex items-center space-x-3.5 text-slate-600 dark:text-slate-300">
                <Award size={16} className="text-emerald-500 shrink-0" />
                <span className="text-xs font-medium">Mon-Sat: 11:00 AM to 03:30 PM (Sunday Closed)</span>
              </div>

              <div className="pt-2">
                <a 
                  href="https://maps.app.goo.gl/iEtv2L3vmppAhnY3A" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="neu-btn inline-flex items-center space-x-2 bg-primaryBlue text-white py-3 px-5 font-bold text-xs"
                >
                  <MapPin size={14} />
                  <span>Get Directions (Google Maps)</span>
                </a>
              </div>
            </div>
          </div>

          {/* Styled Neumorphic Map Block */}
          <div className="lg:col-span-7">
            <div className="neu-flat p-4 bg-white dark:bg-slate-800 rounded-large shadow-md">
              <div className="h-[280px] w-full rounded-medium overflow-hidden border border-slate-200 dark:border-slate-700 relative">
                {/* Embed Map Iframe pointing to Varanasi Brij Enclave Sundarpur */}
                <iframe 
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3608.2721868352654!2d82.98064567597148!3d25.278278277659424!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x398e318ca4cf0421%3A0xe1ab75cbd67a9c9e!2sAsha%20Neurology%20Center!5e0!3m2!1sen!2sin!4v1720790000000!5m2!1sen!2sin" 
                  width="100%" 
                  height="100%" 
                  style={{ border: 0 }} 
                  allowFullScreen={false} 
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="filter grayscale opacity-90 dark:invert-[0.9] dark:hue-rotate-180"
                />
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="py-8 bg-white dark:bg-slate-900 border-t border-slate-200/50 dark:border-slate-800/80 text-center text-xs text-slate-400 dark:text-slate-500">
        © 2026 Asha Neurology Center • Varanasi, UP, India. All rights reserved.
      </footer>
    </div>
  );
}
