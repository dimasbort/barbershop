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
    date.setHours(3,0,0,0);
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

  // Делим слоты на «Утро», «День» и «Вечер»
  const morning = dayData.slots.filter(s => new Date(s).getHours() < 12);
  const day = dayData.slots.filter(s => new Date(s).getHours() >= 12 && new Date(s).getHours() < 18);
  const evening = dayData.slots.filter(s => new Date(s).getHours() >= 18);

  let html = "";

  if (morning.length) {
    html += `<div class="slots-header">Утро</div><div class="slots-grid">`;
    morning.forEach(sl => {
      const t = new Date(sl).toLocaleTimeString("ru-RU", {hour:"2-digit", minute:"2-digit"});
      html += `<div class="time-slot" onclick="chooseSlot('${sl}', this)">${t}</div>`;
    });
    html += `</div>`;
  }

  if (day.length) {
    html += `<div class="slots-header">День</div><div class="slots-grid">`;
    day.forEach(sl => {
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
// Глобальная переменная для отслеживания состояния формы
let clientFormMode = "check-phone"; // "check-phone" | "new-client" | "existing-client"
let existingClient = null;
let clientPhone = null;

// Шаг 4 — Данные клиента (переработанный)
function showClientForm() {
  clientFormMode = "check-phone";
  existingClient = null;
  renderClientForm();
}

function renderClientForm() {
  const dt = new Date(bookingData.datetime_start);
  const dateStr = dt.toLocaleDateString("ru-RU", {weekday:"long", day:"numeric", month:"long"});
  const timeStr = dt.toLocaleTimeString("ru-RU", {hour:"2-digit", minute:"2-digit"});

  let formHTML = `
    <div class="booking-section-title">Детали записи</div>

    <div class="booking-summary">
      <div class="summary-row">
        <img src="${bookingData.specialistPhoto || "images/home-page/mustache.png"}"
             onerror="this.src='images/home-page/mustache.png'"
             class="summary-avatar">
        <div>
          <div class="summary-name">${bookingData.specialistName}</div>
          <div class="summary-sub">Барбер</div>
        </div>
      </div>
      <div class="summary-row">
        <div class="summary-icon">📅</div>
        <div>
          <div class="summary-name">${dateStr}</div>
          <div class="summary-sub">${timeStr} — ${getEndTime(dt, bookingData.serviceDuration)}</div>
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
    <div style="padding:0 20px 20px">`;

  if (clientFormMode === "check-phone") {
    // Шаг 1: Проверка номера телефона
    formHTML += `
      <div class="phone-input-wrap">
        <span class="phone-prefix">+375</span>
        <input id="client-phone" class="booking-input phone-field" placeholder="Номер телефона *" maxlength="9" required>
      </div>
      
      <div class="info-note">
        👋 Введите ваш номер телефона. Мы проверим, есть ли у вас уже личный кабинет.
      </div>
      
      <div id="form-error" class="form-error" style="display:none"></div>
      <div class="booking-btn" onclick="checkClientPhone()">Продолжить</div>`;

  } else if (clientFormMode === "existing-client") {
    // Шаг 2a: Существующий клиент - только пароль
    formHTML += `
      <div class="client-info-card">
        <div class="client-welcome">
          <span class="welcome-icon">👋</span>
          <div>
            <div class="welcome-title">Добро пожаловать, ${existingClient.name}!</div>
            <div class="welcome-phone">+375${clientPhone}</div>
          </div>
        </div>
      </div>
      
      <input id="client-password" class="booking-input" type="password" placeholder="Введите ваш пароль *" required>
      
      <div class="form-actions">
        <button class="booking-btn secondary" onclick="goBackToPhoneCheck()">Назад</button>
        <button class="booking-btn" onclick="submitBookingExisting()">Записаться</button>
      </div>
      
      <div id="form-error" class="form-error" style="display:none"></div>`;

  } else if (clientFormMode === "new-client") {
    // Шаг 2b: Новый клиент - полная регистрация
    formHTML += `
      <div class="client-info-card">
        <div class="new-client-info">
          <span class="info-icon">✨</span>
          <div>
            <div class="info-title">Создание личного кабинета</div>
            <div class="info-subtitle">Номер +375${clientPhone} не найден</div>
          </div>
        </div>
      </div>
      
      <input id="client-name" class="booking-input" placeholder="Ваше имя *" required>
      <input id="client-password" class="booking-input" type="password" placeholder="Придумайте пароль (мин. 4 символа) *" required>
      
      <label class="gdpr-checkbox">
        <input type="checkbox" id="gdpr-consent" required>
        <span class="checkmark"></span>
        <span class="gdpr-text">
          Согласен на <a href="/privacy-policy.html" target="_blank">обработку персональных данных</a> 
          и получение SMS-уведомлений
        </span>
      </label>

      <div class="info-note">
        💡 Пароль нужен для входа в личный кабинет, где вы сможете просматривать и отменять записи
      </div>

      <div class="form-actions">
        <button class="booking-btn secondary" onclick="goBackToPhoneCheck()">Назад</button>
        <button class="booking-btn" onclick="submitBookingNew()">Создать кабинет и записаться</button>
      </div>
      
      <div id="form-error" class="form-error" style="display:none"></div>`;
  }

  formHTML += `</div>`;
  document.getElementById("step-client").innerHTML = formHTML;
}

// Проверка номера телефона
async function checkClientPhone() {
  const phone = document.getElementById("client-phone").value.trim();
  const errEl = document.getElementById("form-error");

  if (phone.length < 7) {
    errEl.textContent = "Введите корректный номер телефона.";
    errEl.style.display = "block";
    return;
  }

  errEl.style.display = "none";

  try {
    const res = await fetch(`${API_URL}/client/check-phone`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ phone: "+375" + phone }),
    });

    const data = await res.json();
    
    if (data.error) {
      errEl.textContent = data.error;
      errEl.style.display = "block";
      return;
    }

    if (data.exists) {
      // Клиент существует
      clientFormMode = "existing-client";
      existingClient = data.client;
    } else {
      // Новый клиент
      clientFormMode = "new-client";
      existingClient = null;
    }
    clientPhone = phone;

    renderClientForm();
  } catch (err) {
    errEl.textContent = "Ошибка сети. Попробуйте еще раз.";
    errEl.style.display = "block";
  }
}

// Возврат к проверке телефона
function goBackToPhoneCheck() {
  clientFormMode = "check-phone";
  existingClient = null;
  renderClientForm();
}

// Запись для существующего клиента
async function submitBookingExisting() {
  const phone = "+375" + clientPhone;
  const password = document.getElementById("client-password").value.trim();
  const errEl = document.getElementById("form-error");

  if (!password) {
    errEl.textContent = "Введите пароль.";
    errEl.style.display = "block";
    return;
  }

  // Сначала авторизуемся
  try {
    const authRes = await fetch(`${API_URL}/client/auth`, {
      method: "POST", 
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        phone,
        password,
        mode: "login"
      }),
    });

    const authData = await authRes.json();
    
    if (authData.error) {
      errEl.textContent = authData.error;
      errEl.style.display = "block";
      return;
    }

    // Теперь создаём запись
    const appointmentData = {
      specialistId: bookingData.specialistId,
      serviceId: bookingData.serviceId,
      client_name: existingClient.name,
      client_phone: phone,
      client_password: password,
      datetime_start: bookingData.datetime_start,
      gdpr_consent: true, // уже был дан при регистрации
    };

    const bookingRes = await fetch(`${API_URL}/appointments`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(appointmentData),
    });

    const bookingData_result = await bookingRes.json();
    
    if (bookingData_result.error) {
      errEl.textContent = bookingData_result.error;
      errEl.style.display = "block";
      return;
    }

    // Успех
    goToStep("success");
    showSuccessStep(existingClient.name, phone.replace("+375", ""), "***", true);

  } catch (err) {
    errEl.textContent = "Ошибка сети. Попробуйте еще раз.";
    errEl.style.display = "block";
  }
}

// Запись для нового клиента
async function submitBookingNew() {
  const phone = "+375" + clientPhone;
  const name = document.getElementById("client-name").value.trim();
  const password = document.getElementById("client-password").value.trim();
  const gdprConsent = document.getElementById("gdpr-consent").checked;
  const errEl = document.getElementById("form-error");
  console.log(phone);

  if (!name) {
    errEl.textContent = "Введите ваше имя.";
    errEl.style.display = "block";
    return;
  }
  if (!password || password.length < 4) {
    errEl.textContent = "Пароль должен содержать минимум 4 символа.";
    errEl.style.display = "block";
    return;
  }
  if (!gdprConsent) {
    errEl.textContent = "Необходимо согласие на обработку персональных данных.";
    errEl.style.display = "block";
    return;
  }

  try {
    // Создаём запись (клиент будет создан автоматически)
    const appointmentData = {
      specialistId: bookingData.specialistId,
      serviceId: bookingData.serviceId,
      client_name: name,
      client_phone: phone,
      client_password: password,
      datetime_start: bookingData.datetime_start,
      gdpr_consent: true,
    };

    const res = await fetch(`${API_URL}/appointments`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(appointmentData),
    });

    const data = await res.json();
    
    if (data.error) {
      errEl.textContent = data.error;
      errEl.style.display = "block";
      return;
    }

    // Успех
    goToStep("success");
    showSuccessStep(name, phone.replace("+375", ""), password, false);

  } catch (err) {
    errEl.textContent = "Ошибка сети. Попробуйте еще раз.";
    errEl.style.display = "block";
  }
}

// Показ экрана успеха
function showSuccessStep(name, phone, password, isExisting) {
  const dt = new Date(bookingData.datetime_start);
  
  document.getElementById("step-success").innerHTML = `
    <div class="booking-success">
      <div class="success-icon">✓</div>
      <h3>Вы успешно записаны!</h3>
      <p><strong>${bookingData.specialistName}</strong></p>
      <p>${bookingData.serviceName}</p>
      <p>${dt.toLocaleDateString("ru-RU", {weekday:"long", day:"numeric", month:"long"})},
         ${dt.toLocaleTimeString("ru-RU", {hour:"2-digit", minute:"2-digit"})}</p>
      
      <div class="cabinet-info">
        <h4>📱 Личный кабинет</h4>
        <p>${isExisting ? 'Войдите в личный кабинет для управления записями:' : 'Ваш личный кабинет создан! Данные для входа:'}</p>
        <div class="cabinet-credentials">
          <div>Телефон: <strong>+375${phone}</strong></div>
          <div>Пароль: <strong>${password === "***" ? "ваш пароль" : password}</strong></div>
        </div>
        <button class="booking-btn" onclick="openClientCabinet()" style="margin-top:15px">
          Войти в личный кабинет
        </button>
      </div>
      
      <div class="booking-btn" style="margin-top:20px" onclick="closeModal()">Закрыть</div>
    </div>
  `;
}

function openClientCabinet() {
  // Сохраняем токен авторизации если он есть из формы
  const phone = document.getElementById("client-phone")?.value;
  const password = document.getElementById("client-password")?.value;
  
  if (phone && password && clientFormMode === "new-client") {
    // Для новых клиентов сразу авторизуемся в кабинете
    const normalizedPhone = "+375" + phone.trim();
    
    fetch(`${API_URL}/client/auth`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        phone: normalizedPhone,
        password,
        mode: 'login'
      }),
    })
    .then(res => res.json())
    .then(data => {
      if (data.token) {
        localStorage.setItem('client_token', data.token);
      }
      window.open('/client-cabinet.html', '_blank');
    })
    .catch(() => {
      window.open('/client-cabinet.html', '_blank');
    });
  } else {
    window.open('/client-cabinet.html', '_blank');
  }
}

function getEndTime(start, duration) {
  const end = new Date(start.getTime() + duration * 60000);
  return end.toLocaleTimeString("ru-RU", {hour:"2-digit", minute:"2-digit"});
}


// Плавающая кнопка
// document.addEventListener("DOMContentLoaded", () => {
//   const floatingBtn = document.getElementById("floating-booking");
//   if (floatingBtn) {
//     floatingBtn.addEventListener("click", openModal);
//   }
// });
