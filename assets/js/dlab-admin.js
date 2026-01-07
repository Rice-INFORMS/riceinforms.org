import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-analytics.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

import {
  
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// 1)Firebase config (Firebase Console → Project settings → Your apps)
const firebaseConfig = {
    apiKey: "AIzaSyCLKiW9wNrGLLARLJYT5QsQYkK8q8ALNYY",
    authDomain: "rice-informs.firebaseapp.com",
    projectId: "rice-informs",
    storageBucket: "rice-informs.firebasestorage.app",
    messagingSenderId: "470650869170",
    appId: "1:470650869170:web:ce806366f3d16e7c6980ab",
    measurementId: "G-N417193H28"
};

// 2) Dev allowlist (ONLY these accounts can add items)
const ADMIN_EMAILS = new Set([
  "bae5@rice.edu",
  "beckedwards314@gmail.com",
  "gbd2@rice.edu"
  // "other@gmail.com"
]);

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// UI elements
const btnSignIn = document.getElementById("btnSignIn");
const btnSignOut = document.getElementById("btnSignOut");
const authStatus = document.getElementById("authStatus");
const adminForm = document.getElementById("adminForm");
const tbody = document.getElementById("projectsTbody");
const sortSeasonBtn = document.getElementById("sortSeason");




// For removing DecisionLab project rows
let IS_ADMIN = false;
let lastProjects = [];                 // array of { id, ...data }
let sortMode = "seasonDesc";        //  "seasonAsc" or "seasonDesc"



function renderProjects() {
  if (!tbody) return;

  const rows = [...lastProjects];

  // Apply sort mode
  if (sortMode === "seasonAsc") {
    rows.sort((a, b) => seasonKey(a.season) - seasonKey(b.season));
  } else if (sortMode === "seasonDesc") {
    rows.sort((a, b) => seasonKey(b.season) - seasonKey(a.season));
  } else {
    // default: createdAt desc (fallback if createdAt missing)
    rows.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
  }

  tbody.innerHTML = "";

  if (rows.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="4" class="text-muted py-4">Getting projects...</td></tr>
    `;
    return;
  }

  rows.forEach((p) => {
    const tr = document.createElement("tr");

    const deckCell = `
      <td>
        <div class="d-flex gap-2 flex-wrap">
          ${
            p.pitchDeckUrl
              ? `<a class="btn btn-sm btn-outline-soft" href="${p.pitchDeckUrl}" target="_blank" rel="noopener">View</a>`
              : `<span class="text-muted small">—</span>`
          }
          ${
            IS_ADMIN
              ? `<button class="btn btn-sm btn-outline-danger js-delete"
                         type="button"
                         data-id="${p.id}"
                         data-name="${escapeHtml(p.name ?? "")}">
                   Remove
                 </button>`
              : ``
          }
        </div>
      </td>
    `;

    tr.innerHTML = `
      <td class="fw-semibold">${escapeHtml(p.name ?? "")}</td>
      <td class="text-muted">${escapeHtml(p.about ?? "")}</td>
      <td><span class="season-badge ${seasonClass(p.season)}">${escapeHtml(p.season ?? "")}</span></td>
      ${deckCell}
    `;

    tbody.appendChild(tr);
  });
}



// Sign-in / out
btnSignIn?.addEventListener("click", async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error("SIGN-IN ERROR:", e.code, e.message, e);
    alert(`Sign-in failed: ${e.code || e.message}`);
  }
});

btnSignOut?.addEventListener("click", async () => {
  await signOut(auth);
});

// Delete Row

tbody?.addEventListener("click", async (e) => {
  const btn = e.target.closest(".js-delete");
  if (!btn) return;

  if (!IS_ADMIN) {
    alert("Not authorized.");
    return;
  }

  const id = btn.getAttribute("data-id");
  const name = btn.getAttribute("data-name") || "this item";

  const ok = confirm(`Remove ${name}? This cannot be undone.`);
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "decisionlabProjects", id));
  } catch (err) {
    console.error("[DecisionLab] delete failed:", err);
    alert(`Remove failed: ${err.code || ""} ${err.message || err}`);
  }
});


// Auth gate

function setAdminUI(user) {
  const signedIn = !!user;
  const isAdmin = signedIn && ADMIN_EMAILS.has(user.email);

  if (authStatus) {
    authStatus.textContent = signedIn
      ? `Dev mode: signed in as ${user.email}${isAdmin ? "" : " (no edit access)"}`
      : "Dev mode: signed out";
  }

  btnSignIn?.classList.toggle("d-none", signedIn);
  btnSignOut?.classList.toggle("d-none", !signedIn);
  adminForm?.classList.toggle("d-none", !isAdmin);
}





onAuthStateChanged(auth, (user) => {
  IS_ADMIN = !!user && ADMIN_EMAILS.has(user.email);

  // If you remove #authStatus, make this null-safe
  setAdminUI?.(user);

  // Critical: re-render so Remove buttons appear/disappear correctly
  renderProjects();
});



// Firestore: render table live
const projectsRef = collection(db, "decisionlabProjects");
const q = query(projectsRef, orderBy("createdAt", "desc"));

onSnapshot(q, (snap) => {
  lastProjects = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderProjects();
}, (err) => {
  console.error("[DecisionLab] snapshot error:", err);
});



// Add new item

adminForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Basic “is the handler running?” proof
  console.log("[DecisionLab] submit fired");

  const user = auth.currentUser;
  if (!user) {
    alert("You are signed out. Sign in (dev) first.");
    return;
  }
  if (!ADMIN_EMAILS.has(user.email)) {
    alert(`Signed in as ${user.email}, but not on ADMIN_EMAILS allowlist.`);
    return;
  }

  const name = document.getElementById("fName")?.value.trim();
  const about = document.getElementById("fAbout")?.value.trim();
  const season = document.getElementById("fSeason").value;
  const pitchDeckUrl = document.getElementById("fDeck")?.value.trim();

  if (!name || !about || !season ) {
    alert("Please fill in the first 3 fields.");
    return;
  }

  try {
    await addDoc(projectsRef, {
      name,
      about,
      season,
      pitchDeckUrl,
      createdAt: serverTimestamp(),
      createdBy: user.email
    });

    console.log("[DecisionLab] addDoc succeeded");
    adminForm.reset();
  } catch (err) {
    console.error("[DecisionLab] addDoc failed:", err);
    alert(`Add failed: ${err.code || ""} ${err.message || err}`);
  }
});

// Sort Button
sortSeasonBtn?.addEventListener("click", () => {
  // toggle: createdAtDesc -> seasonAsc -> seasonDesc -> seasonAsc ...
  if (sortMode === "seasonAsc") sortMode = "seasonDesc";
  else sortMode = "seasonAsc";

  // update indicator
  const ind = sortSeasonBtn.querySelector(".sort-indicator");
  if (ind) ind.textContent = (sortMode === "seasonAsc") ? "↑" : "↓";

  renderProjects();
});


// Minimal HTML escaping for table cells
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function seasonClass(season) {
  switch (season) {
    case "Spring 2024": return "season-s24";
    case "Spring 2025": return "season-s25";
    case "Spring 2026": return "season-s26";
    case "Fall 2026":   return "season-f26";
    case "Spring 2027": return "season-s27";
    case "Fall 2027":   return "season-f27";
    case "Spring 2028": return "season-s28";
    case "Fall 2028":   return "season-f28";
    case "Spring 2029": return "season-s29";
    case "Fall 2029":   return "season-f29";
    case "Spring 2030": return "season-s30";
    case "Fall 2030":   return "season-f30";
    default:            return "season-default";
  }
}


function seasonKey(season) {
  // Expected: "Spring 2026" or "Fall 2026"
  if (!season) return Number.NEGATIVE_INFINITY;

  const m = String(season).match(/^(Spring|Fall)\s+(\d{4})$/);
  if (!m) return Number.NEGATIVE_INFINITY;

  const term = m[1];
  const year = parseInt(m[2], 10);

  // Spring comes before Fall in the same year
  const termIndex = term === "Spring" ? 0 : 1;

  return year * 10 + termIndex;
}



