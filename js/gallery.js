import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ============================================================
// STATE
// ============================================================
let allMedia = [];
let propSectionTemplate = "";
let activeType = "all";       // "all" | "photo" | "video"
let activeCategory = null;    // null | "sala" | "cocina" | ...

const CATEGORY_LABELS = {
  sala: "Sala",
  cocina: "Cocina",
  habitacion: "Habitación",
  exterior: "Exterior",
  bano: "Baño",
  otro: "Otro"
};

// ============================================================
// SKELETONS
// ============================================================
function showSkeletons(count = 8) {
  const grid = document.getElementById("gallery-grid");
  grid.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const card = document.createElement("div");
    card.className = "skeleton-card";
    card.style.setProperty("--i", i);
    card.innerHTML = `
      <div class="skeleton-img"></div>
      <div class="skeleton-body">
        <div class="skeleton-line skeleton-line--title"></div>
        <div class="skeleton-line skeleton-line--sub"></div>
      </div>`;
    grid.appendChild(card);
  }
}

function showPropertySkeleton() {
  const section = document.getElementById("propiedad");
  propSectionTemplate = section.innerHTML;
  section.innerHTML = `<div class="prop-loading"><span class="prop-spinner"></span> Cargando información...</div>`;
  section.hidden = false;
}

// ============================================================
// FIREBASE — Load all media once, filter in memory
// ============================================================
async function loadAllMedia() {
  showSkeletons();
  try {
    const snap = await getDocs(
      query(collection(db, "media"), orderBy("createdAt", "desc"))
    );
    allMedia = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    buildCategoryPills();
    renderFilteredMedia();
  } catch (err) {
    console.error("Error cargando galería:", err);
    document.getElementById("gallery-grid").innerHTML = "";
    document.getElementById("empty-msg").hidden = false;
  }
}

// ============================================================
// RENDER
// ============================================================
function renderFilteredMedia() {
  const filtered = allMedia.filter(item => {
    const typeMatch = activeType === "all" || item.type === activeType;
    const catMatch = !activeCategory || item.category === activeCategory;
    return typeMatch && catMatch;
  });

  const grid = document.getElementById("gallery-grid");
  const emptyMsg = document.getElementById("empty-msg");

  grid.classList.add("grid-transitioning");

  requestAnimationFrame(() => {
    grid.innerHTML = "";
    grid.classList.remove("grid-transitioning");

    if (filtered.length === 0) {
      emptyMsg.hidden = false;
      return;
    }
    emptyMsg.hidden = true;

    filtered.forEach((item, index) => {
      grid.appendChild(buildCard(item, index));
    });
  });
}

function buildCard(item, index) {
  const figure = document.createElement("figure");
  figure.className = "media-card";
  figure.style.setProperty("--i", index);
  figure.setAttribute("tabindex", "0");
  figure.setAttribute("role", "button");
  figure.setAttribute("aria-label", item.title || (item.type === "photo" ? "Foto" : "Video"));

  // Thumbnail image
  const img = document.createElement("img");
  img.className = "card-img";
  img.loading = "lazy";
  img.alt = item.title || "";

  if (item.type === "photo") {
    img.src = item.url;
  } else {
    // Video: use thumbnailUrl or auto-generate from YouTube
    img.src = item.thumbnailUrl || getYoutubeThumbnail(item.url) || "";
    if (!img.src) {
      img.style.background = "#2a2a2a";
    }
    // Play icon overlay
    const overlay = document.createElement("div");
    overlay.className = "play-overlay";
    overlay.innerHTML = `
      <div class="play-icon">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </div>`;
    figure.appendChild(overlay);
  }

  figure.appendChild(img);

  // Info footer
  const info = document.createElement("figcaption");
  info.className = "card-info";
  info.innerHTML = `
    <p class="card-title">${escapeHtml(item.title || "")}</p>
    <p class="card-category">${escapeHtml(CATEGORY_LABELS[item.category] || item.category || "")}</p>
  `;
  figure.appendChild(info);

  // Click / keyboard to open lightbox
  const open = () => openLightbox(item);
  figure.addEventListener("click", open);
  figure.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
  });

  return figure;
}

// ============================================================
// CATEGORY PILLS
// ============================================================
function buildCategoryPills() {
  const container = document.getElementById("category-pills");
  container.innerHTML = "";

  const existingCats = [...new Set(allMedia.map(m => m.category).filter(Boolean))];
  if (existingCats.length === 0) return;

  existingCats.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "category-pill";
    btn.dataset.cat = cat;
    btn.textContent = CATEGORY_LABELS[cat] || cat;
    btn.setAttribute("aria-pressed", "false");

    btn.addEventListener("click", () => {
      if (activeCategory === cat) {
        activeCategory = null;
        btn.classList.remove("active");
        btn.setAttribute("aria-pressed", "false");
      } else {
        // Deselect previous pill
        container.querySelectorAll(".category-pill").forEach(p => {
          p.classList.remove("active");
          p.setAttribute("aria-pressed", "false");
        });
        activeCategory = cat;
        btn.classList.add("active");
        btn.setAttribute("aria-pressed", "true");
      }
      renderFilteredMedia();
    });

    container.appendChild(btn);
  });
}

// ============================================================
// LIGHTBOX
// ============================================================
const lightbox = document.getElementById("lightbox");
const lightboxContent = document.getElementById("lightbox-content");
const lightboxCaption = document.getElementById("lightbox-caption");

function openLightbox(item) {
  lightboxContent.innerHTML = "";

  if (item.type === "photo") {
    const img = document.createElement("img");
    img.src = item.url;
    img.alt = item.title || "";
    lightboxContent.appendChild(img);
  } else {
    const youtubeId = extractYoutubeId(item.url);
    if (youtubeId) {
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`;
      iframe.allow = "autoplay; fullscreen";
      iframe.setAttribute("allowfullscreen", "");
      lightboxContent.appendChild(iframe);
    } else {
      const video = document.createElement("video");
      video.src = item.url;
      video.controls = true;
      video.autoplay = true;
      lightboxContent.appendChild(video);
    }
  }

  lightboxCaption.innerHTML = `
    ${item.title ? `<p class="caption-title">${escapeHtml(item.title)}</p>` : ""}
    ${item.description ? `<p class="caption-desc">${escapeHtml(item.description)}</p>` : ""}
  `;

  lightbox.classList.add("open");
  document.body.style.overflow = "hidden";
  document.getElementById("lightbox-close").focus();

  document.addEventListener("keydown", handleLightboxKey);
}

function closeLightbox() {
  document.removeEventListener("keydown", handleLightboxKey);
  lightbox.classList.remove("open");
  lightbox.classList.add("is-closing");

  lightbox.addEventListener("transitionend", function cleanup(e) {
    if (e.target !== lightbox.querySelector(".lightbox-backdrop")) return;
    lightbox.classList.remove("is-closing");
    lightboxContent.innerHTML = "";
    document.body.style.overflow = "";
    lightbox.removeEventListener("transitionend", cleanup);
  });
}

function handleLightboxKey(e) {
  if (e.key === "Escape") closeLightbox();
}

// Close on backdrop click
document.querySelector(".lightbox-backdrop").addEventListener("click", closeLightbox);
document.getElementById("lightbox-close").addEventListener("click", closeLightbox);

// ============================================================
// FILTERS — Type buttons
// ============================================================
function initTypeFilters() {
  document.querySelectorAll(".filter-btn[data-type]").forEach(btn => {
    btn.addEventListener("click", () => {
      activeType = btn.dataset.type;
      document.querySelectorAll(".filter-btn[data-type]").forEach(b => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      renderFilteredMedia();
    });
  });
}

// ============================================================
// HELPERS
// ============================================================
function extractYoutubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/\s]{11})/
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

function getYoutubeThumbnail(url) {
  const id = extractYoutubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ============================================================
// PROPERTY INFO + CONTACT
// ============================================================
async function loadPropertyInfo() {
  showPropertySkeleton();
  try {
    const snap = await getDoc(doc(db, "config", "property"));
    const section = document.getElementById("propiedad");
    if (!snap.exists()) {
      section.hidden = true;
      return;
    }
    const p = snap.data();
    section.innerHTML = propSectionTemplate;
    section.querySelectorAll(".reveal").forEach(el => {
      el.classList.remove("is-visible");
      scrollRevealObserver.observe(el);
    });

    if (p.title) document.getElementById("prop-title").textContent = p.title;
    if (p.price) document.getElementById("prop-price").textContent = p.price;
    if (p.description) document.getElementById("prop-description").textContent = p.description;
    if (p.address) document.getElementById("prop-address").textContent = p.address;

    // Feature chips
    const featureList = document.getElementById("prop-features");
    featureList.innerHTML = "";
    const featureDefs = [
      { key: "bedrooms",  icon: "🛏️", label: v => `${v} habitación${v !== 1 ? "es" : ""}` },
      { key: "bathrooms", icon: "🚿", label: v => `${v} baño${v !== 1 ? "s" : ""}` },
      { key: "area",      icon: "📐", label: v => `${v} m²` },
      { key: "garage",    icon: "🚗", label: () => "Garaje" },
      { key: "pool",      icon: "🏊", label: () => "Piscina" }
    ];
    featureDefs.forEach(({ key, icon, label }) => {
      if (!p[key]) return;
      const li = document.createElement("li");
      li.innerHTML = `<span class="feat-icon">${icon}</span>${escapeHtml(label(p[key]))}`;
      featureList.appendChild(li);
    });
    // Extra features
    if (Array.isArray(p.extraFeatures)) {
      p.extraFeatures.forEach(feat => {
        if (!feat) return;
        const li = document.createElement("li");
        li.innerHTML = `<span class="feat-icon">✓</span>${escapeHtml(feat)}`;
        featureList.appendChild(li);
      });
    }

    // Contact links
    const linksEl = document.getElementById("contact-links");
    linksEl.innerHTML = "";
    if (p.contactName) document.getElementById("contact-name").textContent = p.contactName;

    if (p.contactWhatsapp) {
      const phone = p.contactWhatsapp.replace(/\D/g, "");
      const a = document.createElement("a");
      a.className = "contact-link whatsapp";
      a.href = `https://wa.me/${phone}`;
      a.target = "_blank";
      a.rel = "noopener";
      a.innerHTML = `<span class="contact-link-icon">💬</span> WhatsApp`;
      linksEl.appendChild(a);
    }
    if (p.contactPhone) {
      const a = document.createElement("a");
      a.className = "contact-link phone";
      a.href = `tel:${p.contactPhone}`;
      a.innerHTML = `<span class="contact-link-icon">📞</span> ${escapeHtml(p.contactPhone)}`;
      linksEl.appendChild(a);
    }
    if (p.contactEmail) {
      const a = document.createElement("a");
      a.className = "contact-link email";
      a.href = `mailto:${p.contactEmail}`;
      a.innerHTML = `<span class="contact-link-icon">✉️</span> ${escapeHtml(p.contactEmail)}`;
      linksEl.appendChild(a);
    }

  } catch (err) {
    console.error("Error cargando información de la propiedad:", err);
    document.getElementById("propiedad").hidden = true;
  }
}

// ============================================================
// BACK TO TOP
// ============================================================
function initBackToTop() {
  const btn = document.getElementById("back-to-top");

  window.addEventListener("scroll", () => {
    btn.classList.toggle("visible", window.scrollY > 400);
  }, { passive: true });

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// ============================================================
// SCROLL REVEAL
// ============================================================
const scrollRevealObserver = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        scrollRevealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

function initScrollReveal() {
  document.querySelectorAll(".reveal").forEach(el => scrollRevealObserver.observe(el));
}

// ============================================================
// NAV — resalta el link de la sección visible
// ============================================================
function initNavHighlight() {
  const links = document.querySelectorAll(".site-nav-link");
  const sectionIds = ["inicio", "galeria", "propiedad", "contacto"];

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          links.forEach(l => l.classList.remove("active"));
          const active = document.querySelector(`.site-nav-link[href="#${entry.target.id}"]`);
          if (active) active.classList.add("active");
        }
      });
    },
    { rootMargin: "-30% 0px -60% 0px" }
  );

  sectionIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}

// ============================================================
// INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  initTypeFilters();
  loadAllMedia();
  loadPropertyInfo();
  initScrollReveal();
  initNavHighlight();
  initBackToTop();
});
