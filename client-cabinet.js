const API_URL = window.location.hostname === 'andreipalych.by' || window.location.hostname === 'www.andreipalych.by'
  ? "https://barbershop-api-xxxx.onrender.com/api"  // замени на твой реальный URL
  : "http://localhost:4000/api";

let clientToken = localStorage.getItem('client_token');

// Инициализация при загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
  if (clientToken) {
    showCabinet();
    loadAppointments();
  } else {
    showLoginForm();
  }
});

// Показать форму входа
function showLoginForm() {
  document.getElementById('login-form').classList.add('active');
  document.getElementById('cabinet-content').classList.remove('active');
}

// Показать содержимое кабинета
function showCabinet() {
  document.getElementById('login-form').classList.remove('active');
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
  showLoginForm();
  
  // Очищаем форму
  document.getElementById('login-phone').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').style.display = 'none';
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
        year: 'numeric'
      });
      const timeStr = dt.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
      const endTimeStr = new Date(app.datetime_end).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
      
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

