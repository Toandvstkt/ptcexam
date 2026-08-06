const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Helper to normalize answers for grading
function evaluateAnswer(studentAns, keyAns) {
  if (!studentAns) return false;
  if (!keyAns) return false;
  
  // Normalize: lowercase, trim whitespace, and replace multiple spaces/newlines
  const normStudent = studentAns.trim().toLowerCase().replace(/\s+/g, ' ');
  
  // Key answers can have multiple alternatives separated by '|'
  const alternatives = keyAns.split('|').map(ans => ans.trim().toLowerCase().replace(/\s+/g, ' '));
  
  return alternatives.includes(normStudent);
}

// ---------------- AUTH API ----------------

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Vui lòng nhập đầy đủ tài khoản và mật khẩu." });
  }

  const users = await db.getUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);

  if (!user) {
    return res.status(401).json({ error: "Tài khoản hoặc mật khẩu không chính xác." });
  }

  res.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      className: user.className || ''
    }
  });
});

// ---------------- USERS API (Teacher Only) ----------------

app.get('/api/users', async (req, res) => {
  const role = req.headers['x-user-role'];
  if (role !== 'teacher') {
    return res.status(403).json({ error: "Không có quyền truy cập." });
  }

  const users = await db.getUsers();
  res.json(users.filter(u => u.role === 'student'));
});

app.post('/api/users', async (req, res) => {
  const role = req.headers['x-user-role'];
  if (role !== 'teacher') {
    return res.status(403).json({ error: "Không có quyền truy cập." });
  }

  const { username, password, className } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Vui lòng điền đầy đủ tên đăng nhập và mật khẩu." });
  }

  const users = await db.getUsers();
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ error: "Tên đăng nhập đã tồn tại." });
  }

  const newUser = {
    id: 'u-' + Date.now(),
    username,
    password,
    className: className || '',
    role: 'student'
  };

  await db.saveUser(newUser);
  res.status(201).json(newUser);
});

app.delete('/api/users/:id', async (req, res) => {
  const role = req.headers['x-user-role'];
  if (role !== 'teacher') {
    return res.status(403).json({ error: "Không có quyền truy cập." });
  }

  await db.deleteUser(req.params.id);
  res.json({ success: true });
});

// ---------------- CLASSES API ----------------

app.get('/api/classes', async (req, res) => {
  const classes = await db.getClasses();
  res.json(classes);
});

app.post('/api/classes', async (req, res) => {
  const role = req.headers['x-user-role'];
  if (role !== 'teacher') {
    return res.status(403).json({ error: "Không có quyền truy cập." });
  }

  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Vui lòng nhập tên lớp học." });
  }

  const classes = await db.getClasses();
  if (classes.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    return res.status(400).json({ error: "Lớp học đã tồn tại." });
  }

  const newClass = {
    id: 'c-' + Date.now(),
    name
  };

  await db.saveClass(newClass);
  res.status(201).json(newClass);
});

app.delete('/api/classes/:id', async (req, res) => {
  const role = req.headers['x-user-role'];
  if (role !== 'teacher') {
    return res.status(403).json({ error: "Không có quyền truy cập." });
  }

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
    const studentUser = users.find(u => u.id === userId);
    const studentClass = studentUser ? (studentUser.className || '') : '';

    const filtered = exams.filter(ex => {
      const assigned = ex.assignedClass || 'All';
      return assigned === 'All' || assigned === '' || assigned.toLowerCase() === studentClass.toLowerCase();
    });

    const safeExams = filtered.map(({ keyAnswers, ...rest }) => rest);
    return res.json(safeExams);
  }
  res.json(exams);
});

app.get('/api/exams/:id', async (req, res) => {
  const exam = await db.getExamById(req.params.id);
  if (!exam) {
    return res.status(404).json({ error: "Không tìm thấy đề thi." });
  }
  const role = req.headers['x-user-role'];
  const userId = req.headers['x-user-id'];

  if (role === 'student') {
    const users = await db.getUsers();
    const studentUser = users.find(u => u.id === userId);
    const studentClass = studentUser ? (studentUser.className || '') : '';
    const assigned = exam.assignedClass || 'All';

    if (assigned !== 'All' && assigned !== '' && assigned.toLowerCase() !== studentClass.toLowerCase()) {
      return res.status(403).json({ error: "Bạn không có quyền làm đề thi này." });
    }

    const { keyAnswers, ...rest } = exam;
    return res.json(rest);
  }
  res.json(exam);
});

app.post('/api/exams', async (req, res) => {
  const role = req.headers['x-user-role'];
  if (role !== 'teacher') {
    return res.status(403).json({ error: "Không có quyền truy cập." });
  }

  const { id, title, durationMinutes, keyAnswers, assignedClass } = req.body;
  if (!title || !durationMinutes || !keyAnswers) {
    return res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin đề thi." });
  }

  const exam = {
    id: id || 'e-' + Date.now(),
    title,
    durationMinutes: parseInt(durationMinutes) || 120,
    assignedClass: assignedClass || 'All',
    keyAnswers, // { r_1..r_52, l_1..l_30 }
    createdAt: new Date().toISOString()
  };

  await db.saveExam(exam);
  res.status(201).json(exam);
});

app.delete('/api/exams/:id', async (req, res) => {
  const role = req.headers['x-user-role'];
  if (role !== 'teacher') {
    return res.status(403).json({ error: "Không có quyền truy cập." });
  }

  await db.deleteExam(req.params.id);
  res.json({ success: true });
});

// ---------------- SUBMISSIONS API ----------------

app.get('/api/submissions', async (req, res) => {
  const role = req.headers['x-user-role'];
  const userId = req.headers['x-user-id'];
  
  const submissions = await db.getSubmissions();
  
  if (role === 'teacher') {
    res.json(submissions);
  } else {
    // Students only see their own submissions
    res.json(submissions.filter(s => s.studentId === userId));
  }
});

app.post('/api/submissions', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const username = req.headers['x-user-username'] || 'Học viên';
  const { examId, answers } = req.body; // answers is { [qKey]: "student answer" }

  if (!examId || !answers) {
    return res.status(400).json({ error: "Dữ liệu nộp bài không hợp lệ." });
  }

  const exam = await db.getExamById(examId);
  if (!exam) {
    return res.status(404).json({ error: "Đề thi không tồn tại." });
  }

  const keyAnswers = exam.keyAnswers || {};
  let score = 0;
  let readingScore = 0;
  let listeningScore = 0;
  const details = {};

  // Grade Reading section (r_1 to r_52)
  for (let qNum = 1; qNum <= 52; qNum++) {
    const qKey = `r_${qNum}`;
    const studentAnswer = (answers[qKey] || "").trim();
    const correctAnswer = keyAnswers[qKey] || "";
    const isCorrect = correctAnswer ? evaluateAnswer(studentAnswer, correctAnswer) : false;

    if (isCorrect) {
      score++;
      readingScore++;
    }

    details[qKey] = {
      studentAnswer,
      correctAnswer,
      isCorrect
    };
  }

  // Grade Listening section (l_1 to l_30)
  for (let qNum = 1; qNum <= 30; qNum++) {
    const qKey = `l_${qNum}`;
    const studentAnswer = (answers[qKey] || "").trim();
    const correctAnswer = keyAnswers[qKey] || "";
    const isCorrect = correctAnswer ? evaluateAnswer(studentAnswer, correctAnswer) : false;

    if (isCorrect) {
      score++;
      listeningScore++;
    }

    details[qKey] = {
      studentAnswer,
      correctAnswer,
      isCorrect
    };
  }

  const submission = {
    id: 's-' + Date.now(),
    examId,
    examTitle: exam.title,
    studentId: userId,
    studentName: username,
    score,
    readingScore,
    listeningScore,
    totalQuestions: 82,
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
