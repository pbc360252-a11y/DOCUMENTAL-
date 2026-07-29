// SGD CORAZA v7.4 SECURE - CLIENTE WEB (FETCH ENGINE)

const API_BASE = window.location.origin;
let currentUser = null;
let currentFolderId = 'RAIZ';
let cacheArbol = { carpetas: [], archivos: [] };

// Helper Central de Peticiones HTTP
async function apiCall(endpoint, method = 'GET', body = null) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }
  try {
    const response = await fetch(API_BASE + endpoint, options);
    const data = await response.json();
    if (response.status === 401 || response.status === 403) {
      cerrarSesion();
      Swal.fire('Sesión Caducada', 'Por favor inicia sesión de nuevo.', 'warning');
      throw new Error('Sesión no autorizada');
    }
    return data;
  } catch(e) {
    console.error(`Error en API ${endpoint}:`, e);
    throw e;
  }
}

// ==========================================
// 1. MANEJO DE SESIÓN Y LOGIN
// ==========================================

async function iniciarSesion(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const errorDiv = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  errorDiv.classList.add('hidden');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AUTENTICANDO...';

  try {
    const res = await apiCall('/api/auth/login', 'POST', { email, password });
    if (res.success) {
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      currentUser = res.user;
      
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('mainApp').classList.remove('hidden');
      document.getElementById('chatFab').classList.remove('hidden');
      
      cargarInfoUsuario();
      iniciarClocksYPolling();
      cargarTodoElSistema();
    } else {
      errorDiv.textContent = res.message || 'Error de inicio de sesión';
      errorDiv.classList.remove('hidden');
    }
  } catch(err) {
    errorDiv.textContent = '❌ Sin conexión con el servidor Node.js';
    errorDiv.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> ACCEDER AL SISTEMA';
  }
}

function verificarTokenActivo() {
  const token = localStorage.getItem('token');
  const savedUser = localStorage.getItem('user');
  if (token && savedUser) {
    currentUser = JSON.parse(savedUser);
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('chatFab').classList.remove('hidden');
    cargarInfoUsuario();
    iniciarClocksYPolling();
    cargarTodoElSistema();
  }
}

function cerrarSesion() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  currentUser = null;
  document.getElementById('mainApp').classList.add('hidden');
  document.getElementById('chatFab').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}

function cargarInfoUsuario() {
  if (!currentUser) return;
  document.getElementById('userName').textContent = currentUser.nombre;
  document.getElementById('userRole').textContent = currentUser.rol;
  document.getElementById('userAv').textContent = currentUser.nombre.substring(0,1).toUpperCase();
}

// ==========================================
// 2. CONFIGURACIÓN E INICIALIZACIÓN
// ==========================================

const DEPTOS_MOCK = [
  { sigla: 'GH', nombre: 'Gestión Humana' },
  { sigla: 'OP', nombre: 'Operaciones' },
  { sigla: 'CM', nombre: 'Comercial' },
  { sigla: 'CP', nombre: 'Compras' },
  { sigla: 'GE', nombre: 'Gerencia' },
  { sigla: 'ST', nombre: 'SST' },
  { sigla: 'GF', nombre: 'Gestión Financiera' },
  { sigla: 'SE', nombre: 'Seguridad Electrónica' },
  { sigla: 'DJ', nombre: 'Jurídico' },
  { sigla: 'SP', nombre: 'Supervisión' },
  { sigla: 'CE', nombre: 'Cliente Externo' },
  { sigla: 'AS', nombre: 'Asociados' }
];

const MAPA_TRD_DEPTOS = {
  GE: [
    { val: '100-10.01', label: '100-10.01 — GERENCIA / Cartas y Comunicaciones (10 Años C.Co 60)' },
    { val: '100-10.02', label: '100-10.02 — GERENCIA / Actas y Resoluciones (Histórico)' }
  ],
  GH: [{ val: '200-20.01', label: '200-20.01 — GESTION HUMANA / Historias Laborales y Expedientes (20 Años Ley 594)' }],
  ST: [{ val: '210-21.01', label: '210-21.01 — SST / SG-SST y Exámenes Médicos Ocupacionales (20 Años Dec. 1072)' }],
  GF: [{ val: '300-30.01', label: '300-30.01 — FINANCIERA / Comprobantes y Facturas Contables (10 Años Ley 527)' }],
  CP: [{ val: '310-30.01', label: '310-30.01 — COMPRAS / Comprobantes y Facturas (10 Años C.Co)' }],
  CM: [{ val: '320-30.01', label: '320-30.01 — COMERCIAL / Comprobantes y Facturas (10 Años C.Co)' }],
  OP: [{ val: '400-40.01', label: '400-40.01 — OPERACIONES / Minutas y Reportes Operativos (5 Años AGN)' }],
  SE: [{ val: '410-40.01', label: '410-40.01 — SEGURIDAD ELECTRONICA / Informes Técnicos de Puesto' }],
  SP: [{ val: '420-42.01', label: '420-42.01 — SUPERVISION / Informes de Ronda y Control (Continuidad)' }],
  DJ: [{ val: '500-50.01', label: '500-50.01 — JURIDICO / Contratos y Convenios (20 Años Ley 80)' }],
  CE: [{ val: '900-10.01', label: '900-10.01 — CLIENTE EXTERNO / Cartas y Comunicaciones Oficiales' }],
  AS: [{ val: '910-10.01', label: '910-10.01 — ASOCIADOS / Cartas y Comunicaciones CTA' }]
};

function popularSelectsConfig() {
  const deptoOrigen = document.getElementById('deptoOrigen');
  const deptoDestino = document.getElementById('deptoDestino');
  const deptoPrestamo = document.getElementById('deptoPrestamo');
  const uDepto = document.getElementById('uDepto');

  const opciones = DEPTOS_MOCK.map(d => `<option value="${d.sigla}">${d.nombre} (${d.sigla})</option>`).join('');
  
  if(deptoOrigen) deptoOrigen.innerHTML = opciones;
  if(deptoDestino) deptoDestino.innerHTML = '<option value="">Ninguno</option>' + opciones;
  if(deptoPrestamo) deptoPrestamo.innerHTML = opciones;
  if(uDepto) uDepto.innerHTML = opciones;

  // Llenar selectores de ubicaciones físicas (Voxelsera)
  const voxels = ['VOXEL_A1', 'VOXEL_A2', 'VOXEL_B1', 'VOXEL_B2', 'VOXEL_C1', 'VOXEL_C2', 'VOXEL_D1', 'VOXEL_D2'];
  const voxelOptions = voxels.map(v => `<option value="${v}">${v}</option>`).join('');
  
  document.getElementById('voxelseraMinuta').innerHTML = voxelOptions;
  document.getElementById('voxelseraPersonal').innerHTML = voxelOptions;
  document.getElementById('voxelseraContrato').innerHTML = voxelOptions;

  // Selectores de biblioteca
  document.getElementById('catBib').innerHTML = '<option value="POLITICAS">Políticas</option><option value="MANUALES">Manuales</option><option value="REGISTROS">Registros</option>';
  
  actualizarSeriesTRD();
}

function actualizarSeriesTRD() {
  const depSelect = document.getElementById('deptoOrigen');
  const serieSelect = document.getElementById('serieTRD');
  if(!depSelect || !serieSelect) return;
  const depKey = depSelect.value || 'GE';
  
  const opciones = MAPA_TRD_DEPTOS[depKey] || [
    { val: '100-10.01', label: '100-10.01 — GERENCIA / Cartas y Comunicaciones' }
  ];
  
  serieSelect.innerHTML = opciones.map(o => `<option value="${o.val}">${o.label}</option>`).join('');
  generarCodigoDoc();
}

async function generarCodigoDoc() {
  const d = document.getElementById('deptoOrigen');
  const s = document.getElementById('serieTRD').value;
  if (s) {
    const parts = s.split('-');
    const depCode = parts[0];
    const serieSub = parts[1] || '';
    const subparts = serieSub.split('.');
    const serieCode = subparts[0];
    const subserieCode = subparts[1] || '';
    const depSigla = d ? d.value : 'GE';

    try {
      const res = await apiCall('/api/correspondencia/codigo-trd', 'POST', { depSigla, depCode, serieCode, subserieCode });
      if (res.success) {
        document.getElementById('codigoDocumento').value = res.codigo;
      }
    } catch(e) {
      document.getElementById('codigoDocumento').value = 'Error al calcular';
    }
  }
}

// ==========================================
// 3. REGISTROS (MINUTAS, CORRESPONDENCIA, ETC)
// ==========================================

async function registrarCorrespondencia(e) {
  e.preventDefault();
  const sVal = document.getElementById('serieTRD').value;
  const parts = sVal.split('-');
  const depCode = parts[0];
  const serieSub = parts[1] || '';
  const subparts = serieSub.split('.');
  const serieCode = subparts[0];
  const subserieCode = subparts[1] || '';

  const data = {
    fecha: document.getElementById('fechaDocumento').value,
    medio: document.getElementById('medio').value,
    tipo: document.getElementById('tipoDocumento').value.trim(),
    deptoOrigen: document.getElementById('deptoOrigen').value,
    deptoDestino: document.getElementById('deptoDestino').value,
    estado: document.getElementById('estadoDocumento').value,
    codigo: document.getElementById('codigoDocumento').value,
    depCode, serieCode, subserieCode,
    asunto: document.getElementById('asunto').value.trim(),
    detalle: document.getElementById('detalle').value.trim()
  };

  try {
    const res = await apiCall('/api/correspondencia', 'POST', data);
    if (res.success) {
      mostrarModalConfirmacion('✅ CORRESPONDENCIA REGISTRADA', res.codigo, 'Trazabilidad y consecutivos integrados en SQL.');
      resetFormCorr();
      cargarCorrespondencia();
      cargarDashboard();
    }
  } catch(e) {
    Swal.fire('Error', 'No se pudo registrar la correspondencia.', 'error');
  }
}

async function registrarMinuta(e) {
  e.preventDefault();
  const data = {
    tipoMinuta: document.getElementById('tipoMinuta').value,
    nombrePuesto: document.getElementById('nombrePuesto').value.trim(),
    fechaInicio: document.getElementById('fechaInicioMinuta').value,
    fechaCierre: document.getElementById('fechaCierreMinuta').value,
    observaciones: document.getElementById('observacionesMinuta').value.trim()
  };

  try {
    const res = await apiCall('/api/minutas', 'POST', data);
    if (res.success) {
      mostrarModalConfirmacion('✅ MINUTA REGISTRADA', res.codigoUnico, 'Puesto y minuta enlazados correctamente.');
      document.getElementById('nombrePuesto').value = '';
      document.getElementById('observacionesMinuta').value = '';
    }
  } catch(e) {
    Swal.fire('Error', 'No se pudo registrar la minuta.', 'error');
  }
}

async function registrarPersonal(e) {
  e.preventDefault();
  const data = {
    tipoPersona: document.getElementById('tipoPersona') ? document.getElementById('tipoPersona').value : 'EMPLEADO',
    nombre: document.getElementById('nombrePersonal').value.trim(),
    cedula: document.getElementById('cedula').value.trim(),
    fechaBaja: document.getElementById('fechaBaja').value,
    motivo: document.getElementById('motivoBaja').value.trim(),
    observaciones: document.getElementById('observacionesPersonal').value.trim()
  };

  try {
    const res = await apiCall('/api/personal-inactivo', 'POST', data);
    if (res.success) {
      mostrarModalConfirmacion('✅ PERSONAL INACTIVO REGISTRADO', `ID: ${res.codigo}`, 'Expediente digital guardado en el archivo central.');
      document.getElementById('nombrePersonal').value = '';
      document.getElementById('cedula').value = '';
      document.getElementById('observacionesPersonal').value = '';
      cargarPersonal();
    }
  } catch(e) {
    Swal.fire('Error', 'No se pudo registrar al personal.', 'error');
  }
}

// ==========================================
// LISTADO Y FILTRADO DE PERSONAL INACTIVO / ASOCIADOS
// ==========================================

let listPersonal = [];
let persPage = 1;
const persLimit = 25;
let persFiltroTipo = 'TODOS';
let persQuery = '';

async function cargarPersonal() {
  const listDiv = document.getElementById('listaPersonal');
  if (!listDiv) return;
  listDiv.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> Cargando personal desde PostgreSQL...</div>';
  try {
    const res = await apiCall('/api/personal-inactivo');
    if (res.success) {
      listPersonal = res.datos;
      renderPersonalStats();
      renderPersonal();
    }
  } catch(e) {
    listDiv.innerHTML = '<div class="alert alert-danger">❌ Error de conexión al servidor backend</div>';
  }
}

function renderPersonalStats() {
  const statsDiv = document.getElementById('statsPersonal');
  if (!statsDiv) return;
  const total = listPersonal.length;
  const empleados = listPersonal.filter(p => (p.tipo_persona || 'EMPLEADO') === 'EMPLEADO').length;
  const asociados = listPersonal.filter(p => p.tipo_persona === 'ASOCIADO').length;

  statsDiv.innerHTML = `
    <div style="background:var(--bg-elevated);padding:8px 14px;border-radius:var(--r-md);border:1px solid var(--border-medium);font-size:0.82rem">
      <span style="color:var(--text-muted)">Total Registros:</span> <strong style="color:var(--accent-primary)">${total}</strong>
    </div>
    <div style="background:var(--bg-elevated);padding:8px 14px;border-radius:var(--r-md);border:1px solid var(--border-medium);font-size:0.82rem">
      <span style="color:var(--text-muted)">👷 Empleados:</span> <strong style="color:var(--accent-cyan)">${empleados}</strong>
    </div>
    <div style="background:var(--bg-elevated);padding:8px 14px;border-radius:var(--r-md);border:1px solid var(--border-medium);font-size:0.82rem">
      <span style="color:var(--text-muted)">🤝 Asociados:</span> <strong style="color:var(--accent-gold)">${asociados}</strong>
    </div>
  `;
}

function filtrarPersonalTipo(tipo) {
  persFiltroTipo = tipo;
  persPage = 1;

  ['btnFiltroTodos', 'btnFiltroEmpleado', 'btnFiltroAsociado'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.className = 'btn btn-sm btn-ghost';
    }
  });

  if (tipo === 'TODOS') document.getElementById('btnFiltroTodos').className = 'btn btn-sm btn-primary';
  if (tipo === 'EMPLEADO') document.getElementById('btnFiltroEmpleado').className = 'btn btn-sm btn-primary';
  if (tipo === 'ASOCIADO') document.getElementById('btnFiltroAsociado').className = 'btn btn-sm btn-primary';

  renderPersonal();
}

function buscarPersonal() {
  persQuery = (document.getElementById('searchPersonal')?.value || '').trim().toLowerCase();
  persPage = 1;
  renderPersonal();
}

function renderPersonal() {
  const listDiv = document.getElementById('listaPersonal');
  if (!listDiv) return;

  let filtrados = listPersonal.filter(p => {
    const tipo = p.tipo_persona || 'EMPLEADO';
    if (persFiltroTipo !== 'TODOS' && tipo !== persFiltroTipo) return false;
    if (persQuery) {
      const matchNom = String(p.nombre_completo || '').toLowerCase().includes(persQuery);
      const matchCed = String(p.cedula || '').toLowerCase().includes(persQuery);
      const matchMot = String(p.motivo_baja || '').toLowerCase().includes(persQuery);
      if (!matchNom && !matchCed && !matchMot) return false;
    }
    return true;
  });

  const total = filtrados.length;
  const paginas = Math.ceil(total / persLimit) || 1;
  if (persPage > paginas) persPage = paginas;

  const pagInfo = document.getElementById('persPagInfo');
  if (pagInfo) pagInfo.textContent = `Pág. ${persPage} de ${paginas} (${total} total)`;
  
  const prevBtn = document.getElementById('persPrev');
  if (prevBtn) prevBtn.disabled = persPage === 1;
  const nextBtn = document.getElementById('persNext');
  if (nextBtn) nextBtn.disabled = persPage === paginas;

  const start = (persPage - 1) * persLimit;
  const pageData = filtrados.slice(start, start + persLimit);

  if (pageData.length === 0) {
    listDiv.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)">No hay registros de personal que coincidan con el filtro.</div>';
    return;
  }

  let html = `
    <div class="table-wrap">
      <table id="tablaPersonal">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Nombre Completo</th>
            <th>Cédula</th>
            <th>Fecha Baja</th>
            <th>Motivo</th>
            <th>Ubicación</th>
            <th>Cambiar Clasificación</th>
          </tr>
        </thead>
        <tbody>
  `;

  pageData.forEach(p => {
    const tipo = p.tipo_persona || 'EMPLEADO';
    const badge = tipo === 'ASOCIADO' 
      ? '<span class="badge" style="background:rgba(234,179,8,0.15);color:var(--accent-gold);border:1px solid var(--accent-gold)">🤝 ASOCIADO</span>'
      : '<span class="badge badge-info">👷 EMPLEADO</span>';

    const fechaBaja = p.fecha_baja ? String(p.fecha_baja).substring(0, 10) : '--';

    html += `
      <tr>
        <td>${badge}</td>
        <td style="font-weight:600">${p.nombre_completo}</td>
        <td style="color:var(--accent-primary);font-weight:700">${p.cedula}</td>
        <td>${fechaBaja}</td>
        <td>${p.motivo_baja || '--'}</td>
        <td>${p.voxelsera ? `<span class="badge badge-violet">${p.voxelsera}</span>` : '--'}</td>
        <td>
          <select class="inp" style="padding:3px 8px;font-size:0.75rem;width:auto" onchange="cambiarTipoPersonaFila('${p.id}', this.value)">
            <option value="EMPLEADO" ${tipo === 'EMPLEADO' ? 'selected' : ''}>👷 EMPLEADO</option>
            <option value="ASOCIADO" ${tipo === 'ASOCIADO' ? 'selected' : ''}>🤝 ASOCIADO</option>
          </select>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  listDiv.innerHTML = html;
}

function cambiarPaginaPers(dir) {
  persPage += dir;
  renderPersonal();
}

async function cambiarTipoPersonaFila(id, nuevoTipo) {
  try {
    const res = await apiCall(`/api/personal-inactivo/${id}/tipo`, 'PUT', { tipoPersona: nuevoTipo });
    if (res.success) {
      const item = listPersonal.find(p => p.id === id);
      if (item) item.tipo_persona = nuevoTipo;
      renderPersonalStats();
      renderPersonal();
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `Clasificado como ${nuevoTipo}`, showConfirmButton: false, timer: 1500 });
    }
  } catch(e) {
    Swal.fire('Error', 'No se pudo actualizar la clasificación', 'error');
  }
}

async function registrarContrato(e) {
  e.preventDefault();
  const data = {
    tipo: document.getElementById('tipoContrato').value.trim(),
    numero: document.getElementById('numeroContrato').value.trim(),
    parteA: document.getElementById('parteA').value.trim(),
    parteB: document.getElementById('parteB').value.trim(),
    fechaInicio: document.getElementById('fechaInicioContrato').value,
    fechaFin: document.getElementById('fechaFinContrato').value,
    valor: document.getElementById('valorContrato').value,
    objeto: document.getElementById('objetoContrato').value.trim()
  };

  try {
    const res = await apiCall('/api/contratos', 'POST', data);
    if (res.success) {
      mostrarModalConfirmacion('✅ CONTRATO REGISTRADO', `CTR-${res.codigo}`, 'Contrato archivado. Si supera $1M se creó workflow de aprobación.');
      document.getElementById('tipoContrato').value = '';
      document.getElementById('numeroContrato').value = '';
      document.getElementById('parteA').value = '';
      document.getElementById('parteB').value = '';
      document.getElementById('valorContrato').value = '';
      document.getElementById('objetoContrato').value = '';
      cargarWorkflows();
    }
  } catch(e) {
    Swal.fire('Error', 'No se pudo registrar el contrato.', 'error');
  }
}

async function registrarPrestamo(e) {
  e.preventDefault();
  const data = {
    solicitante: document.getElementById('solicitantePrestamo').value.trim(),
    departamento: document.getElementById('deptoPrestamo').value,
    documento: document.getElementById('docPrestamo').value.trim(),
    codigo: document.getElementById('codDocPrestamo').value.trim(),
    fechaPrestamo: document.getElementById('fechaPrestamo').value,
    fechaDevolucion: document.getElementById('fechaDevPrestamo').value
  };

  try {
    const res = await apiCall('/api/prestamos', 'POST', data);
    if (res.success) {
      mostrarModalConfirmacion('✅ PRÉSTAMO REGISTRADO', 'EXITOSO', 'Alerta de vencimiento programada.');
      resetFormPrestamo();
      cargarPrestamos();
    }
  } catch(e) {
    Swal.fire('Error', 'No se pudo registrar el préstamo.', 'error');
  }
}

// ==========================================
// 4. CARGA DE LISTAS Y RENDERS
// ==========================================

let listCorr = [];
let corrPage = 1;
const corrLimit = 25;

async function cargarCorrespondencia() {
  const listDiv = document.getElementById('listaCorrespondencia');
  listDiv.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> Cargando datos desde PostgreSQL...</div>';
  try {
    const res = await apiCall('/api/correspondencia');
    if (res.success) {
      listCorr = res.datos;
      popularFiltroOrigenesCorr();
      renderCorr();
    }
  } catch(e) {
    listDiv.innerHTML = '<div class="alert alert-danger">❌ Error de conexión al servidor backend</div>';
  }
}

function popularFiltroOrigenesCorr() {
  const oSelect = document.getElementById('filtroCorrOrigen');
  if(!oSelect) return;
  const set = new Set();
  listCorr.forEach(c => { if(c.depto_origen) set.add(c.depto_origen); });
  
  let options = '<option value="todos">Todos orígenes</option>';
  set.forEach(o => {
    options += `<option value="${o}">${o}</option>`;
  });
  oSelect.innerHTML = options;
}

function renderCorr() {
  const listDiv = document.getElementById('listaCorrespondencia');
  
  const fDesde = document.getElementById('filtroCorrDesde').value;
  const fHasta = document.getElementById('filtroCorrHasta').value;
  const fOrig = document.getElementById('filtroCorrOrigen').value;
  const fEst = document.getElementById('filtroCorrEstado').value;

  let filtrados = listCorr.filter(c => {
    if (fDesde && c.fecha_documento.substring(0, 10) < fDesde) return false;
    if (fHasta && c.fecha_documento.substring(0, 10) > fHasta) return false;
    if (fOrig !== 'todos' && c.depto_origen !== fOrig) return false;
    if (fEst !== 'todos' && c.estado !== fEst) return false;
    return true;
  });

  const total = filtrados.length;
  const paginas = Math.ceil(total / corrLimit) || 1;
  if(corrPage > paginas) corrPage = paginas;

  document.getElementById('corrPagInfo').textContent = `Pág. ${corrPage} de ${paginas} (${total} total)`;
  document.getElementById('corrPrev').disabled = corrPage === 1;
  document.getElementById('corrNext').disabled = corrPage === paginas;

  const start = (corrPage - 1) * corrLimit;
  const pageData = filtrados.slice(start, start + corrLimit);

  if (pageData.length === 0) {
    listDiv.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)">Ninguna correspondencia coincide con los filtros.</div>';
    return;
  }

  let html = `
    <div class="table-wrap">
      <table id="tablaCorr">
        <thead>
          <tr>
            <th>Radicado</th>
            <th>Fecha Documento</th>
            <th>Medio</th>
            <th>Tipo</th>
            <th>Origen</th>
            <th>Destino</th>
            <th>Asunto</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
  `;

  pageData.forEach(c => {
    let badgeClass = 'badge-pending';
    if(c.estado === 'ENVIADO') badgeClass = 'badge-info';
    if(c.estado === 'RECIBIDO') badgeClass = 'badge-done';
    if(c.estado === 'ENTREGADO') badgeClass = 'badge-active';
    if(c.estado === 'DEVUELTO') badgeClass = 'badge-violet';

    html += `
      <tr>
        <td style="font-weight:700;color:var(--accent-primary)">${c.codigo_documento}</td>
        <td>${c.fecha_documento.substring(0, 10)}</td>
        <td>${c.medio}</td>
        <td>${c.tipo_documento}</td>
        <td><span class="badge badge-info">${c.depto_origen}</span></td>
        <td>${c.depto_destino ? `<span class="badge badge-violet">${c.depto_destino}</span>` : '--'}</td>
        <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${c.asunto}">${c.asunto}</td>
        <td>
          <div class="estado-select-wrap">
            <select class="estado-select" data-estado="${c.estado}" onchange="cambiarEstadoFila('${c.id}', this.value)">
              <option value="PENDIENTE" ${c.estado==='PENDIENTE'?'selected':''}>⏳ PENDIENTE</option>
              <option value="ENVIADO" ${c.estado==='ENVIADO'?'selected':''}>📤 ENVIADO</option>
              <option value="RECIBIDO" ${c.estado==='RECIBIDO'?'selected':''}>📥 RECIBIDO</option>
              <option value="ENTREGADO" ${c.estado==='ENTREGADO'?'selected':''}>✅ ENTREGADO</option>
              <option value="DEVUELTO" ${c.estado==='DEVUELTO'?'selected':''}>🔄 DEVUELTO</option>
            </select>
          </div>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  listDiv.innerHTML = html;
}

async function cambiarEstadoFila(id, nuevoEstado) {
  try {
    // Implementación rápida de actualización
    const res = await apiCall('/api/correspondencia', 'POST', { id, estado: nuevoEstado, updateOnly: true });
    if(res.success) {
      cargarCorrespondencia();
    }
  } catch(e) {
    Swal.fire('Error', 'No se pudo actualizar el estado', 'error');
  }
}

// ==========================================
// 5. MAPA DE ARCHIVO Y BÚSQUEDA
// ==========================================

async function cargarMapaArchivo() {
  const grid = document.getElementById('mapaArchivo');
  if(!grid) return;
  
  grid.innerHTML = '<div style="text-align:center;grid-column:1/-1;padding:20px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> Cargando Slots desde PostgreSQL...</div>';
  
  try {
    // Generar slots físicos de archivo A1-D9
    let html = '';
    const letras = ['A', 'B', 'C', 'D'];
    
    // Consultar todos los documentos para ver qué ubicaciones están ocupadas (columna voxelsera)
    const res = await apiCall('/api/busqueda?query=');
    const ocupados = new Set();
    if (res.success) {
      res.resultados.forEach(r => {
        if(r.detalles && r.detalles.VOXELSERA) {
          ocupados.add(r.detalles.VOXELSERA);
        }
      });
    }

    for (let l of letras) {
      for (let i = 1; i <= 9; i++) {
        const slotId = `VOXEL_${l}${i}`;
        const isOcc = ocupados.has(slotId);
        html += `
          <div class="slot ${isOcc ? 'occ' : ''}" id="slot_${slotId}" onclick="verDetallesSlot('${slotId}', ${isOcc})" title="Slot ${slotId}">
            ${l}${i}
          </div>
        `;
      }
    }
    grid.innerHTML = html;
  } catch(e) {
    grid.innerHTML = '<div class="alert alert-danger" style="grid-column:1/-1">Error al cargar mapa físico</div>';
  }
}

async function verDetallesSlot(slotId, isOcc) {
  if(!isOcc) {
    Swal.fire(`Slot ${slotId}`, 'Este compartimento está disponible para archivar.', 'info');
    return;
  }
  
  try {
    const res = await apiCall(`/api/busqueda?query=${slotId}`);
    if (res.success && res.resultados.length > 0) {
      const doc = res.resultados[0];
      Swal.fire({
        title: `Slot ${slotId} (Ocupado)`,
        html: `<strong>Módulo:</strong> ${doc.modulo}<br><strong>Código:</strong> ${doc.codigo}<br><strong>Descripción:</strong> ${doc.titulo}`,
        icon: 'success'
      });
    }
  } catch(e) {
    Swal.fire('Error', 'No pudimos consultar el detalle del slot', 'error');
  }
}

async function ejecutarBusqueda() {
  const query = document.getElementById('searchInput').value.trim();
  const listDiv = document.getElementById('resultadosBusqueda');
  listDiv.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> Buscando...</div>';

  try {
    const res = await apiCall(`/api/busqueda?query=${encodeURIComponent(query)}`);
    if (res.success) {
      document.getElementById('totalRes').textContent = `${res.total} resultados`;
      if (res.resultados.length === 0) {
        listDiv.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)">No encontramos resultados.</div>';
        return;
      }
      
      let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">';
      res.resultados.forEach(r => {
        html += `
          <div class="kpi-card" style="cursor:pointer;" onclick="mostrarDetalleRegistro('${r.id}', '${r.modulo}')">
            <span class="kpi-icon">📄</span>
            <div class="kpi-value" style="font-size:1.1rem;word-break:break-all">${r.codigo}</div>
            <div class="kpi-label" style="font-size:0.65rem">${r.modulo}</div>
            <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:6px">${r.titulo}</div>
          </div>
        `;
      });
      html += '</div>';
      listDiv.innerHTML = html;
    }
  } catch(e) {
    listDiv.innerHTML = '<div class="alert alert-danger">Error al consultar buscador universal</div>';
  }
}

function busquedaInstantanea() {
  clearTimeout(window.searchTimeout);
  window.searchTimeout = setTimeout(ejecutarBusqueda, 300);
}

// ==========================================
// 6. WORKFLOWS Y AUDITORÍA
// ==========================================

async function cargarWorkflows() {
  const listDiv = document.getElementById('listaWF');
  listDiv.innerHTML = '<div class="text-muted text-sm"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';
  try {
    const res = await apiCall('/api/workflows/pendientes');
    if (res.success) {
      document.getElementById('wfBadge').textContent = res.workflows.length;
      document.getElementById('wfBadge').classList.toggle('hidden', res.workflows.length === 0);
      
      if (res.workflows.length === 0) {
        listDiv.innerHTML = '<div class="text-muted text-sm">No tienes flujos pendientes.</div>';
        return;
      }

      let html = '';
      res.workflows.forEach(w => {
        html += `
          <div class="wf-item normal">
            <div class="wf-icon" style="background:rgba(37,99,235,.1);color:var(--accent-primary)"><i class="fas fa-project-diagram"></i></div>
            <div class="wf-meta">
              <div class="wf-type">${w.tipo}</div>
              <div class="wf-title">${w.comentarios}</div>
              <div class="wf-row">
                <span>Solicita: ${w.solicitante}</span>
                <span>•</span>
                <span>Documento: ${w.documento_id}</span>
              </div>
            </div>
            <div class="flex-row">
              <button class="btn btn-success btn-sm" onclick="resolverWF('${w.id}', 'APROBAR')"><i class="fas fa-check"></i>Aprobar</button>
              <button class="btn btn-danger btn-sm" onclick="resolverWF('${w.id}', 'RECHAZAR')"><i class="fas fa-times"></i>Rechazar</button>
            </div>
          </div>
        `;
      });
      listDiv.innerHTML = html;
    }
  } catch(e) {
    listDiv.innerHTML = '<div class="alert alert-danger">Error de carga de workflows</div>';
  }
}

async function resolverWF(id, decision) {
  const { value: comentario } = await Swal.fire({
    title: 'Comentario de resolución',
    input: 'text',
    inputPlaceholder: 'Escribe comentarios (opcional)...',
    showCancelButton: true
  });

  try {
    const res = await apiCall('/api/workflows/resolver', 'POST', { id, decision, comentario });
    if(res.success) {
      Swal.fire('Resuelto', res.message, 'success');
      cargarWorkflows();
      cargarDashboard();
    }
  } catch(e) {
    Swal.fire('Error', 'Fallo al procesar el workflow', 'error');
  }
}

// ==========================================
// 7. INICIALIZAR BASE DE DATOS LOCAL
// ==========================================

async function inicializarBD() {
  const confirm = await Swal.fire({
    title: '¿Inicializar Base de Datos?',
    text: 'Esto creará las tablas SQL e insertará las TRD iniciales de ley.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#10b981',
    confirmButtonText: 'Sí, inicializar'
  });

  if (confirm.isConfirmed) {
    Swal.fire({
      title: 'Creando Estructuras...',
      text: 'Por favor espera un momento.',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

    try {
      const res = await apiCall('/api/system/initialize', 'POST');
      if (res.success) {
        Swal.fire('Éxito', res.message, 'success');
        cargarTodoElSistema();
      }
    } catch(e) {
      Swal.fire('Error', 'No pudimos contactar al servidor Express.', 'error');
    }
  }
}

// ==========================================
// 8. FUNCIONES DE APOYO Y PÁGINA
// ==========================================

function showSection(secId) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  
  const target = document.getElementById(secId);
  if (target) {
    target.classList.add('active');
    document.getElementById('pageTitle').textContent = secId.toUpperCase();
  }

  // Resaltar ícono en barra lateral
  const buttons = document.querySelectorAll('.nav-item');
  buttons.forEach(b => {
    if(b.getAttribute('onclick') && b.getAttribute('onclick').includes(secId)) {
      b.classList.add('active');
    }
  });
}

function iniciarClocksYPolling() {
  setInterval(() => {
    const clock = document.getElementById('topbarClock');
    if(clock) {
      const d = new Date();
      clock.textContent = d.toLocaleTimeString();
    }
  }, 1000);
}

function cargarTodoElSistema() {
  popularSelectsConfig();
  cargarDashboard();
  cargarCorrespondencia();
  cargarPersonal();
  cargarMapaArchivo();
  cargarWorkflows();
  ejecutarBusqueda();
}

// Mock Dashboard
async function cargarDashboard() {
  const grid = document.getElementById('kpiGrid');
  if(!grid) return;

  try {
    const res = await apiCall('/api/analytics');
    if (res.success) {
      grid.innerHTML = `
        <div class="kpi-card" style="--kpi-color:var(--accent-primary)">
          <span class="kpi-icon">📧</span>
          <div class="kpi-value">${res.correspondencia}</div>
          <div class="kpi-label">Correspondencia</div>
        </div>
        <div class="kpi-card" style="--kpi-color:var(--accent-green)">
          <span class="kpi-icon">📋</span>
          <div class="kpi-value">${res.minutas}</div>
          <div class="kpi-label">Minutas Registradas</div>
        </div>
        <div class="kpi-card" style="--kpi-color:var(--accent-violet)">
          <span class="kpi-icon">📑</span>
          <div class="kpi-value">${res.contratos}</div>
          <div class="kpi-label">Contratos Vigentes</div>
        </div>
        <div class="kpi-card" style="--kpi-color:var(--accent-gold)">
          <span class="kpi-icon">🤝</span>
          <div class="kpi-value">${res.asociadosRetirados || 0}</div>
          <div class="kpi-label">Asociados Retirados</div>
        </div>
        <div class="kpi-card" style="--kpi-color:var(--accent-amber)">
          <span class="kpi-icon">🔄</span>
          <div class="kpi-value">${res.prestamosActivos}</div>
          <div class="kpi-label">Préstamos Activos</div>
        </div>
      `;
    }
  } catch(e) {
    grid.innerHTML = '<div class="alert alert-danger" style="grid-column:1/-1">Error al conectar servidor backend</div>';
  }
}

function mostrarModalConfirmacion(titulo, codigo, mensaje) {
  document.getElementById('mIcon').textContent = '✅';
  document.getElementById('mTitle').textContent = titulo;
  document.getElementById('mCode').textContent = codigo;
  document.getElementById('mMsg').textContent = mensaje;
  document.getElementById('modalConfirm').classList.add('show');
}

function cerrarModal() {
  document.getElementById('modalConfirm').classList.remove('show');
}

function resetFormCorr() {
  document.getElementById('asunto').value = '';
  document.getElementById('detalle').value = '';
  generarCodigoDoc();
}

function resetFormPrestamo() {
  document.getElementById('solicitantePrestamo').value = '';
  document.getElementById('docPrestamo').value = '';
  document.getElementById('codDocPrestamo').value = '';
}

// Al arrancar la página web
window.onload = function() {
  verificarTokenActivo();
  popularSelectsConfig();
};
