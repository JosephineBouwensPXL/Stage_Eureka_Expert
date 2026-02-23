
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User, Classroom, Role, StudyItem } from '../types';

interface Props {
  teacher: User;
  onClose: () => void;
}

const TeacherPanel: React.FC<Props> = ({ teacher, onClose }) => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [newClassName, setNewClassName] = useState('');
  
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentFirstName, setNewStudentFirstName] = useState('');
  const [newStudentLastName, setNewStudentLastName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [classes, allUsers] = await Promise.all([
      api.getClassrooms(teacher.id),
      api.getUsers()
    ]);
    setClassrooms(classes);
    setStudents(allUsers.filter(u => u.role === Role.STUDENT));
    setLoading(false);
  };

  const handleCreateClass = async () => {
    if (!newClassName.trim()) return;
    await api.createClassroom(teacher.id, newClassName);
    setNewClassName('');
    fetchData();
  };

  const handleRegisterStudent = async () => {
    if (!newStudentFirstName.trim() || !newStudentLastName.trim() || !newStudentEmail.trim() || !selectedClassId) return;
    try {
      const response = await api.register(
        newStudentFirstName,
        newStudentLastName,
        newStudentEmail,
        'welkom01',
        Role.STUDENT
      );
      await api.addStudentToClass(selectedClassId, response.user.id);
      setNewStudentFirstName('');
      setNewStudentLastName('');
      setNewStudentEmail('');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[85vh] transition-colors border-8 border-white dark:border-slate-700">
        <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-clever-yellow/5 dark:bg-clever-yellow/10">
          <div>
            <h2 className="text-3xl font-black text-clever-dark dark:text-white">Docenten Dashboard</h2>
            <p className="text-slate-400 font-medium tracking-tight">Beheer je klassen en help studenten groeien</p>
          </div>
          <button onClick={onClose} className="w-12 h-12 bg-white dark:bg-slate-700 rounded-2xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-600 transition-all shadow-sm">
            <i className="fa-solid fa-xmark text-xl text-slate-400"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 no-scrollbar flex gap-8">
          {/* Left: Classes */}
          <div className="flex-1 space-y-6">
            <div className="bg-slate-50 dark:bg-slate-900/30 p-6 rounded-3xl border-2 border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-lg mb-4 dark:text-white">Nieuwe Klas</h3>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Bijv. Groep 7A"
                  className="flex-1 p-3 bg-white dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-clever-blue/20 dark:text-white"
                />
                <button 
                  onClick={handleCreateClass}
                  className="bg-clever-blue text-white px-6 rounded-xl font-bold shadow-sm"
                >
                  Maken
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-black text-slate-400 uppercase text-xs tracking-widest">Mijn Klassen</h3>
              {classrooms.map(cls => (
                <div key={cls.id} className="p-6 bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-100 dark:border-slate-800 shadow-sm hover:border-clever-blue/20 transition-all">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-black text-xl dark:text-white">{cls.name}</h4>
                      <p className="text-slate-400 text-sm font-bold">{cls.studentIds.length} studenten</p>
                    </div>
                    <button 
                      onClick={() => { setSelectedClassId(cls.id); setShowAddStudent(true); }}
                      className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-clever-blue hover:bg-clever-blue hover:text-white transition-all"
                    >
                      <i className="fa-solid fa-user-plus"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Quick Tools */}
          <div className="w-80 space-y-6">
             <div className="bg-clever-magenta/5 dark:bg-clever-magenta/10 p-6 rounded-3xl border-2 border-clever-magenta/10">
                <i className="fa-solid fa-graduation-cap text-3xl text-clever-magenta mb-4"></i>
                <h3 className="font-black text-lg dark:text-white mb-2">Student Toevoegen</h3>
                <p className="text-xs text-slate-500 mb-4 font-medium leading-relaxed">Voeg direct een nieuwe student toe aan een van je klassen.</p>
                <div className="space-y-3">
                  <select 
                    value={selectedClassId || ''} 
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full p-3 bg-white dark:bg-slate-800 rounded-xl border-none text-xs font-bold dark:text-white"
                  >
                    <option value="">Kies klas...</option>
                    {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input 
                    type="text"
                    value={newStudentFirstName}
                    onChange={(e) => setNewStudentFirstName(e.target.value)}
                    placeholder="Voornaam student"
                    className="w-full p-3 bg-white dark:bg-slate-800 rounded-xl border-none text-xs dark:text-white"
                  />
                  <input
                    type="text"
                    value={newStudentLastName}
                    onChange={(e) => setNewStudentLastName(e.target.value)}
                    placeholder="Achternaam student"
                    className="w-full p-3 bg-white dark:bg-slate-800 rounded-xl border-none text-xs dark:text-white"
                  />
                  <input 
                    type="email" 
                    value={newStudentEmail}
                    onChange={(e) => setNewStudentEmail(e.target.value)}
                    placeholder="E-mail student"
                    className="w-full p-3 bg-white dark:bg-slate-800 rounded-xl border-none text-xs dark:text-white"
                  />
                  <button 
                    onClick={handleRegisterStudent}
                    disabled={!selectedClassId || !newStudentFirstName || !newStudentLastName || !newStudentEmail}
                    className="w-full py-3 bg-clever-magenta text-white rounded-xl font-bold shadow-md disabled:opacity-50"
                  >
                    Registreren
                  </button>
                </div>
             </div>

             <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-3xl border-2 border-slate-100 dark:border-slate-800">
                <h3 className="font-black text-xs text-slate-400 uppercase tracking-widest mb-4">Wist je dat?</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed italic">"Docenten kunnen boeken en lesstof 'vastzetten' voor hun studenten in de bibliotheek."</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherPanel;

