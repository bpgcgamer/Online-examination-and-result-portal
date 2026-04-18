USE online_exam_portal;

INSERT INTO admin (username, password, full_name) VALUES
('admin1', 'admin123', 'Ananya Sharma'),
('admin2', 'admin123', 'Ravi Verma');

INSERT INTO mentor (username, password, full_name) VALUES
('mentor1', 'mentor123', 'Neha Kapoor');

CALL Add_Student('aarav.shah@example.com', 'stud123', 'Aarav', 'Shah', 'ENR001');
CALL Add_Student('diya.mehta@example.com', 'stud123', 'Diya', 'Mehta', 'ENR002');
CALL Add_Student('kabir.nanda@example.com', 'stud123', 'Kabir', 'Nanda', 'ENR003');

INSERT INTO mentor_student_map (mentor_id, student_id) VALUES
(1, 1),
(1, 2),
(1, 3);

INSERT INTO exam (exam_code, title, duration_minutes, total_marks, pass_mark, created_by_admin_id) VALUES
('DBMS-MID-01', 'DBMS Midterm', 60, 50, 40, 1),
('SQL-FIN-01', 'SQL Final', 75, 50, 50, 2);

INSERT INTO question(exam_id, question_text, option_1, option_2, option_3, option_4, correct_answer, marks_allocated, explanation) VALUES

(1, 'What does DBMS stand for?', 'Data Backup Management System', 'Database Management System', 'Digital Base Monitoring Software', 'Data Batch Management Setup', 2, 5,'DBMS stands for Database Management System. It is software used to store, manage, and retrieve data efficiently.'),
(1, 'Which normal form removes partial dependency?', '1NF', '2NF', '3NF', 'BCNF', 2, 5,'Second Normal Form (2NF) removes partial dependency, ensuring that non-key attributes depend on the entire primary key.'),
(1, 'Which SQL clause is used to filter rows?', 'ORDER BY', 'GROUP BY', 'WHERE', 'LIMIT', 3, 5,'The WHERE clause is used to filter rows based on a specified condition before any grouping or ordering.'),
(1, 'Which key uniquely identifies a record?', 'Foreign Key', 'Primary Key', 'Composite Key', 'Alternate Key', 2, 5,'A Primary Key uniquely identifies each record in a table and cannot contain NULL or duplicate values.'),
(1, 'Which join returns matching rows from both tables?', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 3, 5,'INNER JOIN returns only the rows that have matching values in both tables.'),
(1, 'Which command removes all rows but keeps table structure?', 'DELETE', 'DROP', 'TRUNCATE', 'REMOVE', 3, 5,'TRUNCATE removes all rows from a table quickly but keeps the table structure intact'),
(1, 'What is ACID property in DBMS?', 'A database backup rule', 'A transaction property set', 'A schema design method', 'An indexing strategy', 2, 5,'ACID stands for Atomicity, Consistency, Isoation, and Durability. These properties ensure reliable database transactions.'),
(1, 'Which SQL function counts rows?', 'COUNT()', 'SUM()', 'AVG()', 'MAX()', 1, 5,'COUNT() is used to count the number of rows in a table or the number of non-null values in a column.'),
(1, 'Foreign key is used to?', 'Create duplicates', 'Link related tables', 'Delete tables', 'Encrypt data', 2, 5,'A Foreign Key is used to establish a relationship between two tables by referencing a primary key in another table.'),
(1, 'Which one is a DDL command?', 'INSERT', 'UPDATE', 'CREATE', 'SELECT', 3, 5,'CREATE is a Data Definition Language (DDL) command used to define database structures like tables.'),

-- EXAM 2

(2, 'Which command is used to create a view?', 'CREATE VIEW', 'NEW VIEW', 'MAKE VIEW', 'VIEW CREATE', 1, 5,'CREATE VIEW is used to define a virtual table based on the result of a SELECT query.'),
(2, 'Which function returns current date in MySQL?', 'GETDATE()', 'CURRENT_DATE()', 'NOWDATE()', 'TODAY()', 2, 5,'CURRENT_DATE() returns the current date in MySQL without the time component.'),
(2, 'Which clause is used with aggregate functions?', 'HAVING', 'LIMIT', 'UNION', 'DISTINCT', 1, 5,'HAVING is used with aggregate functions to filter grouped data after GROUP BY.'),
(2, 'What does LEFT JOIN return?', 'Only matched rows', 'All rows from right table', 'All rows from left plus matched right', 'Cartesian product', 3, 5,'LEFT JOIN returns all rows from the left table and matching rows from the right table. Non-matching rows contain NULL.'),
(2, 'Which statement modifies existing table structure?', 'ALTER TABLE', 'MODIFY TABLE', 'CHANGE TABLE', 'EDIT TABLE', 1, 5,'ALTER TABLE is used to modify the structure of an existing table, such as adding or removing columns.'),
(2, 'What does GROUP BY do?', 'Sorts rows', 'Groups rows for aggregation', 'Deletes duplicates', 'Creates index', 2, 5,'GROUP BY groups rows with the same values so aggregate functions like COUNT or SUM can be applied.'),
(2, 'Which keyword removes duplicate rows in output?', 'UNIQUE', 'DISTINCT', 'SINGLE', 'ONLY', 2, 5,'DISTINCT removes duplicate rows from the result set of a SELECT query.'),
(2, 'Which SQL operator checks a range?','IN', 'BETWEEN', 'LIKE', 'IS', 2, 5,'BETWEEN is used to filter values within a specified range (inclusive).'),
(2, 'Which command adds new records?','SELECT', 'INSERT', 'ALTER', 'CREATE',2, 5,'INSERT is used to add new records (rows) into a table.'),
(2, 'Which clause sorts results?','WHERE', 'ORDER BY', 'HAVING', 'GROUP BY', 2, 5,'ORDER BY is used to sort query results in ascending or descending order.');

INSERT INTO result (student_id, exam_id, attempt_number, raw_score, total_marks_snapshot, score_obtained, is_best_score, status, attempt_date) VALUES
-- DBMS Exam (total_marks = 50, 10 questions x 5 marks each)
(1, 1, 1, 35, 50, 70.00, 0, 'Pass', '2026-03-10 10:10:00'),
(1, 1, 2, 40, 50, 80.00, 1, 'Pass', '2026-03-16 10:45:00'),
-- SQL Exam (total_marks = 50, 10 questions x 5 marks each)
(1, 2, 1, 30, 50, 60.00, 0, 'Pass', '2026-03-11 11:00:00'),
(1, 2, 2, 40, 50, 80.00, 1, 'Pass', '2026-03-19 15:40:00'),
-- Student 2
(2, 1, 1, 25, 50, 50.00, 0, 'Pass', '2026-03-12 09:15:00'),
(2, 1, 2, 35, 50, 70.00, 1, 'Pass', '2026-03-17 08:35:00'),
(2, 2, 1, 35, 50, 70.00, 0, 'Pass', '2026-03-13 14:20:00'),
(2, 2, 2, 45, 50, 90.00, 1, 'Pass', '2026-03-20 10:30:00'),
-- Student 3
(3, 1, 1, 20, 50, 40.00, 1, 'Pass', '2026-03-14 16:25:00'),
(3, 2, 1, 25, 50, 50.00, 1, 'Pass', '2026-03-15 12:05:00'),
(3, 2, 2, 20, 50, 40.00, 0, 'Fail', '2026-03-18 13:00:00');

-- Constraint test (run separately to demonstrate failure):
-- This should fail because CHECK(score_obtained <= 100)
-- INSERT INTO result (student_id, exam_id, raw_score, total_marks_snapshot, score_obtained, status)
-- VALUES (1, 1, 105, 100, 105.00, 'Pass');
