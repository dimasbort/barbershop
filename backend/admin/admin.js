const API = "http://localhost:4000/api";
let token = localStorage.getItem("ap_admin_token") || "";
let allSpecialists = [];
let allServices = [];

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
    const dateStr = dt.toLocaleDateString("ru-RU", { weekday:"short", day:"numeric", month:"short" });
    const timeStr = dt.toLocaleTimeString("ru-RU", { hour:"2-digit", minute:"2-digit" });
    const endStr = new Date(r.datetime_end).toLocaleTimeString("ru-RU", { hour:"2-digit", minute:"2-digit" });

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

  // Редактор расписания
  const days = ["mon","tue","wed","thu","fri","sat","sun"];
  const labels = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
  const schedule = s?.schedule || {};
  document.getElementById("sp-schedule-editor").innerHTML = days.map((d, i) => {
    const val = schedule[d]?.[0] || "";
    const [from, to] = val ? val.split("-") : ["",""];
    return `
      <div class="weekday-row">
        <span class="weekday-label">${labels[i]}</span>
        <input id="sch-${d}-from" value="${from}" placeholder="09:00">
        <span>—</span>
        <input id="sch-${d}-to"   value="${to}"   placeholder="18:00">
      </div>`;
  }).join("");

  document.getElementById("modal-specialist").style.display = "flex";
}

async function saveSpecialist() {
  const id = document.getElementById("sp-id").value;
  const days = ["mon","tue","wed","thu","fri","sat","sun"];
  const schedule = {};
  days.forEach(d => {
    const from = document.getElementById(`sch-${d}-from`).value.trim();
    const to   = document.getElementById(`sch-${d}-to`).value.trim();
    schedule[d] = (from && to) ? [`${from}-${to}`] : [];
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
  document.getElementById("modal-service").style.display = "flex";
}

async function saveService() {
  const id = document.getElementById("svc-id").value;
  const body = {
    name: document.getElementById("svc-name").value
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

