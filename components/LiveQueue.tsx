import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Activity, ShieldCheck } from 'lucide-react';

interface QueueItem {
  appointmentId: string;
  queueNumber?: number | null;
  priority: 'Routine' | 'Walk-in' | 'Emergency';
  status: 'Waiting' | 'Consulting' | 'Completed' | 'Cancelled';
  isMine?: boolean;
  avatarSeed: string;
}

interface LiveQueueProps {
  queueList: any[];
  currentServingNumber: number;
}

// Helper to generate deterministic visual traits based on string seed
const getAvatarTraits = (seed: string) => {
  const num = parseInt(seed, 16) || 0;
  
  // Shirt Color
  const colors = [
    '#5A8DEE', // primary blue
    '#34D399', // accent green
    '#F59E0B', // amber
    '#EC4899', // pink
    '#8B5CF6', // purple
    '#3B82F6', // light blue
    '#EF4444', // red
    '#10B981', // green
  ];
  const shirtColor = colors[num % colors.length];

  // Head Shape / Hair style
  // 0: Short hair, 1: Long hair, 2: Grey hair (senior), 3: Bald, 4: Child cap
  const hairStyle = num % 5;
  
  // Accessories: Glasses / Mask
  const hasGlasses = (num % 3) === 0;
  const hasMask = (num % 4) === 0;
  
  // Gender representation for drawing
  const gender = hairStyle === 1 ? 'Female' : 'Male';

  return { shirtColor, hairStyle, hasGlasses, hasMask, gender };
};

// SVG Human Avatar Component based on traits
const HumanAvatar = ({ seed, isMine }: { seed: string; isMine: boolean }) => {
  const { shirtColor, hairStyle, hasGlasses, hasMask } = getAvatarTraits(seed);

  return (
    <svg viewBox="0 0 100 100" className="w-16 h-16 drop-shadow-md">
      {/* Background / Glow if User's avatar */}
      {isMine && (
        <circle cx="50" cy="50" r="45" fill="none" stroke="#5A8DEE" strokeWidth="3" strokeDasharray="5 3" className="animate-spin" style={{ animationDuration: '8s' }} />
      )}
      
      {/* Head Back / Neck */}
      <path d="M40 70 L60 70 L55 55 L45 55 Z" fill="#E0B094" />
      
      {/* Face */}
      <circle cx="50" cy="42" r="18" fill="#F3C3A4" />
      
      {/* Features: Hair Styles */}
      {hairStyle === 0 && (
        // Short black hair
        <path d="M30 38 Q50 15 70 38 Q50 30 30 38 Z" fill="#2D3748" />
      )}
      {hairStyle === 1 && (
        // Long hair
        <path d="M30 40 Q25 22 50 20 Q75 22 70 40 Q75 60 72 65 Q60 50 50 50 Q40 50 28 65 Z" fill="#718096" />
      )}
      {hairStyle === 2 && (
        // Grey hair (senior)
        <path d="M31 38 Q50 18 69 38 Q50 32 31 38 M29 35 Q50 12 71 35 Z" fill="#CBD5E0" />
      )}
      {hairStyle === 3 && (
        // Bald (no hair path, just shininess circle)
        <path d="M42 27 Q50 25 58 27" stroke="#FFF" strokeWidth="2" fill="none" opacity="0.4" />
      )}
      {hairStyle === 4 && (
        // Cap
        <path d="M30 35 Q50 15 70 35 Q60 25 30 35 Z" fill="#EC4899" />
      )}

      {/* Eyes */}
      <circle cx="44" cy="42" r="2" fill="#2D3748" />
      <circle cx="56" cy="42" r="2" fill="#2D3748" />

      {/* Nose */}
      <path d="M49 42 L51 42 L50 46 Z" fill="#E0B094" />

      {/* Mouth */}
      {!hasMask && <path d="M45 50 Q50 54 55 50" stroke="#E53E3E" strokeWidth="1.5" fill="none" />}

      {/* Accessories: Glasses */}
      {hasGlasses && (
        <g stroke="#2B6CB0" strokeWidth="1.5" fill="none">
          <circle cx="43" cy="42" r="5" />
          <circle cx="57" cy="42" r="5" />
          <line x1="48" y1="42" x2="52" y2="42" />
        </g>
      )}

      {/* Accessories: Mask */}
      {hasMask && (
        <path d="M37 45 C37 56 63 56 63 45 Z" fill="#E2E8F0" stroke="#CBD5E0" strokeWidth="1" />
      )}

      {/* Shoulders / Shirt */}
      <path d="M22 80 C22 65 35 60 50 60 C65 60 78 65 78 80 L78 95 L22 95 Z" fill={shirtColor} />
    </svg>
  );
};

// Queue Mood calculation
const getQueueMood = (length: number) => {
  if (length <= 2) return { emoji: '😁', text: 'Queue Very Small', desc: 'Great! Very little waiting today.' };
  if (length <= 5) return { emoji: '😊', text: 'Queue Moderate', desc: 'Comfortable queue. Your appointment is on schedule.' };
  if (length <= 10) return { emoji: '🙂', text: 'Queue Busy', desc: 'Clinic is busy. Your estimated consultation time has been updated.' };
  return { emoji: '☕', text: 'Queue Very Busy', desc: 'Clinic is experiencing high demand today. Grab a coffee!' };
};

// Queue Color Interpolation helper
const getQueueColorClass = (length: number) => {
  if (length <= 2) return 'from-emerald-400 to-teal-400';
  if (length <= 5) return 'from-teal-400 to-lime-400';
  if (length <= 10) return 'from-amber-400 to-orange-400';
  return 'from-orange-400 to-rose-400';
};

export default function LiveQueue({ queueList, currentServingNumber }: LiveQueueProps) {
  const waitingPatients = queueList.filter(p => p.status === 'Waiting');
  const consultingPatient = queueList.find(p => p.status === 'Consulting');
  const mood = getQueueMood(waitingPatients.length);
  const colorGradient = getQueueColorClass(waitingPatients.length);

  return (
    <div className="space-y-6">
      {/* Neumorphic Mood & Status Card */}
      <div className="neu-flat p-6 flex flex-col md:flex-row items-center md:justify-between space-y-4 md:space-y-0">
        <div className="flex items-center space-x-5">
          {/* Animated Emoji */}
          <motion.div 
            animate={{ 
              y: [0, -6, 0],
              scale: [1, 1.02, 1] 
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="text-5xl select-none filter drop-shadow-md"
          >
            {mood.emoji}
          </motion.div>

          <div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center space-x-2">
              <span>{mood.text}</span>
              <Sparkles size={16} className="text-primaryBlue animate-pulse" />
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{mood.desc}</p>
          </div>
        </div>

        {/* Dynamic Health Progress Bar */}
        <div className="w-full md:w-64 space-y-2">
          <div className="flex justify-between text-xs font-semibold text-slate-500">
            <span>Lobby Load</span>
            <span>{waitingPatients.length} Waiting</span>
          </div>
          <div className="h-3 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden p-0.5 shadow-inner">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(10, waitingPatients.length * 8))}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className={`h-full rounded-full bg-gradient-to-r ${colorGradient}`}
            />
          </div>
        </div>
      </div>

      {/* Signature Queue Visualization Track */}
      <div className="neu-flat p-8 relative overflow-hidden bg-gradient-to-b from-white to-slate-50/20 dark:from-slate-800 dark:to-slate-800/80">
        
        {/* Track Title */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-700/80">
          <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
            <Activity size={18} className="text-primaryBlue" />
            <span className="font-bold text-sm">Live Clinic Track</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-400 text-xs">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Strict Privacy Active (Shielded)</span>
          </div>
        </div>

        <div className="relative mt-8 flex flex-col md:flex-row items-center md:space-x-8 space-y-8 md:space-y-0 min-h-[220px]">
          
          {/* 1. Doctor Cabin Block */}
          <div className="relative flex flex-col items-center justify-center w-40 h-44 border-2 border-dashed border-primaryBlue/40 dark:border-primaryBlue/20 bg-primaryBlue/5 dark:bg-primaryBlue/10 rounded-large shadow-inner p-4 text-center shrink-0">
            <div className="absolute top-2 px-2.5 py-0.5 bg-primaryBlue text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
              Doctor Cabin
            </div>
            
            {/* Consulting Patient representation */}
            <div className="mt-4 flex flex-col items-center justify-center">
              {consultingPatient ? (
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center"
                >
                  <HumanAvatar seed={consultingPatient.avatarSeed} isMine={consultingPatient.isMine} />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-2 truncate max-w-[120px]">
                    {consultingPatient.isMine ? 'YOU' : 'Consulting...'}
                  </p>
                  <span className="text-[10px] font-semibold text-emerald-500 animate-pulse mt-0.5">In Progress</span>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center text-slate-400 dark:text-slate-500 py-3">
                  <span className="text-3xl mb-1">🚪</span>
                  <p className="text-xs font-medium">Cabin Empty</p>
                  <p className="text-[10px]">No active patient</p>
                </div>
              )}
            </div>
          </div>

          {/* 2. Divider door arrow */}
          <div className="hidden md:flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 shrink-0">
            <span className="text-2xl animate-pulse">←</span>
            <span className="text-[9px] uppercase tracking-wider font-bold mt-1 text-slate-400">Next In</span>
          </div>

          {/* 3. Waiting Queue Avatars Track */}
          <div className="flex-1 w-full overflow-x-auto py-4">
            <div className="flex space-x-5 min-w-max px-2 items-center">
              <AnimatePresence mode="popLayout">
                {waitingPatients.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-slate-400 dark:text-slate-500 font-medium text-sm py-8 px-4"
                  >
                    No patients currently waiting. The doctor is available.
                  </motion.div>
                ) : (
                  waitingPatients.map((patient, index) => (
                    <motion.div
                      key={patient.appointmentId}
                      layout
                      initial={{ scale: 0.7, opacity: 0, x: 50 }}
                      animate={{ scale: 1, opacity: 1, x: 0 }}
                      exit={{ scale: 0.7, opacity: 0, x: -50 }}
                      transition={{ 
                        type: "spring",
                        stiffness: 300,
                        damping: 25
                      }}
                      className={`relative flex flex-col items-center p-3 rounded-medium border transition-all duration-300 ${patient.isMine ? 'bg-primaryBlue/10 dark:bg-primaryBlue/20 border-primaryBlue shadow-md' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700/60 shadow-sm hover:shadow'}`}
                    >
                      {/* Priority Tag */}
                      {patient.priority !== 'Routine' && (
                        <span className={`absolute -top-2 px-1.5 py-0.5 rounded text-[8px] font-bold text-white uppercase tracking-wide ${patient.priority === 'Emergency' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'}`}>
                          {patient.priority}
                        </span>
                      )}

                      {/* Avatar SVG Drawing */}
                      <HumanAvatar seed={patient.avatarSeed} isMine={patient.isMine} />

                      {/* Detail under avatar */}
                      <div className="mt-2 text-center">
                        <p className={`text-[10px] font-bold ${patient.isMine ? 'text-primaryBlue' : 'text-slate-500 dark:text-slate-400'}`}>
                          {patient.isMine ? 'YOU' : `Position ${index + 1}`}
                        </p>
                        {patient.queueNumber && (
                          <p className="text-[9px] font-semibold text-slate-400">Token #{patient.queueNumber}</p>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
