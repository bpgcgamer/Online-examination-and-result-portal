USE online_exam_portal;

INSERT INTO admin (username, password, full_name) VALUES
('admin1', 'admin123', 'Ananya Sharma'),
('admin2', 'admin123', 'Ravi Verma');

CALL Add_Student('aarav.shah@example.com', 'stud123', 'Aarav', 'Shah', 'ENR001');
CALL Add_Student('diya.mehta@example.com', 'stud123', 'Diya', 'Mehta', 'ENR002');
CALL Add_Student('kabir.nanda@example.com', 'stud123', 'Kabir', 'Nanda', 'ENR003');

INSERT INTO exam (exam_code, title, duration_minutes, total_marks, pass_mark, remarks, created_by_admin_id) VALUES
('DBMS-MID-01', 'DBMS Midterm', 60, 100, 40, 'Good effort. Revise normalization and joins.', 1),
('SQL-FIN-01', 'SQL Final', 75, 100, 50, 'Focus on aggregate functions and views.', 2);

INSERT INTO question (exam_id, question_text, option_1, option_2, option_3, option_4, correct_answer, marks_allocated) VALUES
(1, 'What does DBMS stand for?', 'Data Backup Management System', 'Database Management System', 'Digital Base Monitoring Software', 'Data Batch Management Setup', 2, 5),
(1, 'Which normal form removes partial dependency?', '1NF', '2NF', '3NF', 'BCNF', 2, 5),
(1, 'Which SQL clause is used to filter rows?', 'ORDER BY', 'GROUP BY', 'WHERE', 'LIMIT', 3, 5),
(1, 'Which key uniquely identifies a record?', 'Foreign Key', 'Primary Key', 'Composite Key', 'Alternate Key', 2, 5),
(1, 'Which join returns matching rows from both tables?', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 3, 5),
(1, 'Which command removes all rows but keeps table structure?', 'DELETE', 'DROP', 'TRUNCATE', 'REMOVE', 3, 5),
(1, 'What is ACID property in DBMS?', 'A database backup rule', 'A transaction property set', 'A schema design method', 'An indexing strategy', 2, 5),
(1, 'Which SQL function counts rows?', 'COUNT()', 'SUM()', 'AVG()', 'MAX()', 1, 5),
(1, 'Foreign key is used to?', 'Create duplicates', 'Link related tables', 'Delete tables', 'Encrypt data', 2, 5),
(1, 'Which one is a DDL command?', 'INSERT', 'UPDATE', 'CREATE', 'SELECT', 3, 5),

(2, 'Which command is used to create a view?', 'CREATE VIEW', 'NEW VIEW', 'MAKE VIEW', 'VIEW CREATE', 1, 5),
(2, 'Which function returns current date in MySQL?', 'GETDATE()', 'CURRENT_DATE()', 'NOWDATE()', 'TODAY()', 2, 5),
(2, 'Which clause is used with aggregate functions?', 'HAVING', 'LIMIT', 'UNION', 'DISTINCT', 1, 5),
(2, 'What does LEFT JOIN return?', 'Only matched rows', 'All rows from right table', 'All rows from left plus matched right', 'Cartesian product', 3, 5),
(2, 'Which statement modifies existing table structure?', 'ALTER TABLE', 'MODIFY TABLE', 'CHANGE TABLE', 'EDIT TABLE', 1, 5),
(2, 'What does GROUP BY do?', 'Sorts rows', 'Groups rows for aggregation', 'Deletes duplicates', 'Creates index', 2, 5),
(2, 'Which keyword removes duplicate rows in output?', 'UNIQUE', 'DISTINCT', 'SINGLE', 'ONLY', 2, 5),
(2, 'Which SQL operator checks a range?', 'IN', 'BETWEEN', 'LIKE', 'IS', 2, 5),
(2, 'Which command adds new records?', 'SELECT', 'INSERT', 'ALTER', 'CREATE', 2, 5),
(2, 'Which clause sorts results?', 'WHERE', 'ORDER BY', 'HAVING', 'GROUP BY', 2, 5);

INSERT INTO result (student_id, exam_id, raw_score, total_marks_snapshot, score_obtained, status, attempt_date) VALUES
(1, 1, 35, 100, 35.00, 'Fail', '2026-03-10 10:10:00'),
(1, 2, 62, 100, 62.00, 'Pass', '2026-03-11 11:00:00'),
(2, 1, 48, 100, 48.00, 'Pass', '2026-03-12 09:15:00'),
(2, 2, 77, 100, 77.00, 'Pass', '2026-03-13 14:20:00'),
(3, 1, 39, 100, 39.00, 'Fail', '2026-03-14 16:25:00'),
(3, 2, 58, 100, 58.00, 'Pass', '2026-03-15 12:05:00'),
(1, 1, 41, 100, 41.00, 'Pass', '2026-03-16 10:45:00'),
(2, 1, 65, 100, 65.00, 'Pass', '2026-03-17 08:35:00'),
(3, 2, 49, 100, 49.00, 'Fail', '2026-03-18 13:00:00'),
(1, 2, 85, 100, 85.00, 'Pass', '2026-03-19 15:40:00');

-- Constraint test (run separately to demonstrate failure):
-- This should fail because CHECK(score_obtained <= 100)
-- INSERT INTO result (student_id, exam_id, raw_score, total_marks_snapshot, score_obtained, status)
-- VALUES (1, 1, 105, 100, 105.00, 'Pass');
