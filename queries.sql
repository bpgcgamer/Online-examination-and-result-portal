USE online_exam_portal;

DROP VIEW IF EXISTS Student_Report_Card;

CREATE VIEW Student_Report_Card AS
SELECT
  s.student_id,
  CONCAT(s.first_name, ' ', s.last_name) AS student_name,
  s.enrollment_no,
  e.exam_id,
  e.title AS exam_title,
  r.raw_score,
  r.total_marks_snapshot AS total_marks,
  r.score_obtained AS percentage,
  r.attempt_number,
  r.is_best_score,
  r.status,
  r.attempt_date,
  CASE
    WHEN r.score_obtained >= 85 THEN 'A'
    WHEN r.score_obtained >= 70 THEN 'B'
    WHEN r.score_obtained >= 55 THEN 'C'
    WHEN r.score_obtained >= e.pass_mark THEN 'D'
    ELSE 'F'
  END AS grade
FROM result r
JOIN student s ON s.student_id = r.student_id
JOIN exam e ON e.exam_id = r.exam_id;

-- Query: Topper of the class (highest average percentage)
SELECT
  s.student_id,
  CONCAT(s.first_name, ' ', s.last_name) AS student_name,
  ROUND(AVG(r.score_obtained), 2) AS avg_percentage
FROM student s
JOIN result r ON r.student_id = s.student_id
GROUP BY s.student_id, s.first_name, s.last_name
ORDER BY avg_percentage DESC
LIMIT 1;

-- Additional useful complex queries
-- 1) Exam-wise performance summary
SELECT
  e.exam_id,
  e.title,
  COUNT(r.result_id) AS attempts,
  ROUND(AVG(r.score_obtained), 2) AS avg_score,
  SUM(CASE WHEN r.status = 'Pass' THEN 1 ELSE 0 END) AS pass_count,
  SUM(CASE WHEN r.status = 'Fail' THEN 1 ELSE 0 END) AS fail_count
FROM exam e
LEFT JOIN result r ON r.exam_id = e.exam_id
GROUP BY e.exam_id, e.title;

-- 2) Student leaderboard
SELECT
  s.student_id,
  CONCAT(s.first_name, ' ', s.last_name) AS student_name,
  s.total_attempts,
  ROUND(AVG(r.score_obtained), 2) AS avg_score
FROM student s
LEFT JOIN result r ON r.student_id = s.student_id
GROUP BY s.student_id, s.first_name, s.last_name, s.total_attempts
ORDER BY avg_score DESC;

-- 3) Reattempt and improvement tracking per student and exam
SELECT
  s.student_id,
  CONCAT(s.first_name, ' ', s.last_name) AS student_name,
  e.exam_id,
  e.title AS exam_title,
  COUNT(r.result_id) AS total_attempts,
  MIN(r.score_obtained) AS first_score,
  MAX(r.score_obtained) AS best_score,
  SUBSTRING_INDEX(
    GROUP_CONCAT(r.score_obtained ORDER BY r.attempt_number DESC),
    ',',
    1
  ) AS latest_score,
  (
    SUBSTRING_INDEX(
      GROUP_CONCAT(r.score_obtained ORDER BY r.attempt_number DESC),
      ',',
      1
    ) - MIN(r.score_obtained)
  ) AS improvement
FROM result r
JOIN student s ON s.student_id = r.student_id
JOIN exam e ON e.exam_id = r.exam_id
GROUP BY s.student_id, s.first_name, s.last_name, e.exam_id, e.title
ORDER BY s.student_id, e.exam_id;
