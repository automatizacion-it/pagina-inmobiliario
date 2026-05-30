// Firebase v10 modular SDK via CDN — no bundler needed
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// Configuración del proyecto bella-casa-soacha
// (esta config es pública por diseño; lo que protege el proyecto son las reglas de Firestore)
const firebaseConfig = {
  apiKey: "AIzaSyCH04DtYYVz7QLfY0cd0JPTL0638dOEcrk",
  authDomain: "bella-casa-soacha-4b9a5.firebaseapp.com",
  projectId: "bella-casa-soacha-4b9a5",
  storageBucket: "bella-casa-soacha-4b9a5.firebasestorage.app",
  messagingSenderId: "773904545911",
  appId: "1:773904545911:web:17c1f20d450284df7cee72",
  measurementId: "G-FQY81P2D2C"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
