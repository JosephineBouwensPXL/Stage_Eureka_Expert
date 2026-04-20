import React, { useState } from 'react';
import { api } from '../services/api';
import StudyBuddyLogo from './StudyBuddyLogo';

interface Props {
  onLoginSuccess: (user: any, options?: { justRegistered?: boolean }) => void;
}

const AuthScreen: React.FC<Props> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
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
        response = await api.login(email, password);
      } else {
        response = await api.register(firstName, lastName, email, password);
      }
      onLoginSuccess(response.user, { justRegistered: !isLogin });
    } catch (err: any) {
      setError(err.message || 'Er is iets misgegaan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 sm:p-6 z-[100] transition-colors duration-300">
      <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[2rem] shadow-xl px-6 py-7 sm:px-8 sm:py-8 border border-slate-200/70 dark:border-slate-700">
        <div className="text-center mb-7 sm:mb-8">
          <div className="inline-flex p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl mb-4">
            <StudyBuddyLogo className="w-12 h-12 sm:w-14 sm:h-14" />
          </div>
          <h1 className="text-[2rem] sm:text-4xl font-black text-studybuddy-dark dark:text-white mb-2">
            StudyBuddy
          </h1>
          <p className="text-slate-400 font-bold uppercase tracking-[0.22em] text-[11px]">
            Jouw AI study assistant
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-2xl text-sm font-bold border-2 border-red-100 dark:border-red-900/30">
              {error}
            </div>
          )}

          {!isLogin && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2 ml-1">
                  Voornaam
                </label>
                <input
                  type="text"
                  required={!isLogin}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 focus:ring-2 focus:ring-studybuddy-blue/15 outline-none text-base dark:text-white"
                  placeholder="Voornaam"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2 ml-1">
                  Achternaam
                </label>
                <input
                  type="text"
                  required={!isLogin}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 focus:ring-2 focus:ring-studybuddy-blue/15 outline-none text-base dark:text-white"
                  placeholder="Achternaam"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2 ml-1">
              E-mail
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 focus:ring-2 focus:ring-studybuddy-blue/15 outline-none text-base dark:text-white"
              placeholder="naam@school.nl"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2 ml-1">
              Wachtwoord
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 focus:ring-2 focus:ring-studybuddy-blue/15 outline-none text-base dark:text-white"
              placeholder="Type hier je wachtwoord"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 sm:py-4 bg-studybuddy-magenta text-white rounded-xl font-black text-lg shadow-md hover:bg-magenta-600 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Bezig...' : isLogin ? 'Inloggen' : 'Registreren'}
          </button>
        </form>

        <div className="mt-5 sm:mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-studybuddy-blue font-semibold hover:underline"
          >
            {isLogin ? 'Nog geen account? Maak er een!' : 'Heb je al een account? Log in'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
