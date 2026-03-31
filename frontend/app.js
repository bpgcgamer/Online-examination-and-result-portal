const API_BASE = "/api";
const SESSION_KEY = "examPortalSession";
const app = document.getElementById("app");

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
  const title = isSignup ? "Sign Up" : "Login";
  const helper = isSignup
    ? "Create your account as Student or Admin."
    : "Use your credentials to continue.";
  const nameField = isSignup
    ? `
        <div>
          <label for="name">Full Name</label>
          <input id="name" placeholder="Enter your name" />
        </div>
      `
    : "";

  app.className = "auth-layout";

  app.innerHTML = `
    <section class="card auth-card">
      <h2>${title}</h2>
      <p class="small">${helper}</p>
      <div class="row">
        ${nameField}
        <div>
          <label for="role">Role</label>
          <select id="role">
            <option value="student">Student</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label for="identifier">${isSignup ? "Username / Email" : "Username (Admin) or Email (Student)"}</label>
          <input id="identifier" placeholder="${isSignup ? "Enter username or email" : "Enter username/email"}" />
        </div>
        <div>
          <label for="password">Password</label>
          <input id="password" type="password" placeholder="Enter password" />
        </div>
      </div>
      ${error ? `<p class="small text-danger">${error}</p>` : ""}
      ${info ? `<p class="small text-success">${info}</p>` : ""}
      <button class="btn-primary" id="primaryBtn">${isSignup ? "Create Account" : "Login"}</button>
      <button class="btn-muted" id="switchAuthBtn">${isSignup ? "Back to Login" : "New user? Sign Up"}</button>
      <div class="space-top small">
        <div><strong>Note:</strong> First-time users should create an account first.</div>
      </div>
    </section>
  `;

  document.getElementById("switchAuthBtn").addEventListener("click", () => {
    renderAuthScreen(isSignup ? "login" : "signup");
  });

  document.getElementById("primaryBtn").addEventListener("click", () => {
    const nameInput = document.getElementById("name");
    const fullName = nameInput ? nameInput.value.trim() : "";
    const role = document.getElementById("role").value;
    const identifier = document.getElementById("identifier").value.trim();
    const password = document.getElementById("password").value.trim();
    if (!identifier || !password || (isSignup && !fullName)) {
      renderAuthScreen(mode, "Please fill all required fields.");
      return;
    }

    if (isSignup && role === "student") {
      const parts = fullName.split(" ");
      if (parts.length < 2) {
        renderAuthScreen("signup", "For student signup, enter full name as FirstName LastName.");
        return;
      }
    }

    if (isSignup) {
      const payload =
        role === "admin"
          ? {
              role: "admin",
              fullName,
              username: identifier,
              password
            }
          : {
              role: "student",
              email: identifier,
              password,
              firstName: fullName.split(" ")[0],
              lastName: fullName.split(" ").slice(1).join(" "),
              enrollmentNo: `ENR-${Date.now().toString().slice(-6)}`
            };

      fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(async (res) => ({ ok: res.ok, data: await res.json() }))
        .then(({ ok, data }) => {
          if (!ok) throw new Error(data.message || "Signup failed.");
          renderAuthScreen("login", "", "Account created successfully. Please login.");
        })
        .catch((err) => renderAuthScreen("signup", err.message));
      return;
    }

    fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, identifier, password })
    })
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message || "Login failed.");
        setSession(data);
      })
      .catch((err) => renderAuthScreen("login", err.message));
  });
}

async function renderAdminDashboard() {
  const session = readSession();
  app.className = "";

  app.innerHTML = `
    <section class="card">
      <div class="row">
        <div>
          <h2>Admin Dashboard</h2>
          <p class="small">Welcome, ${session.displayName}</p>
        </div>
        <div style="text-align:right;">
          <button class="btn-muted" id="logoutBtn">Logout</button>
        </div>
      </div>
    </section>

    <section class="card">
      <h3>Create Exam Portal</h3>
      <label for="examTitle">Exam Title</label>
      <input id="examTitle" placeholder="e.g. DBMS Midterm" />
      <label for="examCode">Exam Code</label>
      <input id="examCode" placeholder="e.g. DBMS-MID-02" />

      <label for="examPassMark">Pass Mark (%)</label>
      <input id="examPassMark" type="number" min="1" max="100" value="40" />

      <label for="durationMinutes">Duration (minutes)</label>
      <input id="durationMinutes" type="number" min="10" value="60" />

      <label for="examRemarks">Professor Remarks (shown in result portal)</label>
      <textarea id="examRemarks" placeholder="e.g. Focus more on normalization topics."></textarea>

      <h3 class="space-top">Add Questions</h3>
      <div id="questionsBuilder"></div>
      <button class="btn-muted" id="addQuestionBtn">Add Question</button>
      <button class="btn-primary" id="saveExamBtn">Save Exam</button>
    </section>

    <section class="card">
      <h3>Existing Exams</h3>
      <div id="examList"></div>
    </section>
  `;

  let exams = [];
  try {
    const response = await fetch(`${API_BASE}/exams`);
    exams = await response.json();
  } catch (_error) {
    exams = [];
  }

  const builder = document.getElementById("questionsBuilder");
  const questions = [];

  function addQuestionUI() {
    const index = questions.length;
    questions.push({
      text: "",
      options: ["", "", "", ""],
      correctIndex: 0,
      marks: 1
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
      <label>Marks</label>
      <input data-field="marks" data-index="${index}" type="number" min="1" value="1" />
    `;
    builder.appendChild(block);
  }

  function bindBuilderInputs() {
    builder.addEventListener("input", (e) => {
      const target = e.target;
      const i = Number(target.dataset.index);
      const field = target.dataset.field;
      if (Number.isNaN(i) || !field) return;

      if (field === "text") questions[i].text = target.value.trim();
      if (field.startsWith("option")) {
        const optionIndex = Number(field.replace("option", ""));
        questions[i].options[optionIndex] = target.value.trim();
      }
      if (field === "correctIndex") questions[i].correctIndex = Number(target.value) - 1;
      if (field === "marks") questions[i].marks = Number(target.value);
    });
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
          <div class="small">Remarks: ${exam.remarks || "None"}</div>
        </div>
      `
      )
      .join("");
  }

  document.getElementById("logoutBtn").addEventListener("click", clearSession);

  document.getElementById("addQuestionBtn").addEventListener("click", addQuestionUI);
  document.getElementById("saveExamBtn").addEventListener("click", () => {
    const title = document.getElementById("examTitle").value.trim();
    const examCode = document.getElementById("examCode").value.trim();
    const passMark = Number(document.getElementById("examPassMark").value);
    const durationMinutes = Number(document.getElementById("durationMinutes").value);
    const remarks = document.getElementById("examRemarks").value.trim();

    if (!title || !examCode) {
      alert("Please provide exam title and code.");
      return;
    }
    if (!questions.length) {
      alert("Please add at least one question.");
      return;
    }

    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i];
      if (!q.text || q.options.some((op) => !op) || q.correctIndex < 0 || q.correctIndex > 3 || q.marks < 1) {
        alert(`Question ${i + 1} is incomplete or invalid.`);
        return;
      }
    }

    const payload = {
      adminId: session.userId,
      examCode,
      title,
      durationMinutes,
      passMark,
      remarks,
      questions: questions.map((q) => ({
        questionText: q.text,
        option1: q.options[0],
        option2: q.options[1],
        option3: q.options[2],
        option4: q.options[3],
        correctAnswer: q.correctIndex + 1,
        marksAllocated: q.marks
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

  addQuestionUI();
  bindBuilderInputs();
  renderExamList();
}

async function renderStudentDashboard() {
  const session = readSession();
  app.className = "";

  let exams = [];
  let myResults = [];

  try {
    const examRes = await fetch(`${API_BASE}/exams`);
    exams = await examRes.json();
    const resultRes = await fetch(`${API_BASE}/results/student/${session.userId}`);
    myResults = await resultRes.json();
  } catch (_error) {
    exams = [];
    myResults = [];
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

  const resultsHtml = myResults.length
    ? myResults
        .map(
          (r) => `
        <div class="result-card">
          <strong>${r.exam_title}</strong>
          <div class="small">Score: ${r.raw_score} / ${r.total_marks_snapshot} (${r.score_obtained}%)</div>
          <div class="small">Status: ${
            r.status === "Pass"
              ? '<span class="pill pill-success">Pass</span>'
              : '<span class="pill pill-danger">Fail</span>'
          }</div>
          <div class="small">Attempt Date: ${formatDateTime(r.attempt_date)}</div>
          <div class="small">Remarks: ${r.remarks || "None"}</div>
        </div>
      `
        )
        .join("")
    : `<p class="small">No attempts yet.</p>`;

  app.innerHTML = `
    <section class="card">
      <div class="row">
        <div>
          <h2>Student Dashboard</h2>
          <p class="small">Welcome, ${session.displayName}</p>
        </div>
        <div style="text-align:right;">
          <button class="btn-muted" id="logoutBtn">Logout</button>
        </div>
      </div>
    </section>

    <section class="card">
      <h3>Available Exams</h3>
      ${examsHtml}
    </section>

    <section class="card">
      <h3>Result Portal</h3>
      <div class="result-grid">${resultsHtml}</div>
    </section>
  `;

  document.getElementById("logoutBtn").addEventListener("click", clearSession);
  document.querySelectorAll(".start-exam").forEach((btn) => {
    btn.addEventListener("click", () => renderExamAttempt(btn.dataset.examId));
  });
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
    <section class="card">
      <h2>${exam.title}</h2>
      <p class="small">Attempt all questions and submit.</p>
      ${questionsHtml}
      <button class="btn-primary" id="submitExamBtn">Submit Exam</button>
      <button class="btn-muted" id="cancelBtn">Cancel</button>
    </section>
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
        alert(
          `Exam submitted.\nScore: ${data.rawScore}/${data.totalMarks}\nPercentage: ${data.percentage}%\nStatus: ${data.status}`
        );
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
  } else {
    renderStudentDashboard();
  }
}

render();
