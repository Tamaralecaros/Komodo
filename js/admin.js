/* ===========================================================
   ADMIN · KÓMODO  (archivo completo, robusto y alineado con admin.html)
   - KPIs esperados en HTML:
     #kpi_total_ingresos, #kpi_tickets, #kpi_promedio, #kpi_7dias
   - Tabla esperada en HTML: <table id="tbl_mov"><tbody>…</tbody></table>
   - Lee ingresos reales desde localStorage["komodo_ingresos"]
     (y soporta mocks antiguos con campos distintos).
=========================================================== */

// Utils
const $  = (s, c=document)=>c.querySelector(s);
const $$ = (s, c=document)=>Array.from(c.querySelectorAll(s));
const CL = (n)=>document.createElement(n);
const fmtCLP = (n)=>`$${(Number(n)||0).toLocaleString('es-CL')}`;
const readJSON = (k, fb=[]) => { try { return JSON.parse(localStorage.getItem(k) ?? JSON.stringify(fb)); } catch { return fb; } };

// ====== 1) INGRESOS =========================================================
(function ingresosModule(){
  const STORAGE_KEY = "komodo_ingresos";

  // Soporte para múltiples “shapes” de ingreso
  function normalize(m){
    return {
      fecha:   m.fecha || m.date || m.fechaISO || m.fechaHora || new Date().toISOString(),
      cliente: m.cliente || m.nombre || m.user || "—",
      servicio:m.servicio || m.serv || m.tipo || "—",
      metodo:  m.metodo || m.pago || m.method || "—",
      monto:   Number(m.monto || m.total || m.amount || 0),
      reservaId: m.reservaId || m.reserva || null
    };
  }

  function getIngresos(){
    const reales = readJSON(STORAGE_KEY, []);
    const norm = Array.isArray(reales) ? reales.map(normalize) : [];
    // Fallback opcional: si tenías MOVIMIENTOS mock globales
    if (norm.length === 0 && Array.isArray(window.MOVIMIENTOS)) {
      return window.MOVIMIENTOS.map(normalize);
    }
    return norm;
  }

  function paintKPIs(list){
    const $ = (s)=>document.querySelector(s);

    const data = Array.isArray(list) ? list : [];
    const num = (x)=>Number(x)||0;

    // Basic aggregates
    const sum   = data.reduce((a,x)=>a + num(x.monto), 0);
    const count = data.length;
    const avg   = count ? sum / count : 0;

    // Dates helpers
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay); // Monday as first day
    const dayIdx = (startOfDay.getDay() + 6) % 7; // 0=Mon..6=Sun
    startOfWeek.setDate(startOfWeek.getDate() - dayIdx);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const last7Cut = new Date(now); last7Cut.setDate(now.getDate() - 7);

    // Safe parse date
    const toDate = (m)=>{
      const f = m.fecha || m.fechaISO || m.date || m.fechaHora;
      const d = new Date(f);
      return isNaN(d) ? null : d;
    };

    // Today
    let todaySum=0, todayCount=0;
    // This week (calendar week starting Monday)
    let weekSum=0, weekCount=0;
    // This month
    let monthSum=0, monthCount=0;
    // Last 7 days rolling window
    let last7=0;

    for (const m of data){
      const d = toDate(m);
      if (!d) continue;
      if (d >= startOfDay) { todaySum += num(m.monto); todayCount++; }
      if (d >= startOfWeek) { weekSum += num(m.monto); weekCount++; }
      if (d >= startOfMonth) { monthSum += num(m.monto); monthCount++; }
      if (d >= last7Cut) { last7 += num(m.monto); }
    }

    // --- New IDs expected by this script (compat with newer dashboard) ---
    $("#kpi_total_ingresos") && ($("#kpi_total_ingresos").textContent = fmtCLP(sum));
    $("#kpi_tickets")        && ($("#kpi_tickets").textContent        = String(count));
    $("#kpi_promedio")       && ($("#kpi_promedio").textContent       = fmtCLP(avg));
    $("#kpi_7dias")          && ($("#kpi_7dias").textContent          = fmtCLP(last7));

    // --- Legacy / your current HTML IDs ---
    $("#k_today_amount") && ($("#k_today_amount").textContent = fmtCLP(todaySum));
    $("#k_today_count")  && ($("#k_today_count").textContent  = `${todayCount} pagos`);

    $("#k_week_amount") && ($("#k_week_amount").textContent = fmtCLP(weekSum));
    $("#k_week_count")  && ($("#k_week_count").textContent  = `${weekCount} pagos`);

    $("#k_month_amount") && ($("#k_month_amount").textContent = fmtCLP(monthSum));
    $("#k_month_count")  && ($("#k_month_count").textContent  = `${monthCount} pagos`);

    $("#k_total_amount") && ($("#k_total_amount").textContent = fmtCLP(sum));
    $("#k_total_count")  && ($("#k_total_count").textContent  = `${count} pagos`);
  }


  function rowHTML(m, i){
    const d = new Date(m.fecha);
    const fechaTxt = isNaN(d) ? String(m.fecha) : d.toLocaleDateString("es-CL");
    return `<tr>
      <td>${i+1}</td>
      <td>${fechaTxt}</td>
      <td>${m.cliente}</td>
      <td>${m.servicio}</td>
      <td>${m.metodo}</td>
      <td class="ta-r">${fmtCLP(m.monto)}</td>
    </tr>`;
  }

  function paintTable(list){
    const table = $("#tbl_mov");
    if (!table) return; // esta vista puede no tener tabla
    const tbody = table.tBodies?.[0] || table.querySelector("tbody");
    if (!tbody) return;
    tbody.innerHTML = list.length ? list.map(rowHTML).join("") :
      `<tr><td colspan="6" class="muted">Sin movimientos</td></tr>`;
  }

  function renderIngresos(){
    const data = getIngresos();
    paintKPIs(data);
    paintTable(data);
  }

  // Exponer para el “boot por vista” y render inicial seguro
  window.pintarIngresos = renderIngresos;
  document.addEventListener("DOMContentLoaded", renderIngresos);
})();

// ====== 2) RESERVAS (opcional, solo si tu admin.html muestra reservas) ======
function pintarReservas() {
  const t = $('#tbl_reservas tbody');
  if (!t) return;

  t.innerHTML = '';
  (Array.isArray(window.RESERVAS) ? window.RESERVAS : [])
    .sort((a,b)=> new Date(a.fecha) - new Date(b.fecha))
    .forEach(r=>{
      const tr = CL('tr');
      const estadoBadge = r.estado === 'Confirmada'
        ? `<span class="badge badge--ok">Confirmada</span>`
        : r.estado === 'Cancelada'
          ? `<span class="badge badge--cancel">Cancelada</span>`
          : `<span class="badge badge--pend">Pendiente</span>`;

      tr.innerHTML = `
        <td>${r.cliente}</td>
        <td>${r.servicio}</td>
        <td>${new Date(r.fecha+'T00:00:00').toLocaleDateString('es-CL')}</td>
        <td>${r.hora}</td>
        <td class="ta-r">${fmtCLP(r.abono)}</td>
        <td class="ta-r">${fmtCLP(r.saldo)}</td>
        <td>${estadoBadge}</td>
        <td class="ta-r">
          <button class="btn btn--ghost" data-ver="${r.id}">Ver</button>
          <button class="btn btn--gold"  data-conf="${r.id}">Confirmar</button>
          <button class="btn btn--ghost" data-cancel="${r.id}">Cancelar</button>
        </td>
      `;
      t.appendChild(tr);
    });

  const badge = $('#res_count_badge');
  if (badge) badge.textContent = (window.RESERVAS || []).length;

  t.addEventListener('click', (e)=>{
    const id = e.target.dataset.ver || e.target.dataset.conf || e.target.dataset.cancel;
    if(!id) return;
    const r = (window.RESERVAS || []).find(x=>x.id===id);
    if(!r) return;

    if (e.target.dataset.ver){
      $('#d_cli')?.(0); // noop si no existe modal
      const d = $('#modalReserva'); if (d?.showModal) {
        $('#d_cli') && ($('#d_cli').textContent = r.cliente);
        $('#d_srv') && ($('#d_srv').textContent = r.servicio);
        $('#d_fec') && ($('#d_fec').textContent = new Date(r.fecha+'T00:00:00').toLocaleDateString('es-CL'));
        $('#d_hor') && ($('#d_hor').textContent = r.hora);
        $('#d_abn') && ($('#d_abn').textContent = fmtCLP(r.abono));
        $('#d_sld') && ($('#d_sld').textContent = fmtCLP(r.saldo));
        $('#d_est') && ($('#d_est').textContent = r.estado);
        $('#d_not') && ($('#d_not').textContent = r.notas || '—');
        $('#resumenReserva') && ($('#resumenReserva').textContent = `Reserva #${r.id}`);
        d.showModal();
      }
    }

    if (e.target.dataset.conf){ r.estado = 'Confirmada'; pintarReservas(); }
    if (e.target.dataset.cancel){ r.estado = 'Cancelada'; pintarReservas(); }
  });
}

// ====== 3) SOLICITUDES (opcional) ===========================================
function pintarSolicitudes(){
  const t = $('#tbl_solicitudes tbody');
  if(!t) return;

  t.innerHTML='';
  (Array.isArray(window.SOLICITUDES) ? window.SOLICITUDES : [])
    .sort((a,b)=> new Date(b.fecha) - new Date(a.fecha))
    .forEach(s=>{
      const tr=CL('tr');
      const est = s.estado==='Abierta' ? 'badge--pend'
                : s.estado==='En progreso' ? 'badge--ok' : 'badge';
      tr.innerHTML=`
        <td>${new Date(s.fecha).toLocaleString('es-CL')}</td>
        <td>${s.origen}</td>
        <td>${s.asunto}</td>
        <td><span class="badge ${est}">${s.estado}</span></td>
        <td class="ta-r">
          <button class="btn btn--gold" data-cerrar="1">Atendida</button>
          <button class="btn btn--ghost">Ver</button>
        </td>
      `;
      t.appendChild(tr);
    });

  t.addEventListener('click', e=>{
    if(!e.target.dataset.cerrar) return;
    const row = e.target.closest('tr');
    const b = row?.querySelector('td:nth-child(4) .badge');
    if (b){ b.textContent = 'Cerrada'; b.className = 'badge'; }
  });
}

// ====== 4) BOOT POR VISTA ====================================================
(function init(){
  document.addEventListener("DOMContentLoaded", () => {
    if ($('#tbl_mov'))          window.pintarIngresos?.();
    if ($('#tbl_reservas'))     pintarReservas();
    if ($('#tbl_solicitudes'))  pintarSolicitudes();

    // activar tabs si existieran
    const file = (location.pathname.split("/").pop() || "").toLowerCase();
    $$(".tabs a.tab").forEach(a=>{
      const href = (a.getAttribute("href")||"").toLowerCase();
      a.classList.toggle("is-active", href.endsWith(file));
      a.setAttribute("aria-selected", a.classList.contains("is-active") ? "true" : "false");
    });

    // año footer (si existe)
    const y = $("#year"); if (y) y.textContent = new Date().getFullYear();
  });
})();
