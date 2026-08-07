const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Part ranges for dynamic question counting
const PART_RANGES = {
  reading: [
    { partNum: 1, range: [1, 8] },
    { partNum: 2, range: [9, 16] },
    { partNum: 3, range: [17, 24] },
    { partNum: 4, range: [25, 30] },
    { partNum: 5, range: [31, 36] },
    { partNum: 6, range: [37, 42] },
    { partNum: 7, range: [43, 52] },
  ],
  listening: [
    { partNum: 1, range: [1, 8] },
    { partNum: 2, range: [9, 18] },
    { partNum: 3, range: [19, 23] },
    { partNum: 4, range: [24, 30] },
  ]
};

function getActiveNums(activeParts, tab) {
  const all = PART_RANGES[tab].map(p => p.partNum);
  return activeParts?.[tab] ?? all;
}

function getActiveQuestionKeys(exam, prefix, tab) {
  const activePartNums = getActiveNums(exam?.activeParts, tab);
  const keyAnswers = exam?.keyAnswers || {};
  const questionSlots = exam?.questionSlots || {};
  const keys = [];

  for (const p of PART_RANGES[tab]) {
    if (!activePartNums.includes(p.partNum)) continue;
    for (let q = p.range[0]; q <= p.range[1]; q++) {
      const baseKey = `${prefix}_${q}`;
      keys.push(baseKey);

      const slots = questionSlots[baseKey] || (tab === 'reading' && p.partNum === 4 ? 2 : 1);
      for (let s = 2; s <= slots; s++) {
        const slotKey = `${baseKey}_s${s}`;
        if (!keys.includes(slotKey)) keys.push(slotKey);
      }

      Object.keys(keyAnswers).forEach(k => {
        if (k.startsWith(`${baseKey}_s`) && !keys.includes(k)) {
          keys.push(k);
        }
      });
    }
  }
  return keys;
}

// Normalize answers for grading
function evaluateAnswer(studentAns, keyAns) {
  if (!studentAns || !keyAns) return false;
  const normStudent = studentAns.trim().toLowerCase().replace(/\s+/g, ' ');
  const alternatives = keyAns.split('|').map(a => a.trim().toLowerCase().replace(/\s+/g, ' '));
  return alternatives.includes(normStudent);
}

function gradeExamTab(exam, prefix, tab, answers, details) {
  const activePartNums = getActiveNums(exam?.activeParts, tab);
  const keyAnswers = exam?.keyAnswers || {};
  const questionSlots = exam?.questionSlots || {};

  let correctCount = 0;
  let totalQuestionCount = 0;

  for (const p of PART_RANGES[tab]) {
    if (!activePartNums.includes(p.partNum)) continue;
    for (let q = p.range[0]; q <= p.range[1]; q++) {
      totalQuestionCount++;
      const baseKey = `${prefix}_${q}`;

      const numSlots = questionSlots[baseKey] || (tab === 'reading' && p.partNum === 4 ? 2 : 1);
      const slotKeys = [baseKey];
      for (let s = 2; s <= numSlots; s++) {
        slotKeys.push(`${baseKey}_s${s}`);
      }
      Object.keys(keyAnswers).forEach(k => {
        if (k.startsWith(`${baseKey}_s`) && !slotKeys.includes(k)) {
          slotKeys.push(k);
        }
      });

      let isQuestionAllCorrect = true;
      for (const sKey of slotKeys) {
        const studentAns = (answers[sKey] || '').trim();
        const keyAns = keyAnswers[sKey] || '';
        const isSlotCorrect = keyAns ? evaluateAnswer(studentAns, keyAns) : false;
        details[sKey] = { studentAnswer: studentAns, correctAnswer: keyAns, isCorrect: isSlotCorrect };
        if (!isSlotCorrect) {
          isQuestionAllCorrect = false;
        }
      }

      if (isQuestionAllCorrect) {
        correctCount++;
      }
    }
  }

  return { correctCount, totalQuestionCount };
}

// ---------------- AUTH API ----------------

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Please enter username and password.' });
  const users = await db.getUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
  if (!user) return res.status(401).json({ error: 'Incorrect username or password.' });
  res.json({ user: { id: user.id, fullName: user.fullName || user.username, username: user.username, role: user.role, className: user.className || '' } });
});

// ---------------- USERS API ----------------

app.get('/api/users', async (req, res) => {
  if (req.headers['x-user-role'] !== 'teacher') return res.status(403).json({ error: 'Access denied.' });
  const users = await db.getUsers();
  res.json(users.filter(u => u.role === 'student'));
});

app.post('/api/users', async (req, res) => {
  if (req.headers['x-user-role'] !== 'teacher') return res.status(403).json({ error: 'Access denied.' });
  const { fullName, username, password, className } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
  const users = await db.getUsers();
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ error: 'Username already exists.' });
  }
  const newUser = {
    id: 'u-' + Date.now(),
    fullName: (fullName || username).trim(),
    username: username.trim(),
    password: password.trim(),
    className: (className || '').trim(),
    role: 'student'
  };
  await db.saveUser(newUser);
  res.status(201).json(newUser);
});

// Bulk import students from CSV or list
app.post('/api/users/bulk', async (req, res) => {
  if (getHeaderVal(req, 'x-user-role') !== 'teacher') return res.status(403).json({ error: 'Access denied.' });
  const { students, defaultClass } = req.body; // [{ fullName, username, password, className }]
  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: 'No student data provided.' });
  }

  const existingUsers = await db.getUsers();
  const existingClasses = await db.getClasses();
  const results = { created: [], updated: [], errors: [] };

  for (const s of students) {
    const username = (s.username || '').trim();
    const fullName = (s.fullName || s.name || username).trim();
    if (!username) { results.errors.push(`Row missing username`); continue; }
    const password = (s.password || '123456').trim();
    const className = (s.className || s.class || defaultClass || '').trim();

    // Auto-create class if it doesn't exist yet
    if (className && !existingClasses.some(c => c.name.toLowerCase() === className.toLowerCase())) {
      const newCls = { id: 'c-' + Date.now() + Math.floor(Math.random() * 100), name: className };
      await db.saveClass(newCls);
      existingClasses.push(newCls);
    }

    const existingIndex = existingUsers.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
    if (existingIndex !== -1) {
      const userToUpdate = existingUsers[existingIndex];
      userToUpdate.fullName = fullName || userToUpdate.fullName || username;
      userToUpdate.password = password || userToUpdate.password;
      if (className) userToUpdate.className = className;
      await db.saveUser(userToUpdate);
      results.updated.push(username);
    } else {
      const newUser = {
        id: 'u-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        fullName: fullName || username,
        username,
        password,
        className: className || '',
        role: 'student'
      };
      await db.saveUser(newUser);
      existingUsers.push(newUser);
      results.created.push(username);
    }
  }

  res.json({ success: true, createdCount: results.created.length, updatedCount: results.updated.length, results });
});

app.delete('/api/users/:id', async (req, res) => {
  if (req.headers['x-user-role'] !== 'teacher') return res.status(403).json({ error: 'Access denied.' });
  await db.deleteUser(req.params.id);
  res.json({ success: true });
});

// ---------------- CLASSES API ----------------

app.get('/api/classes', async (req, res) => {
  res.json(await db.getClasses());
});

app.post('/api/classes', async (req, res) => {
  if (req.headers['x-user-role'] !== 'teacher') return res.status(403).json({ error: 'Access denied.' });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Class name is required.' });
  const classes = await db.getClasses();
  if (classes.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    return res.status(400).json({ error: 'Class already exists.' });
  }
  const newClass = { id: 'c-' + Date.now(), name };
  await db.saveClass(newClass);
  res.status(201).json(newClass);
});

app.delete('/api/classes/:id', async (req, res) => {
  if (req.headers['x-user-role'] !== 'teacher') return res.status(403).json({ error: 'Access denied.' });
  await db.deleteClass(req.params.id);
  res.json({ success: true });
});

function getHeaderVal(req, name) {
  const val = req.headers[name];
  if (!val) return '';
  try {
    return decodeURIComponent(val);
  } catch (e) {
    return val;
  }
}

// ---------------- EXAMS API ----------------

app.get('/api/exams', async (req, res) => {
  const exams = await db.getExams();
  const role = getHeaderVal(req, 'x-user-role');
  const userId = getHeaderVal(req, 'x-user-id');
  const usernameHeader = getHeaderVal(req, 'x-user-username');
  const classHeader = getHeaderVal(req, 'x-user-classname');

  if (role === 'student') {
    const users = await db.getUsers();
    const student = users.find(u => u.id === userId || (usernameHeader && u.username.toLowerCase() === usernameHeader.toLowerCase()));
    const studentClass = (student && student.className) ? student.className : classHeader;
    const submissions = await db.getSubmissions();

    const filtered = exams.filter(ex => {
      const hasSubmitted = submissions.some(s => s.examId === ex.id && (s.studentId === userId || (student && s.studentName.toLowerCase() === student.username.toLowerCase())));
      if (hasSubmitted) return true;

      const assignedList = Array.isArray(ex.assignedClasses) && ex.assignedClasses.length > 0
        ? ex.assignedClasses
        : (ex.assignedClass ? ex.assignedClass.split(',').map(s => s.trim()) : ['All']);
      
      const isAssignedToClass = assignedList.includes('All') || assignedList.some(c => c.toLowerCase() === studentClass.toLowerCase());
      if (!isAssignedToClass) return false;

      // Case-insensitive lookup in assignments
      const assignments = ex.assignments || {};
      let assignInfo = null;
      for (const key of Object.keys(assignments)) {
        if (key.toLowerCase() === studentClass.toLowerCase()) {
          assignInfo = assignments[key];
          break;
        }
      }

      // If status is explicitly unassigned or ended, hide from student
      if (assignInfo && (assignInfo.status === 'unassigned' || assignInfo.status === 'ended')) {
        return false;
      }
      return true;
    });
    return res.json(filtered.map(({ keyAnswers, ...rest }) => rest));
  }
  res.json(exams);
});

app.get('/api/exams/:id', async (req, res) => {
  const exam = await db.getExamById(req.params.id);
  if (!exam) return res.status(404).json({ error: 'Exam not found.' });
  const role = getHeaderVal(req, 'x-user-role');
  const userId = getHeaderVal(req, 'x-user-id');
  const usernameHeader = getHeaderVal(req, 'x-user-username');
  const classHeader = getHeaderVal(req, 'x-user-classname');

  if (role === 'student') {
    const users = await db.getUsers();
    const student = users.find(u => u.id === userId || (usernameHeader && u.username.toLowerCase() === usernameHeader.toLowerCase()));
    const studentClass = (student && student.className) ? student.className : classHeader;
    const submissions = await db.getSubmissions();
    const hasSubmitted = submissions.some(s => s.examId === exam.id && (s.studentId === userId || (student && s.studentName.toLowerCase() === student.username.toLowerCase())));

    if (!hasSubmitted) {
      const assignedList = Array.isArray(exam.assignedClasses) && exam.assignedClasses.length > 0
        ? exam.assignedClasses
        : (exam.assignedClass ? exam.assignedClass.split(',').map(s => s.trim()) : ['All']);
      const isAssigned = assignedList.includes('All') || assignedList.some(c => c.toLowerCase() === studentClass.toLowerCase());

      const assignments = exam.assignments || {};
      let assignInfo = null;
      for (const key of Object.keys(assignments)) {
        if (key.toLowerCase() === studentClass.toLowerCase()) {
          assignInfo = assignments[key];
          break;
        }
      }

      if (!isAssigned || (assignInfo && (assignInfo.status === 'unassigned' || assignInfo.status === 'ended'))) {
        return res.status(403).json({ error: 'You do not have access to this exam.' });
      }
    }
    const { keyAnswers, ...rest } = exam;
    return res.json(rest);
  }
  res.json(exam);
});

app.post('/api/exams', async (req, res) => {
  if (getHeaderVal(req, 'x-user-role') !== 'teacher') return res.status(403).json({ error: 'Access denied.' });
  const { id, title, durationMinutes, keyAnswers, assignedClass, assignedClasses, activeParts } = req.body;
  if (!title || !durationMinutes || !keyAnswers) {
    return res.status(400).json({ error: 'Please fill in all exam details.' });
  }

  const existingExam = id ? await db.getExamById(id) : null;
  const assignments = existingExam ? (existingExam.assignments || {}) : {};

  const normalizedClasses = Array.isArray(assignedClasses) && assignedClasses.length > 0
    ? assignedClasses
    : [assignedClass || 'All'];

  // Initialize active status for newly assigned classes
  normalizedClasses.forEach(cName => {
    if (cName !== 'All' && (!assignments[cName] || assignments[cName].status === 'unassigned')) {
      assignments[cName] = { status: 'active', updatedAt: new Date().toISOString() };
    }
  });

  const exam = {
    ...(existingExam || {}),
    id: id || 'e-' + Date.now(),
    title,
    durationMinutes: parseInt(durationMinutes) || 120,
    assignedClass: normalizedClasses.includes('All') ? 'All' : normalizedClasses.join(', '),
    assignedClasses: normalizedClasses,
    assignments,
    activeParts: activeParts || null,
    keyAnswers,
    createdAt: existingExam?.createdAt || new Date().toISOString()
  };
  await db.saveExam(exam);
  res.status(201).json(exam);
});

app.post('/api/exams/:id/assign', async (req, res) => {
  if (req.headers['x-user-role'] !== 'teacher') return res.status(403).json({ error: 'Access denied.' });
  const { className, status, startTime, endTime } = req.body;
  const exam = await db.getExamById(req.params.id);
  if (!exam) return res.status(404).json({ error: 'Exam not found.' });

  exam.assignments = exam.assignments || {};
  exam.assignments[className] = {
    status: status || 'active',
    startTime: startTime || null,
    endTime: endTime || null,
    updatedAt: new Date().toISOString()
  };

  const currentAssigned = Array.isArray(exam.assignedClasses) && exam.assignedClasses.length > 0
    ? exam.assignedClasses
    : (exam.assignedClass ? exam.assignedClass.split(',').map(s => s.trim()) : ['All']);

  if (!currentAssigned.includes('All') && !currentAssigned.some(c => c.toLowerCase() === className.toLowerCase())) {
    currentAssigned.push(className);
    exam.assignedClasses = currentAssigned;
    exam.assignedClass = currentAssigned.join(', ');
  }

  await db.saveExam(exam);
  res.json({ success: true, exam });
});

app.delete('/api/exams/:id', async (req, res) => {
  if (getHeaderVal(req, 'x-user-role') !== 'teacher') return res.status(403).json({ error: 'Access denied.' });
  await db.deleteExam(req.params.id);
  res.json({ success: true });
});

// ---------------- LIVE SESSIONS API (Realtime Student Monitoring) ----------------
const activeSessionsMap = new Map();

app.post('/api/sessions/ping', (req, res) => {
  const userId = getHeaderVal(req, 'x-user-id');
  const username = getHeaderVal(req, 'x-user-username') || 'Student';
  const className = getHeaderVal(req, 'x-user-classname') || '';
  const { examId, examTitle, tabSwitches } = req.body;

  if (!examId) return res.status(400).json({ error: 'Missing examId' });

  const sessionKey = `${username}_${examId}`;
  activeSessionsMap.set(sessionKey, {
    studentId: userId,
    studentName: username,
    className: className,
    examId: examId,
    examTitle: examTitle || 'Exam',
    tabSwitches: tabSwitches || 0,
    answeredCount: typeof req.body.answeredCount === 'number' ? req.body.answeredCount : 0,
    totalQuestions: typeof req.body.totalQuestions === 'number' ? req.body.totalQuestions : 82,
    lastPing: Date.now()
  });

  res.json({ success: true });
});

app.get('/api/sessions/active', (req, res) => {
  const now = Date.now();
  const activeList = [];
  for (const [key, session] of activeSessionsMap.entries()) {
    if (now - session.lastPing < 12000) {
      activeList.push(session);
    } else {
      activeSessionsMap.delete(key);
    }
  }
  res.json(activeList);
});

// ---------------- SUBMISSIONS API ----------------

app.get('/api/submissions', async (req, res) => {
  const role = getHeaderVal(req, 'x-user-role');
  const userId = getHeaderVal(req, 'x-user-id');
  const username = getHeaderVal(req, 'x-user-username');
  const submissions = await db.getSubmissions();
  if (role === 'teacher') return res.json(submissions);
  res.json(submissions.filter(s => s.studentId === userId || (username && s.studentName === username)));
});

app.post('/api/submissions', async (req, res) => {
  const userId = getHeaderVal(req, 'x-user-id');
  const username = getHeaderVal(req, 'x-user-username') || 'Student';
  const { examId, answers, tabSwitches } = req.body;

  if (!examId || !answers) return res.status(400).json({ error: 'Invalid submission data.' });

  // Clear active session upon submission
  const sessionKey = `${username}_${examId}`;
  activeSessionsMap.delete(sessionKey);

  const exam = await db.getExamById(examId);
  if (!exam) return res.status(404).json({ error: 'Exam not found.' });

  const keyAnswers = exam.keyAnswers || {};
  const activeParts = exam.activeParts || null;
  const details = {};

  const readingResult = gradeExamTab(exam, 'r', 'reading', answers, details);
  const listeningResult = gradeExamTab(exam, 'l', 'listening', answers, details);

  const readingScore = readingResult.correctCount;
  const readingTotal = readingResult.totalQuestionCount;
  const listeningScore = listeningResult.correctCount;
  const listeningTotal = listeningResult.totalQuestionCount;

  const score = readingScore + listeningScore;
  const totalQuestions = readingTotal + listeningTotal;
  const score100 = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

  const submission = {
    id: 's-' + Date.now(),
    examId,
    examTitle: exam.title,
    studentId: userId,
    studentName: username,
    score,
    score100,
    readingScore,
    listeningScore,
    readingTotal,
    listeningTotal,
    totalQuestions,
    tabSwitches: tabSwitches || 0,
    answers,
    details,
    submittedAt: new Date().toISOString()
  };

  await db.saveSubmission(submission);
  res.status(201).json(submission);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
