/* inventario.js — lógica del módulo Inventario
   Dejo datos mock para probar. Si después conectamos a backend, reemplazamos esto. */

// data “semilla” para que se vea vivo
const INVENTORY = [
  { id: crypto.randomUUID(), name:'Tinte rubio 8.1',   category:'Coloración', stock:12, min:6, unit:'u',  updated:ts(), },
  { id: crypto.randomUUID(), name:'Decolorante azul 500g', category:'Coloración', stock:2,  min:4, unit:'u',  updated:ts(), },
  { id: crypto.randomUUID(), name:'Shampoo neutro 1L', category:'Higiene', stock:0,  min:2, unit:'u',  updated:ts(), },
  { id: crypto.randomUUID(), name:'Tijera filo navaja', category:'Corte', stock:5,  min:1, unit:'u',  updated:ts(), },
  { id: crypto.randomUUID(), name:'Ampolla reconstrucción', category:'Tratamientos', stock:18, min:10, unit:'u', updated:ts(), },
];

// “bandeja” de solicitudes de compra (simple)
const REQUESTS = [];

const $ = (s,c=document)=>c.querySelector(s);
const $$ = (s,c=document)=>[...c.querySelectorAll(s)];

const tblBody = $("#invTable tbody");
const inpSearch = $("#invSearch");
const selCat    = $("#invFilterCat");
const btnAdd    = $("#btnAddProduct");
const btnReqs   = $("#btnViewRequests");

const modalProduct = $("#modalProduct");
const productForm  = $("#productForm");
const modalRequest = $("#modalRequest");
const requestForm  = $("#requestForm");
const modalList    = $("#modalRequestsList");
const requestsContainer = $("#requestsContainer");

// estado de filtros
let filterText = "";
let filterCat  = "";

// dibuja tabla
function render() {
  const rows = INVENTORY
    .filter(p => (filterCat ? p.category===filterCat : true))
    .filter(p => p.name.toLowerCase().includes(filterText.toLowerCase()))
    .map(productRow)
    .join("");

  tblBody.innerHTML = rows || `<tr><td colspan="8" class="muted">No hay resultados</td></tr>`;
}
function productRow(p){
  const state = statusOf(p);
  const badge = state==='ok' ? 'badge--ok'
              : state==='low' ? 'badge--low'
              : 'badge--out';
  const txt   = state==='ok' ? 'OK' : state==='low' ? 'Bajo' : 'Sin stock';

  // botones con data-id para operar
  return `
  <tr data-id="${p.id}">
    <td>${escapeHTML(p.name)}</td>
    <td>${p.category}</td>
    <td>${p.stock}</td>
    <td>${p.min}</td>
    <td>${p.unit||'u'}</td>
    <td><span class="badge ${badge}">${txt}</span></td>
    <td>${p.updated}</td>
    <td>
      <button class="btn btn--ghost" data-edit>Editar</button>
      <button class="btn btn--ghost" data-request>Solicitar</button>
      <button class="btn btn--gold"  data-delete>Eliminar</button>
    </td>
  </tr>`;
}

// lógica de estado (simple)
function statusOf(p){
  if(p.stock<=0) return 'out';
  if(p.stock>0 && p.stock<=p.min) return 'low';
  return 'ok';
}

// eventos de la tabla (delegación)
tblBody.addEventListener("click",(e)=>{
  const tr = e.target.closest("tr[data-id]");
  if(!tr) return;
  const id = tr.dataset.id;
  if(e.target.matches("[data-edit]")){
    openEdit(id);
  }else if(e.target.matches("[data-delete]")){
    if(confirm("¿Eliminar producto?")) removeProduct(id);
  }else if(e.target.matches("[data-request]")){
    openRequest(id);
  }
});

// filtro texto + categoría
inpSearch.addEventListener("input", (e)=>{ filterText = e.target.value.trim(); render(); });
selCat.addEventListener("change", (e)=>{ filterCat = e.target.value; render(); });

// agregar producto
btnAdd.addEventListener("click", ()=>{
  productForm.reset();
  productForm.elements.id.value="";
  $("#modalProductTitle").textContent="Nuevo producto";
  modalProduct.showModal();
});

// guardar (agrega/edita)
productForm.addEventListener("submit", (e)=>{
  e.preventDefault();
  const data = Object.fromEntries(new FormData(productForm));
  const isEdit = !!data.id;
  const payload = {
    id: isEdit ? data.id : crypto.randomUUID(),
    name: data.name.trim(),
    category: data.category,
    stock: Number(data.stock||0),
    min: Number(data.min||0),
    unit: (data.unit||'u').trim(),
    updated: ts(),
  };
  if(!payload.name || !payload.category){ return; }

  if(isEdit){
    const i = INVENTORY.findIndex(x=>x.id===data.id);
    if(i>=0) INVENTORY[i]=payload;
  }else{
    INVENTORY.unshift(payload);
  }
  modalProduct.close();
  render();
});

// abrir edición
function openEdit(id){
  const p = INVENTORY.find(x=>x.id===id); if(!p) return;
  productForm.reset();
  $("#modalProductTitle").textContent="Editar producto";
  productForm.elements.name.value=p.name;
  productForm.elements.category.value=p.category;
  productForm.elements.stock.value=p.stock;
  productForm.elements.min.value=p.min;
  productForm.elements.unit.value=p.unit;
  productForm.elements.id.value=p.id;
  modalProduct.showModal();
}

// eliminar
function removeProduct(id){
  const i = INVENTORY.findIndex(x=>x.id===id);
  if(i>=0) INVENTORY.splice(i,1);
  render();
}

// solicitar compra (abre modal)
function openRequest(id){
  const p = INVENTORY.find(x=>x.id===id); if(!p) return;
  requestForm.reset();
  requestForm.elements.id.value = p.id;
  $("#reqProductLabel").textContent = `Producto: ${p.name} (${p.category})`;
  modalRequest.showModal();
}

// guarda solicitud
requestForm.addEventListener("submit",(e)=>{
  e.preventDefault();
  const data = Object.fromEntries(new FormData(requestForm));
  const p = INVENTORY.find(x=>x.id===data.id);
  if(!p) return;
  REQUESTS.unshift({
    id: crypto.randomUUID(),
    productId: p.id,
    productName: p.name,
    qty: Number(data.qty),
    note: (data.note||'').trim(),
    createdAt: ts(),
  });
  modalRequest.close();
});

// ver bandeja de solicitudes
btnReqs.addEventListener("click", ()=>{
  if(!REQUESTS.length){
    requestsContainer.innerHTML = `<p class="muted">Aún no hay solicitudes. 🍃</p>`;
  }else{
    requestsContainer.innerHTML = REQUESTS.map(r=>`
      <div class="req-item">
        <div>
          <strong>${escapeHTML(r.productName)}</strong>
          <div class="req-item__meta">Cant: ${r.qty} — ${r.note ? escapeHTML(r.note) : 'sin comentario'}</div>
        </div>
        <div class="req-item__meta">${r.createdAt}</div>
      </div>
    `).join("");
  }
  modalList.showModal();
});

// utilidades
function ts(){
  // fecha corta + hora corta (CL)
  return new Date().toLocaleString("es-CL",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"});
}
function escapeHTML(s){ return String(s).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])); }

// primera pintura
render();
