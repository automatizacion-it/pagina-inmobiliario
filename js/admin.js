import { auth, db, storage } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// ============================================================
// AUTH STATE — single source of truth for UI
// ============================================================
function initAuth() {
  onAuthStateChanged(auth, user => {
    if (user) {
      document.getElementById("login-view").hidden = true;
      document.getElementById("admin-view").hidden = false;
      loadAdminMedia();
      loadPropertyForm();
    } else {
      document.getElementById("login-view").hidden = false;
      document.getElementById("admin-view").hidden = true;
    }
  });
}

async function handleLogin(email, password) {
  const btn = document.getElementById("login-btn");
  const errorEl = document.getElementById("login-error");
  btn.disabled = true;
  btn.textContent = "Iniciando sesión...";
  errorEl.hidden = true;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    errorEl.textContent = getFriendlyAuthError(err.code);
    errorEl.hidden = false;
    btn.disabled = false;
    btn.textContent = "Iniciar sesión";
  }
}

function getFriendlyAuthError(code) {
  const map = {
    "auth/invalid-credential": "Email o contraseña incorrectos.",
    "auth/user-not-found": "No existe una cuenta con ese email.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/too-many-requests": "Demasiados intentos fallidos. Intenta más tarde.",
    "auth/invalid-email": "El email no tiene un formato válido."
  };
  return map[code] || "Error al iniciar sesión. Intenta de nuevo.";
}

async function handleLogout() {
  await signOut(auth);
}

// ============================================================
// PHOTO UPLOAD
// ============================================================
async function handlePhotoUpload() {
  const fileInput = document.getElementById("photo-file");
  const title = document.getElementById("photo-title").value.trim();
  const description = document.getElementById("photo-description").value.trim();
  const category = document.getElementById("photo-category").value;
  const successEl = document.getElementById("photo-success");
  const errorEl = document.getElementById("photo-error");
  const btn = document.getElementById("upload-photo-btn");

  successEl.hidden = true;
  errorEl.hidden = true;

  const files = Array.from(fileInput.files);
  if (files.length === 0) {
    showError(errorEl, "Selecciona al menos un archivo de imagen.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Subiendo...";

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) {
        showError(errorEl, `"${file.name}" no es una imagen válida.`);
        continue;
      }
      await uploadPhoto(file, title, description, category, i, files.length);
    }
    successEl.hidden = false;
    fileInput.value = "";
    document.getElementById("photo-title").value = "";
    document.getElementById("photo-description").value = "";
    loadAdminMedia();
  } catch (err) {
    showError(errorEl, "Error al subir: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Subir fotos";
    document.getElementById("upload-progress-wrap").hidden = true;
  }
}

function uploadPhoto(file, title, description, category, index, total) {
  return new Promise((resolve, reject) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `media/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);

    const progressWrap = document.getElementById("upload-progress-wrap");
    const progressFill = document.getElementById("upload-progress-fill");
    const progressLabel = document.getElementById("upload-progress-label");

    progressWrap.hidden = false;

    task.on(
      "state_changed",
      snapshot => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        progressFill.style.width = pct + "%";
        progressLabel.textContent = total > 1
          ? `Subiendo archivo ${index + 1} de ${total} (${pct}%)`
          : `Subiendo... ${pct}%`;
      },
      err => reject(err),
      async () => {
        try {
          const downloadURL = await getDownloadURL(task.snapshot.ref);
          await addDoc(collection(db, "media"), {
            type: "photo",
            url: downloadURL,
            thumbnailUrl: downloadURL,
            title: title || file.name.replace(/\.[^.]+$/, ""),
            description,
            category,
            createdAt: serverTimestamp()
          });
          resolve();
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

// ============================================================
// ADD VIDEO
// ============================================================
async function handleAddVideo() {
  const url = document.getElementById("video-url").value.trim();
  const thumbnailUrl = document.getElementById("video-thumbnail").value.trim();
  const title = document.getElementById("video-title").value.trim();
  const description = document.getElementById("video-description").value.trim();
  const category = document.getElementById("video-category").value;
  const successEl = document.getElementById("video-success");
  const errorEl = document.getElementById("video-error");
  const btn = document.getElementById("add-video-btn");

  successEl.hidden = true;
  errorEl.hidden = true;

  if (!url) {
    showError(errorEl, "Ingresa la URL del video.");
    return;
  }
  if (!title) {
    showError(errorEl, "Ingresa un título para el video.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Guardando...";

  try {
    const autoThumb = thumbnailUrl || getYoutubeThumbnail(url) || "";
    await addDoc(collection(db, "media"), {
      type: "video",
      url,
      thumbnailUrl: autoThumb,
      title,
      description,
      category,
      createdAt: serverTimestamp()
    });
    successEl.hidden = false;
    document.getElementById("video-url").value = "";
    document.getElementById("video-thumbnail").value = "";
    document.getElementById("video-title").value = "";
    document.getElementById("video-description").value = "";
    loadAdminMedia();
  } catch (err) {
    showError(errorEl, "Error al guardar: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Agregar video";
  }
}

// ============================================================
// DELETE
// ============================================================
async function handleDeleteMedia(docId, itemUrl, itemType) {
  if (!window.confirm("¿Eliminar este elemento de la galería?")) return;

  try {
    // Delete file from Storage only if it was uploaded (photos have Storage URLs)
    if (itemType === "photo" && itemUrl.includes("firebasestorage.googleapis.com")) {
      try {
        const storageRef = ref(storage, itemUrl);
        await deleteObject(storageRef);
      } catch (storageErr) {
        // File may already be deleted — still proceed to delete Firestore doc
        console.warn("No se pudo eliminar el archivo de Storage:", storageErr.message);
      }
    }
    await deleteDoc(doc(db, "media", docId));
    loadAdminMedia();
  } catch (err) {
    alert("Error al eliminar: " + err.message);
  }
}

// ============================================================
// PROPERTY INFO
// ============================================================
async function loadPropertyForm() {
  try {
    const snap = await getDoc(doc(db, "config", "property"));
    if (!snap.exists()) return;
    const p = snap.data();

    const set = (id, val) => { if (val !== undefined && val !== null) document.getElementById(id).value = val; };
    set("prop-title", p.title);
    set("prop-price", p.price);
    set("prop-description", p.description);
    set("prop-address", p.address);
    set("prop-bedrooms", p.bedrooms);
    set("prop-bathrooms", p.bathrooms);
    set("prop-area", p.area);
    set("contact-name", p.contactName);
    set("contact-phone", p.contactPhone);
    set("contact-whatsapp", p.contactWhatsapp);
    set("contact-email", p.contactEmail);

    if (p.garage) document.getElementById("prop-garage").checked = true;
    if (p.pool) document.getElementById("prop-pool").checked = true;
    if (Array.isArray(p.extraFeatures)) {
      document.getElementById("prop-extra").value = p.extraFeatures.join("\n");
    }
  } catch (err) {
    console.error("Error cargando info de propiedad:", err);
  }
}

async function handleSavePropertyInfo() {
  const btn = document.getElementById("save-prop-btn");
  const successEl = document.getElementById("prop-success");
  const errorEl = document.getElementById("prop-error");
  successEl.hidden = true;
  errorEl.hidden = true;
  btn.disabled = true;
  btn.textContent = "Guardando...";

  try {
    const extraRaw = document.getElementById("prop-extra").value;
    const extraFeatures = extraRaw
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);

    const data = {
      title: document.getElementById("prop-title").value.trim(),
      price: document.getElementById("prop-price").value.trim(),
      description: document.getElementById("prop-description").value.trim(),
      address: document.getElementById("prop-address").value.trim(),
      bedrooms: Number(document.getElementById("prop-bedrooms").value) || 0,
      bathrooms: Number(document.getElementById("prop-bathrooms").value) || 0,
      area: Number(document.getElementById("prop-area").value) || 0,
      garage: document.getElementById("prop-garage").checked,
      pool: document.getElementById("prop-pool").checked,
      extraFeatures,
      contactName: document.getElementById("contact-name").value.trim(),
      contactPhone: document.getElementById("contact-phone").value.trim(),
      contactWhatsapp: document.getElementById("contact-whatsapp").value.trim(),
      contactEmail: document.getElementById("contact-email").value.trim()
    };

    await setDoc(doc(db, "config", "property"), data);
    successEl.hidden = false;
  } catch (err) {
    errorEl.textContent = "Error al guardar: " + err.message;
    errorEl.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar información";
  }
}

// ============================================================
// LOAD ADMIN MEDIA LIST
// ============================================================
async function loadAdminMedia() {
  const listEl = document.getElementById("media-list");
  listEl.innerHTML = '<p class="muted-text">Cargando...</p>';

  try {
    const snap = await getDocs(
      query(collection(db, "media"), orderBy("createdAt", "desc"))
    );

    if (snap.empty) {
      listEl.innerHTML = '<p class="muted-text">Aún no hay contenido subido.</p>';
      return;
    }

    listEl.innerHTML = "";
    snap.docs.forEach(d => {
      const item = { id: d.id, ...d.data() };
      listEl.appendChild(renderAdminItem(item));
    });
  } catch (err) {
    listEl.innerHTML = `<p class="error-msg">Error al cargar: ${err.message}</p>`;
  }
}

function renderAdminItem(item) {
  const CATEGORY_LABELS = {
    sala: "Sala", cocina: "Cocina", habitacion: "Habitación",
    exterior: "Exterior", bano: "Baño", otro: "Otro"
  };

  const div = document.createElement("div");
  div.className = "media-item";

  const thumbSrc = item.thumbnailUrl || item.url || "";
  const thumbHtml = thumbSrc
    ? `<img class="media-item-thumb" src="${escapeAttr(thumbSrc)}" alt="${escapeAttr(item.title || "")}" loading="lazy" />`
    : `<div class="media-item-thumb" style="background:#2a2a2a;"></div>`;

  div.innerHTML = `
    ${thumbHtml}
    <div class="media-item-info">
      <p class="media-item-title" title="${escapeAttr(item.title || "")}">${escapeHtml(item.title || "(sin título)")}</p>
      <div class="media-item-meta">
        <span class="badge badge-${item.type}">${item.type === "photo" ? "Foto" : "Video"}</span>
        <span class="badge badge-cat">${escapeHtml(CATEGORY_LABELS[item.category] || item.category || "")}</span>
        <button class="btn btn-danger delete-btn" data-id="${escapeAttr(item.id)}" data-url="${escapeAttr(item.url || "")}" data-type="${escapeAttr(item.type)}">Eliminar</button>
      </div>
    </div>
  `;

  div.querySelector(".delete-btn").addEventListener("click", e => {
    const btn = e.currentTarget;
    handleDeleteMedia(btn.dataset.id, btn.dataset.url, btn.dataset.type);
  });

  return div;
}

// ============================================================
// HELPERS
// ============================================================
function extractYoutubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/\s]{11})/);
  return m ? m[1] : null;
}

function getYoutubeThumbnail(url) {
  const id = extractYoutubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

function showError(el, msg) {
  el.textContent = msg;
  el.hidden = false;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ============================================================
// INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  initAuth();

  document.getElementById("save-prop-btn").addEventListener("click", handleSavePropertyInfo);

  document.getElementById("login-form").addEventListener("submit", e => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    handleLogin(email, password);
  });

  document.getElementById("upload-photo-btn").addEventListener("click", handlePhotoUpload);
  document.getElementById("add-video-btn").addEventListener("click", handleAddVideo);
  document.getElementById("logout-btn").addEventListener("click", handleLogout);
});
