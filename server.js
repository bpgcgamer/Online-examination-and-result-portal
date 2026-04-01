const express = require("express");
const cors = require("cors");
require("dotenv").config();
const pool = require("./db");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

async function ensureSupportTables() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS attempt_answer (
      attempt_answer_id INT AUTO_INCREMENT PRIMARY KEY,
      result_id INT NOT NULL,
      question_id INT NOT NULL,
      selected_option TINYINT NOT NULL CHECK (selected_option BETWEEN 0 AND 4),
      is_correct BOOLEAN NOT NULL DEFAULT FALSE,
      CONSTRAINT fk_attempt_answer_result FOREIGN KEY (result_id) REFERENCES result(result_id) ON DELETE CASCADE,
      CONSTRAINT fk_attempt_answer_question FOREIGN KEY (question_id) REFERENCES question(question_id) ON DELETE CASCADE
    )`
  );
}

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

app.get("/api/exams", async (req, res) => {
  const { createdByAdminId } = req.query;
  try {
    let rows;
    if (createdByAdminId) {
      [rows] = await pool.query(
      `SELECT exam_id, exam_code, title, duration_minutes, total_marks, pass_mark, date_created
         FROM exam
         WHERE created_by_admin_id = ?
         ORDER BY date_created DESC`,
        [createdByAdminId]
      );
    } else {
      [rows] = await pool.query(
        `SELECT exam_id, exam_code, title, duration_minutes, total_marks, pass_mark, date_created
         FROM exam
         ORDER BY date_created DESC`
      );
    }
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
  const { adminId, examCode, title, durationMinutes, passMark, questions } = req.body;
  if (!adminId || !examCode || !title || !durationMinutes || !passMark || !Array.isArray(questions) || !questions.length) {
    return res.status(400).json({ message: "Invalid exam payload." });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const totalMarks = questions.reduce((sum, q) => sum + Number(q.marksAllocated || 0), 0);

    const [examResult] = await conn.query(
      `INSERT INTO exam (exam_code, title, date_created, duration_minutes, total_marks, pass_mark, created_by_admin_id)
       VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)`,
      [examCode, title, durationMinutes, totalMarks, passMark, adminId]
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
      "SELECT exam_id, title, total_marks, pass_mark FROM exam WHERE exam_id = ?",
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

    const [resultInsert] = await pool.query(
      `INSERT INTO result
       (student_id, exam_id, raw_score, total_marks_snapshot, score_obtained, status, attempt_date)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [studentId, examId, rawScore, totalMarks, percentage, status]
    );
    const resultId = resultInsert.insertId;

    for (const q of qRows) {
      const selected = answerMap.get(Number(q.question_id)) || 0;
      const isCorrect = selected === Number(q.correct_answer);
      await pool.query(
        `INSERT INTO attempt_answer (result_id, question_id, selected_option, is_correct)
         VALUES (?, ?, ?, ?)`,
        [resultId, q.question_id, selected, isCorrect ? 1 : 0]
      );
    }

    return res.json({
      examTitle: exam.title,
      rawScore,
      totalMarks,
      percentage,
      status
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
              r.status, r.attempt_date
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

app.get("/api/admin/:adminId/analytics", async (req, res) => {
  const { adminId } = req.params;
  try {
    const [examRows] = await pool.query(
      `SELECT e.exam_id, e.title, e.exam_code, e.total_marks,
              COUNT(r.result_id) AS attempts_count,
              ROUND(AVG(r.score_obtained), 2) AS avg_percentage
       FROM exam e
       LEFT JOIN result r ON r.exam_id = e.exam_id
       WHERE e.created_by_admin_id = ?
       GROUP BY e.exam_id, e.title, e.exam_code, e.total_marks
       ORDER BY e.date_created DESC`,
      [adminId]
    );

    const [detailRows] = await pool.query(
      `SELECT r.result_id, e.exam_id, e.title AS exam_title,
              s.student_id, CONCAT(s.first_name, ' ', s.last_name) AS student_name,
              r.raw_score, r.total_marks_snapshot, r.score_obtained, r.status, r.attempt_date,
              q.question_id, q.question_text, q.correct_answer,
              aa.selected_option, aa.is_correct
       FROM exam e
       JOIN result r ON r.exam_id = e.exam_id
       JOIN student s ON s.student_id = r.student_id
       LEFT JOIN attempt_answer aa ON aa.result_id = r.result_id
       LEFT JOIN question q ON q.question_id = aa.question_id
       WHERE e.created_by_admin_id = ?
       ORDER BY e.exam_id, r.attempt_date DESC, q.question_id`,
      [adminId]
    );

    const examsMap = new Map();
    for (const exam of examRows) {
      examsMap.set(Number(exam.exam_id), {
        examId: Number(exam.exam_id),
        examTitle: exam.title,
        examCode: exam.exam_code,
        totalMarks: Number(exam.total_marks),
        attemptsCount: Number(exam.attempts_count || 0),
        averagePercentage: exam.avg_percentage === null ? null : Number(exam.avg_percentage),
        performance: []
      });
    }

    const attemptMap = new Map();
    for (const row of detailRows) {
      const examId = Number(row.exam_id);
      if (!examsMap.has(examId)) continue;
      const key = `${examId}:${row.result_id}`;
      if (!attemptMap.has(key)) {
        const attemptObj = {
          resultId: Number(row.result_id),
          studentId: Number(row.student_id),
          studentName: row.student_name,
          rawScore: Number(row.raw_score),
          totalMarks: Number(row.total_marks_snapshot),
          percentage: Number(row.score_obtained),
          status: row.status,
          attemptDate: row.attempt_date,
          wrongQuestions: []
        };
        examsMap.get(examId).performance.push(attemptObj);
        attemptMap.set(key, attemptObj);
      }

      if (row.question_id && Number(row.is_correct) === 0) {
        attemptMap.get(key).wrongQuestions.push({
          questionId: Number(row.question_id),
          questionText: row.question_text,
          selectedOption: Number(row.selected_option),
          correctAnswer: Number(row.correct_answer)
        });
      }
    }

    res.json(Array.from(examsMap.values()));
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
ensureSupportTables()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize support tables:", error.message);
    process.exit(1);
  });
