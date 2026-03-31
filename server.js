const express = require("express");
const cors = require("cors");
require("dotenv").config();
const pool = require("./db");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get("/api/health", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    res.json({ status: "ok", db: rows[0].ok === 1 ? "connected" : "unknown" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.post("/api/auth/signup", async (req, res) => {
  const { role, password } = req.body;
  if (!role || !password) {
    return res.status(400).json({ message: "Role and password are required." });
  }

  try {
    if (role === "admin") {
      const { username, fullName } = req.body;
      if (!username || !fullName) {
        return res.status(400).json({ message: "Username and full name are required for admin." });
      }

      const [existing] = await pool.query("SELECT admin_id FROM admin WHERE username = ?", [username]);
      if (existing.length) {
        return res.status(409).json({ message: "Admin username already exists." });
      }

      await pool.query(
        "INSERT INTO admin (username, password, full_name) VALUES (?, ?, ?)",
        [username, password, fullName]
      );
      return res.status(201).json({ message: "Admin account created." });
    }

    if (role === "student") {
      const { email, firstName, lastName, enrollmentNo } = req.body;
      if (!email || !firstName || !lastName || !enrollmentNo) {
        return res.status(400).json({ message: "All student fields are required." });
      }

      const [existing] = await pool.query("SELECT student_id FROM student WHERE email = ?", [email]);
      if (existing.length) {
        return res.status(409).json({ message: "Student email already exists." });
      }

      await pool.query("CALL Add_Student(?, ?, ?, ?, ?)", [email, password, firstName, lastName, enrollmentNo]);
      return res.status(201).json({ message: "Student account created." });
    }

    return res.status(400).json({ message: "Invalid role selected." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { role, identifier, password } = req.body;
  if (!role || !identifier || !password) {
    return res.status(400).json({ message: "Role, identifier and password are required." });
  }

  try {
    if (role === "admin") {
      const [rows] = await pool.query(
        "SELECT admin_id, full_name, username FROM admin WHERE username = ? AND password = ?",
        [identifier, password]
      );
      if (!rows.length) return res.status(401).json({ message: "Invalid admin credentials." });
      const admin = rows[0];
      return res.json({
        role: "admin",
        userId: admin.admin_id,
        displayName: admin.full_name,
        identifier: admin.username
      });
    }

    const [rows] = await pool.query(
      "SELECT student_id, first_name, last_name, email FROM student WHERE email = ? AND password = ?",
      [identifier, password]
    );
    if (!rows.length) return res.status(401).json({ message: "Invalid student credentials." });
    const student = rows[0];
    return res.json({
      role: "student",
      userId: student.student_id,
      displayName: `${student.first_name} ${student.last_name}`,
      identifier: student.email
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get("/api/exams", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT exam_id, exam_code, title, duration_minutes, total_marks, pass_mark, remarks, date_created
       FROM exam
       ORDER BY date_created DESC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/exams/:examId/questions", async (req, res) => {
  const { examId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT question_id, question_text, option_1, option_2, option_3, option_4, marks_allocated
       FROM question
       WHERE exam_id = ?
       ORDER BY question_id`,
      [examId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/exams", async (req, res) => {
  const { adminId, examCode, title, durationMinutes, passMark, remarks, questions } = req.body;
  if (!adminId || !examCode || !title || !durationMinutes || !passMark || !Array.isArray(questions) || !questions.length) {
    return res.status(400).json({ message: "Invalid exam payload." });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const totalMarks = questions.reduce((sum, q) => sum + Number(q.marksAllocated || 0), 0);

    const [examResult] = await conn.query(
      `INSERT INTO exam (exam_code, title, date_created, duration_minutes, total_marks, pass_mark, remarks, created_by_admin_id)
       VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)`,
      [examCode, title, durationMinutes, totalMarks, passMark, remarks || null, adminId]
    );
    const examId = examResult.insertId;

    for (const q of questions) {
      await conn.query(
        `INSERT INTO question
         (exam_id, question_text, option_1, option_2, option_3, option_4, correct_answer, marks_allocated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          examId,
          q.questionText,
          q.option1,
          q.option2,
          q.option3,
          q.option4,
          Number(q.correctAnswer),
          Number(q.marksAllocated)
        ]
      );
    }

    await conn.commit();
    return res.status(201).json({ message: "Exam created successfully.", examId });
  } catch (error) {
    await conn.rollback();
    return res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
});

app.post("/api/exams/:examId/submit", async (req, res) => {
  const { examId } = req.params;
  const { studentId, answers } = req.body;
  if (!studentId || !Array.isArray(answers)) {
    return res.status(400).json({ message: "studentId and answers are required." });
  }

  try {
    const [examRows] = await pool.query(
      "SELECT exam_id, title, total_marks, pass_mark, remarks FROM exam WHERE exam_id = ?",
      [examId]
    );
    if (!examRows.length) return res.status(404).json({ message: "Exam not found." });
    const exam = examRows[0];

    const [qRows] = await pool.query(
      "SELECT question_id, correct_answer, marks_allocated FROM question WHERE exam_id = ?",
      [examId]
    );

    const answerMap = new Map(answers.map((a) => [Number(a.questionId), Number(a.selectedOption)]));
    let rawScore = 0;
    for (const q of qRows) {
      const chosen = answerMap.get(Number(q.question_id));
      if (chosen && chosen === Number(q.correct_answer)) {
        rawScore += Number(q.marks_allocated);
      }
    }
    const totalMarks = Number(exam.total_marks);
    const percentage = totalMarks === 0 ? 0 : Number(((rawScore / totalMarks) * 100).toFixed(2));
    const status = percentage >= Number(exam.pass_mark) ? "Pass" : "Fail";

    await pool.query(
      `INSERT INTO result
       (student_id, exam_id, raw_score, total_marks_snapshot, score_obtained, status, attempt_date)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [studentId, examId, rawScore, totalMarks, percentage, status]
    );

    return res.json({
      examTitle: exam.title,
      rawScore,
      totalMarks,
      percentage,
      status,
      remarks: exam.remarks || ""
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get("/api/results/student/:studentId", async (req, res) => {
  const { studentId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT r.result_id, e.title AS exam_title, r.raw_score, r.total_marks_snapshot, r.score_obtained,
              r.status, r.attempt_date, e.remarks
       FROM result r
       JOIN exam e ON e.exam_id = r.exam_id
       WHERE r.student_id = ?
       ORDER BY r.attempt_date DESC`,
      [studentId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/report/topper", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.student_id, CONCAT(s.first_name, ' ', s.last_name) AS student_name,
              AVG(r.score_obtained) AS average_score
       FROM student s
       JOIN result r ON s.student_id = r.student_id
       GROUP BY s.student_id, s.first_name, s.last_name
       ORDER BY average_score DESC
       LIMIT 1`
    );
    res.json(rows[0] || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
