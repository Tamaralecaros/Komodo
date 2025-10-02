/* reservas.js — vista Reservas (demo sin backend)
   Equipo: dejamos este flujo para probar rápido:
   - Admin ve todas las reservas.
   - Trabajador entra a .../vista_reservas.html?mine=1 y ve SOLO las suyas.
   - Confirmar → pasa a "confirmada".
   - Finalizar → pedimos TOTAL FINAL y lo registramos en Ingresos (localStorage).
   Nota: cuando tengamos backend, esto se reemplaza por filtros por userId y RBAC real.
*/

import { getRole } from "./roles.js"; // usamos el rol guardado en localStorage

// Helpers DOM cortitos
const $ = (s, c = document) => c.querySelector(s);
const tbody = $("#tbody_reservas") || $("#tbl_reservas tbody");

// --- contexto de rol/usuario ---
const role = getRole();                       // "admin" | "trabajador" | "cliente" | null
const url = new URL(location.href);
const soloMias = url.searchParams.get("mine") === "1" && role === "trabajador";

// Heurística simple para “mi nombre” (mock): antes de @ del correo que guardamos al loguear
const yo = (localStorage.getItem("komodo_user") || "")
  .split("@")[0]
  .trim()
  .toLowerCase();

// ----------------- Datos de ejemplo (mock) -----------------
const reservas = [
  {
    id: 1,
    cliente: "María López",
    servicio: "Corte Dama",
    peluquero: "Tamara",
    fechaISO: "2025-03-20",
    hora: "15:00",
    estado: "confirmada", // pendiente | confirmada | finalizada | cancelada
    abono: 2000,
    saldo: 8000,
    total: 10000,
    comprobanteId: null
  },
  {
    id: 2,
    cliente: "Carlos Pérez",
    servicio: "Color Cabello",
    peluquero: "Fabián",
    fechaISO: "2025-03-21",
    hora: "11:30",
    estado: "pendiente",
    abono: 5000,
    saldo: 25000,
    total: 30000,
    comprobanteId: null
  },
  {
    id: 3,
    cliente: "Ana Soto",
    servicio: "Alisado",
    peluquero: "Tamara",
    fechaISO: "2025-03-22",
    hora: "10:00",
    estado: "pendiente",
    abono: 10000,
    saldo: 25000,
    total: 35000,
    comprobanteId: null
  }
];

// ----------------- Utilidades -----------------
const fmtCLP = n =>
  n.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

const badge = st => {
  if (st === "confirmada") return '<span class="badge badge--ok">Confirmada</span>';
  if (st === "pendiente")  return '<span class="badge badge--pend">Pendiente</span>';
  if (st === "finalizada") return '<span class="badge badge--ok">Finalizada</span>';
  return '<span class="badge badge--cancel">Cancelada</span>';
};

const hoyISO = () => new Date().toISOString().slice(0, 10);

function fechaBonita(iso) {
  const d = new Date(iso + "T00:00:00");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
}

// ----------------- Persistencia local de ingresos -----------------
function loadIngresos() {
  try { return JSON.parse(localStorage.getItem("komodo_ingresos") || "[]"); }
  catch { return []; }
}
function saveIngresos(arr) {
  localStorage.setItem("komodo_ingresos", JSON.stringify(arr));
}
function registrarIngreso({ fechaISO, cliente, servicio, metodo, monto, reservaId }) {
  const movs = loadIngresos();
  const id = `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
  movs.push({ id, fechaISO, cliente, servicio, metodo, monto, reservaId });
  saveIngresos(movs);
  return id; // usamos este id como "comprobante"
}

// ----------------- Render de tabla -----------------
function render() {
  tbody.innerHTML = "";

  // Si es trabajador y viene con ?mine=1 → filtramos solo sus reservas
  const data = soloMias
    ? reservas.filter(r =>
        (r.peluquero || "").toLowerCase().includes(yo) || // caso simple: coincide con correo
        (yo && (r.peluquero || "").toLowerCase().startsWith(yo[0]?.toLowerCase()))
      )
    : reservas;

  data.forEach(r => {
    const tr = document.createElement("tr");

    // Botón dorado depende del estado
    const botonDorado =
      r.estado === "pendiente"
        ? `<button class="btn btn--gold" data-action="confirmar" data-id="${r.id}">Confirmar</button>`
        : r.estado === "confirmada"
        ? `<button class="btn btn--gold" data-action="finalizar" data-id="${r.id}">Finalizar</button>`
        : r.estado === "finalizada"
        ? `<button class="btn btn--gold" data-action="imprimir" data-id="${r.id}">Comprobante</button>`
        : ``;

    tr.innerHTML = `
      <td data-col="n">${r.id}</td>
      <td data-col="cliente">${r.cliente}</td>
      <td data-col="servicio">${r.servicio}</td>
      <td data-col="peluquero">${r.peluquero || "-"}</td>
      <td data-col="fecha">${fechaBonita(r.fechaISO)}</td>
      <td data-col="hora">${r.hora}</td>
      <td data-col="estado">${badge(r.estado)}</td>
      <td class="ta-r" data-col="abono">${fmtCLP(r.abono)}</td>
      <td class="ta-r" data-col="saldo">${fmtCLP(r.saldo)}</td>
      <td class="ta-r" data-col="total">${fmtCLP(r.total)}</td>
      <td data-col="acciones">
        <div class="k-actions">
          <button class="btn btn--ghost" data-action="ver" data-id="${r.id}">Ver</button>
          ${botonDorado}
          <button class="btn btn--ghost" data-action="cancelar" data-id="${r.id}">Cancelar</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ----------------- Acciones (delegación) -----------------
tbody.addEventListener("click", e => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const id = Number(btn.dataset.id);
  const act = btn.dataset.action;
  const r = reservas.find(x => x.id === id);
  if (!r) return;

  // Confirmar: solo cambia el estado
  if (act === "confirmar") {
    r.estado = "confirmada";
    render();
  }

  // Finalizar: pedimos TOTAL FINAL → recalculamos saldo → registramos Ingresos
  if (act === "finalizar") {
    const val = prompt(
      `Total final para #${r.id} (${r.cliente})\n` +
      `Estimado actual: ${fmtCLP(r.total)}\n` +
      `Ingresa el TOTAL FINAL en pesos (solo números):`,
      r.total
    );
    if (val === null) return;

    const totalFinal = Number(String(val).replace(/[^\d]/g, ""));
    if (!Number.isFinite(totalFinal) || totalFinal <= 0) {
      alert("Ingresa un monto válido en pesos.");
      return;
    }

    // saldo = totalFinal - abono (nunca negativo)
    r.total = totalFinal;
    r.saldo = Math.max(totalFinal - r.abono, 0);
    r.estado = "finalizada";

    const compId = registrarIngreso({
      fechaISO: hoyISO(),
      cliente: r.cliente,
      servicio: r.servicio,
      metodo: "Caja",     // cuando integremos Webpay, acá irá "Tarjeta"
      monto: totalFinal,  // ESTE es el que se refleja en Ingresos
      reservaId: r.id
    });
    r.comprobanteId = compId;

    alert(
      `Reserva #${r.id} finalizada.\n` +
      `Registrado en Ingresos por ${fmtCLP(totalFinal)}.\n` +
      `Comprobante: ${compId}`
    );
    render();
  }

  if (act === "imprimir") {
    alert(
      `Comprobante: ${r.comprobanteId || "(mock)"}\n` +
      `Cliente: ${r.cliente}\nServicio: ${r.servicio}\n` +
      `Total: ${fmtCLP(r.total)}`
    );
  }

  if (act === "cancelar") {
    if (!confirm(`¿Cancelar la reserva #${r.id} de ${r.cliente}?`)) return;
    r.estado = "cancelada";
    render();
  }

  if (act === "ver") {
    alert(
      `Reserva #${r.id}\n${r.cliente} · ${r.servicio}\n` +
      `${fechaBonita(r.fechaISO)} ${r.hora}\n` +
      `Abono: ${fmtCLP(r.abono)}\nSaldo: ${fmtCLP(r.saldo)}\n` +
      `Total: ${fmtCLP(r.total)}\nEstado: ${r.estado}`
    );
  }
});

// ----------------- Init -----------------
render();
