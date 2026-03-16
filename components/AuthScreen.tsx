import React, { useState } from 'react';
import { api } from '../services/api';
import StudyBuddyLogo from './StudyBuddyLogo';

interface Props {
  onLoginSuccess: (user: any) => void;
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
            <StudyBuddyLogo className="w-16 h-16" />
          </div>
          <h1 className="text-4xl font-black text-studybuddy-dark dark:text-white mb-2">
            StudyBuddy
          </h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
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
            <>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">
                  Voornaam
                </label>
                <input
                  type="text"
                  required={!isLogin}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border-none focus:ring-2 focus:ring-studybuddy-blue/20 outline-none text-lg dark:text-white"
                  placeholder="Voornaam"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">
                  Achternaam
                </label>
                <input
                  type="text"
                  required={!isLogin}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border-none focus:ring-2 focus:ring-studybuddy-blue/20 outline-none text-lg dark:text-white"
                  placeholder="Achternaam"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">
              E-mail
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border-none focus:ring-2 focus:ring-studybuddy-blue/20 outline-none text-lg dark:text-white"
              placeholder="naam@school.nl"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">
              Wachtwoord
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border-none focus:ring-2 focus:ring-studybuddy-blue/20 outline-none text-lg dark:text-white"
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-studybuddy-magenta text-white rounded-2xl font-black text-xl shadow-lg hover:bg-magenta-600 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Bezig...' : isLogin ? 'Inloggen' : 'Registreren'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-studybuddy-blue font-bold hover:underline"
          >
            {isLogin ? 'Nog geen account? Maak er een!' : 'Heb je al een account? Log in'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
