# Online Examination and Result Portal (DBMS-Backed)

This project now includes a complete **Node + Express + MySQL** implementation aligned to your DBMS role distribution:

- `schema.sql` -> DDL + constraints
- `data_seed.sql` -> DML seed data
- `queries.sql` -> views + complex joins
- `advanced_db.sql` -> trigger + stored procedure
- `server.js` + `db.js` -> backend API
- `app.js` + `index.html` + `styles.css` -> frontend portal
- `python_connector.py` -> CLI connector menu (Login, Take Exam, View Result)

User roles currently supported in web app:
- Admin
- Student
- Mentor

## 1) MySQL setup

Run these files in order:

1. `schema.sql`
2. `advanced_db.sql`
3. `data_seed.sql`
4. `queries.sql`

This creates:
- 5 users (2 admins, 3 students)
- 1 mentor
- 2 exams
- 20 questions
- 10 past attempts

To demo constraint failure, run the commented `score_obtained = 105` insert in `data_seed.sql`.

## 2) Backend setup (Node + Express)

1. Copy `.env.example` to `.env` and fill your MySQL credentials.
2. Install dependencies:
   - `npm install`
3. Start server:
   - `npm start`

Server runs on `http://localhost:4000`.

## 3) Frontend usage

Open `http://localhost:4000` in browser (served by Express).

- Sign up as student/admin
- Login
- Admin can create exams
- Student can attempt exams and view results

## 4) Python CLI connector

Install connector package:
- `pip install mysql-connector-python`

Run:
- `python python_connector.py`

Menu includes:
1. Login
2. Take Exam
3. View Result

## Role deliverables mapping

1. **DDL Specialist:** `schema.sql`
2. **DML Specialist:** `data_seed.sql`
3. **Query Analyst:** `queries.sql` (includes `Student_Report_Card` and topper query)
4. **Automation Engineer:** `advanced_db.sql` (trigger + `Add_Student()`)
5. **Integration Lead:** `python_connector.py`
