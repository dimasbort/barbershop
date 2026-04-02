const API_URL = "http://localhost:4000/api";

// Состояние виджета
let bookingData = {};
let availableDays = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

document.addEventListener("DOMContentLoaded", () => {
  // Создаём модальное окно
  const modal = document.createElement("div");
  modal.id = "booking-modal";
  modal.innerHTML = `
    <div class="booking-wrapper">

      <!-- Шапка виджета -->
      <div class="booking-top-bar">
        <button class="booking-back" id="booking-back" style="display:none">&#8592;</button>
        <span class="booking-top-title">Онлайн запись</span>
        <button class="booking-close" id="booking-close">&#10005;</button>
      </div>

      <!-- Шаги -->
      <div id="step-specialist" class="booking-step active"></div>
      <div id="step-calendar"   class="booking-step"></div>
      <div id="step-service"    class="booking-step"></div>
      <div id="step-client"     class="booking-step"></div>
      <div id="step-success"    class="booking-step"></div>
    </div>
  `;
  document.body.appendChild(modal);

  // Кнопка закрытия
  document.getElementById("booking-close").addEventListener("click", closeModal);

  // Закрытие по клику вне виджета
  modal.addEventListener("click", e => {
    if (e.target.id === "booking-modal") closeModal();
  });

  // Кнопка назад
  document.getElementById("booking-back").addEventListener("click", goBack);

  // Все кнопки «Запись» на сайте
  document.querySelectorAll(".ms-button, #open-booking, #floating-booking").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      openModal();
    });
  });
});

// История шагов для кнопки «Назад»
const stepHistory = [];

function openModal() {
  bookingData = {};
  availableDays = [];
  stepHistory.length = 0;
  document.getElementById("booking-modal").classList.add("active");
  showStep("specialist");
  loadSpecialists();
}

function closeModal() {
  document.getElementById("booking-modal").classList.remove("active");
  // сбрасываем состояние
  bookingData = {};
  availableDays = [];
  stepHistory.length = 0;
}

function showStep(name) {
  document.querySelectorAll(".booking-step").forEach(s => s.classList.remove("active"));
  document.getElementById(`step-${name}`).classList.add("active");

  // управляем кнопкой «Назад»
  const backBtn = document.getElementById("booking-back");
  backBtn.style.display = stepHistory.length > 0 ? "block" : "none";
}

function goToStep(name) {
  const current = document.querySelector(".booking-step.active");
  if (current) stepHistory.push(current.id.replace("step-", ""));
  showStep(name);
}

function goBack() {
  if (stepHistory.length === 0) return;
  const prev = stepHistory.pop();
  showStep(prev);
  const backBtn = document.getElementById("booking-back");
  backBtn.style.display = stepHistory.length > 0 ? "block" : "none";
}

// ─────────────────────────────────────────
// ШАГ 1 — СПЕЦИАЛИСТЫ
// ─────────────────────────────────────────
async function loadSpecialists() {
  const res = await fetch(`${API_URL}/specialists`);
  const specialists = await res.json();

  document.getElementById("step-specialist").innerHTML = `
    <div class="booking-section-title">Выберите специалиста</div>
    ${specialists.map(s => `
      <div class="booking-card" onclick="chooseSpecialist(${s.id}, '${s.name}', '${s.photo || ""}', '${s.description}')">
        <img src="${s.photo || "images/home-page/mustache.png"}" onerror="this.src='images/home-page/mustache.png'">
        <div>
          <div class="booking-card-title">${s.name}</div>
          <div class="booking-card-sub">${s.description}</div>
        </div>
      </div>
    `).join("")}
  `;
}

function chooseSpecialist(id, name, photo, description) {
  bookingData.specialistId = id;
  bookingData.specialistName = name;
  bookingData.specialistPhoto = photo;
  bookingData.specialistDescription = description;
  goToStep("service");
  loadServices(id);
}

// ─────────────────────────────────────────
// ШАГ 2 — УСЛУГИ
// ─────────────────────────────────────────
async function loadServices(id) {
  const res = await fetch(`${API_URL}/specialists/${id}/services`);
  const services = await res.json();

  document.getElementById("step-service").innerHTML = `
    <div class="booking-section-title">Выберите услугу</div>
    ${services.map(s => `
      <div class="booking-card" onclick="chooseService(${s.id}, '${s.name}', ${s.duration_min}, ${s.price})">
        <div>
          <div class="booking-card-title">${s.name}</div>
          <div class="booking-card-sub">${s.duration_min} мин &mdash; ${s.price} BYN</div>
        </div>
      </div>
    `).join("")}
  `;
}

function chooseService(id, name, duration, price) {
  bookingData.serviceId = id;
  bookingData.serviceName = name;
  bookingData.serviceDuration = duration;
  bookingData.servicePrice = price;
  goToStep("calendar");
  loadCalendar();
}

// ─────────────────────────────────────────
// ШАГ 3 — КАЛЕНДАРЬ
// ─────────────────────────────────────────
async function loadCalendar() {
  // Загружаем доступные дни с бэкенда
  const res = await fetch(
    `${API_URL}/appointments/${bookingData.specialistId}/available?serviceId=${bookingData.serviceId}`
  );
  availableDays = await res.json();

  currentMonth = new Date().getMonth();
  currentYear = new Date().getFullYear();
  renderCalendar();
}

function renderCalendar() {
  const monthNames = [
    "Январь","Февраль","Март","Апрель","Май","Июнь",
    "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"
  ];

  const today = new Date();
  const firstDay = new Date(currentYear, currentMonth, 1);

  // Определяем границы допустимых дней (7 дней вперёд)
  const minDate = new Date(today);
  minDate.setHours(0,0,0,0);
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 7);
  maxDate.setHours(23,59,59,999);

  // День недели первого числа (пн=0 ... вс=6)
  let startWeekday = firstDay.getDay() - 1;
  if (startWeekday < 0) startWeekday = 6;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Кнопки навигации по месяцам — только вперёд если нужно
  const nowMonth = today.getMonth();
  const nowYear = today.getFullYear();
  const prevDisabled = (currentYear === nowYear && currentMonth <= nowMonth);
  const nextDisabled = (currentYear === nowYear && currentMonth >= nowMonth + 1);

  let gridHTML = "";

  // Заголовки дней недели
  ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].forEach(d => {
    gridHTML += `<div class="calendar-weekday">${d}</div>`;
  });

  // Пустые ячейки в начале
  for (let i = 0; i < startWeekday; i++) {
    gridHTML += `<div class="calendar-day empty"></div>`;
  }

  // Дни месяца
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(currentYear, currentMonth, d);
    const dateStr = date.toISOString().slice(0, 10);

    const isToday = (
      d === today.getDate() &&
      currentMonth === today.getMonth() &&
      currentYear === today.getFullYear()
    );

    const inRange = date >= minDate && date <= maxDate;
    const dayData = availableDays.find(x => x.date === dateStr);
    const isAvailable = inRange && dayData && dayData.available;

    let cls = "calendar-day";
    if (isToday) cls += " today";
    if (isAvailable) cls += " available";

    const onclick = isAvailable
      ? `onclick="selectDay('${dateStr}', this)"`
      : "";

    gridHTML += `<div class="${cls}" ${onclick}>${d}</div>`;
  }

  document.getElementById("step-calendar").innerHTML = `
    <div class="booking-calendar">
      <div class="calendar-month-nav">
        <button onclick="changeMonth(-1)" ${prevDisabled ? "disabled" : ""}>&#8592;</button>
        <span>${monthNames[currentMonth]} ${currentYear}</span>
        <button onclick="changeMonth(1)" ${nextDisabled ? "disabled" : ""}>&#8594;</button>
      </div>
      <div class="calendar-grid">${gridHTML}</div>
      <div id="slots-container"></div>
    </div>
  `;
}

function changeMonth(dir) {
  currentMonth += dir;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  if (currentMonth < 0)  { currentMonth = 11; currentYear--; }
  renderCalendar();
}

function selectDay(dateStr, el) {
  // Снимаем выделение со всех дней
  document.querySelectorAll(".calendar-day.selected").forEach(d => d.classList.remove("selected"));
  el.classList.add("selected");

  bookingData.selectedDate = dateStr;

  const dayData = availableDays.find(x => x.date === dateStr);
  const container = document.getElementById("slots-container");

  if (!dayData || dayData.slots.length === 0) {
    container.innerHTML = `
      <div class="no-slots">
        <span>📅</span>
        В этот день нет свободного времени
      </div>`;
    return;
  }

  // Делим слоты на «День» и «Вечер» (до 18:00 и после)
  const morning = dayData.slots.filter(s => new Date(s).getHours() < 18);
  const evening = dayData.slots.filter(s => new Date(s).getHours() >= 18);

  let html = "";

  if (morning.length) {
    html += `<div class="slots-header">День</div><div class="slots-grid">`;
    morning.forEach(sl => {
      const t = new Date(sl).toLocaleTimeString("ru-RU", {hour:"2-digit", minute:"2-digit"});
      html += `<div class="time-slot" onclick="chooseSlot('${sl}', this)">${t}</div>`;
    });
    html += `</div>`;
  }

  if (evening.length) {
    html += `<div class="slots-header">Вечер</div><div class="slots-grid">`;
    evening.forEach(sl => {
      const t = new Date(sl).toLocaleTimeString("ru-RU", {hour:"2-digit", minute:"2-digit"});
      html += `<div class="time-slot" onclick="chooseSlot('${sl}', this)">${t}</div>`;
    });
    html += `</div>`;
  }

  container.innerHTML = html;
}

function chooseSlot(datetime, el) {
  document.querySelectorAll(".time-slot.selected").forEach(s => s.classList.remove("selected"));
  el.classList.add("selected");
  bookingData.datetime_start = datetime;
  // небольшая задержка для визуального фидбека
  setTimeout(() => goToStep("client"), 300);
  showClientForm();
}

// ─────────────────────────────────────────
// ШАГ 4 — ДАННЫЕ КЛИЕНТА
// ─────────────────────────────────────────
function showClientForm() {
  const dt = new Date(bookingData.datetime_start);
  const dateStr = dt.toLocaleDateString("ru-RU", {weekday:"long", day:"numeric", month:"long"});
  const timeStr = dt.toLocaleTimeString("ru-RU", {hour:"2-digit", minute:"2-digit"});

  document.getElementById("step-client").innerHTML = `
    <div class="booking-section-title">Детали записи</div>

    <div class="booking-summary">
      <div class="summary-row">
        <img src="${bookingData.specialistPhoto || "images/home-page/mustache.png"}"
             onerror="this.src='images/home-page/mustache.png'"
             class="summary-avatar">
        <div>
          <div class="summary-name">${bookingData.specialistName}</div>
          <div class="summary-sub">${bookingData.specialistDescription}</div>
        </div>
      </div>
      <div class="summary-row">
        <div class="summary-icon">📅</div>
        <div>
          <div class="summary-name">${dateStr}</div>
          <div class="summary-sub">${timeStr} &mdash; ${getEndTime(dt, bookingData.serviceDuration)}</div>
        </div>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-service-row">
        <span>${bookingData.serviceName}</span>
        <span>${bookingData.servicePrice} BYN</span>
      </div>
      <div class="summary-total-row">
        <span>Итого</span>
        <span>${bookingData.servicePrice} BYN</span>
      </div>
    </div>

    <div class="booking-section-title" style="margin-top:20px">Ваши данные</div>
    <div style="padding:0 20px 20px">
      <input id="client-name"  class="booking-input" placeholder="Имя *">
      <div class="phone-input-wrap">
        <span class="phone-prefix">+375</span>
        <input id="client-phone" class="booking-input phone-field" placeholder="Номер телефона *" maxlength="9">
      </div>
      <div id="form-error" class="form-error" style="display:none"></div>
      <div class="booking-btn" onclick="submitBooking()">Записаться</div>
    </div>
  `;
}

function getEndTime(start, duration) {
  const end = new Date(start.getTime() + duration * 60000);
  return end.toLocaleTimeString("ru-RU", {hour:"2-digit", minute:"2-digit"});
}

// ─────────────────────────────────────────
// ШАГ 5 — ОТПРАВКА
// ─────────────────────────────────────────
async function submitBooking() {
  const name = document.getElementById("client-name").value.trim();
  const phone = document.getElementById("client-phone").value.trim();
  const errEl = document.getElementById("form-error");

  if (!name) {
    errEl.textContent = "Пожалуйста, введите имя.";
    errEl.style.display = "block";
    return;
  }
  if (phone.length < 7) {
    errEl.textContent = "Введите корректный номер телефона.";
    errEl.style.display = "block";
    return;
  }

  errEl.style.display = "none";
  bookingData.client_name = name;
  bookingData.client_phone = "+375" + phone;

  const res = await fetch(`${API_URL}/appointments`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(bookingData),
  });

  const data = await res.json();
  if (data.error) {
    errEl.textContent = data.error;
    errEl.style.display = "block";
    return;
  }

  goToStep("success");
  const dt = new Date(bookingData.datetime_start);
  document.getElementById("step-success").innerHTML = `
    <div class="booking-success">
      <div class="success-icon">✓</div>
      <h3>Вы записаны!</h3>
      <p>${bookingData.specialistName}</p>
      <p>${bookingData.serviceName}</p>
      <p>${dt.toLocaleDateString("ru-RU", {weekday:"long", day:"numeric", month:"long"})},
         ${dt.toLocaleTimeString("ru-RU", {hour:"2-digit", minute:"2-digit"})}</p>
      <div class="booking-btn" style="margin-top:20px" onclick="closeModal()">Закрыть</div>
    </div>
  `;
}

// Плавающая кнопка
document.addEventListener("DOMContentLoaded", () => {
  const floatingBtn = document.getElementById("floating-booking");
  if (floatingBtn) {
    floatingBtn.addEventListener("click", openModal);
  }
});
