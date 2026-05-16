const API_URL = window.BARBERSHOP_API_URL
  || (isLocalHost(window.location.hostname)
    ? `http://${window.location.hostname || "localhost"}:4000/api`
    : isProductionHost(window.location.hostname)
      ? "https://api.andreipalych.by/api"
    : `${window.location.origin}/api`);
const BARBERSHOP_TIME_ZONE = "Europe/Minsk";

let clientToken = localStorage.getItem('client_token');
let clientProfile = null;
let resetPhone = null;
let verifiedResetCode = null;

function isLocalHost(hostname) {
  return ["localhost", "127.0.0.1", ""].includes(hostname)
    || /^192\.168\./.test(hostname)
    || /^10\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
}

function isProductionHost(hostname) {
  return hostname === "andreipalych.by" || hostname === "www.andreipalych.by";
}

// Инициализация при загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
  if (clientToken) {
    showCabinet();
    loadProfile();
    loadAppointments();
  } else {
    showLoginForm();
  }
});

// Показать форму входа
function showLoginForm() {
  document.getElementById('login-form').classList.add('active');
  document.getElementById('reset-form').classList.remove('active');
  document.getElementById('cabinet-content').classList.remove('active');
}

function showResetForm() {
  document.getElementById('login-form').classList.remove('active');
  document.getElementById('reset-form').classList.add('active');
  document.getElementById('cabinet-content').classList.remove('active');
  document.getElementById('reset-step-phone').style.display = 'block';
  document.getElementById('reset-step-code').style.display = 'none';
  document.getElementById('reset-step-password').style.display = 'none';
  document.getElementById('reset-request-btn').style.display = 'block';
  document.getElementById('reset-phone').disabled = false;
  document.getElementById('reset-code').disabled = false;
  document.getElementById('reset-verify-btn').style.display = 'block';
  resetPhone = null;
  verifiedResetCode = null;
}

// Показать содержимое кабинета
function showCabinet() {
  document.getElementById('login-form').classList.remove('active');
  document.getElementById('reset-form').classList.remove('active');
  document.getElementById('cabinet-content').classList.add('active');
}

// Вход клиента
async function clientLogin() {
  const phone = document.getElementById('login-phone').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const errorEl = document.getElementById('login-error');

  if (!phone || !password) {
    errorEl.textContent = 'Заполните все поля';
    errorEl.style.display = 'block';
    return;
  }

  // Нормализуем номер телефона
  const normalizedPhone = phone.startsWith('+375') ? phone : `+375${phone.replace(/\D/g, '')}`;

  try {
    const res = await fetch(`${API_URL}/client/auth`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        phone: normalizedPhone, 
        password, 
        mode: 'login'
      }),
    });

    const data = await res.json();
    
    if (data.error) {
      errorEl.textContent = data.error;
      errorEl.style.display = 'block';
      return;
    }

    clientToken = data.token;
    localStorage.setItem('client_token', clientToken);
    errorEl.style.display = 'none';
    
    showCabinet();
    loadProfile();
    loadAppointments();
  } catch (err) {
    console.error('Login error:', err);
    errorEl.textContent = 'Ошибка сети. Попробуйте еще раз.';
    errorEl.style.display = 'block';
  }
}

// Выход из кабинета
function clientLogout() {
  localStorage.removeItem('client_token');
  clientToken = null;
  clientProfile = null;
  showLoginForm();
  
  // Очищаем форму
  document.getElementById('login-phone').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').style.display = 'none';
}

async function authedFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientToken}`,
      ...(options.headers || {}),
    },
  });

  const data = await res.json();
  if (res.status === 401) {
    clientLogout();
    throw new Error(data.error || 'Сессия истекла');
  }
  return { res, data };
}

async function loadProfile() {
  try {
    const { data } = await authedFetch('/client/profile');
    if (data.error) return;

    clientProfile = data;
    document.getElementById('profile-name').value = data.name || '';
  } catch (err) {
    console.error('Profile error:', err);
  }
}

function toggleProfilePanel(force) {
  const panel = document.getElementById('profile-panel');
  const shouldShow = typeof force === 'boolean' ? force : panel.style.display === 'none';
  panel.style.display = shouldShow ? 'block' : 'none';
  if (shouldShow && clientProfile) {
    document.getElementById('profile-name').value = clientProfile.name || '';
  }
}

async function updateProfileName() {
  const name = document.getElementById('profile-name').value.trim();
  const msgEl = document.getElementById('profile-name-message');
  const errEl = document.getElementById('profile-name-error');
  msgEl.style.display = 'none';
  errEl.style.display = 'none';

  try {
    const { res, data } = await authedFetch('/client/profile', {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });

    if (!res.ok || data.error) {
      errEl.textContent = data.error || 'Не удалось сохранить имя';
      errEl.style.display = 'block';
      return;
    }

    clientProfile = data.client;
    if (data.token) {
      clientToken = data.token;
      localStorage.setItem('client_token', clientToken);
    }
    msgEl.textContent = 'Имя сохранено';
    msgEl.style.display = 'block';
    loadAppointments();
  } catch (err) {
    errEl.textContent = err.message || 'Ошибка сети';
    errEl.style.display = 'block';
  }
}

async function changePassword() {
  const currentPassword = document.getElementById('current-password').value.trim();
  const newPassword = document.getElementById('new-password').value.trim();
  const msgEl = document.getElementById('password-message');
  const errEl = document.getElementById('password-error');
  msgEl.style.display = 'none';
  errEl.style.display = 'none';

  try {
    const { res, data } = await authedFetch('/client/password', {
      method: 'PUT',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });

    if (!res.ok || data.error) {
      errEl.textContent = data.error || 'Не удалось изменить пароль';
      errEl.style.display = 'block';
      return;
    }

    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    msgEl.textContent = 'Пароль изменён';
    msgEl.style.display = 'block';
  } catch (err) {
    errEl.textContent = err.message || 'Ошибка сети';
    errEl.style.display = 'block';
  }
}

async function requestPasswordReset() {
  const phone = document.getElementById('reset-phone').value.trim();
  const errEl = document.getElementById('reset-request-error');
  const msgEl = document.getElementById('reset-request-success');
  errEl.style.display = 'none';
  msgEl.style.display = 'none';

  try {
    const res = await fetch(`${API_URL}/client/password-reset/request`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      errEl.textContent = data.error || 'Не удалось отправить SMS-код';
      errEl.style.display = 'block';
      return;
    }

    resetPhone = phone;
    msgEl.textContent = `Код отправлен. Он действует ${data.expires_in_minutes || 5} минут.`;
    msgEl.style.display = 'block';
    document.getElementById('reset-request-btn').style.display = 'none';
    document.getElementById('reset-phone').disabled = true;
    document.getElementById('reset-step-code').style.display = 'block';
  } catch (err) {
    errEl.textContent = 'Ошибка сети. Попробуйте еще раз.';
    errEl.style.display = 'block';
  }
}

async function verifyPasswordResetCode() {
  const code = document.getElementById('reset-code').value.trim();
  const errEl = document.getElementById('reset-verify-error');
  const msgEl = document.getElementById('reset-verify-success');
  errEl.style.display = 'none';
  msgEl.style.display = 'none';

  try {
    const res = await fetch(`${API_URL}/client/password-reset/verify`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        phone: resetPhone || document.getElementById('reset-phone').value.trim(),
        code,
      }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      errEl.textContent = data.error || 'Код не подошёл';
      errEl.style.display = 'block';
      return;
    }

    verifiedResetCode = code;
    document.getElementById('reset-code').disabled = true;
    document.getElementById('reset-verify-btn').style.display = 'none';
    msgEl.textContent = 'Код подтверждён';
    msgEl.style.display = 'block';
    document.getElementById('reset-step-password').style.display = 'block';
  } catch (err) {
    errEl.textContent = 'Ошибка сети. Попробуйте еще раз.';
    errEl.style.display = 'block';
  }
}

async function confirmPasswordReset() {
  const newPassword = document.getElementById('reset-new-password').value.trim();
  const errEl = document.getElementById('reset-confirm-error');
  errEl.style.display = 'none';

  if (!verifiedResetCode) {
    errEl.textContent = 'Сначала подтвердите код из SMS';
    errEl.style.display = 'block';
    return;
  }

  try {
    const res = await fetch(`${API_URL}/client/password-reset/confirm`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        phone: resetPhone || document.getElementById('reset-phone').value.trim(),
        code: verifiedResetCode,
        new_password: newPassword,
      }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      errEl.textContent = data.error || 'Не удалось восстановить пароль';
      errEl.style.display = 'block';
      return;
    }

    clientToken = data.token;
    localStorage.setItem('client_token', clientToken);
    showCabinet();
    loadProfile();
    loadAppointments();
  } catch (err) {
    errEl.textContent = 'Ошибка сети. Попробуйте еще раз.';
    errEl.style.display = 'block';
  }
}

// Загрузка записей клиента
async function loadAppointments() {
  try {
    const res = await fetch(`${API_URL}/client/appointments`, {
      headers: {Authorization: `Bearer ${clientToken}`},
    });

    const appointments = await res.json();
    
    if (appointments.error) {
      console.error('Auth error:', appointments.error);
      clientLogout();
      return;
    }

    const listEl = document.getElementById('appointments-list');
    const noAppsEl = document.getElementById('no-appointments');

    if (appointments.length === 0) {
      listEl.style.display = 'none';
      noAppsEl.style.display = 'block';
      return;
    }

    listEl.style.display = 'block';
    noAppsEl.style.display = 'none';

    listEl.innerHTML = appointments.map(app => {
      const dt = new Date(app.datetime_start);
      const dateStr = dt.toLocaleDateString('ru-RU', {
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric',
        timeZone: BARBERSHOP_TIME_ZONE
      });
      const timeStr = dt.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit', timeZone: BARBERSHOP_TIME_ZONE});
      const endTimeStr = new Date(app.datetime_end).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit', timeZone: BARBERSHOP_TIME_ZONE});
      
      // Можно ли отменить (больше 2 часов до записи)
      const now = new Date();
      const timeDiff = dt.getTime() - now.getTime();
      const hoursUntil = timeDiff / (1000 * 60 * 60);
      const canCancel = hoursUntil > 2;

      return `
        <div class="appointment-item">
          <div class="appointment-info">
            <h3>${app.Service?.name || 'Услуга'}</h3>
            <p><strong>Специалист:</strong> ${app.Specialist?.name || 'Не указан'}</p>
            <p><strong>Дата:</strong> ${dateStr}</p>
            <p><strong>Время:</strong> ${timeStr} — ${endTimeStr}</p>
            ${!canCancel ? `<p style="color: #888; font-size: 12px;">⏰ До записи меньше 2 часов</p>` : ''}
          </div>
          <div class="appointment-actions">
            <button 
              class="btn-cancel" 
              onclick="cancelAppointment(${app.id})"
              ${!canCancel ? 'disabled title="Отменить можно не позднее чем за 2 часа до визита"' : ''}
            >
              ${canCancel ? 'Отменить' : 'Нельзя отменить'}
            </button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Ошибка загрузки записей:', err);
  }
}

// Отмена записи
async function cancelAppointment(id) {
  if (!confirm('Вы уверены, что хотите отменить запись?')) return;

  try {
    const res = await fetch(`${API_URL}/client/appointments/${id}`, {
      method: 'DELETE',
      headers: {Authorization: `Bearer ${clientToken}`},
    });

    const data = await res.json();
    
    if (data.error) {
      alert(data.error);
      return;
    }

    alert('Запись успешно отменена');
    loadAppointments(); // Перезагружаем список
  } catch (err) {
    console.error('Cancel error:', err);
    alert('Ошибка отмены записи');
  }
}

// Открыть виджет записи (переход на главную)
function openBookingWidget() {
  window.location.href = '/#booking';
}

// Альтернатива - открыть в том же окне виджет
function openBookingModal() {
  // Если мы на той же странице где есть виджет
  if (parent && parent.document.getElementById('booking-modal')) {
    parent.document.getElementById('booking-modal').classList.add('active');
    if (typeof parent.loadSpecialists === 'function') {
      parent.loadSpecialists();
    }
  } else {
    // Переходим на главную страницу
    window.location.href = '/';
  }
}

