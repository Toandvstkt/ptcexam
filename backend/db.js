const mongoose = require('mongoose');
const path = require('path');

// Load environment variables from root workspace .env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cambridge-exam';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Successfully connected to MongoDB.'))
  .catch(err => console.error('MongoDB connection error:', err));

// ---------------- SCHEMAS & MODELS ----------------

const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  className: { type: String, default: '' },
  role: { type: String, enum: ['student', 'teacher'], default: 'student' }
});

const ExamSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  durationMinutes: { type: Number, default: 120 },
  assignedClass: { type: String, default: 'All' },
  assignedClasses: { type: [String], default: ['All'] },
  assignments: { type: mongoose.Schema.Types.Mixed, default: {} }, // className -> { status, startTime, endTime }
  activeParts: { type: mongoose.Schema.Types.Mixed, default: null },
  keyAnswers: { type: mongoose.Schema.Types.Mixed, default: {} },
  questionSlots: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
});

const SubmissionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  examId: { type: String, required: true },
  examTitle: { type: String, required: true },
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  score: { type: Number, required: true },
  readingScore: { type: Number, default: 0 },
  listeningScore: { type: Number, default: 0 },
  totalQuestions: { type: Number, default: 82 },
  answers: { type: mongoose.Schema.Types.Mixed, default: {} },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  submittedAt: { type: Date, default: Date.now }
});

const ClassSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, unique: true }
});

const LiveProgressSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // `${examId}_${studentId}`
  examId: { type: String, required: true },
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  className: { type: String, default: '' },
  currentQuestion: { type: String, default: '1' },
  answeredCount: { type: Number, default: 0 },
  status: { type: String, enum: ['in_progress', 'submitted'], default: 'in_progress' },
  lastPing: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Exam = mongoose.model('Exam', ExamSchema);
const Submission = mongoose.model('Submission', SubmissionSchema);
const Class = mongoose.model('Class', ClassSchema);
const LiveProgress = mongoose.model('LiveProgress', LiveProgressSchema);

// ---------------- CRUD API IMPLEMENTATION ----------------

module.exports = {
  // Export models if needed for direct query access
  User,
  Exam,
  Submission,
  Class,

  // Users CRUD
  async getUsers() {
    return await User.find().lean();
  },
  
  async saveUser(user) {
    const updated = await User.findOneAndUpdate(
      { id: user.id },
      user,
      { upsert: true, new: true }
    ).lean();
    return updated;
  },

  async deleteUser(userId) {
    await User.deleteOne({ id: userId });
  },

  // Exams CRUD
  async getExams() {
    return await Exam.find().lean();
  },

  async getExamById(id) {
    return await Exam.findOne({ id }).lean();
  },

  async saveExam(exam) {
    const updated = await Exam.findOneAndUpdate(
      { id: exam.id },
      exam,
      { upsert: true, new: true }
    ).lean();
    return updated;
  },

  async deleteExam(examId) {
    await Exam.deleteOne({ id: examId });
    // Cleanup submissions associated with this exam
    await Submission.deleteMany({ examId });
  },

  // Submissions CRUD
  async getSubmissions() {
    return await Submission.find().lean();
  },

  async saveSubmission(submission) {
    const newSub = new Submission(submission);
    await newSub.save();
    return newSub.toObject();
  },

  // Classes CRUD
  async getClasses() {
    return await Class.find().lean();
  },

  async saveClass(cls) {
    const updated = await Class.findOneAndUpdate(
      { id: cls.id },
      cls,
      { upsert: true, new: true }
    ).lean();
    return updated;
  },

  async deleteClass(id) {
    await Class.deleteOne({ id });
  },

  // Live Progress CRUD
  async updateLiveProgress(data) {
    const id = `${data.examId}_${data.studentId}`;
    const updated = await LiveProgress.findOneAndUpdate(
      { id },
      { ...data, id, lastPing: new Date() },
      { upsert: true, new: true }
    ).lean();
    return updated;
  },

  async getLiveProgressForExam(examId, className) {
    const query = { examId };
    if (className && className !== 'All') {
      query.className = className;
    }
    return await LiveProgress.find(query).lean();
  }
};
