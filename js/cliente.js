/* -------------------------------------------------------
   KÓMODO — Cotizador (Chile) + Confirmación por EmailJS
   - Cortes: lavado opcional (+$1.000 H/Niños, +$2.000 Damas/Niñas)
   - Otros: largo + abundancia + historial
   - Total en vivo
   - Persistencia localStorage
   - Calendario es-CL: Domingos/feriados bloqueados
   - Horarios:
       * Lun–Vie 09:00–17:00 (+17:30 si es corte)
       * Sáb     09:00–15:00 (+15:30 si es corte)
   - Bloques ocupados por día (localStorage)
   - Envío de correo de confirmación con EmailJS
   -------------------------------------------------------

   ⚠️ IMPORTANTE:
   En tu HTML debes cargar EmailJS e inicializar con tu Public Key ANTES de este archivo:
     <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script>
     <script> emailjs.init("TU_PUBLIC_KEY_AQUI"); </script>
     <script src="js/cliente.js"></script>
------------------------------------------------------- */

/* ====== EmailJS Config ====== */
const EMAILJS_SERVICE_ID  = "service_123";      // ✅ tu servicio Gmail ya conectado
const EMAILJS_TEMPLATE_ID = "template_ovmjnro"; // ✅ tu Template ID de confirmación

/* ====== valores base ====== */
const SERVICES = {
  cortes: {
    "Corte hombre": 6000,
    "Corte dama": 8000,
    "Corte niños": 6000,
    "Corte niña": 8000
  },
  alisados: {
    "Alisado básico": 22000,
    "Alisado keratina": 35000,
    "Alisado brasileño": 45000
  },
  color: {
    "Color completo": 28000,
    "Visos (base)": 35000,
    "Balayage (desde hombro)": 38000
  },
  tratamientos: {
    "Hidratación profunda": 15000,
    "Reconstrucción capilar": 20000,
    "Olaplex / premium": 25000
  }
};

// recargos (no aplican a cortes)
const AJUSTE_LARGO = { corto:0, medio:4000, largo:8000, extra:12000 };
const AJUSTE_ABUNDANCIA = { poco:0, normal:2000, mucho:4000 };

/* ====== storage ====== */
const STORAGE_KEY_STATE = "komodo_state_v1";
const STORAGE_KEY_TAKEN = "komodo_taken_v1";   // { "yyyy-mm-dd": ["10:30","11:00"] }
const STORAGE_KEY_MHOL  = "komodo_mobiles_v1"; // ["yyyy-mm-dd",...]

/* ====== estado ====== */
const state = {
  cat:"cortes",
  servicio:null,
  totalBase:0,
  largo:"corto",
  abundancia:"normal",
  historial:"ninguno",
  lavado:false,
  fecha:"", hora:"",
  nombre:"", correo:""
};

/* util corto para seleccionar nodos */
const $ = (s, c=document)=>c.querySelector(s);

/* refs de UI que usamos harto */
const lavadoRow = $("#lavadoRow");
const lavadoCb  = $("#lavado");
const advBox    = $("#advancedFactors");
const live1     = $("#live_total");
const live2     = $("#live_total_s2");

/* ====== utilidades ====== */
const fmtCLP = (n) => {
  try { return Number(n).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }); }
  catch { return `$${(n||0).toLocaleString('es-CL')}`; }
};

/* ====== persistencia simple ====== */
// leemos lo guardado
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY_STATE);
    if(!raw) return;
    Object.assign(state, JSON.parse(raw));
  }catch{}
}
// guardamos cada vez que cambia algo
function saveState(){
  try{ localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state)); }catch{}
}
// mapa de horas tomadas
function getTakenMap(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY_TAKEN) || "{}"); }
  catch{ return {}; }
}
function setTakenMap(map){
  localStorage.setItem(STORAGE_KEY_TAKEN, JSON.stringify(map));
}
function addTaken(dateISO, time){
  const map = getTakenMap();
  if(!map[dateISO]) map[dateISO] = [];
  if(!map[dateISO].includes(time)) map[dateISO].push(time);
  setTakenMap(map);
}

/* ====== lógica de negocio ====== */
function isCuts(){ return state.cat === "cortes"; }

// llenamos el select de servicios según categoría
function fillServices(cat){
  const sel = $("#svcSelect");
  sel.innerHTML = "";
  Object.entries(SERVICES[cat]).forEach(([name, price])=>{
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = `${name} — $${price.toLocaleString("es-CL")}`;
    sel.appendChild(opt);
  });

  // si había algo guardado y existe, lo respetamos
  const first = Object.keys(SERVICES[cat])[0];
  if(state.servicio && SERVICES[cat][state.servicio] != null){
    sel.value = state.servicio;
    state.totalBase = SERVICES[cat][state.servicio];
  }else{
    state.servicio = first;
    state.totalBase = SERVICES[cat][first];
  }

  toggleAdvanced();
  updateLiveTotal();
}

// mostramos/ocultamos factores extra
function toggleAdvanced(){
  if(isCuts()){
    advBox.style.display = "none";
    lavadoRow.style.display = "";
  }else{
    advBox.style.display = "";
    lavadoRow.style.display = "none";
    // al cambiar de categoría limpiamos lavado
    if(lavadoCb){ lavadoCb.checked = false; }
    state.lavado = false;
  }
}

// cuánto suma el lavado según tipo de corte
function lavadoExtra(servName){
  const s = servName.toLowerCase();
  if (s.includes("hombre") || s.includes("niño")) return 1000;
  if (s.includes("dama") || s.includes("niña"))  return 2000;
  return 0;
}

// bloqueo simple por historial (solo no-cortes)
function validarHistorial(servicio, historial){
  const s = servicio.toLowerCase();
  if (s.includes("alisado") && historial === "alisado")
    return "No aplicamos un alisado encima de otro reciente. Necesita evaluación.";
  if ((s.includes("balayage") || s.includes("visos") || s.includes("decolor"))
      && historial === "coloracion")
    return "Decoloración sobre color previo requiere evaluación para no dañar el cabello.";
  return null;
}

// total estimado
function calcularTotal(){
  let total = state.totalBase;
  if(isCuts()){
    if(state.lavado) total += lavadoExtra(state.servicio);
  }else{
    total += (AJUSTE_LARGO[state.largo] || 0);
    total += (AJUSTE_ABUNDANCIA[state.abundancia] || 0);
  }
  return total;
}

// pintamos el total en los dos pasos
function updateLiveTotal(){
  const t = calcularTotal();
  if(live1) live1.textContent = `$${t.toLocaleString("es-CL")}`;
  if(live2) live2.textContent = `$${t.toLocaleString("es-CL")}`;
  saveState();
}

/* ====== eventos (paso 1) ====== */
// cambiar categoría
document.querySelectorAll('input[name="cat"]').forEach(r=>{
  r.addEventListener("change", ()=>{
    state.cat = r.value;
    fillServices(state.cat);
    // si ya está montado el calendario, refrescamos disponibilidad por si cambió a cortes
    if (calMounted) document.dispatchEvent(new Event("renderTimesRefresh"));
  });
});

// cambiar servicio
$("#svcSelect").addEventListener("change", e=>{
  const v = e.target.value;
  state.servicio = v;
  state.totalBase = SERVICES[state.cat][v] || 0;
  updateLiveTotal();
});

// factores extra
$("#largo").addEventListener("change", e=>{ state.largo = e.target.value; updateLiveTotal(); });
$("#abundancia").addEventListener("change", e=>{ state.abundancia = e.target.value; updateLiveTotal(); });
$("#historial").addEventListener("change", e=>{ state.historial = e.target.value; updateLiveTotal(); });

// lavado (solo cortes)
if(lavadoCb){
  lavadoCb.addEventListener("change", e=>{ state.lavado = e.target.checked; updateLiveTotal(); });
}

/* ====== navegación entre pasos ====== */
$("#toStep2").addEventListener("click", ()=>{
  $(".panel.is-active")?.classList.remove("is-active");
  $("#step2").classList.add("is-active");
  moveStep(1);
  updateLiveTotal();
  initNiceCalendar(); // montamos el calendario al entrar
});

$("#back1").addEventListener("click", ()=>{
  $(".panel.is-active")?.classList.remove("is-active");
  $("#step1").classList.add("is-active");
  moveStep(0);
});

$("#toStep3").addEventListener("click", ()=>{
  const f = $("#fecha").value;
  const h = $("#hora").value;
  if(!f || !h) return alert("Completa fecha y hora 🙂");
  state.fecha = f; state.hora = h;

  // si no es corte, validamos historial
  if(!isCuts()){
    const bloqueo = validarHistorial(state.servicio, state.historial);
    if(bloqueo){ alert(bloqueo); return; }
  }

  // pintar resumen
  $("#r_servicio").textContent = `${state.servicio} (${state.cat})`;
  $("#r_largo_li").style.display = isCuts() ? "none" : "";
  $("#r_abun_li").style.display  = isCuts() ? "none" : "";
  $("#r_hist_li").style.display  = isCuts() ? "none" : "";
  $("#r_lavado_li").style.display = (isCuts() && state.lavado) ? "" : "none";

  $("#r_largo").textContent = state.largo;
  $("#r_abun").textContent  = state.abundancia;
  $("#r_hist").textContent  = state.historial === "ninguno" ? "Ninguno" : state.historial;
  $("#r_lavado").textContent = state.lavado ? "Sí" : "No";
  $("#r_fecha").textContent = niceDate(state.fecha);
  $("#r_hora").textContent  = state.hora;
  $("#r_total").textContent = `$${calcularTotal().toLocaleString("es-CL")}`;

  $(".panel.is-active")?.classList.remove("is-active");
  $("#step3").classList.add("is-active");
  moveStep(2);
  saveState();
});

$("#back2").addEventListener("click", ()=>{
  $(".panel.is-active")?.classList.remove("is-active");
  $("#step2").classList.add("is-active");
  moveStep(1);
});

/* ====== EmailJS: envío confirmación ====== */
/**
 * Envía correo de confirmación de reserva vía EmailJS
 * Variables esperadas en tu plantilla:
 *   {{to_name}}, {{to_email}}, {{servicio}}, {{fecha}}, {{hora}}, {{total}}
 */
async function enviarCorreoConfirmacion(datos) {
  const req = ["to_name","to_email","servicio","fecha","hora","total"];
  for (const k of req) {
    if (!datos[k]) throw new Error(`Falta el campo obligatorio: ${k}`);
  }

  const templateParams = {
    to_name:  datos.to_name,
    to_email: datos.to_email,
    servicio: datos.servicio,
    fecha:    datos.fecha,
    hora:     datos.hora,
    total:    typeof datos.total === "number" ? fmtCLP(datos.total) : datos.total
  };

  // devuelve la promesa de EmailJS
  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
}

/* ====== envío final (Step 3) ====== */
$("#step3").addEventListener("submit", async (e)=>{
  e.preventDefault();
  state.nombre = $("#nombre").value.trim();
  state.correo = $("#correo").value.trim();
  if(!state.nombre || !state.correo) return alert("Completa tu nombre y correo 😊");

  // bloqueamos la hora elegida localmente (independiente del email)
  if(state.fecha && state.hora) addTaken(state.fecha, state.hora);

  // UI: deshabilitar mientras se envía
  const submitBtn = $("#btn-confirmar-reserva") || $("#step3 button[type='submit']");
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Enviando correo..."; }

  try{
    await enviarCorreoConfirmacion({
      to_name: state.nombre,
      to_email: state.correo,
      servicio: state.servicio,
      fecha: state.fecha,
      hora: state.hora,
      total: calcularTotal()
    });

    alert(`¡Listo, ${state.nombre}! Te enviamos un correo a ${state.correo} con el detalle de tu reserva.`);
  }catch(err){
    console.error("EmailJS error:", err);
    alert(`Registramos tu reserva, pero no pudimos enviar el correo.\nDetalle: ${err?.message || err}`);
  }finally{
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Confirmar"; }
    saveState();
  }
});

/* ====== util de UI/fechas ====== */
function moveStep(idx){
  document.querySelectorAll(".steps li")
    .forEach((li,i)=> li.classList.toggle("is-active", i <= idx));
}
function niceDate(iso){
  try{
    return new Date(iso+"T00:00:00").toLocaleDateString("es-CL",
      {weekday:"long", day:"2-digit", month:"long"});
  }catch{ return iso; }
}
function capitalize(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
function addDays(d, n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function isoDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function isSameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function isBefore(a,b){ return a.setHours(0,0,0,0) < b.setHours(0,0,0,0); }
function isAfter(a,b){ return a.setHours(0,0,0,0) > b.setHours(0,0,0,0); }

/* ====== calendario (bloquea domingos y feriados CL) ====== */
let calMounted = false;

function initNiceCalendar(){
  if(calMounted) return;
  calMounted = true;

  const monthEl = $("#calMonth");
  const yearEl  = $("#calYear");
  const gridEl  = $("#calGrid");
  const timesTitle = $("#timesTitle");
  const timesList  = $("#timesList");
  const prevBtn = $("#calPrev");
  const nextBtn = $("#calNext");

  const today = new Date();
  let view = new Date(today.getFullYear(), today.getMonth(), 1);
  const maxDate = addDays(today, 60);
  let selectedDate = null;
  let selectedTime = null;

  // genera slots según día + categoría
  function buildSlots(date){
    const slots = [];
    const step = 30;
    const startHour = 9;
    const dow = date.getDay(); // 0=Dom..6=Sáb

    // domingo o feriado = no atendemos
    if (dow === 0 || isChileanHoliday(date)) return slots;

    const isSaturday = (dow === 6);
    const endHour = isSaturday ? 15 : 17;
    const allowHalfPast = (state.cat === "cortes"); // cortes pueden tomar :30 al final

    for (let h = startHour; h <= endHour; h++){
      for (let m = 0; m < 60; m += step){
        if (h === endHour && m > 0 && !(allowHalfPast && m === 30)) continue;
        const hh = String(h).padStart(2,"0");
        const mm = String(m).padStart(2,"0");
        slots.push(`${hh}:${mm}`);
      }
    }

    // sacamos ocupadas
    const map = getTakenMap();
    const iso = isoDate(date);
    const taken = new Set(map[iso] || []);
    return slots.filter(t => !taken.has(t));
  }

  function render(){
    const monthFmt = new Intl.DateTimeFormat("es-CL", { month: "long" });
    monthEl.textContent = capitalize(monthFmt.format(view));
    yearEl.textContent  = view.getFullYear();

    gridEl.innerHTML = "";
    const firstDow = mondayFirst(view);
    const daysInMonth = new Date(view.getFullYear(), view.getMonth()+1, 0).getDate();

    // relleno mes anterior
    const prevDays = new Date(view.getFullYear(), view.getMonth(), 0).getDate();
    for(let i=0; i<firstDow; i++){
      const n = prevDays - firstDow + 1 + i;
      gridEl.appendChild(dayBtn(n, true, null));
    }

    // mes actual
    for(let d=1; d<=daysInMonth; d++){
      const date = new Date(view.getFullYear(), view.getMonth(), d);
      const disabled =
        isBefore(date, today) ||
        isAfter(date, maxDate) ||
        date.getDay() === 0 ||
        isChileanHoliday(date);
      gridEl.appendChild(dayBtn(d, false, date, disabled));
    }

    // completar filas
    const cells = gridEl.children.length;
    const rest = (Math.ceil(cells/7)*7) - cells;
    for(let i=1; i<=rest; i++){
      gridEl.appendChild(dayBtn(i, true, null));
    }

    renderTimes();
  }

  function dayBtn(label, muted=false, date=null, disabled=false){
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cal__day";
    b.textContent = label;

    if(muted){ b.classList.add("cal__day--muted"); b.disabled = true; }
    if(disabled){ b.classList.add("cal__day--disabled"); b.disabled = true; }

    if(date){
      if(isSameDay(date, new Date())) b.classList.add("cal__day--today");
      if(selectedDate && isSameDay(date, selectedDate)) b.classList.add("cal__day--selected");

      b.addEventListener("click", ()=>{
        selectedDate = date;
        selectedTime = null;
        $("#fecha").value = isoDate(selectedDate);
        $("#hora").value  = "";
        render(); // repintamos para marcar selección
      });
    }
    return b;
  }

  function renderTimes(){
    timesList.innerHTML = "";
    if(!selectedDate){
      timesTitle.textContent = "Selecciona un día";
      return;
    }
    const longFmt = new Intl.DateTimeFormat("es-CL", { weekday:"long", day:"2-digit", month:"long" });
    timesTitle.textContent = capitalize(longFmt.format(selectedDate));

    const slots = buildSlots(selectedDate);
    if(slots.length === 0){
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = "No hay atención este día.";
      timesList.appendChild(p);
      return;
    }
    slots.forEach(t=>{
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "times__btn";
      btn.textContent = t;
      if(selectedTime === t) btn.classList.add("is-active");
      btn.addEventListener("click", ()=>{
        selectedTime = t;
        $("#hora").value = t;
        document.querySelectorAll(".times__btn.is-active").forEach(x=>x.classList.remove("is-active"));
        btn.classList.add("is-active");
        saveState();
      });
      timesList.appendChild(btn);
    });
  }

  $("#calPrev").addEventListener("click", ()=>{ view = new Date(view.getFullYear(), view.getMonth()-1, 1); render(); });
  $("#calNext").addEventListener("click", ()=>{ view = new Date(view.getFullYear(), view.getMonth()+1, 1); render(); });

  // si cambia categoría (cortes ↔ no cortes), recalculamos horas
  document.addEventListener("renderTimesRefresh", ()=>{
    if (typeof selectedDate !== "undefined" && selectedDate) {
      renderTimes();
    }
  });

  render();

  // si había fecha/hora guardadas, intentamos restaurar
  if(state.fecha){
    const d = new Date(state.fecha + "T00:00:00");
    if(!isNaN(d)) {
      selectedDate = d;
      $("#fecha").value = state.fecha;
      render();
      if(state.hora){
        const btn = Array.from(document.querySelectorAll(".times__btn")).find(b=>b.textContent===state.hora);
        if(btn){ btn.click(); }
      }
    }
  }
}

/* lunes primero en el calendario */
function mondayFirst(date){
  const jsDow = new Date(date.getFullYear(), date.getMonth(), 1).getDay(); // 0=Dom..6=Sáb
  return (jsDow + 6) % 7; // Lun=0
}

/* ====== feriados chilenos ====== */
const HOLIDAY_CACHE = {};
function fixedHolidaysFor(year){
  // fijos (básicos, basta para la maqueta)
  const md = [
    "01-01","05-01","05-21","06-29","07-16","08-15",
    "09-18","09-19","10-12","10-31","11-01","12-08","12-25"
  ];
  return md.map(x => `${year}-${x}`);
}

// domingo de pascua (Meeus/Jones/Butcher)
function easterSunday(year){
  const a = year % 19;
  const b = Math.floor(year/100);
  const c = year % 100;
  const d = Math.floor(b/4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19*a + b - d - g + 15) % 30;
  const i = Math.floor(c/4);
  const k = c % 4;
  const l = (32 + 2*e + 2*i - h - k) % 7;
  const m = Math.floor((a + 11*h + 22*l) / 451);
  const month = Math.floor((h + l - 7*m + 114) / 31);
  const day   = ((h + l - 7*m + 114) % 31) + 1;
  return new Date(year, month-1, day);
}

function getMobileHolidaysFor(year){
  // móviles definidos por admin (si hay)
  let mobiles = [];
  try{ mobiles = JSON.parse(localStorage.getItem(STORAGE_KEY_MHOL) || "[]"); }catch{}

  // agregamos Viernes y Sábado Santo auto
  const easter = easterSunday(year);
  const holySat = addDays(easter, -1);
  const goodFri = addDays(easter, -2);
  const auto = [ isoDate(goodFri), isoDate(holySat) ];

  return [...new Set([...mobiles.filter(x => x.startsWith(`${year}-`)), ...auto])];
}

function isChileanHoliday(date){
  const y = date.getFullYear();
  if (!HOLIDAY_CACHE[y]) {
    const fixed = fixedHolidaysFor(y);
    const mobiles = getMobileHolidaysFor(y);
    HOLIDAY_CACHE[y] = new Set([...fixed, ...mobiles]);
  }
  return HOLIDAY_CACHE[y].has(isoDate(date));
}

/* ====== bootstrap ====== */
(function bootstrap(){
  loadState();

  // set categoría inicial en los radios
  const catRadio = document.querySelector(`input[name="cat"][value="${state.cat}"]`);
  if(catRadio) catRadio.checked = true;

  // pintamos servicios y valores
  fillServices(state.cat);

  // restauramos selects
  const lSel = $("#largo"); if(lSel) lSel.value = state.largo;
  const aSel = $("#abundancia"); if(aSel) aSel.value = state.abundancia;
  const hSel = $("#historial"); if(hSel) hSel.value = state.historial;

  // lavado guardado
  if(isCuts() && lavadoCb){ lavadoCb.checked = !!state.lavado; }

  updateLiveTotal();
})();