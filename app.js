const API_BASE = "/api";
const SESSION_KEY = "examPortalSession";
const THEME_KEY = "examPortalTheme";
const app = document.getElementById("app");

function getPreferredTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const toggleBtn = document.getElementById("themeToggleBtn");
  if (toggleBtn) {
    toggleBtn.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
    toggleBtn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  }
}

function initTheme() {
  applyTheme(getPreferredTheme());
  const toggleBtn = document.getElementById("themeToggleBtn");
  if (!toggleBtn) return;
  toggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
    render();
  });
}

function readSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

function writeSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function formatDateTime(date) {
  return new Date(date).toLocaleString();
}

function setSession(user) {
  writeSession(user);
  render();
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  render();
}

function renderAuthScreen(mode = "login", error = "", info = "") {
  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";
  
  let title = "Login";
  let helper = "Use your credentials to continue.";
  
  if (isSignup) {
    title = "Sign Up";
    helper = "Create your account as Student, Admin, or Mentor.";
  } else if (isForgot) {
    title = "Forgot Password";
    helper = "Enter your details to find your security question.";
  } else if (isReset) {
    title = "Reset Password";
    helper = "Answer your security question to set a new password.";
  }

  const nameField = isSignup
    ? `
        <div>
          <label for="name">Full Name</label>
          <input id="name" placeholder="Enter your name" />
        </div>
      `
    : "";

  const securityFields = isSignup
    ? `
        <div>
          <label for="securityQuestion">Security Question</label>
          <input id="securityQuestion" placeholder="e.g., Your first pet's name?" />
        </div>
        <div>
          <label for="securityAnswer">Security Answer</label>
          <input id="securityAnswer" placeholder="Enter answer" />
        </div>
      `
    : "";

  const resetFields = isReset
    ? `
        <div class="space-top">
          <p><strong>Question:</strong> <span id="displayQuestion"></span></p>
        </div>
        <div>
          <label for="securityAnswer">Your Answer</label>
          <input id="securityAnswer" placeholder="Enter answer" />
        </div>
        <div>
          <label for="newPassword">New Password</label>
          <input id="newPassword" type="password" placeholder="Enter new password" />
        </div>
      `
    : "";

  app.className = "auth-layout";

  app.innerHTML = `
    <section class="card auth-card">
      <div class="auth-shell">
        <aside class="auth-side">
          <h3>Secure Access</h3>
          <p class="small">Use one identity for exams, analytics, mentoring, and AI-assisted doubt solving.</p>
          <ul class="auth-points small">
            <li>Role-based dashboards and workflows</li>
            <li>Exam attempt history and progress insights</li>
            <li>Password recovery with security questions</li>
          </ul>
        </aside>

        <div>
          <span class="hero-kicker">Portal Entry</span>
          <h2 class="hero-title">${title}</h2>
          <p class="small section-subtitle">${helper}</p>

          <div class="row">
            ${nameField}
            <div>
              <label for="role">Role</label>
              <select id="role">
                <option value="student">Student</option>
                <option value="admin">Admin</option>
                <option value="mentor">Mentor</option>
              </select>
            </div>
            <div>
              <label for="identifier">${isSignup || isForgot || isReset ? "Username / Email" : "Username (Admin/Mentor) or Email (Student)"}</label>
              <input id="identifier" placeholder="Enter username or email" />
            </div>
            ${!isForgot && !isReset ? `
            <div>
              <label for="password">Password</label>
              <input id="password" type="password" placeholder="Enter password" />
            </div>
            ` : ""}
            ${securityFields}
            ${resetFields}
          </div>

          ${error ? `<p class="small text-danger">${error}</p>` : ""}
          ${info ? `<p class="small text-success">${info}</p>` : ""}

          <div class="auth-form-actions space-top">
            <button class="btn-primary" id="primaryBtn">
              ${isSignup ? "Create Account" : isForgot ? "Find Question" : isReset ? "Reset Password" : "Login"}
            </button>
            <button class="btn-muted" id="switchAuthBtn">
              ${isSignup || isForgot || isReset ? "Back to Login" : "New user? Sign Up"}
            </button>
          </div>

          ${!isSignup && !isForgot && !isReset ? `
            <div class="text-center space-top">
              <a href="#" id="forgotPasswordLink" class="small link-button">Forgot Password?</a>
            </div>
          ` : ""}

          <div class="note-box small">
            <div><strong>Note:</strong> First-time users should create an account first.</div>
          </div>
        </div>
      </div>
    </section>
  `;

  if (window._forgotState && isReset) {
    document.getElementById("identifier").value = window._forgotState.identifier;
    document.getElementById("role").value = window._forgotState.role;
    document.getElementById("displayQuestion").innerText = window._forgotState.question;
  }

  document.getElementById("switchAuthBtn").addEventListener("click", () => {
  renderAuthScreen(mode === "login" ? "signup" : "login");
});

  if (document.getElementById("forgotPasswordLink")) {
    document.getElementById("forgotPasswordLink").addEventListener("click", (e) => {
      e.preventDefault();
      renderAuthScreen("forgot");
    });
  }

  document.getElementById("primaryBtn").addEventListener("click", () => {
    const role = document.getElementById("role").value;
    const identifier = document.getElementById("identifier").value.trim();
    
    if (isForgot) {
      if (!identifier) return renderAuthScreen("forgot", "Please enter your username/email.");
      fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, identifier })
      })
      .then(async res => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message);
        window._forgotState = { role, identifier, question: data.securityQuestion };
        renderAuthScreen("reset");
      })
      .catch(err => renderAuthScreen("forgot", err.message));
      return;
    }

    if (isReset) {
      const securityAnswer = document.getElementById("securityAnswer").value.trim();
      const newPassword = document.getElementById("newPassword").value.trim();
      if (!securityAnswer || !newPassword) return renderAuthScreen("reset", "Please fill all fields.");
      
      fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, identifier, securityAnswer, newPassword })
      })
      .then(async res => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message);
        renderAuthScreen("login", "", "Password reset successful. Please login.");
      })
      .catch(err => renderAuthScreen("reset", err.message));
      return;
    }

    const password = document.getElementById("password") ? document.getElementById("password").value.trim() : "";
    const nameInput = document.getElementById("name");
    const fullName = nameInput ? nameInput.value.trim() : "";
    
    if (!identifier || (!isForgot && !isReset && !password) || (isSignup && !fullName)) {
      renderAuthScreen(mode, "Please fill all required fields.");
      return;
    }

    if (isSignup) {
      const securityQuestion = document.getElementById("securityQuestion").value.trim();
      const securityAnswer = document.getElementById("securityAnswer").value.trim();
      
      const payload = role === "student" 
        ? {
            role: "student",
            email: identifier,
            password,
            firstName: fullName.split(" ")[0],
            lastName: fullName.split(" ").slice(1).join(" "),
            enrollmentNo: `ENR-${Date.now().toString().slice(-6)}`,
            securityQuestion,
            securityAnswer
          }
        : {
            role,
            fullName,
            username: identifier,
            password,
            securityQuestion,
            securityAnswer
          };

      fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      .then(async res => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message);
        renderAuthScreen("login", "", "Account created successfully. Please login.");
      })
      .catch(err => renderAuthScreen("signup", err.message));
      return;
    }

    // Login
    fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, identifier, password })
    })
    .then(async res => ({ ok: res.ok, data: await res.json() }))
    .then(({ ok, data }) => {
      if (!ok) throw new Error(data.message);
      setSession(data);
    })
    .catch(err => renderAuthScreen("login", err.message));
  });
}

async function renderAdminDashboard() {
  const session = readSession();
  app.className = "";

  app.innerHTML = `
    <div class="page-shell">
      <section class="card hero-card">
        <div class="hero-header">
          <div>
            <span class="hero-kicker">Admin Control</span>
            <h2 class="hero-title">Dashboard Command Center</h2>
            <p class="small hero-summary">Welcome, ${session.displayName}. Manage exam operations, mentor alignment, and leaderboard insights from a single workspace.</p>
          </div>
          <div class="actions-right">
            <button class="btn-muted" id="logoutBtn">Logout</button>
          </div>
        </div>
      </section>

      <section class="card">
        <h3>Primary Actions</h3>
        <div class="action-grid">
          <article class="action-tile">
            <strong>Create and publish exams</strong>
            <p class="small">Define structure, pass marks, and question bank in a dedicated build flow.</p>
            <button class="btn-primary action-cta" id="openCreateExamPageBtn">Open Create Exam</button>
          </article>
          <article class="action-tile">
            <strong>Review student attempts</strong>
            <p class="small">Inspect attempt-wise outcomes per student across your administered exams.</p>
            <button class="btn-secondary action-cta" id="openStudentPerformancePageBtn">Open Performance View</button>
          </article>
        </div>
      </section>

      <div class="dashboard-grid">
        <section class="card">
          <h3>Existing Exams</h3>
          <div id="examList" class="list-stack"></div>
        </section>
        <section class="card">
          <h3>Mentor-Student Assignment</h3>
          <div class="row">
            <div>
              <label for="mentorSelect">Select Mentor</label>
              <select id="mentorSelect"></select>
            </div>
            <div>
              <label for="studentSelect">Select Student</label>
              <select id="studentSelect"></select>
            </div>
          </div>
          <button class="btn-primary" id="assignMentorBtn">Assign Student To Mentor</button>
          <div id="assignmentList" class="space-top list-stack"></div>
        </section>
      </div>

      <section class="card">
        <h3>Leaderboard Rankings (My Exams)</h3>
        <div id="leaderboardList" class="list-stack"></div>
      </section>
    </div>
  `;

  let exams = [];
  let mentors = [];
  let students = [];
  let assignments = [];
  let leaderboardByExam = [];
  try {
    const response = await fetch(`${API_BASE}/exams?createdByAdminId=${session.userId}`);
    exams = await response.json();
    const mentorsRes = await fetch(`${API_BASE}/mentors`);
    mentors = await mentorsRes.json();
    const studentsRes = await fetch(`${API_BASE}/students`);
    students = await studentsRes.json();
    const assignmentsRes = await fetch(`${API_BASE}/mentor-assignments`);
    assignments = await assignmentsRes.json();
    leaderboardByExam = await Promise.all(
      exams.map(async (exam) => {
        try {
          const res = await fetch(`${API_BASE}/leaderboard/exam/${exam.exam_id}`);
          const rows = await res.json();
          return { examId: Number(exam.exam_id), rows };
        } catch (_error) {
          return { examId: Number(exam.exam_id), rows: [] };
        }
      })
    );
  } catch (_error) {
    exams = [];
    mentors = [];
    students = [];
    assignments = [];
    leaderboardByExam = [];
  }

  function renderExamList() {
    const examList = document.getElementById("examList");
    if (!exams.length) {
      examList.innerHTML = `<p class="small">No exams created yet.</p>`;
      return;
    }

    examList.innerHTML = exams
      .map(
        (exam) => `
        <div class="question-box">
          <strong>${exam.title}</strong>
          <div class="small">Code: ${exam.exam_code} | Duration: ${exam.duration_minutes} mins</div>
          <div class="small">Total Marks: ${exam.total_marks} | Pass Mark: ${exam.pass_mark}%</div>
        </div>
      `
      )
      .join("");
  }

  function renderAssignmentControls() {
    const mentorSelect = document.getElementById("mentorSelect");
    const studentSelect = document.getElementById("studentSelect");
    const assignmentList = document.getElementById("assignmentList");

    mentorSelect.innerHTML = mentors.length
      ? mentors.map((m) => `<option value="${m.mentor_id}">${m.full_name} (${m.username})</option>`).join("")
      : `<option value="">No mentors found</option>`;

    studentSelect.innerHTML = students.length
      ? students
          .map(
            (s) =>
              `<option value="${s.student_id}">${s.first_name} ${s.last_name} (${s.enrollment_no})</option>`
          )
          .join("")
      : `<option value="">No students found</option>`;

    if (!assignments.length) {
      assignmentList.innerHTML = `<p class="small">No mentor-student assignments yet.</p>`;
      return;
    }

    assignmentList.innerHTML = assignments
      .map(
        (a) => `
        <div class="question-box">
          <div><strong>${a.mentor_name}</strong> (${a.mentor_username})</div>
          <div class="small">Assigned Student: ${a.student_name} (${a.enrollment_no})</div>
          <div class="small">Assigned On: ${formatDateTime(a.assigned_at)}</div>
          <button class="btn-danger remove-assignment-btn" data-mentor-id="${a.mentor_id}" data-student-id="${a.student_id}">
            Remove Assignment
          </button>
        </div>
      `
      )
      .join("");

    document.querySelectorAll(".remove-assignment-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        fetch(`${API_BASE}/mentor-assignments/${btn.dataset.mentorId}/${btn.dataset.studentId}`, {
          method: "DELETE"
        })
          .then(async (res) => ({ ok: res.ok, data: await res.json() }))
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data.message || "Failed to remove assignment.");
            alert("Assignment removed.");
            renderAdminDashboard();
          })
          .catch((err) => alert(err.message));
      });
    });
  }

  function renderAdminLeaderboards() {
    const leaderboardList = document.getElementById("leaderboardList");
    if (!exams.length) {
      leaderboardList.innerHTML = `<p class="small">Create exams first to see rankings.</p>`;
      return;
    }

    leaderboardList.innerHTML = exams
      .map((exam) => {
        const lb = leaderboardByExam.find((x) => x.examId === Number(exam.exam_id));
        const topRows = (lb?.rows || []).slice(0, 5);
        const tableRows = topRows.length
          ? topRows
              .map(
                (row) => `
              <tr>
                <td>#${row.rank}</td>
                <td>${row.student_name}</td>
                <td>${row.best_score}%</td>
                <td>${row.latest_score}%</td>
                <td>${row.attempts_count}</td>
              </tr>
            `
              )
              .join("")
          : `<tr><td colspan="5" class="small">No attempts yet for this exam.</td></tr>`;

        return `
          <div class="question-box">
            <strong>${exam.title}</strong>
            <div class="small">Top performers (best score ranking)</div>
            <table class="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student</th>
                  <th>Best</th>
                  <th>Latest</th>
                  <th>Attempts</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
        `;
      })
      .join("");
  }

  document.getElementById("logoutBtn").addEventListener("click", clearSession);
  document.getElementById("openCreateExamPageBtn").addEventListener("click", renderAdminCreateExamPage);
  document
    .getElementById("openStudentPerformancePageBtn")
    .addEventListener("click", renderAdminStudentPerformancePage);
  document.getElementById("assignMentorBtn").addEventListener("click", () => {
    const mentorId = Number(document.getElementById("mentorSelect").value);
    const studentId = Number(document.getElementById("studentSelect").value);
    if (!mentorId || !studentId) {
      alert("Please select both mentor and student.");
      return;
    }

    fetch(`${API_BASE}/mentor-assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mentorId, studentId })
    })
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message || "Assignment failed.");
        alert("Student assigned to mentor successfully.");
        renderAdminDashboard();
      })
      .catch((err) => alert(err.message));
  });

  renderExamList();
  renderAdminLeaderboards();
  renderAssignmentControls();
}

function setupAdminQuestionBuilder(builder, questions) {
  function addQuestionUI() {
    const index = questions.length;
    questions.push({
      text: "",
      options: ["", "", "", ""],
      correctIndex: 0,
      marks: 5,
      topic: "General",
      explanation: ""
    });

    const block = document.createElement("div");
    block.className = "question-box";
    block.innerHTML = `
      <h4>Question ${index + 1}</h4>
      <label>Question Text</label>
      <input data-field="text" data-index="${index}" placeholder="Enter question text" />
      <label>Option 1</label>
      <input data-field="option0" data-index="${index}" placeholder="Option 1" />
      <label>Option 2</label>
      <input data-field="option1" data-index="${index}" placeholder="Option 2" />
      <label>Option 3</label>
      <input data-field="option2" data-index="${index}" placeholder="Option 3" />
      <label>Option 4</label>
      <input data-field="option3" data-index="${index}" placeholder="Option 4" />
      <label>Correct Option (1-4)</label>
      <input data-field="correctIndex" data-index="${index}" type="number" min="1" max="4" value="1" />
      <label>Topic</label>
      <input data-field="topic" data-index="${index}" value="General" placeholder="e.g. Normalization, Joins, Indexing" />
      <label>Explanation (shown for wrong answers)</label>
      <textarea data-field="explanation" data-index="${index}" placeholder="Explain why the correct option is right"></textarea>
      <label>Marks</label>
      <input data-field="marks" data-index="${index}" type="number" min="5" step="5" value="5" />
    `;
    builder.appendChild(block);
  }

  builder.addEventListener("input", (e) => {
    const target = e.target;
    const i = Number(target.dataset.index);
    const field = target.dataset.field;
    if (Number.isNaN(i) || !field) return;

    if (field === "text") questions[i].text = target.value.trim();
    if (field === "topic") questions[i].topic = target.value.trim() || "General";
    if (field === "explanation") questions[i].explanation = target.value.trim();
    if (field.startsWith("option")) {
      const optionIndex = Number(field.replace("option", ""));
      questions[i].options[optionIndex] = target.value.trim();
    }
    if (field === "correctIndex") questions[i].correctIndex = Number(target.value) - 1;
    if (field === "marks") {
      const entered = Number(target.value);
      if (Number.isNaN(entered)) return;
      const normalized = Math.max(5, Math.round(entered / 5) * 5);
      questions[i].marks = normalized;
      target.value = normalized;
    }
  });

  addQuestionUI();
  return { addQuestionUI };
}

function validateAdminQuestions(questions) {
  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    if (
      !q.text ||
      q.options.some((op) => !op) ||
      !q.topic ||
      q.correctIndex < 0 ||
      q.correctIndex > 3 ||
      q.marks < 5 ||
      q.marks % 5 !== 0
    ) {
      return `Question ${i + 1} is incomplete or invalid.`;
    }
  }
  return "";
}

async function renderAdminCreateExamPage() {
  const session = readSession();
  app.className = "";

  app.innerHTML = `
    <section class="card">
      <div class="row">
        <div>
          <h2>Create Exam</h2>
          <p class="small">Dedicated page to create exams cleanly.</p>
        </div>
        <div class="actions-right">
          <button class="btn-muted" id="backAdminHomeBtn">Back</button>
          <button class="btn-muted" id="logoutBtn">Logout</button>
        </div>
      </div>
    </section>

    <section class="card">
      <label for="examTitle">Exam Title</label>
      <input id="examTitle" placeholder="e.g. DBMS Midterm" />
      <label for="examCode">Exam Code</label>
      <input id="examCode" placeholder="e.g. DBMS-MID-02" />
      <label for="examPassMark">Pass Mark (%)</label>
      <input id="examPassMark" type="number" min="1" max="100" value="40" />
      <label for="durationMinutes">Duration (minutes)</label>
      <input id="durationMinutes" type="number" min="10" value="60" />
      <h3 class="space-top">Add Questions</h3>
      <div id="questionsBuilder"></div>
      <button class="btn-muted" id="addQuestionBtn">Add Question</button>
      <button class="btn-primary" id="saveExamBtn">Save Exam</button>
    </section>
  `;

  const builder = document.getElementById("questionsBuilder");
  const questions = [];
  const { addQuestionUI } = setupAdminQuestionBuilder(builder, questions);

  document.getElementById("backAdminHomeBtn").addEventListener("click", renderAdminDashboard);
  document.getElementById("logoutBtn").addEventListener("click", clearSession);
  document.getElementById("addQuestionBtn").addEventListener("click", addQuestionUI);
  document.getElementById("saveExamBtn").addEventListener("click", () => {
    const title = document.getElementById("examTitle").value.trim();
    const examCode = document.getElementById("examCode").value.trim();
    const passMark = Number(document.getElementById("examPassMark").value);
    const durationMinutes = Number(document.getElementById("durationMinutes").value);
    if (!title || !examCode) {
      alert("Please provide exam title and code.");
      return;
    }
    if (!questions.length) {
      alert("Please add at least one question.");
      return;
    }
    const validationError = validateAdminQuestions(questions);
    if (validationError) {
      alert(validationError);
      return;
    }

    const payload = {
      adminId: session.userId,
      examCode,
      title,
      durationMinutes,
      passMark,
      questions: questions.map((q) => ({
        questionText: q.text,
        option1: q.options[0],
        option2: q.options[1],
        option3: q.options[2],
        option4: q.options[3],
        correctAnswer: q.correctIndex + 1,
        marksAllocated: q.marks,
        topic: q.topic,
        explanation: q.explanation
      }))
    };

    fetch(`${API_BASE}/exams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message || "Exam creation failed.");
        alert("Exam saved successfully.");
        renderAdminDashboard();
      })
      .catch((err) => alert(err.message));
  });
}

async function renderAdminStudentPerformancePage() {
  const session = readSession();
  app.className = "";

  let students = [];
  try {
    const res = await fetch(`${API_BASE}/admin/${session.userId}/students-performance-list`);
    students = await res.json();
  } catch (_error) {
    students = [];
  }

  app.innerHTML = `
    <section class="card">
      <div class="row">
        <div>
          <h2>Student Performance</h2>
          <p class="small">Select a student to view attempt-wise performance across your exams.</p>
        </div>
        <div class="actions-right">
          <button class="btn-muted" id="backAdminHomeBtn">Back</button>
          <button class="btn-muted" id="logoutBtn">Logout</button>
        </div>
      </div>
    </section>

    <section class="card">
      <label for="adminStudentSelect">Select Student</label>
      <select id="adminStudentSelect">
        ${
          students.length
            ? students
                .map((s) => `<option value="${s.student_id}">${s.student_name} (${s.enrollment_no})</option>`)
                .join("")
            : '<option value="">No students with attempts in your exams</option>'
        }
      </select>
      <button class="btn-primary space-top" id="loadStudentPerformanceBtn">Load Performance</button>
    </section>

    <section class="card">
      <h3>Attempt Details</h3>
      <div id="adminStudentPerformanceList">
        <p class="small">Choose a student and click "Load Performance".</p>
      </div>
    </section>
  `;

  document.getElementById("backAdminHomeBtn").addEventListener("click", renderAdminDashboard);
  document.getElementById("logoutBtn").addEventListener("click", clearSession);
  document.getElementById("loadStudentPerformanceBtn").addEventListener("click", async () => {
    const studentId = Number(document.getElementById("adminStudentSelect").value);
    if (!studentId) {
      alert("Please choose a student.");
      return;
    }
    let rows = [];
    try {
      const res = await fetch(`${API_BASE}/admin/${session.userId}/students/${studentId}/performance`);
      rows = await res.json();
    } catch (_error) {
      rows = [];
    }

    const target = document.getElementById("adminStudentPerformanceList");
    if (!rows.length) {
      target.innerHTML = `<p class="small">No attempts found for this student in your exams.</p>`;
      return;
    }

    const grouped = new Map();
    rows.forEach((row) => {
      const key = `${row.exam_id}|${row.exam_title}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    });

    target.innerHTML = Array.from(grouped.entries())
      .map(([key, attempts]) => {
        const [, examTitle] = key.split("|");
        const attemptsHtml = attempts
          .map(
            (a) => `
            <div class="attempt-item">
              <div><strong>Attempt #${a.attempt_number}</strong> ${a.is_best_score === 1 ? "<span class='small'>(Best)</span>" : ""}</div>
              <div class="small">Score: ${a.raw_score}/${a.total_marks_snapshot} (${a.score_obtained}%)</div>
              <div class="small">Status: ${a.status} | Date: ${formatDateTime(a.attempt_date)}</div>
            </div>
          `
          )
          .join("");
        return `
          <div class="question-box">
            <strong>${examTitle}</strong>
            <div class="attempt-list space-top">${attemptsHtml}</div>
          </div>
        `;
      })
      .join("");
  });
}

function groupResultsByExam(results) {
  const grouped = new Map();
  for (const row of results) {
    if (!grouped.has(row.exam_title)) grouped.set(row.exam_title, []);
    grouped.get(row.exam_title).push(row);
  }
  for (const [, arr] of grouped) {
    arr.sort((a, b) => Number(a.attempt_number) - Number(b.attempt_number));
  }
  return grouped;
}

function buildTrendSvg(resultsForExam) {
  const width = 440;
  const height = 170;
  const padding = 28;
  if (!resultsForExam.length) return "";

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const palette = isDark
    ? {
        axis: "#334155",
        grid1: "#243243",
        grid2: "#1f2937",
        line: "#2dd4bf",
        dot: "#14b8a6",
        text: "#e2e8f0",
        muted: "#94a3b8"
      }
    : {
        axis: "#d6cdbf",
        grid1: "#efe7d8",
        grid2: "#f7f2e7",
        line: "#0d9488",
        dot: "#0f766e",
        text: "#1f2937",
        muted: "#6b7280"
      };

  const points = resultsForExam.map((r, idx) => {
    const x =
      resultsForExam.length === 1
        ? width / 2
        : padding + (idx * (width - 2 * padding)) / (resultsForExam.length - 1);
    const y = padding + ((100 - Number(r.score_obtained)) * (height - 2 * padding)) / 100;
    return { x, y, label: Number(r.score_obtained), attempt: Number(r.attempt_number) };
  });

  const linePath = points
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="trend-chart" role="img" aria-label="Performance trend chart">
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="${palette.axis}" stroke-width="1.5" />
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="${palette.axis}" stroke-width="1.5" />
      <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}" stroke="${palette.grid1}" stroke-width="1" />
      <line x1="${padding}" y1="${(height + padding) / 2}" x2="${width - padding}" y2="${(height + padding) / 2}" stroke="${palette.grid2}" stroke-width="1" />
      <path d="${linePath}" fill="none" stroke="${palette.line}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      ${points
        .map(
          (p) => `
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="${palette.dot}" />
          <text x="${p.x.toFixed(1)}" y="${(p.y - 10).toFixed(1)}" text-anchor="middle" font-size="11" fill="${palette.text}">${p.label}%</text>
          <text x="${p.x.toFixed(1)}" y="${(height - 10).toFixed(1)}" text-anchor="middle" font-size="10" fill="${palette.muted}">A${p.attempt}</text>
        `
        )
        .join("")}
    </svg>
  `;
}

function buildSubjectBarChartSvg(subjectAverages) {
  const width = 760;
  const height = 240;
  const padding = 40;
  if (!subjectAverages.length) return "";

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const palette = isDark
    ? {
        axis: "#334155",
        bar: "#2dd4bf",
        text: "#e2e8f0",
        muted: "#94a3b8"
      }
    : {
        axis: "#d6cdbf",
        bar: "#0d9488",
        text: "#1f2937",
        muted: "#6b7280"
      };

  const barGap = 18;
  const availableWidth = width - 2 * padding;
  const barWidth = Math.max(40, (availableWidth - barGap * (subjectAverages.length - 1)) / subjectAverages.length);

  return `
    <svg viewBox="0 0 ${width} ${height}" class="subject-bar-chart" role="img" aria-label="Average performance by subject bar chart">
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="${palette.axis}" stroke-width="1.5" />
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="${palette.axis}" stroke-width="1.5" />
      ${subjectAverages
        .map((s, i) => {
          const x = padding + i * (barWidth + barGap);
          const barHeight = (Number(s.average) / 100) * (height - 2 * padding);
          const y = height - padding - barHeight;
          const shortLabel = s.subject.length > 12 ? `${s.subject.slice(0, 12)}...` : s.subject;
          return `
            <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(
              1
            )}" rx="6" fill="${palette.bar}" />
            <text x="${(x + barWidth / 2).toFixed(1)}" y="${(y - 8).toFixed(1)}" text-anchor="middle" font-size="11" fill="${palette.text}">${s.average}%</text>
            <text x="${(x + barWidth / 2).toFixed(1)}" y="${(height - 16).toFixed(1)}" text-anchor="middle" font-size="10" fill="${palette.muted}">${shortLabel}</text>
          `;
        })
        .join("")}
    </svg>
  `;
}

async function renderStudentDashboard() {
  const session = readSession();
  app.className = "";

  let exams = [];

  try {
    const examRes = await fetch(`${API_BASE}/exams`);
    exams = await examRes.json();
  } catch (_error) {
    exams = [];
  }

  const examsHtml = exams.length
    ? exams
        .map(
          (exam) => `
        <div class="question-box">
          <strong>${exam.title}</strong>
          <div class="small">Code: ${exam.exam_code}</div>
          <div class="small">Duration: ${exam.duration_minutes} minutes</div>
          <div class="small">Pass Mark: ${exam.pass_mark}%</div>
          <button class="btn-primary start-exam" data-exam-id="${exam.exam_id}">Start Exam</button>
        </div>
      `
        )
        .join("")
    : `<p class="small">No exams available right now.</p>`;

  app.innerHTML = `
    <div class="page-shell">
      <section class="card hero-card">
        <div class="hero-header">
          <div>
            <span class="hero-kicker">Student Workspace</span>
            <h2 class="hero-title">Learning Performance Hub</h2>
            <p class="small hero-summary">Welcome, ${session.displayName}. Attempt exams, track trends, diagnose weak topics, and get targeted support in one place.</p>
          </div>
          <div class="actions-right">
            <button class="btn-muted" id="logoutBtn">Logout</button>
          </div>
        </div>
      </section>

      <div class="dashboard-grid">
        <section class="card">
          <h3>Available Exams</h3>
          <div class="list-stack">${examsHtml}</div>
        </section>
        <section class="card">
          <h3>Insights & Tools</h3>
          <div class="action-grid">
            <article class="action-tile">
              <strong>Result Portal</strong>
              <p class="small">Open full statistics, score trends, and exam-level performance cards.</p>
              <button class="btn-secondary action-cta" id="openResultPortalBtn">Open Result Portal</button>
            </article>
            <article class="action-tile">
              <strong>Weak Area Analysis</strong>
              <p class="small">See which topics cost you the most marks by exam and attempt history.</p>
              <button class="btn-secondary action-cta" id="openWeakAreaPortalBtn">Open Weak Areas</button>
            </article>
            <article class="action-tile">
              <strong>Leaderboard & Ranking</strong>
              <p class="small">Compare your performance with peers overall and for each exam.</p>
              <button class="btn-secondary action-cta" id="openLeaderboardBtn">Open Leaderboard</button>
            </article>
            <article class="action-tile">
              <strong>AI Doubt Solver</strong>
              <p class="small">Ask conceptual or exam-specific questions with context-aware guidance.</p>
              <button class="btn-secondary action-cta" id="openAiChatbotBtn">Open AI Tutor</button>
            </article>
          </div>
        </section>
      </div>
    </div>
  `;

  document.getElementById("logoutBtn").addEventListener("click", clearSession);
  document.querySelectorAll(".start-exam").forEach((btn) => {
    btn.addEventListener("click", () => renderExamAttempt(btn.dataset.examId));
  });
  document.getElementById("openResultPortalBtn").addEventListener("click", renderStudentResultPortal);
  document.getElementById("openWeakAreaPortalBtn").addEventListener("click", renderWeakAreaPortal);
  document.getElementById("openLeaderboardBtn").addEventListener("click", renderLeaderboardPortal);
  document.getElementById("openAiChatbotBtn").addEventListener("click", renderAiChatbotPortal);
}

async function renderStudentResultPortal() {
  const session = readSession();
  app.className = "";

  let myResults = [];
  let improvementRows = [];
  try {
    const resultRes = await fetch(`${API_BASE}/results/student/${session.userId}`);
    myResults = await resultRes.json();
    const improveRes = await fetch(`${API_BASE}/results/student/${session.userId}/improvement`);
    improvementRows = await improveRes.json();
  } catch (_error) {
    myResults = [];
    improvementRows = [];
  }

  const grouped = groupResultsByExam(myResults);
  const subjectAverages = Array.from(grouped.entries()).map(([examTitle, attempts]) => {
    const avg =
      attempts.reduce((sum, a) => sum + Number(a.score_obtained), 0) / (attempts.length || 1);
    return {
      subject: examTitle,
      average: Number(avg.toFixed(2)),
      attempts: attempts.length
    };
  });
  const totalAttempts = myResults.length;
  const avgScore =
    totalAttempts === 0
      ? 0
      : (myResults.reduce((sum, r) => sum + Number(r.score_obtained), 0) / totalAttempts).toFixed(2);
  const bestScore =
    totalAttempts === 0 ? 0 : Math.max(...myResults.map((r) => Number(r.score_obtained))).toFixed(2);
  const passCount = myResults.filter((r) => r.status === "Pass").length;
  const passRate = totalAttempts === 0 ? 0 : ((passCount / totalAttempts) * 100).toFixed(1);

  const examCards = Array.from(grouped.entries()).length
    ? Array.from(grouped.entries())
        .map(([examTitle, attempts]) => {
          const chartSvg = buildTrendSvg(attempts);
          const improve = improvementRows.find((r) => r.exam_title === examTitle);
          const trendLabel = improve
            ? `${improve.improvement >= 0 ? "+" : ""}${improve.improvement}% improvement`
            : "N/A";
          return `
            <section class="card result-portal-card">
              <h3>${examTitle}</h3>
              <div class="result-grid portal-mini-stats">
                <div class="result-card"><div class="small">Attempts</div><strong>${attempts.length}</strong></div>
                <div class="result-card"><div class="small">Latest</div><strong>${attempts[attempts.length - 1].score_obtained}%</strong></div>
                <div class="result-card"><div class="small">Best</div><strong>${Math.max(
                  ...attempts.map((a) => Number(a.score_obtained))
                )}%</strong></div>
                <div class="result-card"><div class="small">Trend</div><strong>${trendLabel}</strong></div>
              </div>
              <div class="trend-wrap">
                ${chartSvg}
              </div>
              <div class="small"><strong>Attempt-wise Performance:</strong></div>
              <div class="attempt-list">
                ${attempts
                  .map(
                    (a) => `
                    <div class="attempt-item">
                      <div><strong>Attempt #${a.attempt_number}</strong> ${Number(a.is_best_score) === 1 ? "<span class='small'>(Best)</span>" : ""}</div>
                      <div class="small">Score: ${a.raw_score}/${a.total_marks_snapshot} (${a.score_obtained}%)</div>
                      <div class="small">Status: ${a.status} | Date: ${formatDateTime(a.attempt_date)}</div>
                    </div>
                  `
                  )
                  .join("")}
              </div>
            </section>
          `;
        })
        .join("")
    : `<section class="card"><p class="small">No attempts yet. Generate demo attempts or take an exam first.</p></section>`;

  const subjectAvgHtml = subjectAverages.length
    ? subjectAverages
        .map(
          (s) => `
        <div class="result-card">
          <strong>${s.subject}</strong>
          <div class="small">Average Performance: ${s.average}%</div>
          <div class="small">Total Attempts: ${s.attempts}</div>
        </div>
      `
        )
        .join("")
    : `<p class="small">No subject performance data available yet.</p>`;
  const subjectBarChart = buildSubjectBarChartSvg(subjectAverages);

  app.innerHTML = `
    <div class="page-shell">
      <section class="card hero-card">
        <div class="hero-header">
          <div>
            <span class="hero-kicker">Performance Intelligence</span>
            <h2 class="hero-title">Result Portal</h2>
            <p class="small hero-summary">Comprehensive performance tracking across attempts, subjects, and progression trends.</p>
          </div>
          <div class="actions-right">
            <button class="btn-muted" id="backToStudentHomeBtn">Back</button>
            <button class="btn-secondary" id="openWeakAreaFromResultBtn">Weak Area Analysis</button>
            <button class="btn-secondary" id="openTargetedPracticeFromResultBtn">Targeted Practice</button>
            <button class="btn-muted" id="logoutBtn">Logout</button>
          </div>
        </div>
        <div class="metric-strip">
          <div class="metric-tile"><div class="small">Total Attempts</div><strong>${totalAttempts}</strong></div>
          <div class="metric-tile"><div class="small">Average Score</div><strong>${avgScore}%</strong></div>
          <div class="metric-tile"><div class="small">Best Score</div><strong>${bestScore}%</strong></div>
          <div class="metric-tile"><div class="small">Pass Rate</div><strong>${passRate}%</strong></div>
        </div>
        ${
          totalAttempts === 0
            ? '<button class="btn-secondary" id="generateDemoAttemptsBtn">Generate Demo Attempts</button>'
            : ""
        }
      </section>

      <div class="dashboard-grid">
        <section class="card">
          <h3>Average Performance By Subject</h3>
          <div class="trend-wrap">
            ${subjectBarChart || '<p class="small">No subject chart data available.</p>'}
          </div>
        </section>
        <section class="card">
          <h3>Subject Summary Cards</h3>
          <div class="result-grid">${subjectAvgHtml}</div>
        </section>
      </div>

      <section class="card">
        <h3>Attempt-Wise Tracking</h3>
        <p class="small">Detailed progression timeline and attempt cards by exam.</p>
      </section>

      ${examCards}
    </div>
  `;
  document.getElementById("backToStudentHomeBtn").addEventListener("click", renderStudentDashboard);
  document.getElementById("logoutBtn").addEventListener("click", clearSession);
  document.getElementById("openWeakAreaFromResultBtn").addEventListener("click", renderWeakAreaPortal);
  document
    .getElementById("openTargetedPracticeFromResultBtn")
    .addEventListener("click", () => renderTargetedPracticePortal());
  const demoBtn = document.getElementById("generateDemoAttemptsBtn");
  if (demoBtn) {
    demoBtn.addEventListener("click", () => {
      fetch(`${API_BASE}/results/student/${session.userId}/generate-demo-attempts`, { method: "POST" })
        .then(async (res) => ({ ok: res.ok, data: await res.json() }))
        .then(({ ok, data }) => {
          if (!ok) throw new Error(data.message || "Failed to generate demo attempts.");
          alert("Demo attempts created. Opening updated result portal.");
          renderStudentResultPortal();
        })
        .catch((err) => alert(err.message));
    });
  }
}

async function renderWeakAreaPortal() {
  const session = readSession();
  app.className = "";

  let byExam = [];
  try {
    const res = await fetch(`${API_BASE}/results/student/${session.userId}/weak-areas`);
    byExam = await res.json();
  } catch (_error) {
    byExam = [];
  }

  let activeExamIdx = 0;

  app.innerHTML = `
    <section class="card">
      <div class="row">
        <div>
          <h2>Weak Area Analysis</h2>
          <p class="small">Topics ranked by how many questions you got wrong in each exam.</p>
        </div>
        <div class="actions-right">
          <button class="btn-muted" id="weakAreaBackBtn">Back</button>
          <button class="btn-secondary" id="weakAreaToPracticeBtn">Targeted Practice</button>
          <button class="btn-muted" id="weakAreaLogoutBtn">Logout</button>
        </div>
      </div>
    </section>

    <section class="card">
      <h3>Weak topics by exam</h3>
      <p class="small">Use the tabs to switch between exams. Higher in the list means more incorrect answers in that topic.</p>
      <div class="exam-tab-bar" id="weakExamTabBar" role="tablist"></div>
      <div id="weakExamTabPanel" class="exam-tab-panel"></div>
    </section>
  `;

  function renderExamTabsAndPanel() {
    const bar = document.getElementById("weakExamTabBar");
    const panel = document.getElementById("weakExamTabPanel");
    if (!byExam.length) {
      bar.innerHTML = "";
      panel.innerHTML = `<p class="small">No data yet. After you attempt exams, topics you missed most often appear here, per exam.</p>`;
      return;
    }
    if (activeExamIdx >= byExam.length) activeExamIdx = 0;

    bar.innerHTML = byExam
      .map(
        (ex, i) => `
      <button type="button" class="exam-tab ${i === activeExamIdx ? "is-active" : ""}" data-index="${i}" role="tab" aria-selected="${i === activeExamIdx}">
        ${ex.exam_title}
      </button>
    `
      )
      .join("");

    const ex = byExam[activeExamIdx];
    const listHtml =
      ex.topics && ex.topics.length
        ? `<ol class="weak-topic-list">
            ${ex.topics
              .map(
                (t) => `
              <li>
                <strong>${t.topic}</strong>
                <span class="small"> — ${t.wrong_count} wrong answer${t.wrong_count === 1 ? "" : "s"}</span>
                ${
                  t.total_answered > 0
                    ? `<span class="small"> (${t.correct_count} correct of ${t.total_answered} in this topic)</span>`
                    : ""
                }
              </li>
            `
              )
              .join("")}
          </ol>`
        : `<p class="small">No topic breakdown for this exam yet.</p>`;

    panel.innerHTML = `
      <h4 class="space-top">${ex.exam_title}</h4>
      ${listHtml}
    `;

    bar.querySelectorAll(".exam-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeExamIdx = Number(btn.dataset.index);
        renderExamTabsAndPanel();
      });
    });
  }

  document.getElementById("weakAreaBackBtn").addEventListener("click", renderStudentDashboard);
  document.getElementById("weakAreaLogoutBtn").addEventListener("click", clearSession);
  document.getElementById("weakAreaToPracticeBtn").addEventListener("click", () => {
    const preset =
      byExam.length && byExam[activeExamIdx] ? byExam[activeExamIdx].exam_id : undefined;
    renderTargetedPracticePortal(preset);
  });

  renderExamTabsAndPanel();
}

async function renderTargetedPracticePortal(presetExamId) {
  const session = readSession();
  app.className = "";

  let byExam = [];
  try {
    const weakAreaRes = await fetch(`${API_BASE}/results/student/${session.userId}/weak-areas`);
    byExam = await weakAreaRes.json();
  } catch (_error) {
    byExam = [];
  }

  let activeExamIdx = 0;
  if (presetExamId != null && byExam.length) {
    const idx = byExam.findIndex((e) => Number(e.exam_id) === Number(presetExamId));
    if (idx >= 0) activeExamIdx = idx;
  }

  app.innerHTML = `
    <section class="card">
      <div class="row">
        <div>
          <h2>Targeted Practice</h2>
          <p class="small">Pick an exam, then a topic you missed often in that exam.</p>
        </div>
        <div class="actions-right">
          <button class="btn-muted" id="backToResultPortalBtn">Back to Result Portal</button>
          <button class="btn-muted" id="toWeakAreaBtn">Weak Area Analysis</button>
          <button class="btn-muted" id="logoutBtn">Logout</button>
        </div>
      </div>
    </section>

    <section class="card">
      <h3>Choose exam and topic</h3>
      <div class="exam-tab-bar" id="practiceExamTabBar" role="tablist"></div>
      <div id="practiceExamTabMeta" class="space-top small"></div>
      <div class="space-top">
        <label for="practiceTopicSelect">Topic (most wrong answers first in this exam)</label>
        <select id="practiceTopicSelect"></select>
      </div>
      <button class="btn-primary space-top" id="loadPracticeBtn">Start Practice</button>
    </section>

    <section class="card">
      <h3>Practice Questions</h3>
      <div id="practiceQuestionsContainer">
        <p class="small">Select exam tab, choose a topic, then Start Practice.</p>
      </div>
    </section>
  `;

  const practiceExamBar = document.getElementById("practiceExamTabBar");
  const practiceMeta = document.getElementById("practiceExamTabMeta");
  const topicSelect = document.getElementById("practiceTopicSelect");
  const practiceContainer = document.getElementById("practiceQuestionsContainer");

  function currentExam() {
    return byExam[activeExamIdx] || null;
  }

  function fillTopicSelect() {
    const ex = currentExam();
    if (!ex || !ex.topics || !ex.topics.length) {
      topicSelect.innerHTML = `<option value="">No topics for this exam</option>`;
      return;
    }
    topicSelect.innerHTML = ex.topics
      .map((t) => `<option value="${t.topic}">${t.topic} (${t.wrong_count} wrong)</option>`)
      .join("");
  }

  function renderPracticeExamTabs() {
    if (!byExam.length) {
      practiceExamBar.innerHTML = "";
      practiceMeta.textContent = "";
      topicSelect.innerHTML = `<option value="">No exams with attempt data</option>`;
      return;
    }
    if (activeExamIdx >= byExam.length) activeExamIdx = 0;
    practiceExamBar.innerHTML = byExam
      .map(
        (ex, i) => `
      <button type="button" class="exam-tab ${i === activeExamIdx ? "is-active" : ""}" data-index="${i}" role="tab">
        ${ex.exam_title}
      </button>
    `
      )
      .join("");
    const ex = currentExam();
    practiceMeta.textContent = ex
      ? `Topics are ordered by wrong-answer count for “${ex.exam_title}”.`
      : "";
    fillTopicSelect();
    practiceExamBar.querySelectorAll(".exam-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeExamIdx = Number(btn.dataset.index);
        renderPracticeExamTabs();
      });
    });
  }

  renderPracticeExamTabs();

  document.getElementById("backToResultPortalBtn").addEventListener("click", renderStudentResultPortal);
  document.getElementById("toWeakAreaBtn").addEventListener("click", renderWeakAreaPortal);
  document.getElementById("logoutBtn").addEventListener("click", clearSession);
  document.getElementById("loadPracticeBtn").addEventListener("click", async () => {
    const ex = currentExam();
    const topic = topicSelect.value;
    if (!ex || !topic) {
      alert("Please select an exam tab and a topic.");
      return;
    }

    let questions = [];
    try {
      const url = `${API_BASE}/results/student/${session.userId}/practice-topics/${encodeURIComponent(
        topic
      )}/questions?examId=${encodeURIComponent(ex.exam_id)}`;
      const response = await fetch(url);
      questions = await response.json();
    } catch (_error) {
      questions = [];
    }

    if (!questions.length) {
      practiceContainer.innerHTML = `<p class="small">No practice questions found for “${topic}” in this exam.</p>`;
      return;
    }

    practiceContainer.innerHTML = `
      <div class="small">Exam: <strong>${ex.exam_title}</strong> · Topic: <strong>${topic}</strong> · Questions: ${questions.length}</div>
      <div id="practiceQuestionList" class="space-top">
        ${questions
          .map(
            (q, idx) => `
            <div class="question-box">
              <div><strong>Q${idx + 1}. ${q.question_text}</strong></div>
              <label><input type="radio" name="pq${q.question_id}" value="1" /> ${q.option_1}</label>
              <label><input type="radio" name="pq${q.question_id}" value="2" /> ${q.option_2}</label>
              <label><input type="radio" name="pq${q.question_id}" value="3" /> ${q.option_3}</label>
              <label><input type="radio" name="pq${q.question_id}" value="4" /> ${q.option_4}</label>
            </div>
          `
          )
          .join("")}
      </div>
      <button class="btn-primary" id="submitPracticeBtn">Submit Practice</button>
      <div id="practiceResultBox" class="space-top"></div>
    `;

    document.getElementById("submitPracticeBtn").addEventListener("click", () => {
      const answers = questions.map((q) => {
        const selected = document.querySelector(`input[name="pq${q.question_id}"]:checked`);
        return {
          questionId: q.question_id,
          selectedOption: selected ? Number(selected.value) : 0
        };
      });

      fetch(`${API_BASE}/practice/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: session.userId,
          examId: ex.exam_id,
          topic,
          answers
        })
      })
        .then(async (res) => ({ ok: res.ok, data: await res.json() }))
        .then(({ ok, data }) => {
          if (!ok) throw new Error(data.message || "Practice submission failed.");
          const resultBox = document.getElementById("practiceResultBox");
          resultBox.innerHTML = `
            <div class="result-card">
              <div class="small">Practice Score</div>
              <strong>${data.correctAnswers}/${data.totalQuestions} (${data.scorePercent}%)</strong>
            </div>
            <div class="small space-top">Saved as Practice Attempt #${data.practiceAttemptId}</div>
            ${
              data.wrongAnswers && data.wrongAnswers.length
                ? `<div class="space-top small"><strong>Review Incorrect Questions & Explanations:</strong></div>
                   <ul class="small">${data.wrongAnswers
                     .map(
                       (w) =>
                         `<li><strong>${w.questionText}</strong><br/>Selected: ${
                           w.selectedOption || "Not answered"
                         } | Correct: ${w.correctAnswer}<br/>Explanation: ${w.explanation}</li>`
                     )
                     .join("")}</ul>`
                : `<p class="small text-success">Excellent! All answers are correct.</p>`
            }
          `;
        })
        .catch((err) => alert(err.message));
    });
  });
}

async function renderLeaderboardPortal() {
  const session = readSession();
  app.className = "";

  let overallRows = [];
  let exams = [];
  let examLeaderboards = [];
  try {
    const overallRes = await fetch(`${API_BASE}/leaderboard/overall`);
    overallRows = await overallRes.json();
    const examsRes = await fetch(`${API_BASE}/exams`);
    exams = await examsRes.json();
    examLeaderboards = await Promise.all(
      exams.map(async (exam) => {
        try {
          const lbRes = await fetch(`${API_BASE}/leaderboard/exam/${exam.exam_id}`);
          const rows = await lbRes.json();
          return { exam, rows };
        } catch (_error) {
          return { exam, rows: [] };
        }
      })
    );
  } catch (_error) {
    overallRows = [];
    exams = [];
    examLeaderboards = [];
  }

  const myOverall = overallRows.find((r) => Number(r.student_id) === Number(session.userId));
  const overallTableRows = overallRows.length
    ? overallRows
        .slice(0, 10)
        .map(
          (row) => `
        <tr ${Number(row.student_id) === Number(session.userId) ? 'class="highlight-row"' : ""}>
          <td>#${row.rank}</td>
          <td>${row.student_name}</td>
          <td>${row.average_score}%</td>
          <td>${row.best_score}%</td>
          <td>${row.attempts_count}</td>
        </tr>
      `
        )
        .join("")
    : `<tr><td colspan="5" class="small">No ranking data yet.</td></tr>`;

  const examBlocks = examLeaderboards.length
    ? examLeaderboards
        .map(({ exam, rows }) => {
          const myRow = rows.find((r) => Number(r.student_id) === Number(session.userId));
          const topRows = rows.slice(0, 5);
          const tableRows = topRows.length
            ? topRows
                .map(
                  (row) => `
                <tr ${Number(row.student_id) === Number(session.userId) ? 'class="highlight-row"' : ""}>
                  <td>#${row.rank}</td>
                  <td>${row.student_name}</td>
                  <td>${row.best_score}%</td>
                  <td>${row.latest_score}%</td>
                  <td>${row.attempts_count}</td>
                </tr>
              `
                )
                .join("")
            : `<tr><td colspan="5" class="small">No attempts yet for this exam.</td></tr>`;

          return `
            <section class="card result-portal-card">
              <h3>${exam.title}</h3>
              <div class="small">${
                myRow
                  ? `Your rank: #${myRow.rank} | Best: ${myRow.best_score}%`
                  : "You are not ranked yet for this exam."
              }</div>
              <table class="leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Student</th>
                    <th>Best</th>
                    <th>Latest</th>
                    <th>Attempts</th>
                  </tr>
                </thead>
                <tbody>${tableRows}</tbody>
              </table>
            </section>
          `;
        })
        .join("")
    : `<section class="card"><p class="small">No exams found for leaderboard.</p></section>`;

  app.innerHTML = `
    <div class="page-shell">
      <section class="card hero-card">
        <div class="hero-header">
          <div>
            <span class="hero-kicker">Competitive Insights</span>
            <h2 class="hero-title">Leaderboard & Ranking</h2>
            <p class="small hero-summary">Overall and exam-specific standings based on average, best, and latest performance snapshots.</p>
          </div>
          <div class="actions-right">
            <button class="btn-muted" id="leaderboardBackBtn">Back</button>
            <button class="btn-muted" id="logoutBtn">Logout</button>
          </div>
        </div>
        <div class="metric-strip">
          <div class="metric-tile"><div class="small">Students Ranked</div><strong>${overallRows.length}</strong></div>
          <div class="metric-tile"><div class="small">Your Overall Rank</div><strong>${
            myOverall ? `#${myOverall.rank}` : "N/A"
          }</strong></div>
          <div class="metric-tile"><div class="small">Your Avg Score</div><strong>${
            myOverall ? `${myOverall.average_score}%` : "N/A"
          }</strong></div>
        </div>
      </section>

      <section class="card">
        <h3>Overall Top 10</h3>
        <table class="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Student</th>
              <th>Average</th>
              <th>Best</th>
              <th>Attempts</th>
            </tr>
          </thead>
          <tbody>${overallTableRows}</tbody>
        </table>
      </section>

      ${examBlocks}
    </div>
  `;

  document.getElementById("leaderboardBackBtn").addEventListener("click", renderStudentDashboard);
  document.getElementById("logoutBtn").addEventListener("click", clearSession);
}

async function renderAiChatbotPortal() {
  const session = readSession();
  app.className = "";

  let history = [];
  try {
    const res = await fetch(`${API_BASE}/chatbot/history/${session.userId}`);
    history = await res.json();
  } catch (_error) {
    history = [];
  }

  app.innerHTML = `
    <div class="page-shell">
      <section class="card hero-card">
        <div class="hero-header">
          <div>
            <span class="hero-kicker">AI Assistance</span>
            <h2 class="hero-title">AI Doubt Solver</h2>
            <p class="small hero-summary">General AI assistant with exam-aware context for wrong answers, weak topics, and focused improvement.</p>
          </div>
          <div class="actions-right">
            <button class="btn-muted" id="chatbotBackBtn">Back</button>
            <button class="btn-muted" id="logoutBtn">Logout</button>
          </div>
        </div>
      </section>

      <section class="card">
        <h3>Conversation</h3>
        <div id="chatbotMessages" class="chatbot-messages"></div>
        <label for="chatbotInput" class="space-top">Your doubt</label>
        <textarea id="chatbotInput" placeholder="e.g. Explain difference between WHERE and HAVING with an example"></textarea>
        <button class="btn-primary space-top" id="chatbotSendBtn">Ask AI Tutor</button>
      </section>
    </div>
  `;

  const messagesEl = document.getElementById("chatbotMessages");
  const inputEl = document.getElementById("chatbotInput");
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function appendMessage(role, text) {
    const block = document.createElement("div");
    block.className = `chatbot-message ${role === "student" ? "student" : "assistant"}`;
    const safeText = escapeHtml(text).replace(/\n/g, "<br/>");
    block.innerHTML = `
      <div class="small"><strong>${role === "student" ? "You" : "AI Tutor"}</strong></div>
      <div>${safeText}</div>
    `;
    messagesEl.appendChild(block);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  if (history.length) {
    history
      .slice()
      .reverse()
      .forEach((item) => {
        appendMessage("student", item.query_text);
        appendMessage("assistant", item.response_text);
      });
  } else {
    appendMessage(
      "assistant",
      "Hi! Ask me anything. I can also use your exam data to explain wrong answers, weak topics, and targeted practice."
    );
  }

  document.getElementById("chatbotBackBtn").addEventListener("click", renderStudentDashboard);
  document.getElementById("logoutBtn").addEventListener("click", clearSession);
  document.getElementById("chatbotSendBtn").addEventListener("click", async () => {
    const message = inputEl.value.trim();
    if (!message) {
      alert("Please enter your doubt first.");
      return;
    }
    appendMessage("student", message);
    inputEl.value = "";

    try {
      const res = await fetch(`${API_BASE}/chatbot/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: session.userId,
          message
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Chatbot failed to respond.");
      const modeLabel = data.mode === "gemini" ? "LLM mode: Gemini" : "LLM mode: Fallback tutor";
      const errorLabel = data.llmError ? `\n\nLLM error: ${data.llmError}` : "";
      appendMessage("assistant", `${data.response}\n\n[${modeLabel}]${errorLabel}`);
    } catch (error) {
      appendMessage("assistant", `Error: ${error.message}`);
    }
  });
}

async function renderMentorDashboard() {
  const session = readSession();
  app.className = "";

  let students = [];
  let recentAttempts = [];
  try {
    const response = await fetch(`${API_BASE}/mentor/${session.userId}/students-performance`);
    const data = await response.json();
    students = data.students || [];
    recentAttempts = data.recentAttempts || [];
  } catch (_error) {
    students = [];
    recentAttempts = [];
  }

  const studentCards = students.length
    ? students
        .map(
          (s) => `
        <div class="result-card">
          <strong>${s.first_name} ${s.last_name}</strong>
          <div class="small">Enrollment: ${s.enrollment_no}</div>
          <div class="small">Attempts: ${s.attempts_count}</div>
          <div class="small">Average: ${s.average_percentage === null ? "N/A" : `${s.average_percentage}%`}</div>
          <div class="small">Latest Attempt: ${s.latest_attempt ? formatDateTime(s.latest_attempt) : "No attempts yet"}</div>
        </div>
      `
        )
        .join("")
    : `<p class="small">No students are assigned to you yet.</p>`;

  const recentList = recentAttempts.length
    ? recentAttempts
        .map(
          (item) => `
        <div class="question-box">
          <strong>${item.student_name}</strong>
          <div class="small">Exam: ${item.exam_title}</div>
          <div class="small">Score: ${item.score_obtained}% (${item.status})</div>
          <div class="small">Attempted On: ${formatDateTime(item.attempt_date)}</div>
        </div>
      `
        )
        .join("")
    : `<p class="small">No recent attempts from assigned students.</p>`;

  app.innerHTML = `
    <div class="page-shell">
      <section class="card hero-card">
        <div class="hero-header">
          <div>
            <span class="hero-kicker">Mentor Workspace</span>
            <h2 class="hero-title">Mentor Dashboard</h2>
            <p class="small hero-summary">Welcome, ${session.displayName}. Monitor assigned students and track recent attempt activity quickly.</p>
          </div>
          <div class="actions-right">
            <button class="btn-muted" id="logoutBtn">Logout</button>
          </div>
        </div>
      </section>

      <div class="dashboard-grid">
        <section class="card">
          <h3>Assigned Students Overview</h3>
          <div class="result-grid">${studentCards}</div>
        </section>

        <section class="card">
          <h3>Recent Performance Activity</h3>
          <div class="list-stack">${recentList}</div>
        </section>
      </div>
    </div>
  `;

  document.getElementById("logoutBtn").addEventListener("click", clearSession);
}

async function renderExamAttempt(examId) {
  const session = readSession();
  app.className = "";

  let exam = null;
  let questions = [];
  try {
    const examRes = await fetch(`${API_BASE}/exams`);
    const exams = await examRes.json();
    exam = exams.find((e) => String(e.exam_id) === String(examId));
    const qRes = await fetch(`${API_BASE}/exams/${examId}/questions`);
    questions = await qRes.json();
  } catch (_error) {
    exam = null;
    questions = [];
  }

  if (!exam) {
    renderStudentDashboard();
    return;
  }

  const questionsHtml = questions
    .map(
      (q, idx) => `
      <div class="question-box">
        <strong>Q${idx + 1}. ${q.question_text}</strong>
        <label><input type="radio" name="q${q.question_id}" value="1" /> ${q.option_1}</label>
        <label><input type="radio" name="q${q.question_id}" value="2" /> ${q.option_2}</label>
        <label><input type="radio" name="q${q.question_id}" value="3" /> ${q.option_3}</label>
        <label><input type="radio" name="q${q.question_id}" value="4" /> ${q.option_4}</label>
        <div class="small">Marks: ${q.marks_allocated}</div>
      </div>
    `
    )
    .join("");

  app.innerHTML = `
    <div class="page-shell">
      <section class="card hero-card">
        <div class="hero-header">
          <div>
            <span class="hero-kicker">Live Assessment</span>
            <h2 class="hero-title">${exam.title}</h2>
            <p class="small hero-summary">Attempt every question carefully. Submit once all responses are selected.</p>
          </div>
          <div class="actions-right">
            <button class="btn-muted" id="cancelBtn">Cancel</button>
          </div>
        </div>
      </section>

      <section class="card">
        <h3>Question Set</h3>
        <div class="list-stack">${questionsHtml}</div>
        <button class="btn-primary" id="submitExamBtn">Submit Exam</button>
      </section>
    </div>
  `;

  document.getElementById("cancelBtn").addEventListener("click", renderStudentDashboard);
  document.getElementById("submitExamBtn").addEventListener("click", () => {
  const answers = questions.map((q) => {
    const selected = document.querySelector(`input[name="q${q.question_id}"]:checked`);
    return {
      questionId: q.question_id,
      selectedOption: selected ? Number(selected.value) : 0
    };
  });

  fetch(`${API_BASE}/exams/${examId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId: session.userId,
      answers
    })
  })
    .then(async (res) => ({ ok: res.ok, data: await res.json() }))
    .then(({ ok, data }) => {
      if (!ok) throw new Error(data.message || "Submission failed.");

      const explanationPreview =
        data.wrongAnswers && data.wrongAnswers.length
          ? `\n\nWrong Answer Explanations:\n${data.wrongAnswers
              .map(
                (w, idx) =>
                  `${idx + 1}) ${w.questionText}\n   Selected: ${
                    w.selectedOption || "Not answered"
                  }, Correct: ${w.correctAnswer}\n   ${
                    w.explanation || "No explanation available"
                  }`
              )
              .join("\n\n")}`
          : "";

      const modal = document.createElement("div");
    modal.className = "modal-overlay";

    const content = document.createElement("div");
    content.className = "modal-content";

let html = `
  <h3>Exam Submitted</h3>
  <p>Attempt #${data.attemptNumber}</p>
  <p>Score: ${data.rawScore}/${data.totalMarks}</p>
  <p>Percentage: ${data.percentage}%</p>
  <p>Status: ${data.status}</p>
`;

if (data.wrongAnswers && data.wrongAnswers.length) {
  html += `<h4>Wrong Answer Explanations:</h4>`;
  data.wrongAnswers.forEach((w, idx) => {
    html += `
      <div class="modal-entry">
        <strong>${idx + 1}) ${w.questionText}</strong><br/>
        Selected: ${w.selectedOption || "Not answered"}<br/>
        Correct: ${w.correctAnswer}<br/>
        ${w.explanation || "No explanation available"}
      </div>
    `;
  });
}

html += `<button id="closeModalBtn" class="btn-primary">OK</button>`;

content.innerHTML = html;
modal.appendChild(content);
document.body.appendChild(modal);

document.getElementById("closeModalBtn").onclick = () => {
  modal.remove();
  renderStudentDashboard();
};

      renderStudentDashboard();
    })
    .catch((err) => alert(err.message));
});
}

function render() {
  const session = readSession();
  if (!session) {
    renderAuthScreen("login");
    return;
  }

  if (session.role === "admin") {
    renderAdminDashboard();
  } else if (session.role === "mentor") {
    renderMentorDashboard();
  } else {
    renderStudentDashboard();
  }
}

initTheme();
render();
