import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import axios from 'axios';
import { useStore } from '../store/useStore';
import { ShieldCheck, User, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const router = useRouter();
  const loginStore = useStore((state) => state.login);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter all required fields.');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', {
        username,
        password,
      });

      if (res.data.success) {
        const { token, user } = res.data.data;
        loginStore(user, token);

        // Redirect based on role
        if (user.role === 'Patient') {
          router.push('/patient/dashboard');
        } else {
          router.push('/admin/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        
        {/* Logo banner */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-[#5A8DEE] rounded-medium flex items-center justify-center text-white font-bold text-2xl shadow-md mx-auto">
            A
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">Sign In to Asha Neurology Center</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Enter your clinical token credentials</p>
        </div>

        {/* Neumorphic login container */}
        <div className="neu-flat p-8 space-y-6">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-medium text-xs font-semibold border border-rose-100/50">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Mobile / Email Input */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mobile Number or Email</label>
              <div className="relative flex items-center">
                <User size={18} className="absolute left-3.5 text-slate-400" />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. 9876543210" 
                  className="neu-input w-full pl-icon-input"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="flex flex-col space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Password</label>
                <Link href="/forgot-password" className="text-xs text-primaryBlue hover:underline">Forgot password?</Link>
              </div>
              <div className="relative flex items-center">
                <Lock size={18} className="absolute left-3.5 text-slate-400" />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="neu-input w-full pl-icon-input !pr-11"
                  required
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-605"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="neu-btn w-full bg-primaryBlue text-white hover:bg-opacity-90 flex items-center justify-center space-x-2 py-3.5"
            >
              <span>{loading ? 'Logging in...' : 'Sign In'}</span>
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          {/* Seed accounts reference card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-medium border border-slate-200/50 dark:border-slate-700/50 space-y-2 text-xs">
            <p className="font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
              <ShieldCheck size={14} className="text-primaryBlue" />
              <span>Demo Seed Accounts:</span>
            </p>
            <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-500 dark:text-slate-400">
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-300">Doctor Console:</p>
                <p>User: 9876543210</p>
                <p>Pass: Password123!</p>
              </div>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-300">Reception Console:</p>
                <p>User: 8765432109</p>
                <p>Pass: Password123!</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-slate-500">
          New Patient? <Link href="/register" className="text-primaryBlue hover:underline font-semibold">Create account</Link>
        </p>
      </div>
    </div>
  );
}
