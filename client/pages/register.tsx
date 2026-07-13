import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import axios from 'axios';
import { ArrowLeft, User, Phone, Mail, Lock, Calendar, ClipboardCheck } from 'lucide-react';

export default function Register() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gender, setGender] = useState('Male');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const validatePassword = (pass: string) => {
    // 8 chars, uppercase, lowercase, number, special char
    const minLen = pass.length >= 8;
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasNum = /[0-9]/.test(pass);
    const hasSpecial = /[^A-Za-z0-9]/.test(pass);
    return minLen && hasUpper && hasLower && hasNum && hasSpecial;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName || !mobileNumber || !password || !confirmPassword || !dateOfBirth || !gender) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!validatePassword(password)) {
      setError('Password must be at least 8 characters long, containing an uppercase letter, a lowercase letter, a number, and a special character.');
      return;
    }

    setLoading(true);

    try {
      const res = await axios.post('http://localhost:5000/api/auth/register', {
        fullName,
        mobileNumber,
        email: email || undefined,
        password,
        gender,
        dateOfBirth,
        address: address || undefined,
      });

      if (res.data.success) {
        setSuccess('Registration Successful! Redirecting to login...');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        
        {/* Back Link */}
        <Link href="/" className="inline-flex items-center space-x-2 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all text-sm">
          <ArrowLeft size={16} />
          <span>Back to Home</span>
        </Link>

        {/* Logo banner */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">Create Patient Account</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Complete details to enable smart queue tracking</p>
        </div>

        {/* Form Container */}
        <div className="neu-flat p-8 space-y-6">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-medium text-xs font-semibold border border-rose-100/50 leading-relaxed">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-medium text-xs font-semibold border border-emerald-100/50">
              {success}
            </div>
          )}

          <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Full Name */}
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Full Name *</label>
              <div className="relative flex items-center">
                <User size={18} className="absolute left-3.5 text-slate-400" />
                <input 
                  type="text" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="neu-input w-full pl-icon-input"
                  required
                />
              </div>
            </div>

            {/* Mobile Number */}
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Mobile Number *</label>
              <div className="relative flex items-center">
                <Phone size={18} className="absolute left-3.5 text-slate-400" />
                <input 
                  type="tel" 
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="neu-input w-full pl-icon-input"
                  required
                />
              </div>
            </div>

            {/* Email Address */}
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Email Address</label>
              <div className="relative flex items-center">
                <Mail size={18} className="absolute left-3.5 text-slate-400" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. john@example.com"
                  className="neu-input w-full pl-icon-input"
                />
              </div>
            </div>

            {/* Date of Birth */}
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Date of Birth *</label>
              <div className="relative flex items-center">
                <Calendar size={18} className="absolute left-3.5 text-slate-400" />
                <input 
                  type="date" 
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="neu-input w-full pl-icon-input"
                  required
                />
              </div>
            </div>

            {/* Gender Selection */}
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Gender *</label>
              <select 
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="neu-input w-full"
                required
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Address */}
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Residential Address</label>
              <input 
                type="text" 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Apartment, Street Name"
                className="neu-input w-full"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Password *</label>
              <div className="relative flex items-center">
                <Lock size={18} className="absolute left-3.5 text-slate-400" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="neu-input w-full pl-icon-input"
                  required
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Confirm Password *</label>
              <div className="relative flex items-center">
                <Lock size={18} className="absolute left-3.5 text-slate-400" />
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="neu-input w-full pl-icon-input"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading}
              className="neu-btn md:col-span-2 bg-[#5A8DEE] text-white hover:bg-opacity-95 flex items-center justify-center space-x-2 py-4 mt-2"
            >
              <ClipboardCheck size={20} />
              <span>{loading ? 'Registering Account...' : 'Complete Register'}</span>
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500">
          Already registered? <Link href="/login" className="text-primaryBlue hover:underline font-semibold">Sign in here</Link>
        </p>
      </div>
    </div>
  );
}
