import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  Plus, 
  LogOut, 
  User, 
  Users, 
  Award, 
  ClipboardList, 
  ChevronRight, 
  ChevronLeft,
  AlertTriangle,
  RefreshCw,
  Search,
  Eye,
  ArrowUp,
  Upload,
  FileText
} from 'lucide-react';
import { TEMPLATES, getQuestionArray, getActiveParts } from './utils/templates';

const API_BASE = window.location.port === '5173'
  ? 'http://localhost:5000/api'
  : '/api';

export default function App() {
  // Authentication & Navigation
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('exam_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [currentView, setCurrentView] = useState('login'); // login, teacher_exams, teacher_students, teacher_scores, student_exams, student_session, student_result
  const [errorMsg, setErrorMsg] = useState('');

  // Scroll to Top state
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const [successMsg, setSuccessMsg] = useState('');

  // Teacher States
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [editingExam, setEditingExam] = useState(null);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentPass, setNewStudentPass] = useState('');
  const [newStudentClass, setNewStudentClass] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [selectedClassForDetails, setSelectedClassForDetails] = useState(null);
  const [backView, setBackView] = useState(null);

  // Bulk CSV Import
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkResult, setBulkResult] = useState(null);

  // Scoreboard Filters & Views
  const [scoreFilterClass, setScoreFilterClass] = useState('All');
  const [scoreSearchStudent, setScoreSearchStudent] = useState('');
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [reportingMode, setReportingMode] = useState('submissions'); // 'submissions' or 'students'

  // Student States
  const [activeExam, setActiveExam] = useState(null);
  const [studentAnswers, setStudentAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [reportSubmission, setReportSubmission] = useState(null);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const timerRef = useRef(null);
  const [activeTab, setActiveTab] = useState('reading');

  // Tab-switch anti-cheat tracking
  const tabSwitchRef = useRef(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);

  const renderTabHeaders = (exam) => {
    const readingCount = exam
      ? getActiveParts(exam, 'reading').reduce((s, pn) => {
          const p = TEMPLATES.reading.parts.find(x => x.partNum === pn);
          return p ? s + (p.questionRange[1] - p.questionRange[0] + 1) : s;
        }, 0)
      : 52;
    const listeningCount = exam
      ? getActiveParts(exam, 'listening').reduce((s, pn) => {
          const p = TEMPLATES.listening.parts.find(x => x.partNum === pn);
          return p ? s + (p.questionRange[1] - p.questionRange[0] + 1) : s;
        }, 0)
      : 30;
    return (
      <div className="tab-headers animate-fade-in" style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid hsla(var(--border-color) / 0.2)', marginBottom: '1.5rem', paddingBottom: '0.25rem' }}>
        <button type="button" className={`tab-btn ${activeTab === 'reading' ? 'active' : ''}`} onClick={() => setActiveTab('reading')}
          style={{ background: 'none', border: 'none', color: activeTab === 'reading' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))', borderBottom: activeTab === 'reading' ? '3px solid hsl(var(--primary))' : '3px solid transparent', padding: '0.5rem 1rem', fontWeight: '600', cursor: 'pointer', fontSize: '1rem', marginBottom: '-6px', transition: 'all 0.2s ease' }}>
          Reading & Use of English ({readingCount} questions)
        </button>
        <button type="button" className={`tab-btn ${activeTab === 'listening' ? 'active' : ''}`} onClick={() => setActiveTab('listening')}
          style={{ background: 'none', border: 'none', color: activeTab === 'listening' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))', borderBottom: activeTab === 'listening' ? '3px solid hsl(var(--primary))' : '3px solid transparent', padding: '0.5rem 1rem', fontWeight: '600', cursor: 'pointer', fontSize: '1rem', marginBottom: '-6px', transition: 'all 0.2s ease' }}>
          Listening ({listeningCount} questions)
        </button>
      </div>
    );
  };

  // Sync view on startup
  useEffect(() => {
    if (user) {
      if (user.role === 'teacher') {
        setCurrentView('teacher_exams');
        fetchTeacherData();
      } else {
        setCurrentView('student_exams');
        fetchStudentData();
      }
    } else {
      setCurrentView('login');
    }
  }, [user]);

  // Tab-switch tracking during exam
  useEffect(() => {
    if (currentView !== 'student_session') return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        tabSwitchRef.current += 1;
        setTabSwitchCount(tabSwitchRef.current);
      } else {
        setShowTabWarning(true);
        setTimeout(() => setShowTabWarning(false), 4000);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [currentView]);

  // Timer Tick effect
  useEffect(() => {
    if (currentView === 'student_session' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentView, timeLeft]);

  // Headers helper
  const getHeaders = () => {
    if (!user) return {};
    return {
      'Content-Type': 'application/json',
      'x-user-id': user.id,
      'x-user-role': user.role,
      'x-user-username': user.username
    };
  };

  // Fetch Teacher data
  const fetchTeacherData = async () => {
    try {
      const headers = getHeaders();
      const [examsRes, studentsRes, subsRes, classesRes] = await Promise.all([
        fetch(`${API_BASE}/exams`, { headers }),
        fetch(`${API_BASE}/users`, { headers }),
        fetch(`${API_BASE}/submissions`, { headers }),
        fetch(`${API_BASE}/classes`, { headers })
      ]);
      
      if (examsRes.ok) setExams(await examsRes.json());
      if (studentsRes.ok) setStudents(await studentsRes.json());
      if (subsRes.ok) setSubmissions(await subsRes.json());
      if (classesRes.ok) setClasses(await classesRes.json());
    } catch (err) {
      console.error("Error loading teacher data:", err);
    }
  };

  const handleAddClass = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!newClassName) return;
    try {
      const res = await fetch(`${API_BASE}/classes`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name: newClassName })
      });
      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || 'Lỗi khi tạo lớp.');
        return;
      }
      setNewClassName('');
      fetchTeacherData();
    } catch (err) {
      setErrorMsg('Không thể tạo lớp học.');
    }
  };

  const handleDeleteClass = async (id) => {
    if (!window.confirm("Xóa lớp học này?")) return;
    try {
      await fetch(`${API_BASE}/classes/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      fetchTeacherData();
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch Student data
  const fetchStudentData = async () => {
    try {
      const headers = getHeaders();
      const [examsRes, subsRes] = await Promise.all([
        fetch(`${API_BASE}/exams`, { headers }),
        fetch(`${API_BASE}/submissions`, { headers })
      ]);
      
      if (examsRes.ok) setExams(await examsRes.json());
      if (subsRes.ok) setSubmissions(await subsRes.json());
    } catch (err) {
      console.error("Error loading student data:", err);
    }
  };

  // Auth Operations
  const handleLogin = async (username, password) => {
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Có lỗi xảy ra.');
        return;
      }
      localStorage.setItem('exam_user', JSON.stringify(data.user));
      setUser(data.user);
    } catch (err) {
      setErrorMsg('Không thể kết nối đến máy chủ.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('exam_user');
    setUser(null);
    setCurrentView('login');
    setActiveExam(null);
    setStudentAnswers({});
    setReportSubmission(null);
  };

  // Teacher Actions
  const handleSaveExam = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${API_BASE}/exams`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(editingExam)
      });
      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || 'Lỗi khi lưu đề thi.');
        return;
      }
      setSuccessMsg('Exam saved successfully.');
      setEditingExam(null);
      fetchTeacherData();
    } catch (err) {
      setErrorMsg('Failed to save exam.');
    }
  };

  const handleDeleteExam = async (id) => {
    if (!window.confirm("Are you sure you want to delete this exam? All related student submissions will also be deleted.")) return;
    try {
      await fetch(`${API_BASE}/exams/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      fetchTeacherData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!newStudentName || !newStudentPass) return;
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ username: newStudentName, password: newStudentPass, className: newStudentClass })
      });
      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to add student.');
        return;
      }
      setNewStudentName('');
      setNewStudentPass('');
      setNewStudentClass('');
      fetchTeacherData();
    } catch (err) {
      setErrorMsg('Failed to add student.');
    }
  };

  const handleDeleteStudent = async (id) => {
    if (!window.confirm("Delete this student account?")) return;
    try {
      await fetch(`${API_BASE}/users/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      fetchTeacherData();
    } catch (err) {
      console.error(err);
    }
  };

  // Student Actions
  const handleStartExam = (exam) => {
    setActiveExam(exam);
    // Reset tab-switch tracker
    tabSwitchRef.current = 0;
    setTabSwitchCount(0);
    setShowTabWarning(false);
    // Initialize answers
    const initial = {};
    for (let i = 1; i <= 52; i++) initial[`r_${i}`] = '';
    for (let i = 1; i <= 30; i++) initial[`l_${i}`] = '';
    setStudentAnswers(initial);
    setTimeLeft(exam.durationMinutes * 60);
    setActiveTab('reading');
    setCurrentView('student_session');
  };

  const handleAutoSubmit = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    await submitAnswers(true);
  };

  const handleManualSubmit = async () => {
    setShowConfirmSubmit(false);
    if (timerRef.current) clearInterval(timerRef.current);
    await submitAnswers(false);
  };

  const submitAnswers = async (isAuto = false) => {
    try {
      const res = await fetch(`${API_BASE}/submissions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          examId: activeExam.id,
          answers: studentAnswers,
          tabSwitches: tabSwitchRef.current
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert('Submission error: ' + (data.error || 'Unknown error'));
        return;
      }
      setReportSubmission(data);
      setCurrentView('student_result');
      if (isAuto) alert('Time is up! Your answers have been submitted automatically.');
      else alert('Submitted successfully!');
      fetchStudentData();
    } catch {
      alert('Connection error while submitting!');
    }
  };

  // Bulk CSV import handler
  const handleBulkImport = async () => {
    setBulkResult(null);
    const lines = bulkCsvText.trim().split('\n').filter(l => l.trim());
    const students = lines.map(line => {
      const parts = line.split(',').map(p => p.trim());
      return { username: parts[0] || '', password: parts[1] || '', className: parts[2] || '' };
    }).filter(s => s.username && s.password);
    if (students.length === 0) { setBulkResult({ error: 'No valid rows found. Format: username,password,class' }); return; }
    try {
      const res = await fetch(`${API_BASE}/users/bulk`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ students })
      });
      const data = await res.json();
      if (!res.ok) { setBulkResult({ error: data.error }); return; }
      setBulkResult(data);
      setBulkCsvText('');
      fetchTeacherData();
    } catch { setBulkResult({ error: 'Connection error.' }); }
  };

  // Formatting seconds to MM:SS
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Renders
  return (
    <div className="app-container">
      {/* HEADER */}
      {user && (
        <header className="header">
          <div className="logo-section">
            <BookOpen size={28} style={{ color: 'hsl(var(--primary))' }} />
            <h1>Cambridge Exam Portal</h1>
          </div>
          <div className="user-info">
            <span className="user-role-badge">{user.role === 'teacher' ? 'Teacher' : 'Student'}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={16} />
              <strong style={{ fontSize: '0.95rem' }}>{user.username}</strong>
            </div>
            <button className="btn-logout" onClick={handleLogout}>
              <LogOut size={16} />
            </button>
          </div>
        </header>
      )}

      {/* LOGIN PAGE */}
      {currentView === 'login' && (
        <div className="login-wrapper">
          <div className="glass-card login-card animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <BookOpen size={48} style={{ color: 'hsl(var(--primary))' }} />
            </div>
            <h2>Sign In</h2>
            <p>Enter your account credentials to get started</p>
            {errorMsg && (
              <div style={{ color: 'hsl(var(--danger))', background: 'hsla(var(--danger) / 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', fontSize: '0.9rem', textAlign: 'center', border: '1px solid hsla(var(--danger) / 0.2)' }}>
                {errorMsg}
              </div>
            )}
            <form onSubmit={(e) => {
              e.preventDefault();
              handleLogin(e.target.username.value, e.target.password.value);
            }}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="form-input" name="username" type="text" placeholder="e.g. student1 or teacher" required />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-input" name="password" type="password" placeholder="••••••" required />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} type="submit">
                Sign In
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TEACHER DASHBOARD */}
      {user?.role === 'teacher' && currentView.startsWith('teacher_') && (
        <div className="dashboard-grid animate-fade-in">
          {/* Sidebar */}
          <aside className="sidebar-nav">
            <div className="glass-cardNav" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div className={`sidebar-link ${currentView === 'teacher_exams' ? 'active' : ''}`} onClick={() => { setCurrentView('teacher_exams'); setEditingExam(null); }}>
                <ClipboardList size={18} />
                <span>Manage Exams</span>
              </div>
              <div className={`sidebar-link ${currentView === 'teacher_classes' ? 'active' : ''}`} onClick={() => { setCurrentView('teacher_classes'); setEditingExam(null); }}>
                <BookOpen size={18} />
                <span>Manage Classes</span>
              </div>
              <div className={`sidebar-link ${currentView === 'teacher_students' ? 'active' : ''}`} onClick={() => { setCurrentView('teacher_students'); setEditingExam(null); }}>
                <Users size={18} />
                <span>Student Accounts</span>
              </div>
              <div className={`sidebar-link ${currentView === 'teacher_scores' ? 'active' : ''}`} onClick={() => { setCurrentView('teacher_scores'); setEditingExam(null); }}>
                <Award size={18} />
                <span>Score Reports</span>
              </div>
            </div>
            
            <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={fetchTeacherData}>
              <RefreshCw size={16} />
              Refresh Data
            </button>
          </aside>

          {/* Main Area */}
          <main className="main-content">
            {/* View 1: Manage Exams */}
            {currentView === 'teacher_exams' && !editingExam && (
              <div className="glass-card animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <div>
                    <h2>Exam List</h2>
                    <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Cambridge-format exam sheets. Create, edit and assign to classes.</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => {
                      const allReadingParts = TEMPLATES.reading.parts.map(p => p.partNum);
                      const allListeningParts = TEMPLATES.listening.parts.map(p => p.partNum);
                      setEditingExam({ title: '', durationMinutes: 120, assignedClass: 'All', keyAnswers: {}, activeParts: { reading: allReadingParts, listening: allListeningParts } });
                      setActiveTab('reading');
                    }}>
                      <Plus size={16} />
                      Create New Exam
                    </button>
                  </div>
                </div>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Exam Title</th>
                        <th>Assigned Class</th>
                        <th>Duration</th>
                        <th>Answers Set</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exams.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', color: 'hsl(var(--text-muted))' }}>No exams created yet.</td>
                        </tr>
                      ) : (
                        exams.map(ex => (
                          <tr key={ex.id}>
                            <td><strong>{ex.title}</strong></td>
                            <td>
                              <span className="user-role-badge" style={{ background: ex.assignedClass && ex.assignedClass !== 'All' ? 'hsla(var(--success) / 0.08)' : 'hsla(var(--primary) / 0.08)', color: ex.assignedClass && ex.assignedClass !== 'All' ? 'hsl(var(--success))' : 'hsl(var(--primary))' }}>
                                {ex.assignedClass || 'All'}
                              </span>
                            </td>
                            <td>{ex.durationMinutes} mins</td>
                            <td>{Object.keys(ex.keyAnswers || {}).length} / {ex.totalQuestions || 82} keys set</td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => setEditingExam(ex)}>
                                  Edit Answers
                                </button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteExam(ex.id)}>
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* View 1b: Edit/Create Exam Form */}
            {currentView === 'teacher_exams' && editingExam && (
              <form onSubmit={handleSaveExam} className="glass-card animate-fade-in">
                <div className="exam-creator-header">
                  <div>
                    <h2>{editingExam.id ? 'Edit Exam' : 'Create New Exam'}</h2>
                    <p style={{ color: 'hsl(var(--text-secondary))' }}>Configure exam details and set answer keys for automatic grading.</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingExam(null)}>Cancel</button>
                    <button type="submit" className="btn btn-primary">Save Exam</button>
                  </div>
                </div>

                {errorMsg && <div style={{ color: 'hsl(var(--danger))', marginBottom: '1rem' }}>{errorMsg}</div>}
                {successMsg && <div style={{ color: 'hsl(var(--success))', marginBottom: '1rem' }}>{successMsg}</div>}

                <div className="exam-creator-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                  <div className="form-group">
                    <label className="form-label">Exam title (e.g. Cambridge Test 1)</label>
                    <input className="form-input" type="text" value={editingExam.title} onChange={e => setEditingExam({ ...editingExam, title: e.target.value })} placeholder="Enter title..." required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Duration (minutes)</label>
                    <input className="form-input" type="number" value={editingExam.durationMinutes} onChange={e => setEditingExam({ ...editingExam, durationMinutes: parseInt(e.target.value) || 0 })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Assign to class</label>
                    <select
                      className="form-input"
                      value={editingExam.assignedClass || 'All'}
                      onChange={e => setEditingExam({ ...editingExam, assignedClass: e.target.value })}
                      required
                      style={{ height: '2.7rem', padding: '0.5rem', background: 'hsla(var(--background-card-raw) / 0.6)', color: 'hsl(var(--text-primary))' }}
                    >
                      <option value="All">All Classes</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <h2 style={{ fontSize: '1.25rem', marginTop: '2rem', borderBottom: '1px solid hsla(var(--border-color) / 0.4)', paddingBottom: '0.5rem' }}>
                  Answer Key Setup
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginTop: '0.25rem', marginBottom: '1.5rem' }}>
                  * For fill-in-the-blank questions, separate multiple acceptable answers with vertical bars " | " (e.g. known | well-known). Case and surrounding spaces are ignored automatically.
                </p>

                {renderTabHeaders(editingExam)}

                {/* Part toggle checkboxes */}
                <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'hsla(var(--primary) / 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid hsla(var(--primary) / 0.15)' }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.75rem', color: 'hsl(var(--text-secondary))' }}>Active Parts — uncheck to remove a part from this exam:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {TEMPLATES[activeTab].parts.map(part => {
                      const active = editingExam.activeParts?.[activeTab] ?? TEMPLATES[activeTab].parts.map(p => p.partNum);
                      const isActive = active.includes(part.partNum);
                      return (
                        <label key={part.partNum} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', padding: '0.3rem 0.7rem', borderRadius: 'var(--radius-sm)', background: isActive ? 'hsla(var(--primary) / 0.12)' : 'hsla(var(--border-color) / 0.15)', border: `1px solid ${isActive ? 'hsla(var(--primary) / 0.3)' : 'hsla(var(--border-color) / 0.3)'}`, fontSize: '0.82rem', fontWeight: '600', color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))' }}>
                          <input type="checkbox" checked={isActive} onChange={() => {
                            const current = editingExam.activeParts?.[activeTab] ?? TEMPLATES[activeTab].parts.map(p => p.partNum);
                            const updated = isActive ? current.filter(n => n !== part.partNum) : [...current, part.partNum].sort((a, b) => a - b);
                            setEditingExam({ ...editingExam, activeParts: { ...(editingExam.activeParts || { reading: TEMPLATES.reading.parts.map(p => p.partNum), listening: TEMPLATES.listening.parts.map(p => p.partNum) }), [activeTab]: updated } });
                          }} style={{ accentColor: 'hsl(var(--primary))' }} />
                          Part {part.partNum}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {TEMPLATES[activeTab].parts.map(part => {
                  const activePNs = editingExam.activeParts?.[activeTab] ?? TEMPLATES[activeTab].parts.map(p => p.partNum);
                  if (!activePNs.includes(part.partNum)) return null;
                  const qArray = getQuestionArray(part.questionRange);
                  const numSlots = part.slots || 1;
                  return (
                    <div key={part.partNum} className="exam-part-section animate-fade-in">
                      <h3>{part.title}</h3>
                      <p>{part.description}</p>
                      <div className="questions-grid">
                        {qArray.map(qNum => {
                          const prefix = activeTab === 'reading' ? 'r' : 'l';
                          const qKey = `${prefix}_${qNum}`;
                          const currentVal = editingExam.keyAnswers[qKey] || '';
                          return (
                            <div key={qNum} className="question-row" style={numSlots > 1 ? { flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem' } : {}}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                                <span className="question-num">{qNum}</span>
                                {part.type === 'mcq' ? (
                                  <div className="answer-mcq-options">
                                    {part.options.map(opt => (
                                      <button key={opt} type="button" className={`mcq-option-btn ${currentVal === opt ? 'selected' : ''}`}
                                        onClick={() => setEditingExam({ ...editingExam, keyAnswers: { ...editingExam.keyAnswers, [qKey]: opt } })}>
                                        {opt}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <input className="answer-text-input" type="text"
                                    placeholder={Array.isArray(part.placeholder) ? part.placeholder[0] : part.placeholder}
                                    style={part.uppercase ? { textTransform: 'uppercase' } : {}}
                                    value={currentVal}
                                    onChange={e => {
                                      const val = part.uppercase ? e.target.value.toUpperCase() : e.target.value;
                                      setEditingExam({ ...editingExam, keyAnswers: { ...editingExam.keyAnswers, [qKey]: val } });
                                    }} />
                                )}
                              </div>
                              {numSlots > 1 && Array.from({ length: numSlots - 1 }, (_, si) => {
                                const slotKey = `${qKey}_s${si + 2}`;
                                const slotVal = editingExam.keyAnswers[slotKey] || '';
                                return (
                                  <div key={slotKey} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', paddingLeft: '2.5rem' }}>
                                    <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', minWidth: '1.8rem', textAlign: 'right' }}>+{si + 2}</span>
                                    <input className="answer-text-input" type="text"
                                      placeholder={Array.isArray(part.placeholder) ? (part.placeholder[si + 1] || 'Part...') : part.placeholder}
                                      style={part.uppercase ? { textTransform: 'uppercase' } : {}}
                                      value={slotVal}
                                      onChange={e => {
                                        const val = part.uppercase ? e.target.value.toUpperCase() : e.target.value;
                                        setEditingExam({ ...editingExam, keyAnswers: { ...editingExam.keyAnswers, [slotKey]: val } });
                                      }} />
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </form>
            )}

            {/* View 1c: Class Management */}
            {currentView === 'teacher_classes' && (
              <div className="glass-card animate-fade-in">
                <h2>Manage Classes</h2>
                <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem' }}>Create and manage class groups for your students.</p>
                
                <form onSubmit={handleAddClass} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '2rem', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                    <label className="form-label">Class Name</label>
                    <input className="form-input" type="text" placeholder="e.g. 12A1" value={newClassName} onChange={e => setNewClassName(e.target.value)} required />
                  </div>
                  <button className="btn btn-primary" type="submit" style={{ height: '2.7rem' }}>
                    <Plus size={16} />
                    Create Class
                  </button>
                </form>

                {errorMsg && <div style={{ color: 'hsl(var(--danger))', marginBottom: '1rem' }}>{errorMsg}</div>}

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Class Name</th>
                        <th>Class ID</th>
                        <th style={{ width: '80px' }}>Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classes.length === 0 ? (
                        <tr>
                          <td colSpan="3" style={{ textAlign: 'center', color: 'hsl(var(--text-muted))' }}>No classes created yet.</td>
                        </tr>
                      ) : (
                        classes.map(c => (
                          <tr key={c.id}>
                            <td>
                              <span 
                                style={{ 
                                  cursor: 'pointer', 
                                  color: 'hsl(var(--primary))', 
                                  fontWeight: '600',
                                  textDecoration: 'underline',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem'
                                }} 
                                onClick={() => setSelectedClassForDetails(c)}
                                title="Click to view students and submission history"
                              >
                                <Users size={15} style={{ opacity: 0.8 }} />
                                {c.name}
                              </span>
                            </td>
                            <td style={{ fontFamily: 'monospace' }}>{c.id}</td>
                            <td>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClass(c.id)}>
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {selectedClassForDetails && (
                  <div className="glass-card animate-fade-in" style={{ marginTop: '2rem', borderTop: '2px solid hsl(var(--primary))' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.75rem' }}>
                      <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                        <Users size={18} style={{ color: 'hsl(var(--primary))' }} />
                        <span>Student List — Class {selectedClassForDetails.name}</span>
                      </h3>
                      <button 
                        className="btn btn-secondary btn-sm" 
                        onClick={() => setSelectedClassForDetails(null)}
                      >
                        Close Details
                      </button>
                    </div>

                    {(() => {
                      const classStudents = students.filter(s => s.className === selectedClassForDetails.name);
                      if (classStudents.length === 0) {
                        return <p style={{ color: 'hsl(var(--text-secondary))', fontStyle: 'italic', padding: '1rem 0' }}>No students in this class yet.</p>;
                      }
                      
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {classStudents.map(st => {
                            const studentSubs = submissions.filter(sub => sub.studentId === st.id || sub.studentName === st.username);
                            return (
                              <div key={st.id} style={{ border: '1px solid hsl(var(--border-color))', borderRadius: 'var(--radius-md)', padding: '1rem', background: 'hsl(var(--bg-primary))' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                  <strong style={{ fontSize: '1rem', color: 'hsl(var(--text-primary))' }}>{st.username}</strong>
                                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', background: 'hsl(var(--bg-secondary))', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                                    Completed {studentSubs.length} exam(s)
                                  </span>
                                </div>
                                
                                {studentSubs.length > 0 ? (
                                  <div className="table-container" style={{ margin: '0.5rem 0 0 0', background: 'hsl(var(--card-bg))' }}>
                                    <table className="data-table" style={{ fontSize: '0.85rem' }}>
                                      <thead>
                                        <tr>
                                          <th>Exam</th>
                                          <th>Date Submitted</th>
                                          <th>Score</th>
                                          <th>Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {studentSubs.map(sub => {
                                          const pct = Math.round((sub.score / sub.totalQuestions) * 100);
                                          return (
                                            <tr key={sub.id}>
                                              <td><strong>{sub.examTitle}</strong></td>
                                              <td style={{ fontSize: '0.75rem' }}>{new Date(sub.submittedAt).toLocaleDateString('en-GB')}</td>
                                              <td style={{ fontWeight: '600', color: pct >= 50 ? 'hsl(var(--success))' : 'hsl(var(--danger))' }}>
                                                {pct}/100 ({sub.score}/{sub.totalQuestions} correct)
                                              </td>
                                              <td>
                                                <button 
                                                  className="btn btn-secondary btn-sm" 
                                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                                  onClick={() => {
                                                    setReportSubmission(sub);
                                                    setCurrentView('student_result');
                                                    setBackView('teacher_classes');
                                                  }}
                                                >
                                                  <Eye size={12} />
                                                  View
                                                </button>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', margin: '0.25rem 0 0 0', fontStyle: 'italic' }}>No submissions yet.</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {currentView === 'teacher_students' && (
              <div className="glass-card animate-fade-in">
                <h2>Student Accounts</h2>
                <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem' }}>Create login accounts for students to access and submit exams.</p>
                
                <form onSubmit={handleAddStudent} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}>
                    <label className="form-label">Username</label>
                    <input className="form-input" type="text" placeholder="e.g. student_an" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}>
                    <label className="form-label">Password</label>
                    <input className="form-input" type="text" placeholder="Enter password..." value={newStudentPass} onChange={e => setNewStudentPass(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}>
                    <label className="form-label">Class</label>
                    <select className="form-input" value={newStudentClass} onChange={e => setNewStudentClass(e.target.value)} required style={{ height: '2.7rem', padding: '0.5rem', background: 'hsla(var(--background-card-raw) / 0.6)', color: 'hsl(var(--text-primary))' }}>
                      <option value="">-- Select class --</option>
                      {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-primary" type="submit" style={{ height: '2.7rem' }}>
                    <Plus size={16} /> Add Student
                  </button>
                </form>

                {/* Bulk CSV Import */}
                <div style={{ marginBottom: '2rem' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setShowBulkImport(!showBulkImport); setBulkResult(null); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Upload size={14} /> {showBulkImport ? 'Hide' : 'Bulk Import (CSV)'}
                  </button>
                  {showBulkImport && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'hsla(var(--primary) / 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid hsla(var(--primary) / 0.15)' }}>
                      <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '0.5rem' }}>
                        One student per line: <code style={{ background: 'hsla(var(--border-color)/0.3)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>username,password,classname</code>
                      </p>
                      <textarea
                        rows={6} placeholder={"student1,pass123,12A1\nstudent2,pass456,12A2"}
                        value={bulkCsvText} onChange={e => setBulkCsvText(e.target.value)}
                        style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border-color))', background: 'hsl(var(--card-bg))', color: 'hsl(var(--text-primary))', resize: 'vertical', boxSizing: 'border-box' }}
                      />
                      <button className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem' }} onClick={handleBulkImport}>
                        <FileText size={14} /> Import Students
                      </button>
                      {bulkResult && (
                        <div style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                          {bulkResult.error && <p style={{ color: 'hsl(var(--danger))' }}>❌ {bulkResult.error}</p>}
                          {bulkResult.created && <p style={{ color: 'hsl(var(--success))' }}>✅ Created: {bulkResult.created.length} ({bulkResult.created.join(', ')})</p>}
                          {bulkResult.skipped?.length > 0 && <p style={{ color: 'hsl(var(--warning))' }}>⚠️ Skipped (already exist): {bulkResult.skipped.join(', ')}</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {errorMsg && <div style={{ color: 'hsl(var(--danger))', marginBottom: '1rem' }}>{errorMsg}</div>}

                <div className="table-container">
                  <table className="data-table">
                    <thead><tr>
                      <th>Username</th><th>Password</th><th>Class</th><th>Role</th><th style={{ width: '80px' }}>Delete</th>
                    </tr></thead>
                    <tbody>
                      {students.length === 0 ? (
                        <tr><td colSpan="5" style={{ textAlign: 'center', color: 'hsl(var(--text-muted))' }}>No student accounts yet.</td></tr>
                      ) : (
                        students.map(st => (
                          <tr key={st.id}>
                            <td><strong>{st.username}</strong></td>
                            <td style={{ fontFamily: 'monospace' }}>{st.password}</td>
                            <td><span className="user-role-badge" style={{ background: 'hsla(var(--primary) / 0.08)', color: 'hsl(var(--primary))' }}>{st.className || 'Unassigned'}</span></td>
                            <td>Student</td>
                            <td><button className="btn btn-danger btn-sm" onClick={() => handleDeleteStudent(st.id)}><Trash2 size={14} /></button></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* View 3: Scoreboard / Submissions */}
            {currentView === 'teacher_scores' && (
              <div className="glass-card animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <h2>Score Reports</h2>
                    <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Track exam results and view detailed student submissions.</p>
                  </div>
                  {/* Reporting Mode Toggles */}
                  <div style={{ display: 'flex', background: 'hsl(var(--bg-secondary))', padding: '0.2rem', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border-color))' }}>
                    <button 
                      className={`btn ${reportingMode === 'submissions' ? 'btn-primary' : 'btn-secondary'}`} 
                      style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', border: 'none', background: reportingMode === 'submissions' ? '' : 'transparent' }} 
                      onClick={() => setReportingMode('submissions')}
                    >
                      All Submissions
                    </button>
                    <button 
                      className={`btn ${reportingMode === 'students' ? 'btn-primary' : 'btn-secondary'}`} 
                      style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', border: 'none', background: reportingMode === 'students' ? '' : 'transparent' }} 
                      onClick={() => setReportingMode('students')}
                    >
                      By Student
                    </button>
                  </div>
                </div>

                {/* Filters Toolbar */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', background: 'hsl(var(--bg-primary))', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border-color))' }}>
                  <div className="form-group" style={{ flex: '1', minWidth: '180px', marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>Filter by Class</label>
                    <select
                      className="form-input"
                      value={scoreFilterClass}
                      onChange={e => { setScoreFilterClass(e.target.value); setExpandedStudentId(null); }}
                      style={{ height: '2.5rem', padding: '0.25rem 0.5rem', background: 'hsl(var(--card-bg))' }}
                    >
                      <option value="All">All Classes</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group" style={{ flex: '2', minWidth: '220px', marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>Search Student</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="form-input"
                        type="text"
                        placeholder="Enter student name..."
                        value={scoreSearchStudent}
                        onChange={e => setScoreSearchStudent(e.target.value)}
                        style={{ height: '2.5rem', paddingLeft: '2.25rem', background: 'hsl(var(--card-bg))' }}
                      />
                      <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                    </div>
                  </div>
                </div>

                {reportingMode === 'submissions' ? (
                  /* Flat Submissions List */
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Tên Học Sinh</th>
                          <th>Lớp</th>
                          <th>Đề Thi</th>
                          <th>Ngày Nộp</th>
                          <th>Điểm Số</th>
                          <th>Tỷ Lệ</th>
                          <th>Chi Tiết</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const filtered = submissions.filter(sub => {
                            const studentObj = students.find(s => s.id === sub.studentId || s.username === sub.studentName);
                            const studentClass = studentObj ? studentObj.className : 'Chưa phân lớp';
                            const matchClass = scoreFilterClass === 'All' || studentClass === scoreFilterClass;
                            const matchName = sub.studentName.toLowerCase().includes(scoreSearchStudent.toLowerCase());
                            return matchClass && matchName;
                          });

                          if (filtered.length === 0) {
                            return (
                              <tr>
                              <td colSpan="6" style={{ textAlign: 'center', color: 'hsl(var(--text-muted))' }}>No submissions found.</td>
                              </tr>
                            );
                          }

                          return filtered.map(sub => {
                            const studentObj = students.find(s => s.id === sub.studentId || s.username === sub.studentName);
                            const studentClass = studentObj ? studentObj.className : 'Chưa phân lớp';
                            const pct = Math.round((sub.score / sub.totalQuestions) * 100);
                            return (
                              <tr key={sub.id}>
                                <td><strong>{sub.studentName}</strong></td>
                                <td>
                                  <span className="user-role-badge" style={{ background: 'hsla(var(--primary) / 0.08)', color: 'hsl(var(--primary))', fontSize: '0.8rem', padding: '0.1rem 0.5rem' }}>
                                    {studentClass}
                                  </span>
                                </td>
                                <td>{sub.examTitle}</td>
                                <td>{new Date(sub.submittedAt).toLocaleString('vi-VN')}</td>
                                <td>
                                  <div style={{ fontWeight: '600', color: pct >= 50 ? 'hsl(var(--success))' : 'hsl(var(--danger))' }}>
                                    {pct}/100
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', marginTop: '0.15rem' }}>
                                    R: {sub.readingScore || 0} | L: {sub.listeningScore || 0} ({sub.score}/{sub.totalQuestions} đúng)
                                  </div>
                                </td>
                                <td>{pct}%</td>
                                <td>
                                  <button className="btn btn-secondary btn-sm" onClick={() => {
                                    setReportSubmission(sub);
                                    setCurrentView('student_result');
                                  }}>
                                    <Eye size={14} style={{ marginRight: '0.25rem' }} />
                                    Xem Bài Làm
                                  </button>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* Grouped by Student */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {(() => {
                      const filteredStudents = students.filter(st => {
                        const matchClass = scoreFilterClass === 'All' || st.className === scoreFilterClass;
                        const matchName = st.username.toLowerCase().includes(scoreSearchStudent.toLowerCase());
                        return matchClass && matchName;
                      });

                      if (filteredStudents.length === 0) {
                        return <div style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', padding: '2rem' }}>No students found.</div>;
                      }

                      return filteredStudents.map(st => {
                        const studentSubs = submissions.filter(sub => sub.studentId === st.id || sub.studentName === st.username);
                        const isExpanded = expandedStudentId === st.id;
                        return (
                          <div key={st.id} className="glass-card" style={{ background: 'hsl(var(--card-bg))', border: '1px solid hsl(var(--border-color))', padding: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <h4 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <span>{st.username}</span>
                                  <span className="user-role-badge" style={{ background: 'hsla(var(--primary) / 0.08)', color: 'hsl(var(--primary))', fontSize: '0.75rem', padding: '0.05rem 0.4rem' }}>
                                    {st.className || 'Chưa phân lớp'}
                                  </span>
                                </h4>
                                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>
                                  Đã làm {studentSubs.length} bài thi
                                </p>
                              </div>
                              <button 
                                className="btn btn-secondary btn-sm" 
                                onClick={() => setExpandedStudentId(isExpanded ? null : st.id)}
                              >
                                {isExpanded ? 'Thu Gọn' : 'Xem Lịch Sử Thi'}
                              </button>
                            </div>

                            {isExpanded && (
                              <div className="table-container animate-fade-in" style={{ marginTop: '1rem', borderTop: '1px solid hsl(var(--border-color))', paddingTop: '0.75rem' }}>
                                {studentSubs.length === 0 ? (
                                  <div style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>Học viên này chưa làm bài thi nào.</div>
                                ) : (
                                  <table className="data-table" style={{ fontSize: '0.9rem' }}>
                                    <thead>
                                      <tr>
                                        <th>Tên Đề Thi</th>
                                        <th>Ngày Nộp</th>
                                        <th>Điểm Số</th>
                                        <th>Tỷ Lệ</th>
                                        <th>Hành Động</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {studentSubs.map(sub => {
                                        const pct = Math.round((sub.score / sub.totalQuestions) * 100);
                                        return (
                                          <tr key={sub.id}>
                                            <td>{sub.examTitle}</td>
                                            <td>{new Date(sub.submittedAt).toLocaleString('vi-VN')}</td>
                                            <td>
                                              <span style={{ fontWeight: '600', color: pct >= 50 ? 'hsl(var(--success))' : 'hsl(var(--danger))' }}>
                                                {pct}/100
                                              </span>
                                              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', marginLeft: '0.5rem' }}>
                                                ({sub.score}/{sub.totalQuestions} đúng)
                                              </span>
                                            </td>
                                            <td>{pct}%</td>
                                            <td>
                                              <button className="btn btn-secondary btn-sm" onClick={() => {
                                                setReportSubmission(sub);
                                                setCurrentView('student_result');
                                              }}>
                                                <Eye size={12} style={{ marginRight: '0.2rem' }} />
                                                Xem Bài Làm
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      )}

      {/* STUDENT DASHBOARD */}
      {user?.role === 'student' && currentView === 'student_exams' && (
        <div className="dashboard-grid animate-fade-in" style={{ gridTemplateColumns: '1fr' }}>
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ marginBottom: '0.25rem' }}>Đề Thi Đang Hoạt Động</h2>
                <p style={{ color: 'hsl(var(--text-secondary))' }}>Hãy chọn một đề thi để tiến hành điền đáp án bài làm của bạn.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Lớp của bạn:</span>
                <span className="user-role-badge" style={{ background: 'hsla(var(--primary) / 0.08)', color: 'hsl(var(--primary))' }}>
                  {user?.className || 'Chưa phân lớp'}
                </span>
              </div>
            </div>

            <div className="exams-list-grid">
              {exams.length === 0 ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'hsl(var(--text-muted))', padding: '3rem 0' }}>
                  Giáo viên chưa kích hoạt đề thi nào. Vui lòng tải lại trang sau.
                </div>
              ) : (
                exams.map(ex => {
                  const previousSub = submissions.find(s => s.examId === ex.id);
                  return (
                    <div key={ex.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <span className="user-role-badge" style={{ alignSelf: 'flex-start', background: 'hsla(var(--primary) / 0.08)', color: 'hsl(var(--primary))', marginBottom: '1rem' }}>
                        Full Exam (Reading & Listening)
                      </span>
                      <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{ex.title}</h3>
                      
                      <div style={{ display: 'flex', gap: '1.25rem', color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Clock size={16} />
                          <span>{ex.durationMinutes} phút</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <ClipboardList size={16} />
                          <span>82 câu</span>
                        </div>
                      </div>

                      <div style={{ marginTop: 'auto' }}>
                        {previousSub ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'hsl(var(--success))', fontWeight: '600' }}>
                              <CheckCircle size={16} />
                              <span>Score: {Math.round((previousSub.score / previousSub.totalQuestions) * 100)} / 100</span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
                              Reading: {previousSub.readingScore || 0} | Listening: {previousSub.listeningScore || 0} ({previousSub.score}/{previousSub.totalQuestions} correct)
                            </div>
                            <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => {
                              setReportSubmission(previousSub);
                              setCurrentView('student_result');
                              setActiveTab('reading');
                            }}>
                              View Result
                            </button>
                          </div>
                        ) : (
                          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleStartExam(ex)}>
                            Start Exam
                            <ChevronRight size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* STUDENT EXAM SESSION */}
      {currentView === 'student_session' && activeExam && (
        <div className="animate-fade-in">
          {/* Sticky Timer Bar */}
          <div className="exam-info-header">
            <div>
              <h2 style={{ fontSize: '1.4rem' }}>{activeExam.title}</h2>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>
                Exam in progress: Enter your answers matching your paper sheet.
              </p>
            </div>
            <div className={`timer-box ${timeLeft < 120 ? 'warning' : ''}`}>
              <Clock size={20} />
              <span>{formatTime(timeLeft)}</span>
            </div>
          </div>

          {renderTabHeaders()}

          {/* Tab-switch warning banner */}
          {showTabWarning && (
            <div style={{ position: 'fixed', top: '5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: 'hsl(var(--danger))', color: '#fff', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', fontSize: '0.95rem', animation: 'fadeIn 0.3s ease' }}>
              <AlertTriangle size={18} />
              ⚠️ Tab switch detected! ({tabSwitchCount} time{tabSwitchCount > 1 ? 's' : ''}) — this is being recorded.
            </div>
          )}

          <div className="exam-layout">
            <div className="main-content">
                {TEMPLATES[activeTab].parts
                .filter(part => {
                  const active = getActiveParts(activeExam, activeTab);
                  return active.includes(part.partNum);
                })
                .map(part => {
                const qArray = getQuestionArray(part.questionRange);
                const numSlots = part.slots || 1;
                return (
                  <div key={part.partNum} className="glass-card" id={`part-section-${part.partNum}`}>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>{part.title}</h3>
                    <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem', marginBottom: '1.25rem' }}>{part.description}</p>
                    <div className="questions-grid">
                      {qArray.map(qNum => {
                        const prefix = activeTab === 'reading' ? 'r' : 'l';
                        const qKey = `${prefix}_${qNum}`;
                        const currentAnswer = studentAnswers[qKey] || '';
                        const isAnyAnswered = currentAnswer || (numSlots > 1 && Array.from({ length: numSlots - 1 }, (_, si) => studentAnswers[`${qKey}_s${si + 2}`] || '').some(Boolean));
                        return (
                          <div key={qNum} className="question-row" id={`q-field-${qKey}`} style={numSlots > 1 ? { flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem' } : {}}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                              <span className="question-num" style={{ background: isAnyAnswered ? 'hsl(var(--primary))' : 'hsl(var(--bg-secondary))', color: isAnyAnswered ? '#fff' : 'hsl(var(--text-secondary))' }}>
                                {qNum}
                              </span>
                              {part.type === 'mcq' ? (
                                <div className="answer-mcq-options">
                                  {part.options.map(opt => (
                                    <button key={opt} type="button" className={`mcq-option-btn ${currentAnswer === opt ? 'selected' : ''}`}
                                      onClick={() => setStudentAnswers({ ...studentAnswers, [qKey]: opt })}>
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <input className="answer-text-input" type="text"
                                  placeholder={Array.isArray(part.placeholder) ? part.placeholder[0] : part.placeholder}
                                  style={part.uppercase ? { textTransform: 'uppercase' } : {}}
                                  value={currentAnswer}
                                  onChange={e => {
                                    const val = part.uppercase ? e.target.value.toUpperCase() : e.target.value;
                                    setStudentAnswers({ ...studentAnswers, [qKey]: val });
                                  }} />
                              )}
                            </div>
                            {numSlots > 1 && Array.from({ length: numSlots - 1 }, (_, si) => {
                              const slotKey = `${qKey}_s${si + 2}`;
                              const slotAnswer = studentAnswers[slotKey] || '';
                              return (
                                <div key={slotKey} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', paddingLeft: '2.5rem' }}>
                                  <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', minWidth: '1.8rem', textAlign: 'right' }}>+{si + 2}</span>
                                  <input className="answer-text-input" type="text"
                                    placeholder={Array.isArray(part.placeholder) ? (part.placeholder[si + 1] || 'Part...') : part.placeholder}
                                    style={part.uppercase ? { textTransform: 'uppercase' } : {}}
                                    value={slotAnswer}
                                    onChange={e => {
                                      const val = part.uppercase ? e.target.value.toUpperCase() : e.target.value;
                                      setStudentAnswers({ ...studentAnswers, [slotKey]: val });
                                    }} />
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right hand side sticky widget */}
            <aside>
              <div className="glass-card exam-nav-widget">
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Progress Navigator</h3>
                <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                  Track answered questions. Click any question number to scroll directly to it.
                </p>

              {TEMPLATES[activeTab].parts
                .filter(p => getActiveParts(activeExam, activeTab).includes(p.partNum))
                .map(part => {
                  const qArray = getQuestionArray(part.questionRange);
                  return (
                    <div key={part.partNum} style={{ marginTop: '1rem' }}>
                      <h4 style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '0.25rem' }}>Part {part.partNum}</h4>
                      <div className="nav-questions-grid" style={{ maxHeight: 'none', gridTemplateColumns: 'repeat(5, 1fr)' }}>
                        {qArray.map(qNum => {
                          const qKey = `${activeTab === 'reading' ? 'r' : 'l'}_${qNum}`;
                          const isAnswered = studentAnswers[qKey] !== '';
                          return (
                            <a key={qNum} href={`#q-field-${qKey}`} className={`nav-question-dot ${isAnswered ? 'answered' : ''}`}
                              onClick={(e) => { e.preventDefault(); document.getElementById(`q-field-${qKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
                              {qNum}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <button className="btn btn-primary" style={{ width: '100%', marginTop: '2rem' }} onClick={() => setShowConfirmSubmit(true)}>
                  Submit Exam
                </button>
              </div>
            </aside>
          </div>

          {/* Confirm Submit Modal */}
          {showConfirmSubmit && (
            <div className="modal-overlay">
              <div className="glass-card modal-content animate-fade-in">
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', color: 'hsl(var(--warning))' }}>
                  <AlertTriangle size={24} />
                  <h3 style={{ fontSize: '1.25rem' }}>Confirm Submission</h3>
                </div>
                <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                  Are you sure you want to submit your exam? Please review all your answers carefully.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => setShowConfirmSubmit(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleManualSubmit}>Submit Exam</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STUDENT SCORE / RESULT REPORT */}
      {currentView === 'student_result' && reportSubmission && (
        <div className="dashboard-grid animate-fade-in" style={{ gridTemplateColumns: '1fr', padding: '2rem' }}>
          <div className="glass-card results-header-card">
            <h2>Exam Results</h2>
            <p style={{ color: 'hsl(var(--text-secondary))' }}>Exam: {reportSubmission.examTitle}</p>
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', margin: '1.5rem 0', flexWrap: 'wrap' }}>
              <div className="results-score-circle">
                <span className="results-score-num">{Math.round((reportSubmission.score / reportSubmission.totalQuestions) * 100)}</span>
                <span className="results-score-label">/ 100 Total</span>
              </div>
              <div className="results-score-circle reading">
                <span className="results-score-num">{reportSubmission.readingScore || 0}</span>
                <span className="results-score-label">/ {reportSubmission.totalQuestions - 30} Reading</span>
              </div>
              <div className="results-score-circle listening">
                <span className="results-score-num">{reportSubmission.listeningScore || 0}</span>
                <span className="results-score-label">/ 30 Listening</span>
              </div>
            </div>

            <p style={{ fontSize: '1.1rem', fontWeight: '600', color: 'hsl(var(--text-primary))' }}>
              {reportSubmission.score} / {reportSubmission.totalQuestions} correct answers
            </p>
            {reportSubmission.tabSwitches > 0 && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'hsl(var(--danger))', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertTriangle size={16} /> Tab switches detected: {reportSubmission.tabSwitches}
              </p>
            )}

            <button className="btn btn-secondary" style={{ marginTop: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => {
              if (user.role === 'teacher') {
                setCurrentView(backView || 'teacher_scores');
                if (backView !== 'teacher_classes') {
                  setSelectedClassForDetails(null);
                }
              } else {
                setCurrentView('student_exams');
              }
              setReportSubmission(null);
              setBackView(null);
            }}>
              <ChevronLeft size={16} />
              Back
            </button>
          </div>

          <div className="glass-card">
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', borderBottom: '1px solid hsla(var(--border-color) / 0.4)', paddingBottom: '0.5rem' }}>
              Detailed Answer Breakdown
            </h3>

            {renderTabHeaders(null)}

            {TEMPLATES[activeTab].parts.map(part => {
              const qArray = getQuestionArray(part.questionRange);
              return (
                <div key={part.partNum} className="exam-part-section animate-fade-in" style={{ marginTop: '1.5rem' }}>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>{part.title}</h4>
                  
                  <div className="results-grid">
                    {qArray.map(qNum => {
                      const qKey = `${activeTab === 'reading' ? 'r' : 'l'}_${qNum}`;
                      const detail = reportSubmission.details[qKey] || { studentAnswer: '', correctAnswer: '', isCorrect: false };
                      // Split multiple alternative keys
                      const displayKey = detail.correctAnswer.split('|').join(' or ');
                      return (
                        <div key={qNum} className={`result-item-card ${detail.isCorrect ? 'correct' : 'incorrect'}`}>
                          <div className="result-indicator">
                            {detail.isCorrect ? <CheckCircle size={18} /> : <XCircle size={18} />}
                          </div>
                          <div className="result-text-info">
                            <strong style={{ display: 'block', fontSize: '0.9rem' }}>Question {qNum}</strong>
                            <p style={{ fontSize: '0.8rem' }}>
                              Your answer: <strong className={detail.isCorrect ? 'text-success' : 'text-danger'}>
                                {detail.studentAnswer || '(Empty)'}
                              </strong>
                            </p>
                            {!detail.isCorrect && (
                              <p style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                                Correct answer: <strong className="text-success">{displayKey}</strong>
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showScrollTop && (
        <button 
          className="scroll-to-top-btn" 
          onClick={scrollToTop}
          aria-label="Scroll to top"
        >
          <ArrowUp size={20} />
        </button>
      )}
    </div>
  );
}
