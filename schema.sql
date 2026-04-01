CREATE DATABASE IF NOT EXISTS online_exam_portal;
USE online_exam_portal;

DROP TABLE IF EXISTS result;
DROP TABLE IF EXISTS question;
DROP TABLE IF EXISTS exam;
DROP TABLE IF EXISTS student;
DROP TABLE IF EXISTS admin;

CREATE TABLE admin (
  admin_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL
);

CREATE TABLE student (
  student_id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(120) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(60) NOT NULL,
  last_name VARCHAR(60) NOT NULL,
  enrollment_no VARCHAR(40) NOT NULL UNIQUE,
  total_attempts INT NOT NULL DEFAULT 0 CHECK (total_attempts >= 0)
);

CREATE TABLE exam (
  exam_id INT AUTO_INCREMENT PRIMARY KEY,
  exam_code VARCHAR(30) NOT NULL UNIQUE,
  title VARCHAR(120) NOT NULL,
  date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  total_marks INT NOT NULL DEFAULT 100 CHECK (total_marks > 0 AND total_marks <= 1000),
  pass_mark DECIMAL(5,2) NOT NULL DEFAULT 40.00 CHECK (pass_mark >= 0 AND pass_mark <= 100),
  created_by_admin_id INT NOT NULL,
  CONSTRAINT fk_exam_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin(admin_id)
);

CREATE TABLE question (
  question_id INT AUTO_INCREMENT PRIMARY KEY,
  exam_id INT NOT NULL,
  question_text VARCHAR(500) NOT NULL,
  option_1 VARCHAR(255) NOT NULL,
  option_2 VARCHAR(255) NOT NULL,
  option_3 VARCHAR(255) NOT NULL,
  option_4 VARCHAR(255) NOT NULL,
  correct_answer TINYINT NOT NULL CHECK (correct_answer BETWEEN 1 AND 4),
  marks_allocated INT NOT NULL DEFAULT 1 CHECK (marks_allocated > 0 AND marks_allocated <= 100),
  CONSTRAINT fk_question_exam FOREIGN KEY (exam_id) REFERENCES exam(exam_id) ON DELETE CASCADE
);

CREATE TABLE result (
  result_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  exam_id INT NOT NULL,
  raw_score INT NOT NULL DEFAULT 0 CHECK (raw_score >= 0),
  total_marks_snapshot INT NOT NULL CHECK (total_marks_snapshot > 0),
  score_obtained DECIMAL(5,2) NOT NULL CHECK (score_obtained >= 0 AND score_obtained <= 100),
  status ENUM('Pass', 'Fail') NOT NULL,
  attempt_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_result_student FOREIGN KEY (student_id) REFERENCES student(student_id),
  CONSTRAINT fk_result_exam FOREIGN KEY (exam_id) REFERENCES exam(exam_id)
);

CREATE TABLE attempt_answer (
  attempt_answer_id INT AUTO_INCREMENT PRIMARY KEY,
  result_id INT NOT NULL,
  question_id INT NOT NULL,
  selected_option TINYINT NOT NULL CHECK (selected_option BETWEEN 0 AND 4),
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_attempt_answer_result FOREIGN KEY (result_id) REFERENCES result(result_id) ON DELETE CASCADE,
  CONSTRAINT fk_attempt_answer_question FOREIGN KEY (question_id) REFERENCES question(question_id) ON DELETE CASCADE
);
