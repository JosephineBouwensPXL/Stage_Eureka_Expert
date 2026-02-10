
import React, { useState } from 'react';
import { mockApi } from '../services/api';

interface Props {
  onLoginSuccess: (user: any) => void;
}

const AuthScreen: React.FC<Props> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let response;
      if (isLogin) {
        response = await mockApi.login(email, password);
      } else {
        response = await mockApi.register(email, password);
      }
      onLoginSuccess(response.user);
    } catch (err: any) {
      setError(err.message || 'Er is iets misgegaan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 z-[100] transition-colors duration-300">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 border-8 border-white dark:border-slate-700">
        <div className="text-center mb-10">
          <div className="inline-block p-4 bg-slate-50 dark:bg-slate-900 rounded-3xl mb-4">
            <svg viewBox="0 0 120 120" className="w-16 h-16" fill="none">
              <path d="M40 30L60 20L80 30L80 50L60 60L40 50V30Z" fill="#e61e6e" />
              <path d="M25 65L45 55L65 65L65 85L45 95L25 85V65Z" fill="#4c84ff" />
              <path d="M75 65L95 55L115 65V85L95 95L75 85V65Z" fill="#fbc02d" />
            </svg>
          </div>
          <h1 className="text-4xl font-black text-clever-dark dark:text-white mb-2">CleverKids</h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Jouw AI Studie Buddy</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-2xl text-sm font-bold border-2 border-red-100 dark:border-red-900/30">{error}</div>}
          
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">E-mail</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border-none focus:ring-2 focus:ring-clever-blue/20 outline-none text-lg dark:text-white"
              placeholder="naam@school.nl"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Wachtwoord</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border-none focus:ring-2 focus:ring-clever-blue/20 outline-none text-lg dark:text-white"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-5 bg-clever-magenta text-white rounded-2xl font-black text-xl shadow-lg hover:bg-magenta-600 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Bezig...' : isLogin ? 'Inloggen' : 'Registreren'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-clever-blue font-bold hover:underline"
          >
            {isLogin ? 'Nog geen account? Maak er een!' : 'Heb je al een account? Log in'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
