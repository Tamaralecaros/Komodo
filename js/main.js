// Ponemos el año actual en el footer para no estar cambiándolo a mano
const y = document.getElementById("year");
if (y) y.textContent = new Date().getFullYear();

// Abrimos el modal de login cuando tocan cualquier acción marcada con data-open-auth
const authModal = document.getElementById("authModal");
document.addEventListener("click", (e) => {
  const openAuth = e.target.closest("[data-open-auth]");
  if (openAuth) {
    e.preventDefault();
    authModal?.showModal();
  }
});

/* validacion para entrar como prestador */
document.addEventListener("DOMContentLoaded", () => {
  const validUsers = [
    "fabian@gmail.com",
    "enghel@gmail.com",
    "tamara@gmail.com"
  ];
  const validPass = "Komodo123";

  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;
  const loginEmail = document.getElementById("loginEmail");
  const loginPassInput = document.getElementById("loginPass");
  const loginError = document.getElementById("loginError");

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const email = loginEmail.value.trim().toLowerCase();
    const pass = loginPassInput.value;

    if (validUsers.includes(email) && pass === validPass) {
      // redirigir al admin
      window.location.href = "vista_ingresos.html";
    } else {
      loginError.style.display = "block";
    }
  });
});
