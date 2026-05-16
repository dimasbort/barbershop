const API = window.BARBERSHOP_API_URL
  || (isLocalHost(window.location.hostname)
    ? `http://${window.location.hostname || "localhost"}:4000/api`
    : isProductionHost(window.location.hostname)
      ? "https://api.andreipalych.by/api"
    : `${window.location.origin}/api`);
const BARBERSHOP_TIME_ZONE = "Europe/Minsk";
let token = localStorage.getItem("ap_admin_token") || "";
let allSpecialists = [];
let allServices = [];
const weekdays = ["mon","tue","wed","thu","fri","sat","sun"];

function isLocalHost(hostname) {
  return ["localhost", "127.0.0.1", ""].includes(hostname)
    || /^192\.168\./.test(hostname)
    || /^10\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
}

function isProductionHost(hostname) {
  return hostname === "andreipalych.by" || hostname === "www.andreipalych.by";
}

// ── Инициализация ──────────────────────────────────────────────────

window.addEventListener("DOMContentLoaded", () => {
  if (token) {
    showMain();
  }
});

// ── Авторизация ────────────────────────────────────────────────────

async function doLogin() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();
  const errEl = document.getElementById("login-error");

  try {
    const res = await api("POST", "/admin/login", { username, password }, false);
    token = res.token;
    localStorage.setItem("ap_admin_token", token);
    errEl.style.display = "none";
    showMain();
  } catch (e) {
    errEl.textContent = "Неверный логин или пароль";
    errEl.style.display = "block";
  }
}

function doLogout() {
  token = "";
  localStorage.removeItem("ap_admin_token");
  document.getElementById("screen-main").classList.remove("active");
  document.getElementById("screen-login").classList.add("active");
}

async function showMain() {
  document.getElementById("screen-login").classList.remove("active");
  document.getElementById("screen-main").classList.add("active");

  // Загружаем базовые данные
  allSpecialists = await api("GET", "/admin/specialists");
  allServices = await api("GET", "/admin/services");

  // Заполняем фильтр специалистов
  const filterSel = document.getElementById("filter-specialist");
  const scheduleSel = document.getElementById("schedule-specialist");
  filterSel.innerHTML = `<option value="">Все специалисты</option>`;
  scheduleSel.innerHTML = `<option value="">Выберите специалиста</option>`;
  allSpecialists.forEach(s => {
    filterSel.innerHTML += `<option value="${s.id}">${s.name}</option>`;
    scheduleSel.innerHTML += `<option value="${s.id}">${s.name}</option>`;
  });

  showPage("appointments");
}

// ── Навигация ──────────────────────────────────────────────────────

function showPage(name) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById(`page-${name}`).classList.add("active");
  document.querySelector(`[data-page="${name}"]`).classList.add("active");

  if (name === "appointments") loadAppointments();
  if (name === "specialists") loadSpecialistsList();
  if (name === "services") loadServicesList();
}

// ── Записи ─────────────────────────────────────────────────────────

async function loadAppointments() {
  const specId = document.getElementById("filter-specialist").value;
  let rows = await api("GET", "/admin/appointments");
  if (specId) rows = rows.filter(r => r.specialistId == specId);
  const el = document.getElementById("appointments-list");
  if (!rows.length) {
    el.innerHTML = `<div class="empty-state">Предстоящих записей нет</div>`;
    return;
  }

  el.innerHTML = rows.map(r => {
    const dt = new Date(r.datetime_start);
    const dateStr = dt.toLocaleDateString("ru-RU", { weekday:"short", day:"numeric", month:"short", timeZone: BARBERSHOP_TIME_ZONE });
    const timeStr = dt.toLocaleTimeString("ru-RU", { hour:"2-digit", minute:"2-digit", timeZone: BARBERSHOP_TIME_ZONE });
    const endStr = new Date(r.datetime_end).toLocaleTimeString("ru-RU", { hour:"2-digit", minute:"2-digit", timeZone: BARBERSHOP_TIME_ZONE });

    return `
      <div class="appt-card">
        <div class="appt-info">
          <div class="appt-name">${r.client_name}
            <span class="badge">${r.Specialist?.name || ""}</span>
          </div>
          <div class="appt-detail">
            ${r.Service?.name || ""}
            &nbsp;·&nbsp; ${r.client_phone}
          </div>
          <div class="appt-time">${dateStr}, ${timeStr} — ${endStr}</div>
        </div>
        <button class="a-btn danger small" onclick="deleteAppointment(${r.id})">Удалить</button>
      </div>`;
  }).join("");
}

async function deleteAppointment(id) {
  if (!confirm("Удалить запись?")) return;
  await api("DELETE", `/admin/appointments/${id}`);
  loadAppointments();
}

function openAppointmentModal() {
  document.getElementById("appt-phone").value = "";
  document.getElementById("appt-name").value = "";
  document.getElementById("appt-datetime").value = "";
  document.getElementById("appt-error").style.display = "none";

  const specialistSel = document.getElementById("appt-specialist");
  specialistSel.innerHTML = `<option value="">Выберите специалиста</option>`;
  allSpecialists.forEach(s => {
    specialistSel.innerHTML += `<option value="${s.id}">${s.name}</option>`;
  });
  updateAppointmentServices();

  document.getElementById("modal-appointment").style.display = "flex";
}

function updateAppointmentServices() {
  const specialistId = Number(document.getElementById("appt-specialist").value);
  const serviceSel = document.getElementById("appt-service");
  const specialist = allSpecialists.find(s => s.id === specialistId);

  serviceSel.innerHTML = `<option value="">Выберите услугу</option>`;
  (specialist?.Services || []).forEach(service => {
    const link = service.SpecialistService;
    const details = link ? ` · ${link.duration_min} мин · ${link.price} BYN` : "";
    serviceSel.innerHTML += `<option value="${service.id}">${service.name}${details}</option>`;
  });
}

async function saveAppointment() {
  const errEl = document.getElementById("appt-error");
  errEl.style.display = "none";

  const dateValue = document.getElementById("appt-datetime").value;
  const body = {
    client_phone: document.getElementById("appt-phone").value.trim(),
    client_name: document.getElementById("appt-name").value.trim(),
    specialistId: document.getElementById("appt-specialist").value,
    serviceId: document.getElementById("appt-service").value,
    datetime_start: dateValue ? new Date(dateValue).toISOString() : "",
  };

  try {
    await api("POST", "/admin/appointments", body);
    closeModal("modal-appointment");
    await loadAppointments();
  } catch (err) {
    errEl.textContent = "Не удалось создать запись. Проверьте телефон, услугу и время.";
    errEl.style.display = "block";
  }
}

// ── Специалисты ────────────────────────────────────────────────────

async function loadSpecialistsList() {
  const el = document.getElementById("specialists-list");
  el.innerHTML = allSpecialists.map(s => {
    const tags = allServices.map(svc => {
      const linked = s.Services?.find(x => x.id === svc.id);

      if (linked) {
        // Услуга привязана — показываем тег с ценой и кнопкой удаления
        const price = linked.SpecialistService?.price || "";
        const dur   = linked.SpecialistService?.duration_min || "";
        return `
          <span class="service-tag active">
            <span onclick="openSSModal(
              ${s.id},'${s.name}',
              ${svc.id},'${svc.name}',
              ${price},${dur}
            )">${svc.name} · ${price} BYN · ${dur} мин</span>
            <button
              class="tag-delete"
              title="Удалить связь"
              onclick="unlinkService(${s.id}, ${svc.id})"
            >✕</button>
          </span>`;
      } else {
        // Услуга не привязана — серый тег для добавления
        return `
          <span class="service-tag" onclick="openSSModal(
            ${s.id},'${s.name}',
            ${svc.id},'${svc.name}',
            '',''
          )">+ ${svc.name}</span>`;
      }
    }).join("");

    return `
      <div class="item-card">
        <img src="${s.photo || ""}" onerror="this.style.display='none'">
        <div class="item-info">
          <div class="item-name">${s.name}</div>
          <div class="item-sub">${s.description || ""}</div>
          <div class="service-tags">${tags}</div>
        </div>
        <div class="item-actions">
          <button class="a-btn small" onclick="openSpecialistModal(${s.id})">✎</button>
        </div>
      </div>`;
  }).join("");
}

function openSpecialistModal(id) {
  const s = id ? allSpecialists.find(x => x.id === id) : null;
  document.getElementById("modal-specialist-title").textContent = s ? "Редактировать специалиста" : "Добавить специалиста";
  document.getElementById("sp-id").value = s?.id || "";
  document.getElementById("sp-name").value = s?.name || "";
  document.getElementById("sp-photo").value = s?.photo || "";
  document.getElementById("sp-desc").value = s?.description || "";
  document.getElementById("sp-photo-file").value = "";
  updatePhotoPreview(s?.photo || "");

  // Редактор расписания
  const labels = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
  const schedule = s?.schedule || {};
  document.getElementById("sp-schedule-editor").innerHTML = weekdays.map((d, i) => {
    const val = schedule[d]?.[0] || "";
    const [from, to] = val ? val.split("-") : ["",""];
    const [fromH = "", fromM = ""] = from ? from.split(":") : ["", ""];
    const [toH = "", toM = ""] = to ? to.split(":") : ["", ""];
    return `
      <div class="weekday-row">
        <span class="weekday-label">${labels[i]}</span>
        <input id="sch-${d}-from-h" class="time-part" value="${fromH}" placeholder="09" inputmode="numeric" maxlength="2">
        <span>:</span>
        <input id="sch-${d}-from-m" class="time-part" value="${fromM}" placeholder="00" inputmode="numeric" maxlength="2">
        <span>—</span>
        <input id="sch-${d}-to-h" class="time-part" value="${toH}" placeholder="18" inputmode="numeric" maxlength="2">
        <span>:</span>
        <input id="sch-${d}-to-m" class="time-part" value="${toM}" placeholder="00" inputmode="numeric" maxlength="2">
      </div>`;
  }).join("");

  document.getElementById("modal-specialist").style.display = "flex";
}

async function saveSpecialist() {
  const id = document.getElementById("sp-id").value;
  const schedule = {};
  weekdays.forEach(d => {
    const fromH = normalizeTimePart(document.getElementById(`sch-${d}-from-h`).value, 23);
    const fromM = normalizeTimePart(document.getElementById(`sch-${d}-from-m`).value, 59);
    const toH = normalizeTimePart(document.getElementById(`sch-${d}-to-h`).value, 23);
    const toM = normalizeTimePart(document.getElementById(`sch-${d}-to-m`).value, 59);
    schedule[d] = (fromH && fromM && toH && toM) ? [`${fromH}:${fromM}-${toH}:${toM}`] : [];
  });

  const body = {
    name: document.getElementById("sp-name").value,
    photo: document.getElementById("sp-photo").value,
    description: document.getElementById("sp-desc").value,
    schedule,
  };

  if (id) {
    await api("PUT", `/admin/specialists/${id}`, body);
  } else {
    await api("POST", "/admin/specialists", body);
  }

  closeModal("modal-specialist");
  allSpecialists = await api("GET", "/admin/specialists");
  loadSpecialistsList();
}

function normalizeTimePart(value, max) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";

  const number = Math.min(Number(digits), max);
  return String(number).padStart(2, "0");
}

function updatePhotoPreview(src) {
  const preview = document.getElementById("sp-photo-preview");
  const status = document.getElementById("sp-photo-status");
  if (src) {
    preview.src = src;
    preview.style.display = "block";
    status.textContent = "Фото прикреплено";
  } else {
    preview.removeAttribute("src");
    preview.style.display = "none";
    status.textContent = "Файл JPG, PNG или WEBP до 3 МБ";
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadSpecialistPhoto(input) {
  const file = input.files?.[0];
  if (!file) return;

  const status = document.getElementById("sp-photo-status");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    status.textContent = "Выберите JPG, PNG или WEBP";
    input.value = "";
    return;
  }
  if (file.size > 3 * 1024 * 1024) {
    status.textContent = "Фото должно быть меньше 3 МБ";
    input.value = "";
    return;
  }

  status.textContent = "Загружаем фото...";
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const result = await api("POST", "/admin/specialists/photo", {
      fileName: file.name,
      dataUrl,
    });
    document.getElementById("sp-photo").value = result.url;
    updatePhotoPreview(result.url);
  } catch (err) {
    status.textContent = "Не удалось загрузить фото";
  }
}

// ── Услуги ─────────────────────────────────────────────────────────

async function loadServicesList() {
  const el = document.getElementById("services-list");
  el.innerHTML = allServices.map(s => `
    <div class="item-card">
      <div class="item-info">
        <div class="item-name">${s.name}</div>
        <div class="item-sub">${s.description || ""}</div>
      </div>
      <div class="item-actions">
        <button class="a-btn small" onclick="openServiceModal(${s.id})">✎</button>
        <button class="a-btn small danger" onclick="deleteService(${s.id})">✕</button>
      </div>
    </div>`
  ).join("");
}

function openServiceModal(id) {
  const s = id ? allServices.find(x => x.id === id) : null;
  document.getElementById("modal-service-title").textContent = s ? "Редактировать услугу" : "Добавить услугу";
  document.getElementById("svc-id").value = s?.id || "";
  document.getElementById("svc-name").value = s?.name || "";
  document.getElementById("svc-desc").value = s?.description || "";
  document.getElementById("modal-service").style.display = "flex";
}

async function saveService() {
  const id = document.getElementById("svc-id").value;
  const body = {
    name: document.getElementById("svc-name").value,
    description: document.getElementById("svc-desc").value,
  };
  if (id) {
    await api("PUT", `/admin/services/${id}`, body);
  } else {
    await api("POST", "/admin/services", body);
  }
  closeModal("modal-service");
  allServices = await api("GET", "/admin/services");
  loadServicesList();
}

async function deleteService(id) {
  if (!confirm("Удалить услугу?")) return;
  await api("DELETE", `/admin/services/${id}`);
  allServices = await api("GET", "/admin/services");
  loadServicesList();
}

// ── Связь специалист ↔ услуга ──────────────────────────────────────

function openSSModal(specId, specName, svcId, svcName, price, duration) {
  console.log('Bubu');
  document.getElementById("modal-ss-name").textContent = `${specName} — ${svcName}`;
  document.getElementById("ss-specialist-id").value = specId;
  document.getElementById("ss-service-id").value = svcId;
  document.getElementById("ss-price").value = price || "";
  document.getElementById("ss-duration").value = duration || "";
  document.getElementById("modal-ss").style.display = "flex";
}

async function saveSpecialistService() {
  await api("POST", "/admin/specialist-service", {
    specialistId: document.getElementById("ss-specialist-id").value,
    serviceId: document.getElementById("ss-service-id").value,
    price: +document.getElementById("ss-price").value,
    duration_min: +document.getElementById("ss-duration").value,
  });
  closeModal("modal-ss");
  allSpecialists = await api("GET", "/admin/specialists");
  loadSpecialistsList();
}

// ── Расписание (доступные даты) ────────────────────────────────────

async function loadSchedule() {
  const specId = document.getElementById("schedule-specialist").value;
  if (!specId) {
    document.getElementById("schedule-calendar").innerHTML = "";
    return;
  }

  const dates = await api("GET", `/admin/available-dates/${specId}`);
  const today = new Date();
  today.setHours(3,0,0,0);

  // Строим сетку на 30 дней
  let html = `<div class="schedule-grid">`;
  const weekdays = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
    const skip = today.getDay() == 0 ? 6 : today.getDay() - 1;
    for(let j = 0; j < skip; j++) {
        html += `
      <div>
      </div>`;
    }

  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);    
    const dateStr = d.toISOString().slice(0, 10);
    const rec = dates.find(x => x.date === dateStr);
    const isOn = rec?.isAvailable;
    const cls = isOn ? "sched-day on" : "sched-day off";
    html += `
      <div class="${cls}" onclick="toggleDate('${dateStr}', ${specId}, ${isOn ? "false" : "true"})">
        <div class="day-name">${weekdays[d.getDay()]}</div>
        <div class="day-date">${d.getDate()}.${String(d.getMonth()+1).padStart(2,"0")}</div>
      </div>`;
  }

  html += `</div>`;
  document.getElementById("schedule-calendar").innerHTML = html;
}

async function toggleDate(date, specId, makeAvailable) {
    console.log(date, 'hhh', makeAvailable);
  await api("POST", "/admin/available-dates", {
    specialistId: specId,
    date,
    isAvailable: makeAvailable,
  });
  loadSchedule();
}

// ── Вспомогательные ────────────────────────────────────────────────

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

async function api(method, path, body, useToken = true) {
  const headers = { "Content-Type": "application/json" };
  if (useToken && token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    if (res.status === 401) doLogout();
    throw new Error(await res.text());
  }
  return res.json();
}

async function unlinkService(specialistId, serviceId) {
  if (!confirm("Удалить связь специалиста с этой услугой?")) return;
  await api("DELETE", "/admin/specialist-service", {
    specialistId,
    serviceId,
  });
  allSpecialists = await api("GET", "/admin/specialists");
  loadSpecialistsList();
}

