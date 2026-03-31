import os
import mysql.connector
from getpass import getpass


def get_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "online_exam_portal")
    )


def login(cursor):
    print("\nLogin")
    role = input("Role (student/admin): ").strip().lower()
    identifier = input("Email (student) or username (admin): ").strip()
    password = getpass("Password: ").strip()

    if role == "admin":
        cursor.execute(
            "SELECT admin_id, full_name FROM admin WHERE username=%s AND password=%s",
            (identifier, password)
        )
        row = cursor.fetchone()
        if not row:
            print("Invalid credentials.")
            return None
        return {"role": "admin", "id": row[0], "name": row[1]}

    cursor.execute(
        "SELECT student_id, first_name, last_name FROM student WHERE email=%s AND password=%s",
        (identifier, password)
    )
    row = cursor.fetchone()
    if not row:
        print("Invalid credentials.")
        return None
    return {"role": "student", "id": row[0], "name": f"{row[1]} {row[2]}"}


def take_exam(cursor, conn, student_id):
    cursor.execute("SELECT exam_id, title, total_marks, pass_mark FROM exam ORDER BY exam_id")
    exams = cursor.fetchall()
    if not exams:
        print("No exams available.")
        return

    print("\nAvailable Exams:")
    for exam in exams:
        print(f"Exam ID: {exam[0]} | {exam[1]} | Total: {exam[2]} | Pass Mark: {exam[3]}%")

    exam_id = int(input("Enter exam_id to attempt: ").strip())
    cursor.execute(
        "SELECT question_id, question_text, option_1, option_2, option_3, option_4, correct_answer, marks_allocated "
        "FROM question WHERE exam_id=%s ORDER BY question_id",
        (exam_id,)
    )
    questions = cursor.fetchall()
    if not questions:
        print("No questions found for this exam.")
        return

    raw_score = 0
    total = 0
    for q in questions:
        qid, qtext, o1, o2, o3, o4, correct, marks = q
        total += marks
        print(f"\nQ{qid}: {qtext} ({marks} marks)")
        print(f"1. {o1}\n2. {o2}\n3. {o3}\n4. {o4}")
        try:
            choice = int(input("Your answer (1-4): ").strip())
        except ValueError:
            choice = 0
        if choice == correct:
            raw_score += marks

    percentage = round((raw_score / total) * 100, 2) if total else 0
    cursor.execute("SELECT pass_mark FROM exam WHERE exam_id=%s", (exam_id,))
    pass_mark = float(cursor.fetchone()[0])
    status = "Pass" if percentage >= pass_mark else "Fail"

    cursor.execute(
        "INSERT INTO result (student_id, exam_id, raw_score, total_marks_snapshot, score_obtained, status) "
        "VALUES (%s, %s, %s, %s, %s, %s)",
        (student_id, exam_id, raw_score, total, percentage, status)
    )
    conn.commit()
    print(f"\nSubmitted. Score: {raw_score}/{total} ({percentage}%) | Status: {status}")


def view_results(cursor, student_id):
    cursor.execute(
        "SELECT e.title, r.raw_score, r.total_marks_snapshot, r.score_obtained, r.status, r.attempt_date "
        "FROM result r JOIN exam e ON e.exam_id = r.exam_id "
        "WHERE r.student_id=%s ORDER BY r.attempt_date DESC",
        (student_id,)
    )
    rows = cursor.fetchall()
    if not rows:
        print("No result history found.")
        return

    print("\nResult History:")
    for row in rows:
        print(
            f"Exam: {row[0]} | Score: {row[1]}/{row[2]} ({row[3]}%) | "
            f"Status: {row[4]} | Date: {row[5]}"
        )


def main():
    try:
        conn = get_connection()
    except Exception as exc:
        print(f"Database connection failed: {exc}")
        return

    cursor = conn.cursor()
    session = None

    while True:
        print("\n=== Online Exam CLI ===")
        print("1. Login")
        print("2. Take Exam")
        print("3. View Result")
        print("4. Exit")
        choice = input("Choose option: ").strip()

        if choice == "1":
            session = login(cursor)
            if session:
                print(f"Logged in as {session['name']} ({session['role']})")
        elif choice == "2":
            if not session or session["role"] != "student":
                print("Login as student first.")
            else:
                take_exam(cursor, conn, session["id"])
        elif choice == "3":
            if not session or session["role"] != "student":
                print("Login as student first.")
            else:
                view_results(cursor, session["id"])
        elif choice == "4":
            break
        else:
            print("Invalid option.")

    cursor.close()
    conn.close()


if __name__ == "__main__":
    main()
