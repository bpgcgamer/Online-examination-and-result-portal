const express = require("express");
const cors = require("cors");
require("dotenv").config();
const pool = require("./db");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

async function ensureSupportTables() {
  const [attemptNumberCol] = await pool.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'result'
       AND COLUMN_NAME = 'attempt_number'
     LIMIT 1`
  );
  if (!attemptNumberCol.length) {
    await pool.query(
      `ALTER TABLE result
       ADD COLUMN attempt_number INT NOT NULL DEFAULT 1`
    );
  }

  const [bestScoreCol] = await pool.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'result'
       AND COLUMN_NAME = 'is_best_score'
     LIMIT 1`
  );
  if (!bestScoreCol.length) {
    await pool.query(
      `ALTER TABLE result
       ADD COLUMN is_best_score BOOLEAN NOT NULL DEFAULT FALSE`
    );
  }

  await pool.query(
    `UPDATE result r
     JOIN (
       SELECT student_id, exam_id, MAX(score_obtained) AS max_score
       FROM result
       GROUP BY student_id, exam_id
     ) best ON best.student_id = r.student_id
         AND best.exam_id = r.exam_id
     SET r.is_best_score = CASE WHEN r.score_obtained = best.max_score THEN 1 ELSE 0 END`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS mentor (
      mentor_id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      full_name VARCHAR(100) NOT NULL
    )`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS mentor_student_map (
      mentor_id INT NOT NULL,
      student_id INT NOT NULL,
      assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (mentor_id, student_id),
      CONSTRAINT fk_msm_mentor FOREIGN KEY (mentor_id) REFERENCES mentor(mentor_id) ON DELETE CASCADE,
      CONSTRAINT fk_msm_student FOREIGN KEY (student_id) REFERENCES student(student_id) ON DELETE CASCADE
    )`
  );

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

  const [topicCol] = await pool.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'question'
       AND COLUMN_NAME = 'topic'
     LIMIT 1`
  );
  if (!topicCol.length) {
    await pool.query(
      `ALTER TABLE question
       ADD COLUMN topic VARCHAR(100) NOT NULL DEFAULT 'General'`
    );
  }

  await pool.query(
    `UPDATE question q
     JOIN exam e ON e.exam_id = q.exam_id
     SET q.topic = COALESCE(NULLIF(TRIM(q.topic), ''), e.title)
     WHERE q.topic IS NULL OR TRIM(q.topic) = '' OR q.topic = 'General'`
  );

  // Keep exam total marks aligned with the sum of question marks.
  await pool.query(
    `UPDATE exam e
     JOIN (
       SELECT exam_id, COALESCE(SUM(marks_allocated), 0) AS computed_total
       FROM question
       GROUP BY exam_id
     ) q ON q.exam_id = e.exam_id
     SET e.total_marks = q.computed_total`
  );

  // Backfill historical results so old attempts match corrected exam totals.
  await pool.query(
    `UPDATE result r
     JOIN exam e ON e.exam_id = r.exam_id
     JOIN (
       SELECT exam_id, COALESCE(SUM(marks_allocated), 0) AS computed_total
       FROM question
       GROUP BY exam_id
     ) q ON q.exam_id = r.exam_id
     SET r.raw_score = LEAST(q.computed_total, GREATEST(0, r.raw_score)),
         r.total_marks_snapshot = q.computed_total,
         r.score_obtained = CASE
           WHEN q.computed_total = 0 THEN 0
           ELSE LEAST(
             100,
             GREATEST(0, ROUND((LEAST(q.computed_total, GREATEST(0, r.raw_score)) / q.computed_total) * 100, 2))
           )
         END,
         r.status = CASE
           WHEN (
             CASE
               WHEN q.computed_total = 0 THEN 0
               ELSE LEAST(
                 100,
                 GREATEST(0, ROUND((LEAST(q.computed_total, GREATEST(0, r.raw_score)) / q.computed_total) * 100, 2))
               )
             END
           ) >= e.pass_mark THEN 'Pass'
           ELSE 'Fail'
         END`
  );

  // Re-mark best attempts after recalculating percentages.
  await pool.query(
    `UPDATE result r
     JOIN (
       SELECT student_id, exam_id, MAX(score_obtained) AS max_score
       FROM result
       GROUP BY student_id, exam_id
     ) best ON best.student_id = r.student_id AND best.exam_id = r.exam_id
     SET r.is_best_score = CASE WHEN r.score_obtained = best.max_score THEN 1 ELSE 0 END`
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

    if (role === "mentor") {
      const { username, fullName } = req.body;
      if (!username || !fullName) {
        return res.status(400).json({ message: "Username and full name are required for mentor." });
      }

      const [existing] = await pool.query("SELECT mentor_id FROM mentor WHERE username = ?", [username]);
      if (existing.length) {
        return res.status(409).json({ message: "Mentor username already exists." });
      }

      await pool.query(
        "INSERT INTO mentor (username, password, full_name) VALUES (?, ?, ?)",
        [username, password, fullName]
      );
      return res.status(201).json({ message: "Mentor account created." });
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

    if (role === "mentor") {
      const [rows] = await pool.query(
        "SELECT mentor_id, full_name, username FROM mentor WHERE username = ? AND password = ?",
        [identifier, password]
      );
      if (!rows.length) return res.status(401).json({ message: "Invalid mentor credentials." });
      const mentor = rows[0];
      return res.json({
        role: "mentor",
        userId: mentor.mentor_id,
        displayName: mentor.full_name,
        identifier: mentor.username
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
      `SELECT question_id, question_text, option_1, option_2, option_3, option_4, marks_allocated, topic
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
         (exam_id, question_text, option_1, option_2, option_3, option_4, correct_answer, marks_allocated, topic)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          examId,
          q.questionText,
          q.option1,
          q.option2,
          q.option3,
          q.option4,
          Number(q.correctAnswer),
          Number(q.marksAllocated),
          (q.topic || "General").trim()
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

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [examRows] = await conn.query(
      "SELECT exam_id, title, total_marks, pass_mark FROM exam WHERE exam_id = ?",
      [examId]
    );
    if (!examRows.length) return res.status(404).json({ message: "Exam not found." });
    const exam = examRows[0];

    const [qRows] = await conn.query(
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
    const totalMarks = qRows.reduce((sum, q) => sum + Number(q.marks_allocated), 0);
    const percentage = totalMarks === 0 ? 0 : Number(((rawScore / totalMarks) * 100).toFixed(2));
    const status = percentage >= Number(exam.pass_mark) ? "Pass" : "Fail";

    const [attemptRows] = await conn.query(
      `SELECT
         COALESCE(MAX(attempt_number), 0) AS max_attempt_number,
         COALESCE(MAX(score_obtained), -1) AS best_score
       FROM result
       WHERE student_id = ? AND exam_id = ?`,
      [studentId, examId]
    );
    const nextAttemptNumber = Number(attemptRows[0].max_attempt_number) + 1;
    const shouldBeBest = percentage > Number(attemptRows[0].best_score);

    if (shouldBeBest) {
      await conn.query(
        `UPDATE result
         SET is_best_score = 0
         WHERE student_id = ? AND exam_id = ?`,
        [studentId, examId]
      );
    }

    const [resultInsert] = await conn.query(
      `INSERT INTO result
       (student_id, exam_id, attempt_number, raw_score, total_marks_snapshot, score_obtained, is_best_score, status, attempt_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [studentId, examId, nextAttemptNumber, rawScore, totalMarks, percentage, shouldBeBest ? 1 : 0, status]
    );
    const resultId = resultInsert.insertId;

    for (const q of qRows) {
      const selected = answerMap.get(Number(q.question_id)) || 0;
      const isCorrect = selected === Number(q.correct_answer);
      await conn.query(
        `INSERT INTO attempt_answer (result_id, question_id, selected_option, is_correct)
         VALUES (?, ?, ?, ?)`,
        [resultId, q.question_id, selected, isCorrect ? 1 : 0]
      );
    }

    await conn.commit();

    return res.json({
      examTitle: exam.title,
      rawScore,
      totalMarks,
      percentage,
      status,
      attemptNumber: nextAttemptNumber,
      isBestScore: shouldBeBest
    });
  } catch (error) {
    await conn.rollback();
    return res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
});

app.get("/api/results/student/:studentId", async (req, res) => {
  const { studentId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT r.result_id, e.title AS exam_title, r.raw_score, r.total_marks_snapshot, r.score_obtained,
              r.status, r.attempt_number, r.is_best_score, r.attempt_date
       FROM result r
       JOIN exam e ON e.exam_id = r.exam_id
       WHERE r.student_id = ?
       ORDER BY r.exam_id, r.attempt_number DESC`,
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

app.get("/api/mentors", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT mentor_id, username, full_name FROM mentor ORDER BY mentor_id"
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/students", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT student_id, first_name, last_name, email, enrollment_no
       FROM student
       ORDER BY student_id`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/mentor-assignments", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT msm.mentor_id, msm.student_id, msm.assigned_at,
              m.full_name AS mentor_name, m.username AS mentor_username,
              CONCAT(s.first_name, ' ', s.last_name) AS student_name,
              s.enrollment_no
       FROM mentor_student_map msm
       JOIN mentor m ON m.mentor_id = msm.mentor_id
       JOIN student s ON s.student_id = msm.student_id
       ORDER BY msm.assigned_at DESC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/mentor-assignments", async (req, res) => {
  const { mentorId, studentId } = req.body;
  if (!mentorId || !studentId) {
    return res.status(400).json({ message: "mentorId and studentId are required." });
  }
  try {
    await pool.query(
      `INSERT INTO mentor_student_map (mentor_id, student_id)
       VALUES (?, ?)`,
      [mentorId, studentId]
    );
    res.status(201).json({ message: "Student assigned to mentor successfully." });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "This student is already assigned to this mentor." });
    }
    res.status(500).json({ message: error.message });
  }
});

app.delete("/api/mentor-assignments/:mentorId/:studentId", async (req, res) => {
  const { mentorId, studentId } = req.params;
  try {
    const [result] = await pool.query(
      `DELETE FROM mentor_student_map
       WHERE mentor_id = ? AND student_id = ?`,
      [mentorId, studentId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ message: "Assignment not found." });
    }
    res.json({ message: "Assignment removed successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/mentor/:mentorId/students-performance", async (req, res) => {
  const { mentorId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT s.student_id, s.first_name, s.last_name, s.enrollment_no,
              COUNT(r.result_id) AS attempts_count,
              ROUND(AVG(r.score_obtained), 2) AS average_percentage,
              MAX(r.attempt_date) AS latest_attempt
       FROM mentor_student_map msm
       JOIN student s ON s.student_id = msm.student_id
       LEFT JOIN result r ON r.student_id = s.student_id
       WHERE msm.mentor_id = ?
       GROUP BY s.student_id, s.first_name, s.last_name, s.enrollment_no
       ORDER BY s.student_id`,
      [mentorId]
    );

    const [recentRows] = await pool.query(
      `SELECT s.student_id, CONCAT(s.first_name, ' ', s.last_name) AS student_name,
              e.title AS exam_title, r.score_obtained, r.status, r.attempt_date
       FROM mentor_student_map msm
       JOIN student s ON s.student_id = msm.student_id
       JOIN result r ON r.student_id = s.student_id
       JOIN exam e ON e.exam_id = r.exam_id
       WHERE msm.mentor_id = ?
       ORDER BY r.attempt_date DESC
       LIMIT 15`,
      [mentorId]
    );

    res.json({ students: rows, recentAttempts: recentRows });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/results/student/:studentId/improvement", async (req, res) => {
  const { studentId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT
         e.exam_id,
         e.title AS exam_title,
         SUBSTRING_INDEX(
           GROUP_CONCAT(r.score_obtained ORDER BY r.attempt_number ASC),
           ',',
           1
         ) AS first_score,
         MAX(r.score_obtained) AS best_score,
         SUBSTRING_INDEX(
           GROUP_CONCAT(r.score_obtained ORDER BY r.attempt_number DESC),
           ',',
           1
         ) AS latest_score,
         COUNT(r.result_id) AS total_attempts
       FROM result r
       JOIN exam e ON e.exam_id = r.exam_id
       WHERE r.student_id = ?
       GROUP BY e.exam_id, e.title
       ORDER BY e.exam_id`,
      [studentId]
    );
    const normalized = rows.map((row) => {
      const first = Number(row.first_score);
      const latest = Number(row.latest_score);
      return {
        exam_id: row.exam_id,
        exam_title: row.exam_title,
        first_score: first,
        latest_score: latest,
        best_score: Number(row.best_score),
        total_attempts: Number(row.total_attempts),
        improvement: Number((latest - first).toFixed(2))
      };
    });
    res.json(normalized);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/results/student/:studentId/weak-areas", async (req, res) => {
  const { studentId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT
         e.exam_id,
         e.title AS exam_title,
         q.topic,
         COUNT(*) AS total_answered,
         SUM(CASE WHEN aa.is_correct = 0 THEN 1 ELSE 0 END) AS wrong_count,
         SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) AS correct_count
       FROM result r
       JOIN exam e ON e.exam_id = r.exam_id
       JOIN attempt_answer aa ON aa.result_id = r.result_id
       JOIN question q ON q.question_id = aa.question_id
       WHERE r.student_id = ?
       GROUP BY e.exam_id, e.title, q.topic
       ORDER BY e.exam_id,
         wrong_count DESC,
         correct_count ASC,
         q.topic ASC`,
      [studentId]
    );

    const byExam = new Map();
    for (const row of rows) {
      const id = Number(row.exam_id);
      if (!byExam.has(id)) {
        byExam.set(id, {
          exam_id: id,
          exam_title: row.exam_title,
          topics: []
        });
      }
      byExam.get(id).topics.push({
        topic: row.topic || "General",
        wrong_count: Number(row.wrong_count),
        correct_count: Number(row.correct_count),
        total_answered: Number(row.total_answered)
      });
    }

    res.json(Array.from(byExam.values()).sort((a, b) => a.exam_id - b.exam_id));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/results/student/:studentId/practice-topics/:topic/questions", async (req, res) => {
  const { studentId, topic } = req.params;
  const examId = req.query.examId != null && req.query.examId !== "" ? Number(req.query.examId) : null;
  try {
    const params = examId != null && !Number.isNaN(examId) ? [studentId, topic, examId] : [studentId, topic];
    const [rows] = await pool.query(
      `SELECT
         q.question_id,
         q.question_text,
         q.option_1,
         q.option_2,
         q.option_3,
         q.option_4,
         q.correct_answer,
         q.marks_allocated,
         q.topic,
         e.title AS exam_title,
         SUM(CASE WHEN r.student_id = ? AND aa.is_correct = 0 THEN 1 ELSE 0 END) AS wrong_count_for_student
       FROM question q
       JOIN exam e ON e.exam_id = q.exam_id
       LEFT JOIN attempt_answer aa ON aa.question_id = q.question_id
       LEFT JOIN result r ON r.result_id = aa.result_id
       WHERE q.topic = ? ${examId != null && !Number.isNaN(examId) ? "AND q.exam_id = ?" : ""}
       GROUP BY
         q.question_id, q.question_text, q.option_1, q.option_2, q.option_3, q.option_4,
         q.correct_answer, q.marks_allocated, q.topic, e.title
       ORDER BY wrong_count_for_student DESC, q.question_id
       LIMIT 10`,
      params
    );

    res.json(
      rows.map((row) => ({
        question_id: Number(row.question_id),
        question_text: row.question_text,
        option_1: row.option_1,
        option_2: row.option_2,
        option_3: row.option_3,
        option_4: row.option_4,
        correct_answer: Number(row.correct_answer),
        marks_allocated: Number(row.marks_allocated),
        topic: row.topic || "General",
        exam_title: row.exam_title,
        wrong_count_for_student: Number(row.wrong_count_for_student)
      }))
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/results/student/:studentId/generate-demo-attempts", async (req, res) => {
  const { studentId } = req.params;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [examRows] = await conn.query(
      `SELECT exam_id, total_marks, pass_mark
       FROM exam
       ORDER BY exam_id
       LIMIT 1`
    );
    if (!examRows.length) {
      await conn.rollback();
      return res.status(400).json({ message: "No exams found to generate demo attempts." });
    }
    const exam = examRows[0];

    const [qRows] = await conn.query(
      `SELECT question_id, correct_answer, marks_allocated
       FROM question
       WHERE exam_id = ?
       ORDER BY question_id`,
      [exam.exam_id]
    );
    if (!qRows.length) {
      await conn.rollback();
      return res.status(400).json({ message: "Selected exam has no questions." });
    }

    const [attemptRows] = await conn.query(
      `SELECT COALESCE(MAX(attempt_number), 0) AS max_attempt
       FROM result
       WHERE student_id = ? AND exam_id = ?`,
      [studentId, exam.exam_id]
    );
    let nextAttempt = Number(attemptRows[0].max_attempt) + 1;

    const scenarios = [
      { correctCount: Math.max(1, Math.floor(qRows.length * 0.35)) },
      { correctCount: Math.max(2, Math.floor(qRows.length * 0.65)) }
    ];

    for (const scenario of scenarios) {
      let rawScore = 0;
      const answersPayload = [];
      qRows.forEach((q, idx) => {
        const shouldBeCorrect = idx < scenario.correctCount;
        const selectedOption = shouldBeCorrect
          ? Number(q.correct_answer)
          : Number(q.correct_answer) === 4
          ? 1
          : Number(q.correct_answer) + 1;
        if (shouldBeCorrect) rawScore += Number(q.marks_allocated);
        answersPayload.push({
          question_id: q.question_id,
          selected_option: selectedOption,
          is_correct: shouldBeCorrect ? 1 : 0
        });
      });

      const percentage =
        Number(exam.total_marks) === 0 ? 0 : Number(((rawScore / Number(exam.total_marks)) * 100).toFixed(2));
      const status = percentage >= Number(exam.pass_mark) ? "Pass" : "Fail";

      const [insertResult] = await conn.query(
        `INSERT INTO result
         (student_id, exam_id, attempt_number, raw_score, total_marks_snapshot, score_obtained, is_best_score, status, attempt_date)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, CURRENT_TIMESTAMP)`,
        [studentId, exam.exam_id, nextAttempt, rawScore, Number(exam.total_marks), percentage, status]
      );

      for (const ans of answersPayload) {
        await conn.query(
          `INSERT INTO attempt_answer (result_id, question_id, selected_option, is_correct)
           VALUES (?, ?, ?, ?)`,
          [insertResult.insertId, ans.question_id, ans.selected_option, ans.is_correct]
        );
      }
      nextAttempt += 1;
    }

    await conn.query(
      `UPDATE result r
       JOIN (
         SELECT result_id
         FROM result
         WHERE student_id = ? AND exam_id = ?
         ORDER BY score_obtained DESC, attempt_number DESC
         LIMIT 1
       ) b ON b.result_id = r.result_id
       SET r.is_best_score = 1`,
      [studentId, exam.exam_id]
    );

    await conn.query(
      `UPDATE result
       SET is_best_score = 0
       WHERE student_id = ? AND exam_id = ? AND result_id NOT IN (
         SELECT result_id FROM (
           SELECT result_id
           FROM result
           WHERE student_id = ? AND exam_id = ?
           ORDER BY score_obtained DESC, attempt_number DESC
           LIMIT 1
         ) x
       )`,
      [studentId, exam.exam_id, studentId, exam.exam_id]
    );

    await conn.commit();
    res.json({ message: "Demo attempts generated successfully." });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: error.message });
  } finally {
    conn.release();
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
