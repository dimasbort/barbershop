const API_URL = "http://localhost:4000/api";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch(`${API_URL}/specialists/with-services`);
    const specialists = await res.json();

    renderTeam(specialists);
    renderPricing(specialists);
  } catch (err) {
    console.error("Ошибка загрузки данных:", err);
    // При ошибке — оставляем захардкоженный HTML как есть
  }
});

// ── Секция "Мастера" ──────────────────────────────────────────────

function renderTeam(specialists) {
  const grid = document.querySelector(".main-team ul.grid");
  if (!grid) return;

  grid.innerHTML = specialists.map(s => `
    <li>
      <img
        class="img-responsive"
        src="${s.photo || "images/home-page/andrew.jpg"}"
        alt="${s.name}"
        onerror="this.src='images/home-page/andrew.jpg'"
      >
      <div class="figcaption">
        <h5>${s.name}</h5>
        <p>${s.description || ""}</p>
        <ul class="social">
          <li>
            <a href="[instagram.com](https://www.instagram.com/andreipalych.by/)" target="_blank">
              <i class="fa fa-instagram"></i>
            </a>
          </li>
        </ul>
      </div>
    </li>
  `).join("");
}

// ── Секция "Цены" ─────────────────────────────────────────────────

function renderPricing(specialists) {
  const container = document.querySelector(".main-pricing .row");
  if (!container) return;

  // Собираем уникальные услуги по всем специалистам
  // (берём минимальную цену если у разных специалистов разная)
  const servicesMap = new Map();

  specialists.forEach(specialist => {
    specialist.services.forEach(svc => {
      if (!servicesMap.has(svc.id)) {
        servicesMap.set(svc.id, { ...svc });
      } else {
        // Если услуга уже есть — берём минимальную цену
        const existing = servicesMap.get(svc.id);
        if (svc.price < existing.price) {
          servicesMap.set(svc.id, { ...svc });
        }
      }
    });
  });

  const services = Array.from(servicesMap.values());

  container.innerHTML = services.map(svc => `
    <div class="col-xs-12 col-sm-4 col-md-4 col-lg-4" style="margin-bottom:30px">
      <div class="price-block">
        <div class="inner-price">
          <h3>${svc.name}</h3>
          <h2 class="h1">${svc.price}<span>руб.</span></h2>
          <button class="main-btn ms-button" type="button">Запись</button>
        </div>
      </div>
    </div>
  `).join("");

  // После рендера кнопок — переподвешиваем обработчики
  reattachBookingButtons();
}

// Переподвешивает обработчики на кнопки записи
// (т.к. новые кнопки появились уже после DOMContentLoaded)
function reattachBookingButtons() {
  document.querySelectorAll(".ms-button").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      const modal = document.getElementById("booking-modal");
      if (modal) {
        modal.classList.add("active");
        if (typeof openModal === "function") openModal();
        else if (typeof loadSpecialists === "function") loadSpecialists();
      }
    });
  });
}
