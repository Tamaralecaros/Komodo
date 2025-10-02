/* Registro simple para KÓMODO (versión validada)
   - Validaciones: campos obligatorios, correo único, teléfono CL, pass >=8 y con número
   - Medidor de fuerza (como antes)
   - Guarda usuarios en localStorage (komodo_users_v1) con pass hasheada (SHA-256 Base64)
   - Tras registrarse, redirige al home (index.html) para iniciar sesión
*/

const $ = (s,c=document)=>c.querySelector(s);

// año dinámico del footer
(function(){ const y=$("#year"); if(y) y.textContent=new Date().getFullYear(); })();

// ----- Modal login mock (por si hay botones con data-open-auth) -----
document.addEventListener("click",(e)=>{
  const open = e.target.closest("[data-open-auth]");
  if(open){ e.preventDefault(); $("#authModal")?.showModal(); }
});

// ================== Medidor de contraseña (igual que antes) ==================
const meterBar = $("#meterBar");
const meterTxt = $("#meterTxt");
const pass     = $("#pass");
const pass2    = $("#pass2");
const toggle   = $("#togglePass");

// medidor muy simple (largo + variedad de chars)
function score(p){
  let s = 0;
  if(!p) return 0;
  if(p.length >= 8) s += 1;
  if(/[A-Z]/.test(p)) s += 1;
  if(/[a-z]/.test(p)) s += 1;
  if(/[0-9]/.test(p)) s += 1;
  if(/[^A-Za-z0-9]/.test(p)) s += 1;
  return Math.min(s,5);
}
function paintMeter(n){
  if(!meterBar || !meterTxt) return;
  const pct = (n/5)*100;
  meterBar.style.width = pct + "%";
  const labels = ["Muy débil","Débil","Media","Buena","Fuerte"];
  meterTxt.textContent = n ? `Fuerza: ${labels[n-1]}` : "Fuerza: —";
}
pass && pass.addEventListener("input", ()=> paintMeter(score(pass.value)));

// ver/ocultar contraseña
toggle && toggle.addEventListener("click", ()=>{
  const showing = pass.type === "text";
  pass.type  = showing ? "password" : "text";
  pass2.type = showing ? "password" : "text";
  toggle.textContent = showing ? "Ver" : "Ocultar";
});

// ================== Validación de teléfono chileno ==================
function cleanPhone(v){ return v.replace(/\s+/g,""); }
function isCLPhone(v){
  const x = cleanPhone(v);
  return /^(\+?56)?9\d{8}$/.test(x); // +56 9 ########
}

// ================== Storage helpers (usuarios) ==================
function getUsers(){
  try { return JSON.parse(localStorage.getItem('komodo_users_v1') || '[]'); }
  catch { return []; }
}
function setUsers(list){
  localStorage.setItem('komodo_users_v1', JSON.stringify(list));
}

// ================== Hash de contraseña (SHA-256 → Base64) ==================
async function hashPass(pwd){
  const data = new TextEncoder().encode(pwd);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

// ================== Envío del formulario ==================
$("#regForm")?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const nombres   = $("#nombres").value.trim();
  const apellidos = $("#apellidos").value.trim();
  const correo    = $("#correo").value.trim().toLowerCase();
  const fono      = $("#fono").value.trim();
  const p1        = pass.value;
  const p2        = pass2.value;
  const tyc       = $("#tyc").checked;

  // validaciones
  if(!nombres || !apellidos) return alert("Completa tus nombres y apellidos 🙂");
  if(!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return alert("Revisa el correo.");
  if(fono && !isCLPhone(fono)) return alert("Formato de teléfono chileno no válido.");
  if(p1.length < 8 || !/\d/.test(p1)) return alert("La contraseña debe tener al menos 8 caracteres y un número.");
  if(p1 !== p2) return alert("Las contraseñas no coinciden.");
  if(!tyc) return alert("Debes aceptar la política de privacidad.");

  // correo único
  const users = getUsers();
  if(users.some(u => (u.correo||"").toLowerCase() === correo)){
    return alert("Ese correo ya tiene cuenta. Inicia sesión.");
  }

  const passHash = await hashPass(p1);
  users.push({
    nombres, apellidos, correo, fono,
    passHash, role: "cliente",
    createdAt: Date.now()
  });
  setUsers(users);

  alert(`¡Listo, ${nombres}! Cuenta creada. Ahora puedes iniciar sesión.`);
  // opción: redirigir al cotizador si prefieres
  location.href = "index.html";
});