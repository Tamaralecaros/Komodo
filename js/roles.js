/* roles.js — control super simple de roles en front (mock de demo)
   Nota equipo: cuando tengamos backend, esto se reemplaza por JWT+RBAC.
*/
const ROLES = { CLIENTE: "cliente", TRABAJADOR: "trabajador", ADMIN: "admin" };

export function setRole(role, nombre = "") {
  localStorage.setItem("komodo_role", role);
  if (nombre) localStorage.setItem("komodo_user", nombre);
}

export function getRole() {
  return localStorage.getItem("komodo_role") || null;
}

export function clearRole() {
  localStorage.removeItem("komodo_role");
  localStorage.removeItem("komodo_user");
}

/* Guard de acceso por vista
   - allowed: array de roles que pueden entrar
   - onDeny: redirección amable cuando no corresponde
*/
export function guard(allowed = [], onDeny = "index.html") {
  const r = getRole();
  if (!r || !allowed.includes(r)) {
    // Nota equipo: por ahora redirigimos, luego mostramos 403 bonito.
    location.href = onDeny;
  }
}

/* Ayuda para adaptar el header según rol (mostrar/ocultar links) */
export function adaptHeader() {
  const role = getRole();
  document.querySelectorAll("[data-role-show]").forEach(el => {
    const should = (el.dataset.roleShow || "").split(",").includes(role || "");
    el.style.display = should ? "" : "none";
  });
}

/* Destinos por rol después de login */
export function homeFor(role) {
  if (role === ROLES.ADMIN)      return "vista_ingresos.html";
  if (role === ROLES.TRABAJADOR) return "vista_reservas.html?mine=1";
  return "cliente.html"; // cliente
}
