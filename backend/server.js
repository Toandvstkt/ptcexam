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

function getActiveQuestionKeys(activeParts, prefix, tab) {
  const activePartNums = getActiveNums(activeParts, tab);
  const keys = [];
  for (const p of PART_RANGES[tab]) {
    if (!activePartNums.includes(p.partNum)) continue;
    for (let q = p.range[0]; q <= p.range[1]; q++) {
      keys.push(`${prefix}_${q}`);
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

// ---------------- AUTH API ----------------

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Please enter username and password.' });
  const users = await db.getUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
  if (!user) return res.status(401).json({ error: 'Incorrect username or password.' });
  res.json({ user: { id: user.id, username: user.username, role: user.role, className: user.className || '' } });
});

// ---------------- USERS API ----------------

app.get('/api/users', async (req, res) => {
  if (req.headers['x-user-role'] !== 'teacher') return res.status(403).json({ error: 'Access denied.' });
  const users = await db.getUsers();
  res.json(users.filter(u => u.role === 'student'));
});

app.post('/api/users', async (req, res) => {
  if (req.headers['x-user-role'] !== 'teacher') return res.status(403).json({ error: 'Access denied.' });
  const { username, password, className } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
  const users = await db.getUsers();
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ error: 'Username already exists.' });
  }
  const newUser = { id: 'u-' + Date.now(), username, password, className: className || '', role: 'student' };
  await db.saveUser(newUser);
  res.status(201).json(newUser);
});

// Bulk import students from CSV
app.post('/api/users/bulk', async (req, res) => {
  if (req.headers['x-user-role'] !== 'teacher') return res.status(403).json({ error: 'Access denied.' });
  const { students } = req.body; // [{ username, password, className }]
  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: 'No student data provided.' });
  }
  const existingUsers = await db.getUsers();
  const results = { created: [], skipped: [], errors: [] };

  for (const s of students) {
    if (!s.username || !s.password) { results.errors.push(`Row missing username/password`); continue; }
    if (existingUsers.some(u => u.username.toLowerCase() === s.username.toLowerCase())) {
      results.skipped.push(s.username); continue;
    }
    const newUser = { id: 'u-' + Date.now() + Math.random(), username: s.username, password: s.password, className: s.className || '', role: 'student' };
    await db.saveUser(newUser);
    existingUsers.push(newUser);
    results.created.push(s.username);
  }
  res.json(results);
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

// ---------------- EXAMS API ----------------

app.get('/api/exams', async (req, res) => {
  const exams = await db.getExams();
  const role = req.headers['x-user-role'];
  const userId = req.headers['x-user-id'];
  if (role === 'student') {
    const users = await db.getUsers();
    const student = users.find(u => u.id === userId);
    const studentClass = student ? (student.className || '') : '';
    const filtered = exams.filter(ex => {
      const assigned = ex.assignedClass || 'All';
      return assigned === 'All' || assigned === '' || assigned.toLowerCase() === studentClass.toLowerCase();
    });
    return res.json(filtered.map(({ keyAnswers, ...rest }) => rest));
  }
  res.json(exams);
});

app.get('/api/exams/:id', async (req, res) => {
  const exam = await db.getExamById(req.params.id);
  if (!exam) return res.status(404).json({ error: 'Exam not found.' });
  const role = req.headers['x-user-role'];
  const userId = req.headers['x-user-id'];
  if (role === 'student') {
    const users = await db.getUsers();
    const student = users.find(u => u.id === userId);
    const studentClass = student ? (student.className || '') : '';
    const assigned = exam.assignedClass || 'All';
    if (assigned !== 'All' && assigned !== '' && assigned.toLowerCase() !== studentClass.toLowerCase()) {
      return res.status(403).json({ error: 'You do not have access to this exam.' });
    }
    const { keyAnswers, ...rest } = exam;
    return res.json(rest);
  }
  res.json(exam);
});

app.post('/api/exams', async (req, res) => {
  if (req.headers['x-user-role'] !== 'teacher') return res.status(403).json({ error: 'Access denied.' });
  const { id, title, durationMinutes, keyAnswers, assignedClass, activeParts } = req.body;
  if (!title || !durationMinutes || !keyAnswers) {
    return res.status(400).json({ error: 'Please fill in all exam details.' });
  }
  const exam = {
    id: id || 'e-' + Date.now(),
    title,
    durationMinutes: parseInt(durationMinutes) || 120,
    assignedClass: assignedClass || 'All',
    activeParts: activeParts || null, // null = all parts active
    keyAnswers,
    createdAt: new Date().toISOString()
  };
  await db.saveExam(exam);
  res.status(201).json(exam);
});

app.delete('/api/exams/:id', async (req, res) => {
  if (req.headers['x-user-role'] !== 'teacher') return res.status(403).json({ error: 'Access denied.' });
  await db.deleteExam(req.params.id);
  res.json({ success: true });
});

// ---------------- SUBMISSIONS API ----------------

app.get('/api/submissions', async (req, res) => {
  const role = req.headers['x-user-role'];
  const userId = req.headers['x-user-id'];
  const submissions = await db.getSubmissions();
  if (role === 'teacher') return res.json(submissions);
  res.json(submissions.filter(s => s.studentId === userId));
});

app.post('/api/submissions', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const username = req.headers['x-user-username'] || 'Student';
  const { examId, answers, tabSwitches } = req.body;

  if (!examId || !answers) return res.status(400).json({ error: 'Invalid submission data.' });

  const exam = await db.getExamById(examId);
  if (!exam) return res.status(404).json({ error: 'Exam not found.' });

  const keyAnswers = exam.keyAnswers || {};
  const activeParts = exam.activeParts || null;

  // Get active question keys
  const readingKeys = getActiveQuestionKeys(activeParts, 'r', 'reading');
  const listeningKeys = getActiveQuestionKeys(activeParts, 'l', 'listening');

  let score = 0, readingScore = 0, listeningScore = 0;
  const details = {};

  for (const qKey of readingKeys) {
    const studentAnswer = (answers[qKey] || '').trim();
    const correctAnswer = keyAnswers[qKey] || '';
    const isCorrect = correctAnswer ? evaluateAnswer(studentAnswer, correctAnswer) : false;
    if (isCorrect) { score++; readingScore++; }
    details[qKey] = { studentAnswer, correctAnswer, isCorrect };
  }

  for (const qKey of listeningKeys) {
    const studentAnswer = (answers[qKey] || '').trim();
    const correctAnswer = keyAnswers[qKey] || '';
    const isCorrect = correctAnswer ? evaluateAnswer(studentAnswer, correctAnswer) : false;
    if (isCorrect) { score++; listeningScore++; }
    details[qKey] = { studentAnswer, correctAnswer, isCorrect };
  }

  const totalQuestions = readingKeys.length + listeningKeys.length;

  const submission = {
    id: 's-' + Date.now(),
    examId,
    examTitle: exam.title,
    studentId: userId,
    studentName: username,
    score,
    readingScore,
    listeningScore,
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
