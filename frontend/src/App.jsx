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
  ArrowLeft,
  Upload,
  FileText,
  Edit
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
  const [newStudentFullName, setNewStudentFullName] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentPass, setNewStudentPass] = useState('');
  const [newStudentClass, setNewStudentClass] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [editStudentFullName, setEditStudentFullName] = useState('');
  const [editStudentUsername, setEditStudentUsername] = useState('');
  const [editStudentPassword, setEditStudentPassword] = useState('');
  const [editStudentClassName, setEditStudentClassName] = useState('');

  // Multi-select & Custom Modals / Toast state
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [confirmModal, setConfirmModal] = useState(null); // { title, message, confirmText, confirmVariant, onConfirm }
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' }

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Bulk CSV Import
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvDefaultClass, setCsvDefaultClass] = useState('');
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkResult, setBulkResult] = useState(null);

  const handleBulkImportSubmit = async (e) => {
    e.preventDefault();
    if (!bulkCsvText.trim()) return;
    setBulkResult(null);

    const lines = bulkCsvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsedStudents = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0 && (line.toLowerCase().includes('username') || line.toLowerCase().includes('mật khẩu') || line.toLowerCase().includes('tên') || line.toLowerCase().includes('password') || line.toLowerCase().includes('name'))) {
        continue;
      }
      const parts = line.split(/[,;\t]+/).map(p => p.trim());
      if (parts.length >= 4) {
        parsedStudents.push({ fullName: parts[0], username: parts[1], password: parts[2], className: parts[3] });
      } else if (parts.length === 3) {
        parsedStudents.push({ fullName: parts[0], username: parts[1], password: parts[2], className: csvDefaultClass || '' });
      } else if (parts.length === 2) {
        parsedStudents.push({ fullName: parts[0], username: parts[1], password: '123456', className: csvDefaultClass || '' });
      } else if (parts.length === 1 && parts[0]) {
        parsedStudents.push({ fullName: parts[0], username: parts[0], password: '123456', className: csvDefaultClass || '' });
      }
    }

    if (parsedStudents.length === 0) {
      setBulkResult({ error: "No valid student entries found in input." });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/users/bulk`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ students: parsedStudents, defaultClass: csvDefaultClass })
      });

      const data = await res.json();
      if (!res.ok) {
        setBulkResult({ error: data.error || 'Bulk import failed.' });
        return;
      }

      setBulkResult({
        success: true,
        msg: `Import complete! Created ${data.createdCount || 0} new account(s), updated ${data.updatedCount || 0} existing account(s).`
      });
      fetchTeacherData();
    } catch (err) {
      setBulkResult({ error: "Failed to connect to server." });
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setBulkCsvText(evt.target.result || '');
    };
    reader.readAsText(file);
  };

  // Scoreboard Filters & Views
  const [scoreFilterClass, setScoreFilterClass] = useState('All');
  const [scoreSearchStudent, setScoreSearchStudent] = useState('');
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [reportingMode, setReportingMode] = useState('submissions'); // 'submissions' or 'students'
  const [activeSessions, setActiveSessions] = useState([]);

  // Student States
  const [activeExam, setActiveExam] = useState(null);
  const [studentAnswers, setStudentAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [reportSubmission, setReportSubmission] = useState(null);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const timerRef = useRef(null);
  const isSubmittingRef = useRef(false);
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

const VIEW_PATHS = {
  login: '/login',
  teacher_exams: '/teacher/exams',
  teacher_classes: '/teacher/classes',
  class_details: '/teacher/class-details',
  teacher_students: '/teacher/students',
  teacher_scores: '/teacher/scores',
  student_exams: '/student/exams',
  student_session: '/student/exam-session',
  student_result: '/student/exam-result'
};

const getPathForView = (view) => VIEW_PATHS[view] || '/';

  // Navigation with History API & Distinct URL Paths (Prevents Back & Forward buttons from exiting app)
  const changeView = (nextView, replace = false) => {
    if (nextView === currentView) return;
    const targetPath = getPathForView(nextView);
    try {
      if (replace) {
        window.history.replaceState({ view: nextView }, '', targetPath);
      } else {
        window.history.pushState({ view: nextView }, '', targetPath);
      }
    } catch (e) {
      console.error(e);
    }
    setCurrentView(nextView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Push base history state on user login / app startup
  useEffect(() => {
    const rootHome = user ? (user.role === 'teacher' ? 'teacher_exams' : 'student_exams') : 'login';
    const targetPath = getPathForView(rootHome);
    if (!window.history.state || !window.history.state.view) {
      window.history.replaceState({ view: rootHome }, '', targetPath);
    }
  }, [user]);

  // Handle Browser & Mobile Phone Back/Forward Buttons (PopState)
  useEffect(() => {
    const handlePopState = (event) => {
      // 1. Intercept Back button during active exam session
      if (currentView === 'student_session') {
        window.history.pushState({ view: 'student_session' }, '', getPathForView('student_session'));
        const confirmExit = window.confirm(
          "⚠️ WARNING: You are currently taking an exam!\nIf you leave, your exam submission will not be complete. Are you sure you want to exit?"
        );
        if (confirmExit) {
          const rootHome = user?.role === 'teacher' ? 'teacher_exams' : 'student_exams';
          changeView(rootHome, true);
        }
        return;
      }

      // 2. Navigation using browser Back & Forward buttons
      const targetView = event.state?.view;

      // Special case: If user clicks Back on student_result screen and pops back to student_session
      if (targetView === 'student_session' && currentView === 'student_result') {
        const rootHome = user?.role === 'teacher' ? 'teacher_exams' : 'student_exams';
        setCurrentView(rootHome);
        window.history.replaceState({ view: rootHome }, '', getPathForView(rootHome));
        return;
      }

      if (targetView) {
        setCurrentView(targetView);
      } else {
        // 3. Trap: If user hits back past initial app entry, push root view back so browser NEVER exits app!
        const rootHome = user ? (user.role === 'teacher' ? 'teacher_exams' : 'student_exams') : 'login';
        window.history.pushState({ view: rootHome }, '', getPathForView(rootHome));
        setCurrentView(rootHome);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentView, user]);

  // Protect against accidental tab close / refresh during exam session
  useEffect(() => {
    if (currentView !== 'student_session') return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'You are currently taking an exam. Leaving this page may cause your answers to be lost!';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentView]);

  // Sync view on startup
  useEffect(() => {
    if (user) {
      if (user.role === 'teacher') {
        changeView('teacher_exams', true);
        fetchTeacherData();
      } else {
        changeView('student_exams', true);
        fetchStudentData();
      }
    } else {
      changeView('login', true);
    }
  }, [user]);

  // Realtime polling for teacher data & live active sessions
  useEffect(() => {
    if (user?.role === 'teacher') {
      const interval = setInterval(() => {
        fetchTeacherData();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Ref to hold current student answers for heartbeat ping without breaking useEffect dependency array
  const studentAnswersRef = useRef(studentAnswers);
  useEffect(() => {
    studentAnswersRef.current = studentAnswers;
  }, [studentAnswers]);

  // Realtime student exam heartbeat ping
  useEffect(() => {
    if (currentView === 'student_session' && activeExam) {
      const sendPing = () => {
        const currentAns = studentAnswersRef.current || {};
        const answeredCount = Object.values(currentAns).filter(val => val && String(val).trim() !== '').length;
        fetch(`${API_BASE}/sessions/ping`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            examId: activeExam.id,
            examTitle: activeExam.title,
            tabSwitches: tabSwitchRef.current,
            answeredCount,
            totalQuestions: 82
          })
        }).catch(() => {});
      };
      sendPing();
      const pingInterval = setInterval(sendPing, 3000);
      return () => clearInterval(pingInterval);
    }
  }, [currentView, activeExam]);

  // Tab-switch anti-cheat tracking: 1-2 times warning, 3 times auto-submit!
  useEffect(() => {
    if (currentView !== 'student_session' || !activeExam) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        tabSwitchRef.current += 1;
        const newCount = tabSwitchRef.current;
        setTabSwitchCount(newCount);

        if (newCount >= 3) {
          if (timerRef.current) clearInterval(timerRef.current);
          submitAnswers(true, '🚨 EXAM AUTO-SUBMITTED: You switched tabs 3 times! Your exam has been automatically submitted due to anti-cheat policy.');
        } else {
          setShowTabWarning(true);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [currentView, activeExam]);

  // Completion statistics helper for exam warning
  const getExamCompletionStats = () => {
    let readingAnswered = 0;
    for (let i = 1; i <= 52; i++) {
      if (studentAnswers[`r_${i}`] && String(studentAnswers[`r_${i}`]).trim() !== '') {
        readingAnswered++;
      }
    }

    let listeningAnswered = 0;
    for (let i = 1; i <= 30; i++) {
      if (studentAnswers[`l_${i}`] && String(studentAnswers[`l_${i}`]).trim() !== '') {
        listeningAnswered++;
      }
    }

    const totalAnswered = readingAnswered + listeningAnswered;
    const readingUnanswered = 52 - readingAnswered;
    const listeningUnanswered = 30 - listeningAnswered;
    const totalUnanswered = 82 - totalAnswered;

    return {
      readingAnswered,
      readingUnanswered,
      listeningAnswered,
      listeningUnanswered,
      totalAnswered,
      totalUnanswered
    };
  };

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
      'x-user-id': encodeURIComponent(user.id || ''),
      'x-user-role': user.role || '',
      'x-user-username': encodeURIComponent(user.username || ''),
      'x-user-classname': encodeURIComponent(user.className || '')
    };
  };

  // Fetch Teacher data
  const fetchTeacherData = async () => {
    try {
      const headers = getHeaders();
      const [examsRes, studentsRes, subsRes, classesRes, sessionsRes] = await Promise.all([
        fetch(`${API_BASE}/exams`, { headers }),
        fetch(`${API_BASE}/users`, { headers }),
        fetch(`${API_BASE}/submissions`, { headers }),
        fetch(`${API_BASE}/classes`, { headers }),
        fetch(`${API_BASE}/sessions/active`, { headers })
      ]);

      if (examsRes.ok) setExams(await examsRes.json());
      if (studentsRes.ok) setStudents(await studentsRes.json());
      if (subsRes.ok) setSubmissions(await subsRes.json());
      if (classesRes.ok) setClasses(await classesRes.json());
      if (sessionsRes && sessionsRes.ok) setActiveSessions(await sessionsRes.json());
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
        setErrorMsg(data.error || 'Error creating class.');
        return;
      }
      setNewClassName('');
      fetchTeacherData();
      showToast('Class created successfully.');
    } catch (err) {
      setErrorMsg('Unable to create class.');
    }
  };

  const handleDeleteClass = (id, className) => {
    setConfirmModal({
      title: 'Delete Class',
      message: `Are you sure you want to delete class "${className || id}"?`,
      confirmText: 'Delete Class',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await fetch(`${API_BASE}/classes/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
          });
          fetchTeacherData();
          showToast('Class deleted successfully.');
        } catch (err) {
          console.error(err);
          showToast('Failed to delete class.', 'error');
        }
      }
    });
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
        setErrorMsg(data.error || 'An error occurred during sign in.');
        return;
      }
      localStorage.setItem('exam_user', JSON.stringify(data.user));
      setUser(data.user);
    } catch (err) {
      setErrorMsg('Unable to connect to the server.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('exam_user');
    setUser(null);
    changeView('login', true);
    setActiveExam(null);
    setStudentAnswers({});
    setReportSubmission(null);
  };

  // Teacher Actions
  const handleSaveExam = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!editingExam.title || !editingExam.title.trim()) {
      setErrorMsg('⚠️ Exam title cannot be empty.');
      alert('⚠️ Please enter an Exam Title.');
      return;
    }

    const missingQuestions = [];

    // Check active parts for reading
    const readingActive = editingExam.activeParts?.reading ?? TEMPLATES.reading.parts.map(p => p.partNum);
    TEMPLATES.reading.parts.forEach(part => {
      if (readingActive.includes(part.partNum)) {
        const qArray = getQuestionArray(part.questionRange);
        qArray.forEach(qNum => {
          const qKey = `r_${qNum}`;
          const slots = editingExam.questionSlots?.[qKey] || part.slots || 1;
          for (let s = 1; s <= slots; s++) {
            const sKey = s === 1 ? qKey : `${qKey}_s${s}`;
            const val = editingExam.keyAnswers?.[sKey];
            if (!val || String(val).trim() === '') {
              const label = slots > 1 ? `Question ${qNum}.${s}` : `Question ${qNum}`;
              missingQuestions.push(`Reading Part ${part.partNum} (${label})`);
            }
          }
        });
      }
    });

    // Check active parts for listening
    const listeningActive = editingExam.activeParts?.listening ?? TEMPLATES.listening.parts.map(p => p.partNum);
    TEMPLATES.listening.parts.forEach(part => {
      if (listeningActive.includes(part.partNum)) {
        const qArray = getQuestionArray(part.questionRange);
        qArray.forEach(qNum => {
          const qKey = `l_${qNum}`;
          const slots = editingExam.questionSlots?.[qKey] || part.slots || 1;
          for (let s = 1; s <= slots; s++) {
            const sKey = s === 1 ? qKey : `${qKey}_s${s}`;
            const val = editingExam.keyAnswers?.[sKey];
            if (!val || String(val).trim() === '') {
              const label = slots > 1 ? `Question ${qNum}.${s}` : `Question ${qNum}`;
              missingQuestions.push(`Listening Part ${part.partNum} (${label})`);
            }
          }
        });
      }
    });

    if (missingQuestions.length > 0) {
      alert(`⚠️ CANNOT SAVE EXAM: ALL ANSWER KEYS ARE MANDATORY!\nNo empty answer boxes are allowed.\n\nMissing answer key for ${missingQuestions.length} question(s):\n• ` + missingQuestions.slice(0, 8).join('\n• ') + (missingQuestions.length > 8 ? `\n...and ${missingQuestions.length - 8} more.` : ''));
      setErrorMsg(`⚠️ Cannot save exam: ${missingQuestions.length} answer key box(es) are missing! Please fill in all answer keys.`);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/exams`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(editingExam)
      });
      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || 'Error saving exam.');
        return;
      }
      setSuccessMsg('Exam saved successfully.');
      setEditingExam(null);
      fetchTeacherData();
    } catch (err) {
      setErrorMsg('Connection error while saving exam.');
    }
  };

  const handleDeleteExam = (id, title) => {
    setConfirmModal({
      title: 'Delete Exam',
      message: `Are you sure you want to delete exam "${title || 'this exam'}"? All student submissions for this exam will also be permanently deleted.`,
      confirmText: 'Delete Exam',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await fetch(`${API_BASE}/exams/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
          });
          fetchTeacherData();
          showToast('Exam deleted successfully.');
        } catch (err) {
          console.error(err);
          showToast('Failed to delete exam.', 'error');
        }
      }
    });
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!newStudentName || !newStudentPass) return;
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          fullName: newStudentFullName || newStudentName,
          username: newStudentName,
          password: newStudentPass,
          className: newStudentClass
        })
      });
      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || 'Error adding student account.');
        showToast(data.error || 'Error adding student account.', 'error');
        return;
      }
      setNewStudentFullName('');
      setNewStudentName('');
      setNewStudentPass('');
      setNewStudentClass('');
      fetchTeacherData();
      showToast('Student account created successfully!');
    } catch (err) {
      setErrorMsg('Unable to add student account.');
      showToast('Unable to add student account.', 'error');
    }
  };

  const handleDeleteStudent = (id, name) => {
    setConfirmModal({
      title: 'Delete Student Account',
      message: `Are you sure you want to delete student account "${name || 'selected student'}"?`,
      confirmText: 'Delete Account',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await fetch(`${API_BASE}/users/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
          });
          setSelectedStudentIds(prev => prev.filter(sId => sId !== id));
          fetchTeacherData();
          showToast('Student account deleted successfully.');
        } catch (err) {
          console.error(err);
          showToast('Failed to delete student account.', 'error');
        }
      }
    });
  };

  const handleBulkDeleteSelectedStudents = () => {
    if (selectedStudentIds.length === 0) return;
    const count = selectedStudentIds.length;
    setConfirmModal({
      title: 'Delete Selected Student Accounts',
      message: `Are you sure you want to delete ${count} selected student account(s)? This action cannot be undone.`,
      confirmText: `Delete ${count} Account(s)`,
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE}/users/bulk-delete`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ ids: selectedStudentIds })
          });
          if (res.ok) {
            setSelectedStudentIds([]);
            fetchTeacherData();
            showToast(`Successfully deleted ${count} student account(s).`);
          } else {
            showToast('Failed to delete selected student accounts.', 'error');
          }
        } catch (err) {
          console.error("Bulk delete error:", err);
          showToast('Server connection error while deleting student accounts.', 'error');
        }
      }
    });
  };

  const handleSaveEditStudent = async (e) => {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      const res = await fetch(`${API_BASE}/users/${editingStudent.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          fullName: editStudentFullName,
          username: editStudentUsername,
          password: editStudentPassword,
          className: editStudentClassName
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to update student account.', 'error');
        return;
      }
      setEditingStudent(null);
      fetchTeacherData();
      showToast('Student account updated successfully!');
    } catch (err) {
      console.error("Error saving student edit:", err);
      showToast('Server connection error.', 'error');
    }
  };

  const handleToggleClassAssignment = async (examId, className, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/exams/${examId}/assign`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ className, status: newStatus })
      });
      if (res.ok) {
        fetchTeacherData();
      }
    } catch (err) {
      console.error("Error toggling exam assignment:", err);
    }
  };

  // Student Actions
  const handleStartExam = (exam) => {
    setActiveExam(exam);
    // Reset tab-switch tracker & submission state
    tabSwitchRef.current = 0;
    isSubmittingRef.current = false;
    setTabSwitchCount(0);
    setShowTabWarning(false);
    // Initialize answers
    const initial = {};
    for (let i = 1; i <= 52; i++) initial[`r_${i}`] = '';
    for (let i = 1; i <= 30; i++) initial[`l_${i}`] = '';
    setStudentAnswers(initial);
    setTimeLeft(exam.durationMinutes * 60);
    setActiveTab('reading');
    changeView('student_session');
  };

  const handleAutoSubmit = async (reason = 'Time is up! Your answers have been submitted automatically.') => {
    if (timerRef.current) clearInterval(timerRef.current);
    await submitAnswers(true, reason);
  };

  const handleManualSubmit = async () => {
    setShowConfirmSubmit(false);
    if (timerRef.current) clearInterval(timerRef.current);
    await submitAnswers(false);
  };

  const submitAnswers = async (isAuto = false, autoReason = 'Time is up! Your answers have been submitted automatically.') => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      const currentAns = studentAnswersRef.current || studentAnswers;
      const res = await fetch(`${API_BASE}/submissions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          examId: activeExam.id,
          answers: currentAns,
          tabSwitches: tabSwitchRef.current
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert('Submission error: ' + (data.error || 'Unknown error'));
        isSubmittingRef.current = false;
        return;
      }
      setReportSubmission(data);
      changeView('student_result', false);
      if (isAuto) alert(autoReason);
      else alert('Submitted successfully!');
      fetchStudentData();
    } catch {
      alert('Connection error while submitting!');
      isSubmittingRef.current = false;
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
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, lineHeight: 1.1 }}>ATO Test Hub</h1>
              <span style={{ fontSize: '0.72rem', color: 'hsl(var(--primary))', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Enjoy Every Test</span>
            </div>
          </div>
          <div className="user-info">
            <span className="user-role-badge">{user.role === 'teacher' ? 'Teacher' : 'Student'}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={16} />
              <strong style={{ fontSize: '0.95rem' }}>{user.fullName || user.username}</strong>
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.25rem' }}>
              <BookOpen size={48} style={{ color: 'hsl(var(--primary))', marginBottom: '0.5rem' }} />
              <h1 style={{ fontSize: '1.85rem', fontWeight: '800', margin: 0, color: 'hsl(var(--primary))', letterSpacing: '-0.02em' }}>ATO Test Hub</h1>
              <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '0.2rem' }}>Enjoy Every Test</span>
            </div>
            <h2 style={{ fontSize: '1.2rem', textAlign: 'center', marginTop: '0.25rem', marginBottom: '0.25rem' }}>Sign In</h2>
            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginBottom: '1.5rem' }}>Enter your Username and Password to sign in</p>
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
                <input className="form-input" name="username" type="text" placeholder="Enter username (e.g. john_d or teacher)" required />
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
      {user?.role === 'teacher' && (currentView.startsWith('teacher_') || currentView === 'class_details') && (
        <div className="dashboard-grid animate-fade-in">
          {/* Sidebar */}
          <aside className="sidebar-nav">
            <div className="glass-cardNav" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div className={`sidebar-link ${currentView === 'teacher_exams' ? 'active' : ''}`} onClick={() => { changeView('teacher_exams'); setEditingExam(null); }}>
                <ClipboardList size={18} />
                <span>Manage Exams</span>
              </div>
              <div className={`sidebar-link ${currentView === 'teacher_classes' || currentView === 'class_details' ? 'active' : ''}`} onClick={() => { changeView('teacher_classes'); setEditingExam(null); }}>
                <BookOpen size={18} />
                <span>Manage Classes</span>
              </div>
              <div className={`sidebar-link ${currentView === 'teacher_students' ? 'active' : ''}`} onClick={() => { changeView('teacher_students'); setEditingExam(null); }}>
                <Users size={18} />
                <span>Student Accounts</span>
              </div>
              <div className={`sidebar-link ${currentView === 'teacher_scores' ? 'active' : ''}`} onClick={() => { changeView('teacher_scores'); setEditingExam(null); }}>
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
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                {(() => {
                                  const list = Array.isArray(ex.assignedClasses) && ex.assignedClasses.length > 0
                                    ? ex.assignedClasses
                                    : (ex.assignedClass ? ex.assignedClass.split(',').map(s => s.trim()) : ['All']);
                                  return list.map(c => (
                                    <span key={c} className="user-role-badge" style={{ background: c !== 'All' ? 'hsla(var(--success) / 0.12)' : 'hsla(var(--primary) / 0.12)', color: c !== 'All' ? 'hsl(var(--success))' : 'hsl(var(--primary))' }}>
                                      {c}
                                    </span>
                                  ));
                                })()}
                              </div>
                            </td>
                            <td>{ex.durationMinutes} mins</td>
                            <td>{Object.keys(ex.keyAnswers || {}).length} / 82 keys set</td>
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
                    <p style={{ color: 'hsl(var(--text-secondary))' }}>Configure settings and enter the answer key for automatic grading.</p>
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
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.4rem', display: 'block' }}>
                      Assign to classes:
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', background: 'hsla(var(--background-card-raw) / 0.4)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid hsla(var(--border-color) / 0.3)' }}>
                      {(() => {
                        const currentClasses = Array.isArray(editingExam.assignedClasses) && editingExam.assignedClasses.length > 0
                          ? editingExam.assignedClasses 
                          : (editingExam.assignedClass ? editingExam.assignedClass.split(',').map(s => s.trim()) : ['All']);
                        const isAllSelected = currentClasses.includes('All');

                        return (
                          <>
                            <label style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '0.4rem', 
                              cursor: 'pointer', 
                              padding: '0.35rem 0.75rem', 
                              borderRadius: 'var(--radius-sm)', 
                              background: isAllSelected ? 'hsla(var(--primary) / 0.15)' : 'hsla(var(--border-color) / 0.15)', 
                              border: `1px solid ${isAllSelected ? 'hsl(var(--primary))' : 'hsla(var(--border-color) / 0.3)'}`,
                              fontWeight: '600',
                              fontSize: '0.85rem',
                              color: isAllSelected ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))'
                            }}>
                              <input 
                                type="checkbox"
                                checked={isAllSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEditingExam({ ...editingExam, assignedClasses: ['All'], assignedClass: 'All' });
                                  } else {
                                    setEditingExam({ ...editingExam, assignedClasses: [], assignedClass: '' });
                                  }
                                }}
                              />
                              All Classes (All)
                            </label>

                            {classes.map(c => {
                              const isChecked = !isAllSelected && currentClasses.includes(c.name);
                              return (
                                <label key={c.id} style={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '0.4rem', 
                                  cursor: 'pointer', 
                                  padding: '0.35rem 0.75rem', 
                                  borderRadius: 'var(--radius-sm)', 
                                  background: isChecked ? 'hsla(var(--success) / 0.15)' : 'hsla(var(--border-color) / 0.15)', 
                                  border: `1px solid ${isChecked ? 'hsl(var(--success))' : 'hsla(var(--border-color) / 0.3)'}`,
                                  fontWeight: '600',
                                  fontSize: '0.85rem',
                                  color: isChecked ? 'hsl(var(--success))' : 'hsl(var(--text-secondary))'
                                }}>
                                  <input 
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      let newArr = currentClasses.filter(x => x !== 'All');
                                      if (e.target.checked) {
                                        newArr.push(c.name);
                                      } else {
                                        newArr = newArr.filter(x => x !== c.name);
                                      }
                                      setEditingExam({
                                        ...editingExam,
                                        assignedClasses: newArr,
                                        assignedClass: newArr.length === 0 ? 'All' : newArr.join(', ')
                                      });
                                    }}
                                  />
                                  {c.name}
                                </label>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <h2 style={{ fontSize: '1.25rem', marginTop: '2rem', borderBottom: '1px solid hsla(var(--border-color) / 0.4)', paddingBottom: '0.5rem' }}>
                  Detailed Answer Key Settings <span style={{ color: 'hsl(var(--danger))', fontSize: '0.85rem', fontWeight: 'bold' }}>(* MANDATORY: All boxes must be filled)</span>
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginTop: '0.25rem', marginBottom: '1.5rem' }}>
                  * For fill-in-the-blank questions, enter multiple acceptable answers separated by a pipe "|" (e.g. <code>known | well-known</code>). Case and extra whitespace are automatically ignored.
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
                  return (
                    <div key={part.partNum} className="exam-part-section animate-fade-in">
                      <h3>{part.title}</h3>
                      <p>{part.description}</p>
                      <div className="questions-grid">
                        {qArray.map(qNum => {
                          const prefix = activeTab === 'reading' ? 'r' : 'l';
                          const qKey = `${prefix}_${qNum}`;
                          const customSlots = editingExam.questionSlots?.[qKey] || (part.slots || 1);
                          const slotKeys = Array.from({ length: customSlots }, (_, i) => i === 0 ? qKey : `${qKey}_s${i + 1}`);

                          // Check if any slot in this question is missing key answer
                          const isAnyMissing = slotKeys.some(sKey => !editingExam.keyAnswers[sKey] || !editingExam.keyAnswers[sKey].trim());

                          return (
                            <div key={qKey} className="question-row" style={isAnyMissing ? { border: '1px dashed hsla(var(--danger) / 0.5)', background: 'hsla(var(--danger) / 0.03)', alignItems: 'flex-start' } : { alignItems: 'flex-start' }}>
                              <span className="question-num" style={{ marginTop: '0.2rem' }}>{qNum}</span>
                              {part.type === 'mcq' ? (
                                <div className="answer-mcq-options">
                                  {part.options.map(opt => (
                                    <button key={opt} type="button" className={`mcq-option-btn ${editingExam.keyAnswers[qKey] === opt ? 'selected' : ''}`}
                                      onClick={() => setEditingExam({ ...editingExam, keyAnswers: { ...editingExam.keyAnswers, [qKey]: opt } })}>
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, width: '100%' }}>
                                  {slotKeys.map((sKey, sIdx) => {
                                    const currentVal = editingExam.keyAnswers[sKey] || '';
                                    const isSlotMissing = !currentVal || !currentVal.trim();
                                    const placeholder = Array.isArray(part.placeholder) ? (part.placeholder[sIdx] || `Word ${sIdx + 1}...`) : (part.placeholder || `Word ${sIdx + 1}...`);

                                    return (
                                      <div key={sKey} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%' }}>
                                        <input className="answer-text-input" type="text" placeholder={placeholder}
                                          style={{
                                            flex: 1,
                                            minWidth: '130px',
                                            ...(part.uppercase ? { textTransform: 'uppercase' } : {}),
                                            border: isSlotMissing ? '1.5px solid hsla(var(--danger) / 0.7)' : '1px solid hsl(var(--border-color))'
                                          }}
                                          value={currentVal}
                                          required
                                          onChange={e => {
                                            const val = part.uppercase ? e.target.value.toUpperCase() : e.target.value;
                                            setEditingExam({ ...editingExam, keyAnswers: { ...editingExam.keyAnswers, [sKey]: val } });
                                          }} />

                                        {sIdx > 0 && (
                                          <button
                                            type="button"
                                            title="Delete this input box"
                                            style={{
                                              background: 'hsla(var(--danger) / 0.1)',
                                              color: 'hsl(var(--danger))',
                                              border: '1px solid hsla(var(--danger) / 0.3)',
                                              borderRadius: 'var(--radius-sm)',
                                              padding: '0.35rem 0.45rem',
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center'
                                            }}
                                            onClick={() => {
                                              const updatedKeys = { ...editingExam.keyAnswers };
                                              delete updatedKeys[sKey];
                                              const nextSlots = Math.max(1, customSlots - 1);
                                              setEditingExam({
                                                ...editingExam,
                                                keyAnswers: updatedKeys,
                                                questionSlots: {
                                                  ...(editingExam.questionSlots || {}),
                                                  [qKey]: nextSlots
                                                }
                                              });
                                            }}
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}

                                  <div style={{ marginTop: '0.1rem' }}>
                                    <button
                                      type="button"
                                      title="Add another input box for this question"
                                      style={{
                                        background: 'hsla(var(--primary) / 0.08)',
                                        color: 'hsl(var(--primary))',
                                        border: '1px dashed hsla(var(--primary) / 0.4)',
                                        borderRadius: 'var(--radius-sm)',
                                        padding: '0.25rem 0.5rem',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                        fontSize: '0.75rem',
                                        fontWeight: '600'
                                      }}
                                      onClick={() => {
                                        const nextSlots = customSlots + 1;
                                        setEditingExam({
                                          ...editingExam,
                                          questionSlots: {
                                            ...(editingExam.questionSlots || {}),
                                            [qKey]: nextSlots
                                          }
                                        });
                                      }}
                                    >
                                      <Plus size={13} /> Add Word Input
                                    </button>
                                  </div>
                                </div>
                              )}
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
                <h2>Class Management</h2>
                <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem' }}>Manage center class lists, view student rosters, and configure exam assignments.</p>

                <form onSubmit={handleAddClass} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '2rem', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                    <label className="form-label">Class Name</label>
                    <input className="form-input" type="text" placeholder="e.g. B1.4F" value={newClassName} onChange={e => setNewClassName(e.target.value)} required />
                  </div>
                  <button className="btn btn-primary" type="submit" style={{ height: '2.7rem' }}>
                    <Plus size={16} />
                    Create Class
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ height: '2.7rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }} onClick={() => { setShowCsvModal(true); setCsvDefaultClass(''); setBulkResult(null); setBulkCsvText(''); }}>
                    <Upload size={16} />
                    Import CSV / Bulk Students
                  </button>
                </form>

                {errorMsg && <div style={{ color: 'hsl(var(--danger))', marginBottom: '1rem' }}>{errorMsg}</div>}

                {/* Realtime Active Students Monitor */}
                {activeSessions.length > 0 && (
                  <div style={{
                    background: 'hsla(var(--success) / 0.08)',
                    border: '1.5px solid hsl(var(--success))',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem 1.25rem',
                    marginBottom: '1.5rem'
                  }}>
                    <h4 style={{ color: 'hsl(var(--success))', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'hsl(var(--success))' }}></span>
                      Live Active Students ({activeSessions.length} taking exam right now)
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {activeSessions.map((sess, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'hsl(var(--card-bg))', padding: '0.5rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border-color))' }}>
                          <div>
                            <strong style={{ fontSize: '0.9rem', color: 'hsl(var(--text-primary))' }}>{sess.studentName}</strong>
                            {sess.className && <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'hsl(var(--primary))', fontWeight: 'bold' }}>({sess.className})</span>}
                            <span style={{ marginLeft: '0.75rem', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>— Taking: "{sess.examTitle}"</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'hsl(var(--primary))', background: 'hsla(var(--primary)/0.1)', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                              📝 Answered: {sess.answeredCount || 0}/{sess.totalQuestions || 82}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: sess.tabSwitches > 0 ? 'hsl(var(--danger))' : 'hsl(var(--text-secondary))', fontWeight: sess.tabSwitches > 0 ? 'bold' : 'normal', fontSize: '0.85rem' }}>
                              <AlertTriangle size={14} />
                              <span>Tab switches: {sess.tabSwitches || 0}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Class Name</th>
                        <th>Class Code</th>
                        <th style={{ width: '220px' }}>Actions</th>
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
                                onClick={() => {
                                  setSelectedClassForDetails(c);
                                  setCurrentView('class_details');
                                }}
                                title="Click to view full class portal"
                              >
                                <Users size={15} style={{ opacity: 0.8 }} />
                                {c.name}
                              </span>
                            </td>
                            <td style={{ fontFamily: 'monospace' }}>{c.id}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => {
                                    setSelectedClassForDetails(c);
                                    setCurrentView('class_details');
                                  }}
                                  style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                                >
                                  <Eye size={13} /> View Portal
                                </button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClass(c.id)}>
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

            {/* View 1d: Dedicated Class Details Screen */}
            {currentView === 'class_details' && selectedClassForDetails && (
              <div className="glass-card animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setSelectedClassForDetails(null);
                        setCurrentView('teacher_classes');
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <ArrowLeft size={16} /> Back to Classes
                    </button>
                    <div>
                      <h2 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                        <Users size={22} style={{ color: 'hsl(var(--primary))' }} />
                        <span>Class Portal: {selectedClassForDetails.name}</span>
                      </h2>
                      <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>
                        Code: <code style={{ background: 'hsla(var(--border-color)/0.3)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{selectedClassForDetails.id}</code> | Total Students: {students.filter(s => s.className === selectedClassForDetails.name).length}
                      </p>
                    </div>
                  </div>
                  <button className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }} onClick={() => { setShowCsvModal(true); setCsvDefaultClass(selectedClassForDetails.name); setBulkResult(null); setBulkCsvText(''); }}>
                    <Upload size={14} /> Import Students to Class
                  </button>
                </div>

                {/* Section A: Assigned Exams & Per-Class Controls */}
                <div style={{ marginBottom: '2.5rem', background: 'hsl(var(--bg-primary))', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid hsl(var(--border-color))' }}>
                  <h3 style={{ fontSize: '1.1rem', color: 'hsl(var(--text-primary))', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={18} style={{ color: 'hsl(var(--primary))' }} />
                    Assigned Exams & Status Controls
                  </h3>
                  {(() => {
                    const classExams = exams.filter(ex => {
                      const assignedList = Array.isArray(ex.assignedClasses) && ex.assignedClasses.length > 0
                        ? ex.assignedClasses
                        : (ex.assignedClass ? ex.assignedClass.split(',').map(s => s.trim()) : ['All']);
                      return assignedList.includes('All') || assignedList.some(c => c.toLowerCase() === selectedClassForDetails.name.toLowerCase());
                    });

                    if (classExams.length === 0) {
                      return <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>No exams currently assigned to this class.</p>;
                    }

                    return (
                      <div className="table-container" style={{ background: 'hsl(var(--card-bg))' }}>
                        <table className="data-table" style={{ fontSize: '0.85rem' }}>
                          <thead>
                            <tr>
                              <th>Exam Title</th>
                              <th>Duration</th>
                              <th>Status for {selectedClassForDetails.name}</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {classExams.map(ex => {
                              const assignments = ex.assignments || {};
                              let status = 'active';
                              for (const key of Object.keys(assignments)) {
                                if (key.toLowerCase() === selectedClassForDetails.name.toLowerCase()) {
                                  status = assignments[key].status || 'active';
                                  break;
                                }
                              }

                              return (
                                <tr key={ex.id}>
                                  <td><strong>{ex.title}</strong></td>
                                  <td>{ex.durationMinutes} mins</td>
                                  <td>
                                    <span className="user-role-badge" style={{
                                      background: status === 'active' ? 'hsla(var(--success) / 0.15)' : status === 'ended' ? 'hsla(var(--warning) / 0.15)' : 'hsla(var(--danger) / 0.15)',
                                      color: status === 'active' ? 'hsl(var(--success))' : status === 'ended' ? 'hsl(var(--warning))' : 'hsl(var(--danger))',
                                      fontWeight: '600'
                                    }}>
                                      {status === 'active' ? '🟢 Active' : status === 'ended' ? '🟡 Paused / Ended' : '🔴 Unassigned'}
                                    </span>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                                      {status !== 'active' && (
                                        <button
                                          className="btn btn-secondary btn-sm"
                                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: 'hsl(var(--success))' }}
                                          onClick={() => handleToggleClassAssignment(ex.id, selectedClassForDetails.name, 'active')}
                                        >
                                          Activate
                                        </button>
                                      )}
                                      {status === 'active' && (
                                        <button
                                          className="btn btn-secondary btn-sm"
                                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: 'hsl(var(--warning))' }}
                                          onClick={() => handleToggleClassAssignment(ex.id, selectedClassForDetails.name, 'ended')}
                                        >
                                          Pause Exam
                                        </button>
                                      )}
                                      <button
                                        className="btn btn-danger btn-sm"
                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                        onClick={() => {
                                          if (window.confirm(`Unassign "${ex.title}" from class ${selectedClassForDetails.name}?`)) {
                                            handleToggleClassAssignment(ex.id, selectedClassForDetails.name, 'unassigned');
                                          }
                                        }}
                                        title="Remove exam from this class"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>

                {/* Section B: Student Roster & Exam Submissions Progress */}
                <div style={{ background: 'hsl(var(--bg-primary))', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid hsl(var(--border-color))' }}>
                  <h3 style={{ fontSize: '1.1rem', color: 'hsl(var(--text-primary))', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={18} style={{ color: 'hsl(var(--primary))' }} />
                    Student Roster & Submission History
                  </h3>
                  {(() => {
                    const classStudents = students.filter(s => s.className === selectedClassForDetails.name);
                    if (classStudents.length === 0) {
                      return <p style={{ color: 'hsl(var(--text-secondary))', fontStyle: 'italic', padding: '1rem 0' }}>No students registered in this class.</p>;
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {classStudents.map(st => {
                          const studentSubs = submissions.filter(sub => sub.studentId === st.id || sub.studentName === st.username);
                          const activeSession = activeSessions.find(s => s.studentId === st.id || (s.studentName && s.studentName.toLowerCase() === st.username.toLowerCase()));
                          return (
                            <div key={st.id} style={{ border: activeSession ? '1.5px solid hsl(var(--success))' : '1px solid hsl(var(--border-color))', borderRadius: 'var(--radius-md)', padding: '1rem', background: activeSession ? 'hsla(var(--success) / 0.03)' : 'hsl(var(--card-bg))', transition: 'all 0.2s ease' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <strong style={{ fontSize: '1rem', color: 'hsl(var(--text-primary))' }}>{st.fullName || st.username}</strong>
                                  {st.fullName && <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>({st.username})</span>}
                                  {activeSession && (
                                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', background: 'hsla(var(--success) / 0.15)', color: 'hsl(var(--success))', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'hsl(var(--success))' }}></span> LIVE NOW
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', background: 'hsl(var(--bg-secondary))', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                                  Completed {studentSubs.length} exams
                                </span>
                              </div>

                              {activeSession && (
                                <div style={{
                                  background: 'hsla(var(--success) / 0.1)',
                                  border: '1px solid hsla(var(--success) / 0.3)',
                                  borderRadius: 'var(--radius-sm)',
                                  padding: '0.6rem 0.8rem',
                                  marginTop: '0.5rem',
                                  marginBottom: '0.75rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: '0.5rem'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Clock size={16} style={{ color: 'hsl(var(--success))' }} />
                                    <strong style={{ color: 'hsl(var(--success))', fontSize: '0.88rem' }}>
                                      Currently taking: "{activeSession.examTitle}"
                                    </strong>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'hsla(var(--primary) / 0.15)', color: 'hsl(var(--primary))', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                      <FileText size={14} />
                                      <span>Progress: {activeSession.answeredCount || 0}/{activeSession.totalQuestions || 82} answered ({Math.round(((activeSession.answeredCount || 0) / (activeSession.totalQuestions || 82)) * 100)}%)</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: activeSession.tabSwitches > 0 ? 'hsla(var(--danger) / 0.15)' : 'hsl(var(--bg-secondary))', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
                                      <AlertTriangle size={14} style={{ color: activeSession.tabSwitches > 0 ? 'hsl(var(--danger))' : 'hsl(var(--text-secondary))' }} />
                                      <span style={{ fontSize: '0.85rem', fontWeight: activeSession.tabSwitches > 0 ? 'bold' : '500', color: activeSession.tabSwitches > 0 ? 'hsl(var(--danger))' : 'hsl(var(--text-secondary))' }}>
                                        Live Tab Switches: {activeSession.tabSwitches || 0} time{activeSession.tabSwitches !== 1 ? 's' : ''}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {studentSubs.length > 0 ? (
                                <div className="table-container" style={{ margin: '0.5rem 0 0 0' }}>
                                  <table className="data-table" style={{ fontSize: '0.85rem' }}>
                                    <thead>
                                      <tr>
                                        <th>Exam Title</th>
                                        <th>Submitted Date</th>
                                        <th>Score</th>
                                        <th>Tab Switches</th>
                                        <th>Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {studentSubs.map(sub => {
                                        const pct = Math.round((sub.score / sub.totalQuestions) * 100);
                                        return (
                                          <tr key={sub.id}>
                                            <td><strong>{sub.examTitle}</strong></td>
                                            <td style={{ fontSize: '0.75rem' }}>{new Date(sub.submittedAt).toLocaleDateString()}</td>
                                            <td style={{ fontWeight: '600', color: pct >= 50 ? 'hsl(var(--success))' : 'hsl(var(--danger))' }}>
                                              {sub.score}/{sub.totalQuestions} ({pct}%)
                                            </td>
                                            <td>
                                              <span style={{ color: (sub.tabSwitches || 0) > 0 ? 'hsl(var(--danger))' : 'hsl(var(--text-secondary))', fontWeight: (sub.tabSwitches || 0) > 0 ? 'bold' : 'normal' }}>
                                                {sub.tabSwitches || 0} times
                                              </span>
                                            </td>
                                            <td>
                                              <button
                                                className="btn btn-secondary btn-sm"
                                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                                onClick={() => {
                                                  setReportSubmission(sub);
                                                  setCurrentView('student_result');
                                                  setBackView('class_details');
                                                }}
                                              >
                                                <Eye size={12} />
                                                View Submission
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', margin: '0.25rem 0 0 0', fontStyle: 'italic' }}>No submissions recorded yet for this student.</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {currentView === 'class_details' && !selectedClassForDetails && (
              <div className="glass-card animate-fade-in" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ color: 'hsl(var(--text-muted))', marginBottom: '1rem' }}>No class selected.</p>
                <button className="btn btn-primary btn-sm" onClick={() => changeView('teacher_classes')}>
                  <ArrowLeft size={14} style={{ marginRight: '0.25rem' }} /> Back to Manage Classes
                </button>
              </div>
            )}

            {currentView === 'teacher_students' && (
              <div className="glass-card animate-fade-in">
                <h2>Student Accounts</h2>
                <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem' }}>Create login accounts for students to access and submit exams.</p>

                <form onSubmit={handleAddStudent} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: 1.2, minWidth: '160px', marginBottom: 0 }}>
                    <label className="form-label">Full Name</label>
                    <input className="form-input" type="text" placeholder="e.g. John Doe" value={newStudentFullName} onChange={e => setNewStudentFullName(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: '140px', marginBottom: 0 }}>
                    <label className="form-label">Username</label>
                    <input className="form-input" type="text" placeholder="e.g. john_d" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: '130px', marginBottom: 0 }}>
                    <label className="form-label">Password</label>
                    <input className="form-input" type="text" placeholder="Password..." value={newStudentPass} onChange={e => setNewStudentPass(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: '130px', marginBottom: 0 }}>
                    <label className="form-label">Class</label>
                    <select className="form-input" value={newStudentClass} onChange={e => setNewStudentClass(e.target.value)} required style={{ height: '2.7rem', padding: '0.5rem', background: 'hsla(var(--background-card-raw) / 0.6)', color: 'hsl(var(--text-primary))' }}>
                      <option value="">-- Select Class --</option>
                      {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-primary" type="submit" style={{ height: '2.7rem' }}>
                    <Plus size={16} /> Add Student
                  </button>
                </form>

                {/* Bulk CSV Import */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setShowBulkImport(!showBulkImport); setBulkResult(null); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Upload size={14} /> {showBulkImport ? 'Hide' : 'Bulk Import Students (CSV)'}
                  </button>
                  {showBulkImport && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'hsla(var(--primary) / 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid hsla(var(--primary) / 0.15)' }}>
                      <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '0.5rem' }}>
                        One student per line: <code style={{ background: 'hsla(var(--border-color)/0.3)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Full Name, Username, Password, Class</code>
                      </p>
                      <textarea
                        rows={6} placeholder={"John Doe,john_d,pass123,12A1\nJane Smith,jane_s,pass456,12A2"}
                        value={bulkCsvText} onChange={e => setBulkCsvText(e.target.value)}
                        style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border-color))', background: 'hsl(var(--card-bg))', color: 'hsl(var(--text-primary))', resize: 'vertical', boxSizing: 'border-box' }}
                      />
                      <button className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem' }} onClick={handleBulkImportSubmit}>
                        <FileText size={14} /> Process Bulk Import
                      </button>
                      {bulkResult && (
                        <div style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                          {bulkResult.error && <p style={{ color: 'hsl(var(--danger))' }}>❌ {bulkResult.error}</p>}
                          {bulkResult.success && <p style={{ color: 'hsl(var(--success))' }}>✅ {bulkResult.msg}</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Bulk Actions Bar */}
                {selectedStudentIds.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'hsla(var(--danger) / 0.12)', padding: '0.65rem 1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', border: '1px solid hsla(var(--danger) / 0.3)' }} className="animate-fade-in">
                    <span style={{ fontSize: '0.9rem', color: 'hsl(var(--danger))', fontWeight: 'bold' }}>
                      Selected {selectedStudentIds.length} student account(s)
                    </span>
                    <button className="btn btn-danger btn-sm" onClick={handleBulkDeleteSelectedStudents} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Trash2 size={14} /> Delete Selected ({selectedStudentIds.length})
                    </button>
                  </div>
                )}

                {errorMsg && <div style={{ color: 'hsl(var(--danger))', marginBottom: '1rem' }}>{errorMsg}</div>}

                <div className="table-container">
                  <table className="data-table">
                    <thead><tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={students.length > 0 && selectedStudentIds.length === students.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudentIds(students.map(s => s.id));
                            } else {
                              setSelectedStudentIds([]);
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                      </th>
                      <th>Full Name</th><th>Username</th><th>Password</th><th>Class</th><th>Role</th><th style={{ width: '100px' }}>Actions</th>
                    </tr></thead>
                    <tbody>
                      {students.length === 0 ? (
                        <tr><td colSpan="7" style={{ textAlign: 'center', color: 'hsl(var(--text-muted))' }}>No student accounts found.</td></tr>
                      ) : (
                        students.map(st => (
                          <tr key={st.id} style={{ background: selectedStudentIds.includes(st.id) ? 'hsla(var(--primary) / 0.06)' : undefined }}>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={selectedStudentIds.includes(st.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedStudentIds([...selectedStudentIds, st.id]);
                                  } else {
                                    setSelectedStudentIds(selectedStudentIds.filter(id => id !== st.id));
                                  }
                                }}
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                            <td><strong>{st.fullName || st.username}</strong></td>
                            <td style={{ fontFamily: 'monospace', color: 'hsl(var(--primary))' }}>{st.username}</td>
                            <td style={{ fontFamily: 'monospace' }}>{st.password}</td>
                            <td><span className="user-role-badge" style={{ background: 'hsla(var(--primary) / 0.08)', color: 'hsl(var(--primary))' }}>{st.className || 'Unassigned'}</span></td>
                            <td>Student</td>
                            <td style={{ display: 'flex', gap: '0.4rem' }}>
                              <button className="btn btn-secondary btn-sm" title="Edit Student Information" onClick={() => {
                                setEditingStudent(st);
                                setEditStudentFullName(st.fullName || st.username);
                                setEditStudentUsername(st.username);
                                setEditStudentPassword(st.password);
                                setEditStudentClassName(st.className || '');
                              }}>
                                <Edit size={14} />
                              </button>
                              <button className="btn btn-danger btn-sm" title="Delete Student" onClick={() => handleDeleteStudent(st.id, st.fullName || st.username)}>
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* EDIT STUDENT MODAL */}
                {editingStudent && (
                  <div className="modal-overlay">
                    <div className="glass-card modal-content animate-fade-in" style={{ maxWidth: '480px', width: '92%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'hsl(var(--text-primary))' }}>
                          <Edit size={20} style={{ color: 'hsl(var(--primary))' }} />
                          Edit Student Account
                        </h3>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingStudent(null)}>✕</button>
                      </div>

                      <form onSubmit={handleSaveEditStudent}>
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                          <label className="form-label">Full Name</label>
                          <input
                            className="form-input"
                            type="text"
                            placeholder="e.g. John Doe"
                            value={editStudentFullName}
                            onChange={e => setEditStudentFullName(e.target.value)}
                            required
                          />
                        </div>

                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                          <label className="form-label">Username</label>
                          <input
                            className="form-input"
                            type="text"
                            placeholder="e.g. john_d"
                            value={editStudentUsername}
                            onChange={e => setEditStudentUsername(e.target.value)}
                            required
                          />
                        </div>

                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                          <label className="form-label">Password</label>
                          <input
                            className="form-input"
                            type="text"
                            placeholder="Password..."
                            value={editStudentPassword}
                            onChange={e => setEditStudentPassword(e.target.value)}
                            required
                          />
                        </div>

                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                          <label className="form-label">Class</label>
                          <select
                            className="form-input"
                            value={editStudentClassName}
                            onChange={e => setEditStudentClassName(e.target.value)}
                            style={{ height: '2.7rem', padding: '0.5rem', background: 'hsla(var(--background-card-raw) / 0.6)' }}
                          >
                            <option value="">-- Select Class --</option>
                            {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary" type="button" onClick={() => setEditingStudent(null)}>Cancel</button>
                          <button className="btn btn-primary" type="submit">Save Changes</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* View 3: Scoreboard / Submissions */}
            {currentView === 'teacher_scores' && (
              <div className="glass-card animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <h2>Score Reports & Analytics</h2>
                    <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Track exam scores, tab switch alerts, and detailed submissions from students.</p>
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
                      Student Roster
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
                        placeholder="Search student name..."
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
                          <th>Student Name</th>
                          <th>Class</th>
                          <th>Exam Title</th>
                          <th>Submitted Date</th>
                          <th>Score</th>
                          <th>Percentage</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const filtered = submissions.filter(sub => {
                            const studentObj = students.find(s => s.id === sub.studentId || s.username === sub.studentName);
                            const studentClass = studentObj ? studentObj.className : 'Unassigned';
                            const matchClass = scoreFilterClass === 'All' || studentClass === scoreFilterClass;
                            const matchName = sub.studentName.toLowerCase().includes(scoreSearchStudent.toLowerCase());
                            return matchClass && matchName;
                          });

                          if (filtered.length === 0) {
                            return (
                              <tr>
                                <td colSpan="7" style={{ textAlign: 'center', color: 'hsl(var(--text-muted))' }}>No matching submissions found.</td>
                              </tr>
                            );
                          }

                          return filtered.map(sub => {
                            const studentObj = students.find(s => s.id === sub.studentId || s.username === sub.studentName);
                            const studentClass = studentObj ? studentObj.className : 'Unassigned';
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
                                <td>{new Date(sub.submittedAt).toLocaleDateString()}</td>
                                <td>
                                  <div style={{ fontWeight: '600', color: pct >= 50 ? 'hsl(var(--success))' : 'hsl(var(--danger))' }}>
                                    {sub.score100 ?? Math.round((sub.score / (sub.totalQuestions || 1)) * 100)} / 100 <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>({sub.score}/{sub.totalQuestions})</span>
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', marginTop: '0.15rem' }}>
                                    R: {sub.readingScore || 0}/{sub.readingTotal || 52} | L: {sub.listeningScore || 0}/{sub.listeningTotal || 30}
                                  </div>
                                </td>
                                <td>{pct}%</td>
                                <td>
                                  <button className="btn btn-secondary btn-sm" onClick={() => {
                                    setReportSubmission(sub);
                                    setCurrentView('student_result');
                                  }}>
                                    <Eye size={14} style={{ marginRight: '0.25rem' }} />
                                    View Submission
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
                        const studentDisplayName = st.fullName || st.username;
                        const matchName = studentDisplayName.toLowerCase().includes(scoreSearchStudent.toLowerCase()) || st.username.toLowerCase().includes(scoreSearchStudent.toLowerCase());
                        return matchClass && matchName;
                      });

                      if (filteredStudents.length === 0) {
                        return <div style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', padding: '2rem' }}>No matching students found.</div>;
                      }

                      return filteredStudents.map(st => {
                        const studentSubs = submissions.filter(sub => sub.studentId === st.id || sub.studentName === st.username || sub.studentName === st.fullName);
                        const isExpanded = expandedStudentId === st.id;
                        return (
                          <div key={st.id} className="glass-card" style={{ background: 'hsl(var(--card-bg))', border: '1px solid hsl(var(--border-color))', padding: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <h4 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <span>{st.fullName || st.username}</span>
                                  {st.fullName && <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', fontWeight: 'normal' }}>({st.username})</span>}
                                  <span className="user-role-badge" style={{ background: 'hsla(var(--primary) / 0.08)', color: 'hsl(var(--primary))', fontSize: '0.75rem', padding: '0.05rem 0.4rem' }}>
                                    {st.className || 'Unassigned'}
                                  </span>
                                </h4>
                                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>
                                  Completed {studentSubs.length} exams
                                </p>
                              </div>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setExpandedStudentId(isExpanded ? null : st.id)}
                              >
                                {isExpanded ? 'Collapse' : 'View History'}
                              </button>
                            </div>

                            {isExpanded && (
                              <div className="table-container animate-fade-in" style={{ marginTop: '1rem', borderTop: '1px solid hsl(var(--border-color))', paddingTop: '0.75rem' }}>
                                {studentSubs.length === 0 ? (
                                  <div style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>No exam submissions recorded for this student.</div>
                                ) : (
                                  <table className="data-table" style={{ fontSize: '0.9rem' }}>
                                    <thead>
                                      <tr>
                                        <th>Exam Title</th>
                                        <th>Submitted Date</th>
                                        <th>Score</th>
                                        <th>Percentage</th>
                                        <th>Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {studentSubs.map(sub => {
                                        const pct = Math.round((sub.score / sub.totalQuestions) * 100);
                                        return (
                                          <tr key={sub.id}>
                                            <td>{sub.examTitle}</td>
                                            <td>{new Date(sub.submittedAt).toLocaleDateString()}</td>
                                            <td>
                                              <span style={{ fontWeight: '600', color: pct >= 50 ? 'hsl(var(--success))' : 'hsl(var(--danger))' }}>
                                                {sub.score} / {sub.totalQuestions}
                                              </span>
                                              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', marginLeft: '0.5rem' }}>
                                                (R: {sub.readingScore}/52 | L: {sub.listeningScore}/30)
                                              </span>
                                            </td>
                                            <td>{pct}%</td>
                                            <td>
                                              <button className="btn btn-secondary btn-sm" onClick={() => {
                                                setReportSubmission(sub);
                                                setCurrentView('student_result');
                                              }}>
                                                <Eye size={12} style={{ marginRight: '0.2rem' }} />
                                                View Submission
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
                <h2 style={{ marginBottom: '0.25rem' }}>Student Portal</h2>
                <p style={{ color: 'hsl(var(--text-secondary))' }}>Access active exams and review your completed exam history.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Your class:</span>
                <span className="user-role-badge" style={{ background: 'hsla(var(--primary) / 0.08)', color: 'hsl(var(--primary))' }}>
                  {user?.className || 'Unassigned'}
                </span>
              </div>
            </div>

            {/* Section 1: Active / Available Exams */}
            <div style={{ marginBottom: '3rem' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ClipboardList size={20} color="hsl(var(--primary))" />
                Active Exams to Take
              </h3>
              {(() => {
                const availableExams = exams.filter(ex => !submissions.some(s => s.examId === ex.id));
                if (availableExams.length === 0) {
                  return (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--text-muted))', background: 'hsl(var(--bg-primary))', borderRadius: 'var(--radius-md)', border: '1px dashed hsl(var(--border-color))' }}>
                      No new active exams available to take at this time.
                    </div>
                  );
                }
                return (
                  <div className="exams-list-grid">
                    {availableExams.map(ex => (
                      <div key={ex.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <span className="user-role-badge" style={{ alignSelf: 'flex-start', background: 'hsla(var(--primary) / 0.08)', color: 'hsl(var(--primary))', marginBottom: '1rem' }}>
                          Full Exam (Reading & Listening)
                        </span>
                        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{ex.title}</h3>

                        <div style={{ display: 'flex', gap: '1.25rem', color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={16} />
                            <span>{ex.durationMinutes} minutes</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <ClipboardList size={16} />
                            <span>82 questions</span>
                          </div>
                        </div>

                        <div style={{ marginTop: 'auto' }}>
                          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleStartExam(ex)}>
                            Start Exam
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Section 2: Completed Exam History */}
            <div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={20} color="hsl(var(--success))" />
                Completed Exam History ({submissions.length})
              </h3>
              {submissions.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--text-muted))', background: 'hsl(var(--bg-primary))', borderRadius: 'var(--radius-md)', border: '1px dashed hsl(var(--border-color))' }}>
                  You have not completed any exams yet.
                </div>
              ) : (
                <div className="exams-list-grid">
                  {submissions.map(sub => {
                    const matchedExam = exams.find(e => e.id === sub.examId);
                    const totalQ = sub.totalQuestions || 82;
                    const score100 = sub.score100 ?? Math.round((sub.score / totalQ) * 100);
                    return (
                      <div key={sub.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', borderLeft: '4px solid hsl(var(--success))' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <span className="user-role-badge" style={{ background: 'hsla(var(--success) / 0.1)', color: 'hsl(var(--success))' }}>
                            Submitted
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
                            {new Date(sub.submittedAt).toLocaleDateString()}
                          </span>
                        </div>

                        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>{sub.examTitle}</h3>

                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '1.8rem', fontWeight: '800', color: 'hsl(var(--primary))' }}>
                            {score100}
                          </span>
                          <span style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', fontWeight: '600' }}>
                            / 100 ({sub.score}/{totalQ} questions)
                          </span>
                        </div>

                        <div style={{ fontSize: '0.825rem', color: 'hsl(var(--text-secondary))', marginBottom: '1.25rem' }}>
                          R: {sub.readingScore || 0}/{sub.readingTotal || 52} | L: {sub.listeningScore || 0}/{sub.listeningTotal || 30}
                        </div>

                        <div style={{ marginTop: 'auto' }}>
                          <button className="btn btn-secondary btn-sm" style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }} onClick={() => {
                            if (matchedExam) setActiveExam(matchedExam);
                            setReportSubmission(sub);
                            setCurrentView('student_result');
                            setActiveTab('reading');
                          }}>
                            <Eye size={14} /> Review Answers
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STUDENT EXAM SESSION */}
      {currentView === 'student_session' && activeExam && (
        <div className="animate-fade-in">
          {/* Sticky Timer Bar */}
          <div className="exam-info-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  if (window.confirm('Return to Exam List? Your answers and timer will remain saved on the server.')) {
                    setCurrentView('student_exams');
                  }
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
              >
                <ArrowLeft size={16} /> Back to Dashboard
              </button>
              <div>
                <h2 style={{ fontSize: '1.4rem', margin: 0 }}>{activeExam.title}</h2>
                <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
                  Exam in progress: Enter your answers into the online answer sheet.
                </p>
              </div>
            </div>
            <div className={`timer-box ${timeLeft < 120 ? 'warning' : ''}`}>
              <Clock size={20} />
              <span>{formatTime(timeLeft)}</span>
            </div>
          </div>

          {/* Tab-switch warning banner (Inline layout, never overlaps tab headers) */}
          {tabSwitchCount > 0 && (
            <div className="animate-fade-in" style={{
              background: tabSwitchCount >= 2 ? 'hsla(var(--danger) / 0.12)' : 'hsla(var(--warning) / 0.12)',
              border: `1.5px solid ${tabSwitchCount >= 2 ? 'hsl(var(--danger))' : 'hsl(var(--warning))'}`,
              color: tabSwitchCount >= 2 ? 'hsl(var(--danger))' : 'hsl(var(--warning))',
              padding: '0.85rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              margin: '1rem 0 1.25rem 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontWeight: 'bold',
              fontSize: '0.92rem'
            }}>
              <AlertTriangle size={22} style={{ flexShrink: 0 }} />
              <div>
                {tabSwitchCount === 1 && (
                  <span>⚠️ <strong>Tab Switch Warning (1/3):</strong> Tab/Window switching detected (1 time). If you switch tabs 3 times, your exam will be AUTOMATICALLY SUBMITTED!</span>
                )}
                {tabSwitchCount === 2 && (
                  <span>🚨 <strong>FINAL WARNING (2/3):</strong> You have switched tabs 2 times! Next tab switch will force AUTO-SUBMIT your exam!</span>
                )}
                {tabSwitchCount >= 3 && (
                  <span>🚨 <strong>MAX TAB SWITCHES EXCEEDED (3/3):</strong> Submitting exam automatically...</span>
                )}
              </div>
            </div>
          )}

          {renderTabHeaders()}

          <div className="exam-layout">
            <div className="main-content">
              {TEMPLATES[activeTab].parts
                .filter(part => {
                  const active = getActiveParts(activeExam, activeTab);
                  return active.includes(part.partNum);
                })
                .map(part => {
                  const qArray = getQuestionArray(part.questionRange);
                  return (
                    <div key={part.partNum} className="glass-card" id={`part-section-${part.partNum}`}>
                      <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>{part.title}</h3>
                      <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem', marginBottom: '1.25rem' }}>{part.description}</p>
                      <div className="questions-grid">
                        {qArray.map(qNum => {
                          const prefix = activeTab === 'reading' ? 'r' : 'l';
                          const qKey = `${prefix}_${qNum}`;
                          const slots = activeExam?.questionSlots?.[qKey] || part.slots || 1;
                          const slotKeys = Array.from({ length: slots }, (_, i) => i === 0 ? qKey : `${qKey}_s${i + 1}`);
                          const isAnyAnswered = slotKeys.some(sKey => studentAnswers[sKey] && studentAnswers[sKey].trim());

                          return (
                            <div key={qKey} className="question-row" id={`q-field-${qKey}`} style={{ alignItems: 'flex-start' }}>
                              <span className="question-num" style={{ marginTop: '0.2rem', background: isAnyAnswered ? 'hsl(var(--primary))' : 'hsl(var(--bg-secondary))', color: isAnyAnswered ? '#fff' : 'hsl(var(--text-secondary))' }}>
                                {qNum}
                              </span>
                              {part.type === 'mcq' ? (
                                <div className="answer-mcq-options">
                                  {part.options.map(opt => (
                                    <button key={opt} type="button" className={`mcq-option-btn ${studentAnswers[qKey] === opt ? 'selected' : ''}`}
                                      onClick={() => setStudentAnswers({ ...studentAnswers, [qKey]: opt })}>
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, width: '100%' }}>
                                  {slotKeys.map((sKey, sIdx) => {
                                    const currentAnswer = studentAnswers[sKey] || '';
                                    const placeholder = Array.isArray(part.placeholder) ? (part.placeholder[sIdx] || `Word ${sIdx + 1}...`) : (part.placeholder || `Word ${sIdx + 1}...`);

                                    return (
                                      <input key={sKey} className="answer-text-input" type="text" placeholder={placeholder}
                                        style={part.uppercase ? { textTransform: 'uppercase' } : {}}
                                        value={currentAnswer}
                                        onChange={e => {
                                          const val = part.uppercase ? e.target.value.toUpperCase() : e.target.value;
                                          setStudentAnswers({ ...studentAnswers, [sKey]: val });
                                        }} />
                                    );
                                  })}
                                </div>
                              )}
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
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Progress Dashboard</h3>
                <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                  Track completed questions. Click any question number to scroll directly to it.
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
        </div>
      )}

      {/* STUDENT SCORE / RESULT REPORT */}
      {currentView === 'student_result' && reportSubmission && (
        <div className="dashboard-grid animate-fade-in" style={{ gridTemplateColumns: '1fr', padding: '2rem' }}>
          <div className="glass-card results-header-card">
            <h2>Exam Submission Results</h2>
            <p style={{ color: 'hsl(var(--text-secondary))' }}>Exam: {reportSubmission.examTitle}</p>

            <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', alignItems: 'center', margin: '1.5rem 0', flexWrap: 'wrap' }}>
              {/* Left Circle: Reading */}
              <div className="results-score-circle reading">
                <span className="results-score-num">{reportSubmission.readingScore || 0}</span>
                <span className="results-score-label">/ {reportSubmission.readingTotal || 52} Reading</span>
              </div>

              {/* Center Circle: Main Score out of 100 (Larger) */}
              <div className="results-score-circle" style={{
                width: '110px',
                height: '110px',
                borderWidth: '3.5px',
                borderColor: 'hsl(var(--primary))',
                background: 'hsla(var(--primary) / 0.06)',
                transform: 'scale(1.15)',
                boxShadow: '0 8px 24px hsla(var(--primary) / 0.2)'
              }}>
                <span className="results-score-num" style={{ color: 'hsl(var(--primary))', fontSize: '1.8rem', fontWeight: '800' }}>
                  {reportSubmission.score100 ?? Math.round((reportSubmission.score / (reportSubmission.totalQuestions || 1)) * 100)}
                </span>
                <span className="results-score-label" style={{ fontWeight: '700', color: 'hsl(var(--primary))' }}>
                  / 100 Score
                </span>
              </div>

              {/* Right Circle: Listening */}
              <div className="results-score-circle listening">
                <span className="results-score-num">{reportSubmission.listeningScore || 0}</span>
                <span className="results-score-label">/ {reportSubmission.listeningTotal || 30} Listening</span>
              </div>
            </div>

            <p style={{ fontSize: '1.1rem', fontWeight: '600', color: 'hsl(var(--text-primary))' }}>
              Accuracy: {Math.round((reportSubmission.score / (reportSubmission.totalQuestions || 1)) * 100)}% ({reportSubmission.score}/{reportSubmission.totalQuestions || 82} correct)
            </p>
            {reportSubmission.tabSwitches > 0 && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'hsl(var(--danger))', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertTriangle size={16} /> Tab switches detected: {reportSubmission.tabSwitches}
              </p>
            )}

            <button className="btn btn-secondary" style={{ marginTop: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => {
              if (user.role === 'teacher') {
                const targetView = backView || 'teacher_scores';
                changeView(targetView);
                if (targetView !== 'class_details') {
                  setSelectedClassForDetails(null);
                }
              } else {
                changeView('student_exams');
              }
              setReportSubmission(null);
              setBackView(null);
            }}>
              <ChevronLeft size={16} />
              {user?.role === 'teacher' ? 'Back to Class Portal' : 'Back to Dashboard'}
            </button>
          </div>

          <div className="glass-card">
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', borderBottom: '1px solid hsla(var(--border-color) / 0.4)', paddingBottom: '0.5rem' }}>
              Detailed Answer Review
            </h3>

            {renderTabHeaders(null)}

            {TEMPLATES[activeTab].parts.map(part => {
              const qArray = getQuestionArray(part.questionRange);
              return (
                <div key={part.partNum} className="exam-part-section animate-fade-in" style={{ marginTop: '1.5rem' }}>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>{part.title}</h4>

                  <div className="results-grid">
                    {qArray.map(qNum => {
                      const prefix = activeTab === 'reading' ? 'r' : 'l';
                      const qKey = `${prefix}_${qNum}`;
                      const slots = activeExam?.questionSlots?.[qKey] || part.slots || 1;
                      const slotKeys = Array.from({ length: slots }, (_, i) => i === 0 ? qKey : `${qKey}_s${i + 1}`);

                      const allCorrect = slotKeys.every(sKey => reportSubmission.details[sKey]?.isCorrect);

                      return (
                        <div key={qKey} className={`result-item-card ${allCorrect ? 'correct' : 'incorrect'}`}>
                          <div className="result-indicator">
                            {allCorrect ? <CheckCircle size={18} /> : <XCircle size={18} />}
                          </div>
                          <div className="result-text-info" style={{ width: '100%' }}>
                            <strong style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.2rem' }}>Question {qNum}</strong>
                            {slotKeys.map((sKey, sIdx) => {
                              const detail = reportSubmission.details[sKey] || { studentAnswer: '', correctAnswer: '', isCorrect: false };
                              const displayKey = detail.correctAnswer.split('|').join(' or ');
                              const slotLabel = slots > 1 ? `Word ${sIdx + 1}: ` : '';

                              return (
                                <div key={sKey} style={{ marginTop: sIdx > 0 ? '0.3rem' : 0 }}>
                                  <p style={{ fontSize: '0.8rem', margin: 0 }}>
                                    {slotLabel}Your answer: <strong className={detail.isCorrect ? 'text-success' : 'text-danger'}>
                                      {detail.studentAnswer || '(Empty)'}
                                    </strong>
                                  </p>
                                  {!detail.isCorrect && (
                                    <p style={{ fontSize: '0.8rem', opacity: 0.9, margin: 0 }}>
                                      Correct answer: <strong className="text-success">{displayKey}</strong>
                                    </p>
                                  )}
                                </div>
                              );
                            })}
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

      {/* CSV BULK IMPORT MODAL */}
      {showCsvModal && (
        <div className="modal-overlay">
          <div className="glass-card modal-content animate-fade-in" style={{ maxWidth: '620px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Upload size={20} style={{ color: 'hsl(var(--primary))' }} />
                Bulk Import Students via CSV / Text
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowCsvModal(false); setBulkResult(null); }}>✕</button>
            </div>

            <form onSubmit={handleBulkImportSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Target Class</label>
                <select className="form-input" value={csvDefaultClass} onChange={e => setCsvDefaultClass(e.target.value)}>
                  <option value="">-- Use class from CSV line or auto-assign --</option>
                  {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Option 1: Upload CSV / TXT File</span>
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--primary))', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => {
                    const sample = "fullName,username,password,className\nJohn Doe,john_d,123456,B1.4F\nJane Smith,jane_s,123456,B1.4F\nAlex Johnson,alex_j,123456,B1.4F";
                    const blob = new Blob(['\uFEFF' + sample], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = "students_template.csv";
                    a.click();
                  }}>
                    📥 Download Sample CSV
                  </span>
                </label>
                <input type="file" accept=".csv,.txt" className="form-input" onChange={handleFileUpload} />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Option 2: Paste List (Format: Full Name, Username, Password, Class)</label>
                <textarea
                  className="form-input"
                  rows="6"
                  placeholder={"Example:\nJohn Doe, john_d, 123456, B1.4F\nJane Smith, jane_s, 123456, B1.4F"}
                  value={bulkCsvText}
                  onChange={e => setBulkCsvText(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                ></textarea>
              </div>

              {bulkResult?.error && (
                <div style={{ background: 'hsla(var(--danger) / 0.15)', color: 'hsl(var(--danger))', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                  ⚠️ {bulkResult.error}
                </div>
              )}

              {bulkResult?.success && (
                <div style={{ background: 'hsla(var(--success) / 0.15)', color: 'hsl(var(--success))', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                  ✅ {bulkResult.msg}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowCsvModal(false); setBulkResult(null); }}>Close</button>
                <button type="submit" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Upload size={16} /> Import Students Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM SUBMIT MODAL (Centered Viewport Overlay with Unanswered Section Warnings) */}
      {showConfirmSubmit && (() => {
        const stats = getExamCompletionStats();
        const hasUnanswered = stats.totalUnanswered > 0;
        const missingListening = stats.listeningAnswered === 0;
        const missingReading = stats.readingAnswered === 0;

        return (
          <div className="modal-overlay">
            <div className="glass-card modal-content animate-fade-in" style={{ maxWidth: '540px', width: '92%', border: hasUnanswered ? '1.5px solid hsl(var(--warning))' : '1px solid hsl(var(--border-color))' }}>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', color: hasUnanswered ? 'hsl(var(--warning))' : 'hsl(var(--primary))', alignItems: 'center' }}>
                {hasUnanswered ? <AlertTriangle size={26} /> : <CheckCircle size={26} />}
                <h3 style={{ fontSize: '1.25rem', margin: 0 }}>
                  {hasUnanswered ? 'Confirm Submission - Uncompleted Exam' : 'Confirm Exam Submission'}
                </h3>
              </div>

              {/* Warning box for uncompleted sections */}
              {hasUnanswered ? (
                <div style={{ background: 'hsla(var(--warning) / 0.12)', border: '1px solid hsla(var(--warning) / 0.3)', borderRadius: 'var(--radius-sm)', padding: '1rem', marginBottom: '1.25rem' }}>
                  {missingListening && (
                    <div style={{ color: 'hsl(var(--danger))', fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertTriangle size={18} /> You haven't attempted the Listening section (0/30 questions)!
                    </div>
                  )}
                  {missingReading && (
                    <div style={{ color: 'hsl(var(--danger))', fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertTriangle size={18} /> You haven't attempted the Reading section (0/52 questions)!
                    </div>
                  )}

                  <div style={{ fontSize: '0.88rem', color: 'hsl(var(--text-primary))', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    <div>
                      • <strong>Reading & Use of English:</strong> {stats.readingAnswered}/52 questions {stats.readingUnanswered > 0 ? <span style={{ color: 'hsl(var(--danger))', fontWeight: '600' }}>({stats.readingUnanswered} unanswered)</span> : <span style={{ color: 'hsl(var(--success))', fontWeight: '600' }}>✓ Completed</span>}
                    </div>
                    <div>
                      • <strong>Listening:</strong> {stats.listeningAnswered}/30 questions {stats.listeningUnanswered > 0 ? <span style={{ color: 'hsl(var(--danger))', fontWeight: '600' }}>({stats.listeningUnanswered} unanswered)</span> : <span style={{ color: 'hsl(var(--success))', fontWeight: '600' }}>✓ Completed</span>}
                    </div>
                    <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px dashed hsla(var(--border-color)/0.5)', fontWeight: 'bold', color: 'hsl(var(--text-primary))' }}>
                      Total progress: {stats.totalAnswered}/82 questions answered ({stats.totalUnanswered} unanswered).
                    </div>
                  </div>
                </div>
              ) : (
                <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                  You have completed all <strong>82/82</strong> questions on your Answer Sheet. Are you sure you want to submit your exam now?
                </p>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowConfirmSubmit(false)}
                >
                  Return to Exam
                </button>
                <button
                  type="button"
                  className={`btn ${hasUnanswered ? 'btn-danger' : 'btn-primary'}`}
                  onClick={() => {
                    setShowConfirmSubmit(false);
                    handleManualSubmit();
                  }}
                >
                  {hasUnanswered ? 'Submit Exam Anyway' : 'Submit Exam Now'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* GLOBAL CONFIRMATION MODAL */}
      {confirmModal && (
        <div className="modal-overlay">
          <div className="glass-card modal-content animate-fade-in" style={{ maxWidth: '440px', width: '92%' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: confirmModal.confirmVariant === 'danger' ? 'hsl(var(--danger))' : 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {confirmModal.confirmVariant === 'danger' && <AlertTriangle size={20} />}
              {confirmModal.title}
            </h3>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              {confirmModal.message}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button
                className={`btn ${confirmModal.confirmVariant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => {
                  const fn = confirmModal.onConfirm;
                  setConfirmModal(null);
                  if (fn) fn();
                }}
              >
                {confirmModal.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL TOAST NOTIFICATION */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          zIndex: 9999,
          padding: '0.85rem 1.4rem',
          borderRadius: 'var(--radius-md)',
          background: toast.type === 'error' ? 'hsl(var(--danger))' : 'hsl(var(--success))',
          color: '#fff',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          fontWeight: '600',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }} className="animate-fade-in">
          {toast.type === 'error' ? '⚠️' : '✅'} {toast.message}
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
