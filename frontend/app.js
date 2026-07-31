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
      const chatFab = document.getElementById('chatFab');
      if (chatFab) chatFab.classList.remove('hidden');
      
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
    const chatFab = document.getElementById('chatFab');
    if (chatFab) chatFab.classList.remove('hidden');
    cargarInfoUsuario();
    iniciarClocksYPolling();
    cargarTodoElSistema();
  }
}

function cerrarSesion() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('colaTirasCoraza');
  window.colaImpresionTiras = [];
  actualizarBadgeCola();
  currentUser = null;
  document.getElementById('mainApp').classList.add('hidden');
  const chatFab = document.getElementById('chatFab');
  if (chatFab) chatFab.classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}

function cargarInfoUsuario() {
  if (!currentUser) return;
  const name = currentUser.nombre || currentUser.name || currentUser.email || 'Usuario';
  const role = currentUser.rol || currentUser.role || 'ASOCIADO';
  const elName = document.getElementById('userName');
  const elRole = document.getElementById('userRole');
  const elAv = document.getElementById('userAv');
  if (elName) elName.textContent = name;
  if (elRole) elRole.textContent = role;
  if (elAv) elAv.textContent = name.substring(0, 1).toUpperCase();
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
    { val: '100-10.01', label: '100-10.01 — GERENCIA / Cartas, Comunicaciones Oficiales y Memorandos (10 Años C.Co)' },
    { val: '100-10.02', label: '100-10.02 — GERENCIA / Actas de Consejo de Administración y Asambleas Generales (Conservación Total)' },
    { val: '100-10.03', label: '100-10.03 — GERENCIA / Resoluciones, Directivas y Políticas Institucionales (Conservación Total)' },
    { val: '100-10.04', label: '100-10.04 — GERENCIA / Informes de Gestión, Sostenibilidad y Rendición de Cuentas (5 Años)' },
    { val: '100-10.05', label: '100-10.05 — GERENCIA / Convenios de Intermediación y Alianzas Estratégicas (10 Años)' },
    { val: '100-10.06', label: '100-10.06 — GERENCIA / Planes Estratégicos, Prospectiva y Proyectos de Inversión (10 Años)' },
    { val: '100-10.07', label: '100-10.07 — GERENCIA / Actas del Comité Directivo y Comités Ejecutivos (10 Años)' },
    { val: '100-10.08', label: '100-10.08 — GERENCIA / Correspondencia del Representante Legal y Junta Directiva (10 Años)' },
    { val: '100-10.09', label: '100-10.09 — GERENCIA / Reformas Estatutarias y Reglamento Interno de la CTA (Conservación Total)' },
    { val: '100-10.10', label: '100-10.10 — GERENCIA / Auditorías de Calidad ISO y Certificaciones (5 Años)' },
    { val: '100-10.11', label: '100-10.11 — GERENCIA / Poderes y Mandatos de Representación Legal (10 Años)' },
    { val: '100-10.12', label: '100-10.12 — GERENCIA / Relaciones Institucionales y Gremiales (5 Años)' }
  ],
  GH: [
    { val: '200-20.01', label: '200-20.01 — GESTION HUMANA / Historias Laborales y Expedientes de Asociados/Empleados (20 Años Ley 594)' },
    { val: '200-20.02', label: '200-20.02 — GESTION HUMANA / Cartas, Memorandos y Comunicaciones Internas (5 Años)' },
    { val: '200-20.03', label: '200-20.03 — GESTION HUMANA / Nóminas de Pago y Planillas PILA/Aportes (20 Años Ley 100)' },
    { val: '200-20.04', label: '200-20.04 — GESTION HUMANA / Procesos Disciplinarios y Descargos (10 Años)' },
    { val: '200-20.05', label: '200-20.05 — GESTION HUMANA / Certificaciones Laborales y Paz y Salvos (10 Años)' },
    { val: '200-20.06', label: '200-20.06 — GESTION HUMANA / Hojas de Vida de Aspirantes e Inactivos (3 Años)' },
    { val: '200-20.07', label: '200-20.07 — GESTION HUMANA / Capacitaciones, Inducciones y Formación de Personal (5 Años)' },
    { val: '200-20.08', label: '200-20.08 — GESTION HUMANA / Evaluaciones del Desempeño y Clima Laboral (5 Años)' },
    { val: '200-20.09', label: '200-20.09 — GESTION HUMANA / Control de Asistencia, Permisos y Licencias (3 Años)' },
    { val: '200-20.10', label: '200-20.10 — GESTION HUMANA / Novedades de Personal, Retiros y Traslados (10 Años)' },
    { val: '200-20.11', label: '200-20.11 — GESTION HUMANA / Bienestar Social, Estímulos y Actividades Cooperativas (5 Años)' },
    { val: '200-20.12', label: '200-20.12 — GESTION HUMANA / Carnetización y Control de Identificación Operativa (3 Años)' }
  ],
  ST: [
    { val: '210-21.01', label: '210-21.01 — SST / Expedientes del SG-SST y Matriz de Identificación de Peligros (20 Años Dec. 1072)' },
    { val: '210-21.02', label: '210-21.02 — SST / Exámenes Médicos Ocupacionales e Historial Clínico (20 Años Ley 9ª)' },
    { val: '210-21.03', label: '210-21.03 — SST / Reportes de Accidentes de Trabajo e Incidentes - ATEL (20 Años Dec. 1295)' },
    { val: '210-21.04', label: '210-21.04 — SST / Actas del COPASST y Comité de Convivencia Laboral (10 Años)' },
    { val: '210-21.05', label: '210-21.05 — SST / Investigaciones de Enfermedades Laborales y Profilaxis (20 Años)' },
    { val: '210-21.06', label: '210-21.06 — SST / Plan de Prevención, Preparación y Respuesta ante Emergencias (10 Años)' },
    { val: '210-21.07', label: '210-21.07 — SST / Inspecciones de Seguridad, EPP y Condiciones de Trabajo (5 Años)' },
    { val: '210-21.08', label: '210-21.08 — SST / Auditorías Internas y Evaluaciones del SG-SST (5 Años)' },
    { val: '210-21.09', label: '210-21.09 — SST / Registro de Entrega de Elementos de Protección Personal - EPP (5 Años)' },
    { val: '210-21.10', label: '210-21.10 — SST / Capacitaciones en Prevención de Riesgos Ocupacionales (5 Años)' }
  ],
  GF: [
    { val: '300-30.01', label: '300-30.01 — FINANCIERA / Comprobantes de Egreso, Ingreso y Facturación (10 Años Ley 527)' },
    { val: '300-30.02', label: '300-30.02 — FINANCIERA / Declaraciones Tributarias e Impuestos DIAN/Municipal (10 Años)' },
    { val: '300-30.03', label: '300-30.03 — FINANCIERA / Estados Financieros, Balances y Libros Oficiales (Conservación Total)' },
    { val: '300-30.04', label: '300-30.04 — FINANCIERA / Conciliaciones Bancarias y Extractos de Cuentas (10 Años)' },
    { val: '300-30.05', label: '300-30.05 — FINANCIERA / Informes de Revisoría Fiscal y Auditorías Contables (10 Años)' },
    { val: '300-30.06', label: '300-30.06 — FINANCIERA / Facturación Electrónica y Archivos XML/PDF (10 Años DIAN)' },
    { val: '300-30.07', label: '300-30.07 — FINANCIERA / Cartera, Cobró Coactivo y Cuentas por Cobrar (10 Años)' },
    { val: '300-30.08', label: '300-30.08 — FINANCIERA / Libros Auxiliares, Mayor y Balance (10 Años)' },
    { val: '300-30.09', label: '300-30.09 — FINANCIERA / Presupuestos y Ejecución Presupuestal Anual (5 Años)' },
    { val: '300-30.10', label: '300-30.10 — FINANCIERA / Reportes a Entidades de Control (SuperSolidaria, DIAN) (10 Años)' }
  ],
  CP: [
    { val: '310-31.01', label: '310-31.01 — COMPRAS / Órdenes de Compra y Solicitudes de Suministro (5 Años)' },
    { val: '310-31.02', label: '310-31.02 — COMPRAS / Hojas de Vida, Selección y Evaluación de Proveedores (5 Años)' },
    { val: '310-31.03', label: '310-31.03 — COMPRAS / Facturas, Cotizaciones y Remisiones de Proveedores (10 Años C.Co)' },
    { val: '310-31.04', label: '310-31.04 — COMPRAS / Inventarios de Armamento, Vehículos y Equipos (10 Años SuperVigilancia)' },
    { val: '310-31.05', label: '310-31.05 — COMPRAS / Hojas de Vida de Vehículos y Mantenimiento de Flota (5 Años)' },
    { val: '310-31.06', label: '310-31.06 — COMPRAS / Registro y Entrega de Dotación Operativa y Uniformes (5 Años)' },
    { val: '310-31.07', label: '310-31.07 — COMPRAS / Contratos de Compraventa y Adquisición de Bienes (10 Años)' },
    { val: '310-31.08', label: '310-31.08 — COMPRAS / Baja de Activos e Inventarios Obsoletos (5 Años)' }
  ],
  CM: [
    { val: '320-32.01', label: '320-32.01 — COMERCIAL / Ofertas Comerciales, Propuestas y Cotizaciones (5 Años)' },
    { val: '320-32.02', label: '320-32.02 — COMERCIAL / Licitaciones Públicas y Concursos de Meritos (10 Años)' },
    { val: '320-32.03', label: '320-32.03 — COMERCIAL / Cartas y Comunicaciones Oficiales con Clientes (5 Años)' },
    { val: '320-32.04', label: '320-32.04 — COMERCIAL / Encuestas de Satisfacción, PQRS y PQRSFD de Clientes (3 Años)' },
    { val: '320-32.05', label: '320-32.05 — COMERCIAL / Estudios de Mercado y Análisis de Competencia (3 Años)' },
    { val: '320-32.06', label: '320-32.06 — COMERCIAL / Portafolios de Servicios y Presentaciones Corporativas (3 Años)' },
    { val: '320-32.07', label: '320-32.07 — COMERCIAL / Indicadores de Gestión Comercial y Metas de Venta (5 Años)' }
  ],
  OP: [
    { val: '400-40.01', label: '400-40.01 — OPERACIONES / Minutas de Servicio y Libros de Puestos de Vigilancia (5 Años SuperVigilancia)' },
    { val: '400-40.02', label: '400-40.02 — OPERACIONES / Reportes de Novedades, Incidentes y Siniestros en Puestos (5 Años)' },
    { val: '400-40.03', label: '400-40.03 — OPERACIONES / Programación de Turnos, Malla Operativa y Quadrantes (3 Años)' },
    { val: '400-40.04', label: '400-40.04 — OPERACIONES / Control de Armamento, Salvoconductos y Municiómetro (10 Años Indumil)' },
    { val: '400-40.05', label: '400-40.05 — OPERACIONES / Informes de Estudio de Seguridad e Inspección de Puestos (5 Años)' },
    { val: '400-40.06', label: '400-40.06 — OPERACIONES / Control de Radiocomunicaciones y Frecuencias VHF/UHF (5 Años Mintic)' },
    { val: '400-40.07', label: '400-40.07 — OPERACIONES / Planes de Contingencia Operativa y Red de Apoyo Policía (5 Años)' },
    { val: '400-40.08', label: '400-40.08 — OPERACIONES / Informes de Gestión y Rendición de Cuentas Operativas (5 Años)' },
    { val: '400-40.09', label: '400-40.09 — OPERACIONES / Evaluaciones de Riesgos Operacionales por Puesto de Vigilancia (5 Años)' },
    { val: '400-40.10', label: '400-40.10 — OPERACIONES / Consignas Particulares y Generales de Puestos de Trabajo (5 Años)' }
  ],
  SE: [
    { val: '410-41.01', label: '410-41.01 — SEGURIDAD ELECTRONICA / Informes Técnicos de Mantenimiento CCTV y Alarmas (5 Años)' },
    { val: '410-41.02', label: '410-41.02 — SEGURIDAD ELECTRONICA / Bitácoras de Monitoreo de Alarmas y Control de Video (3 Años)' },
    { val: '410-41.03', label: '410-41.03 — SEGURIDAD ELECTRONICA / Hojas de Vida de Equipos Tecnológicos y Software (5 Años)' },
    { val: '410-41.04', label: '410-41.04 — SEGURIDAD ELECTRONICA / Diseños y Planos de Sistemas de Control de Acceso (10 Años)' },
    { val: '410-41.05', label: '410-41.05 — SEGURIDAD ELECTRONICA / Reportes de Fallas Técnicas y Tiempos de Respuesta SLA (3 Años)' },
    { val: '410-41.06', label: '410-41.06 — SEGURIDAD ELECTRONICA / Registros de Acceso Biométrico y Control de Visitantes (3 Años)' }
  ],
  SP: [
    { val: '420-42.01', label: '420-42.01 — SUPERVISION / Informes de Ronda, Supervisión y Verificación de Puestos (3 Años)' },
    { val: '420-42.02', label: '420-42.02 — SUPERVISION / Planillas de Control de Vehículos, Patrullas y Kilometraje (3 Años)' },
    { val: '420-42.03', label: '420-42.03 — SUPERVISION / Pruebas de Alcoholemia, Poligrafía y Control Operativo (5 Años)' },
    { val: '420-42.04', label: '420-42.04 — SUPERVISION / Inspección de Uniformes, Equipos y Armamento en Campo (3 Años)' },
    { val: '420-42.05', label: '420-42.05 — SUPERVISION / Informes de Reacción Nocturna y Atención de Alarmas (3 Años)' }
  ],
  DJ: [
    { val: '500-50.01', label: '500-50.01 — JURIDICO / Contratos de Prestación de Servicios de Vigilancia Privada (20 Años C.Co)' },
    { val: '500-50.02', label: '500-50.02 — JURIDICO / Convenios Interinstitucionales, Alianzas y Consorcios (10 Años)' },
    { val: '500-50.03', label: '500-50.03 — JURIDICO / Procesos Judiciales, Tutelas, Demandas y Contestaciones (20 Años)' },
    { val: '500-50.04', label: '500-50.04 — JURIDICO / Pólizas de Seguro, Responsabilidad Civil y Garantías (10 Años)' },
    { val: '500-50.05', label: '500-50.05 — JURIDICO / Trámites, Licencias de Funcionamiento ante SuperVigilancia (Conservación Total)' },
    { val: '500-50.06', label: '500-50.06 — JURIDICO / Derecho de Petición, Requerimientos y Solicitudes de Entidades (10 Años)' },
    { val: '500-50.07', label: '500-50.07 — JURIDICO / Escrituras Públicas, Títulos de Propiedad y Certificados (Conservación Total)' },
    { val: '500-50.08', label: '500-50.08 — JURIDICO / Propiedad Intelectual, Marcas y Patentes (Conservación Total)' },
    { val: '500-50.09', label: '500-50.09 — JURIDICO / Investigaciones Administrativas y Sancionatorias (10 Años)' },
    { val: '500-50.10', label: '500-50.10 — JURIDICO / Consultas Legales, Conceptos y Opiniones Jurídicas (10 Años)' }
  ],
  CE: [
    { val: '900-90.01', label: '900-90.01 — CLIENTE EXTERNO / Correspondencia Recibida de Clientes y Contratantes (5 Años)' },
    { val: '900-90.02', label: '900-90.02 — CLIENTE EXTERNO / Solicitudes de Servicio, Modificaciones e Informes Especiales (5 Años)' },
    { val: '900-90.03', label: '900-90.03 — CLIENTE EXTERNO / Actas de Entrega, Recepción y Empalme de Puestos (10 Años)' },
    { val: '900-90.04', label: '900-90.04 — CLIENTE EXTERNO / Solicitudes de Adiciones Contratuales e Incrementos (10 Años)' },
    { val: '900-90.05', label: '900-90.05 — CLIENTE EXTERNO / Informes Mensuales de Servicio Entregados al Cliente (5 Años)' }
  ],
  AS: [
    { val: '910-91.01', label: '910-91.01 — ASOCIADOS / Comunicaciones y Solicitudes de Asociados CTA (10 Años)' },
    { val: '910-91.02', label: '910-91.02 — ASOCIADOS / Convenios de Trabajo Asociado y Reglamentos Cooperativos (20 Años)' },
    { val: '910-91.03', label: '910-91.03 — ASOCIADOS / Solicitudes de Retiro, Compensaciones e Indemnizaciones CTA (20 Años)' },
    { val: '910-91.04', label: '910-91.04 — ASOCIADOS / Certificados de Compensación Ordinaria/Extraordinaria y Aportes (20 Años)' },
    { val: '910-91.05', label: '910-91.05 — ASOCIADOS / Hojas de Vida de Asociados Retirados y Paz y Salvos (20 Años)' },
    { val: '910-91.06', label: '910-91.06 — ASOCIADOS / Solicitudes de Crédito y Auxilios del Fondo de Empleados/CTA (10 Años)' },
    { val: '910-91.07', label: '910-91.07 — ASOCIADOS / Actas de Asambleas de Asociados y Elección de Delegados (Conservación Total)' }
  ]
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
  if(document.getElementById('filtroPrestDepto')) document.getElementById('filtroPrestDepto').innerHTML = '<option value="todos">Todos los dptos</option>' + opciones;
  if(uDepto) uDepto.innerHTML = opciones;

  // Llenar selectores de ubicaciones físicas según regla de negocio:
  // A1-A9: Minutas | B1-B9: Asociados Retirados | C1-C9: Contratos | D1-D9: Estantería Libre / Salida del Día
  const optionsMinuta = '<option value="">-- Seleccionar Compartimento Minuta (A1-A9) --</option>' + 
    Array.from({length:9}, (_, i) => `<option value="VOXEL_A${i+1}">📋 Estante A - Compartimento A${i+1} (Minutas)</option>`).join('');

  const optionsPersonal = '<option value="">-- Seleccionar Compartimento Asociados (B1-B9) --</option>' + 
    Array.from({length:9}, (_, i) => `<option value="VOXEL_B${i+1}">🤝 Estante B - Compartimento B${i+1} (Asociados Retirados)</option>`).join('');

  const optionsContrato = '<option value="">-- Seleccionar Compartimento Contratos (C1-C9) --</option>' + 
    Array.from({length:9}, (_, i) => `<option value="VOXEL_C${i+1}">📑 Estante C - Compartimento C${i+1} (Contratos)</option>`).join('');

  const optionsCorr = '<option value="">⚡ Entregado en el día (No ocupa estantería permanente)</option>' + 
    Array.from({length:9}, (_, i) => `<option value="VOXEL_D${i+1}">📦 Estante D - Compartimento Libre D${i+1} (Temporal)</option>`).join('');

  if (document.getElementById('voxelseraMinuta')) document.getElementById('voxelseraMinuta').innerHTML = optionsMinuta;
  if (document.getElementById('voxelseraPersonal')) document.getElementById('voxelseraPersonal').innerHTML = optionsPersonal;
  if (document.getElementById('voxelseraContrato')) document.getElementById('voxelseraContrato').innerHTML = optionsContrato;
  if (document.getElementById('voxelseraCorr')) document.getElementById('voxelseraCorr').innerHTML = optionsCorr;

  // Selectores de biblioteca
  if (document.getElementById('catBib')) document.getElementById('catBib').innerHTML = '<option value="POLITICAS">Políticas</option><option value="MANUALES">Manuales</option><option value="REGISTROS">Registros</option>';
  
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
    voxelsera: document.getElementById('voxelseraMinuta') ? document.getElementById('voxelseraMinuta').value : '',
    observaciones: document.getElementById('observacionesMinuta').value.trim()
  };

  try {
    const res = await apiCall('/api/minutas', 'POST', data);
    if (res.success) {
      agregarAColaImpresion({
        id: res.codigoUnico || res.id,
        modulo: '📋 MINUTAS',
        codigo: res.codigoUnico,
        titulo: data.nombrePuesto,
        fechas: `${data.fechaInicio || ''} -- ${data.fechaCierre || ''}`,
        slotFisico: data.voxelsera || 'Estante A'
      });
      mostrarModalConfirmacion('✅ MINUTA REGISTRADA', res.codigoUnico, 'Puesto y minuta guardados en la BD y agregados a la Cola de Impresión.', '📋 MINUTAS', data.nombrePuesto, data.voxelsera || 'A');
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
      agregarAColaImpresion({
        id: res.codigo || res.id,
        modulo: '🤝 ASOCIADOS RETIRADOS',
        codigo: res.codigo,
        titulo: data.nombre,
        nit: data.cedula,
        fechas: data.fechaBaja ? `Retiro: ${data.fechaBaja}` : '',
        slotFisico: 'Estante B'
      });
      mostrarModalConfirmacion('✅ PERSONAL INACTIVO REGISTRADO', `ID: ${res.codigo}`, 'Expediente guardado en BD y agregado a la Cola de Impresión.', '🤝 ASOCIADOS RETIRADOS', data.nombre, 'B');
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
  
  grid.innerHTML = '<div style="text-align:center;grid-column:1/-1;padding:30px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin fa-2x"></i><br><br>Consultando estanterías e inventario en PostgreSQL...</div>';
  
  try {
    const res = await apiCall('/api/voxelsera-mapa');
    if (!res.success || !res.slots) {
      grid.innerHTML = '<div class="alert alert-danger" style="grid-column:1/-1">No se pudo cargar el mapa de archivo físico.</div>';
      return;
    }

    const slots = res.slots;
    window._voxelseraSlotsData = slots;

    let html = '';
    const letras = ['A', 'B', 'C', 'D'];
    
    const infoEstantes = {
      'A': { titulo: 'ESTANTE A — MINUTAS DE SERVICIO (A1 - A9)', icon: 'fas fa-file-signature', color: 'var(--accent-cyan)', tag: '📋 MINUTAS' },
      'B': { titulo: 'ESTANTE B — ASOCIADOS RETIRADOS (B1 - B9)', icon: 'fas fa-user-minus', color: 'var(--accent-gold)', tag: '🤝 HOJAS DE VIDA' },
      'C': { titulo: 'ESTANTE C — CONTRATOS Y CONVENIOS (C1 - C9)', icon: 'fas fa-file-contract', color: 'var(--accent-violet)', tag: '📑 CONTRATOS' },
      'D': { titulo: 'ESTANTE D — SALIDA DEL DÍA / LIBRE (D1 - D9)', icon: 'fas fa-box-open', color: 'var(--accent-green)', tag: '⚡ CORRESPONDENCIA' }
    };

    for (let l of letras) {
      const info = infoEstantes[l];
      html += `
        <div style="grid-column: 1 / -1; margin-top: ${l === 'A' ? '0' : '16px'}; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid ${info.color}; padding-bottom: 6px;">
          <span style="font-size: 0.92rem; font-weight: 800; color: ${info.color}; display: flex; align-items: center; gap: 8px;">
            <i class="${info.icon}"></i> ${info.titulo}
          </span>
          <span class="badge" style="background:rgba(255,255,255,0.06);color:${info.color};border:1px solid ${info.color};font-weight:800;font-size:0.7rem">${info.tag}</span>
        </div>
      `;

      for (let i = 1; i <= 9; i++) {
        const slotKey = `VOXEL_${l}${i}`;
        const sData = slots[slotKey] || { count: 0 };
        const count = sData.count || 0;
        const isOcc = count > 0;

        const countLabel = count > 0 
          ? `<span style="font-size:0.7rem;font-weight:800;background:var(--accent-green);color:#fff;padding:2px 8px;border-radius:12px;box-shadow:0 0 8px rgba(16,185,129,0.4)"><i class="fas fa-box"></i> ${count.toLocaleString('es-CO')} doc${count > 1 ? 's' : ''}</span>`
          : `<span style="font-size:0.65rem;color:var(--text-muted);font-weight:700">DISPONIBLE</span>`;

        html += `
          <div class="slot ${isOcc ? 'occ' : ''}" id="slot_${slotKey}" onclick="verDetallesSlot('${slotKey}', ${isOcc})" title="Compartimento ${l}${i} - ${count} documentos archivados" style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 6px;min-height:75px;border-radius:var(--r-md);cursor:pointer;transition:all 0.25s ease;">
            <div style="font-size:1.1rem;font-weight:900;letter-spacing:0.5px;color:${isOcc ? info.color : 'var(--text-secondary)'};display:flex;align-items:center;gap:4px">
              <i class="fas fa-archive" style="font-size:0.85rem;opacity:0.8"></i> ${l}${i}
            </div>
            <div style="margin-top:5px;text-align:center">
              ${countLabel}
            </div>
          </div>
        `;
      }
    }
    grid.innerHTML = html;
  } catch(e) {
    grid.innerHTML = '<div class="alert alert-danger" style="grid-column:1/-1">Error al consultar estanterías físicas</div>';
  }
}

async function verDetallesSlot(slotId, isOcc) {
  const normId = slotId.replace('VOXEL_', '');
  const sData = window._voxelseraSlotsData ? window._voxelseraSlotsData[slotId] : null;
  const totalDocs = sData ? sData.count : 0;
  
  if(!isOcc && totalDocs === 0) {
    Swal.fire({
      title: `📦 Compartimento Físico ${normId}`,
      text: 'Este slot físico se encuentra 100% disponible para archivar nuevos expedientes o minutas.',
      icon: 'info',
      confirmButtonText: 'Entendido'
    });
    return;
  }
  
  try {
    let items = sData && sData.items ? sData.items : [];

    if (items.length === 0) {
      const res = await apiCall(`/api/busqueda?query=${encodeURIComponent(normId)}`);
      if (res.success && res.resultados) {
        items = res.resultados;
      }
    }

    let html = `<div style="text-align:left;max-height:420px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding-right:4px">`;
    items.forEach(d => {
      html += `
        <div style="background:var(--bg-elevated);border:1px solid var(--border-medium);border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:center;gap:12px">
          <div style="flex:1">
            <span class="badge badge-info" style="font-size:0.65rem;margin-bottom:4px;font-weight:800">${d.modulo}</span>
            <div style="font-weight:900;color:var(--accent-primary);font-size:1.05rem">${d.codigo}</div>
            <div style="font-size:0.84rem;color:var(--text-secondary);margin-top:2px;font-weight:600">${d.titulo}</div>
          </div>
          <button class="btn btn-sm btn-ghost" style="color:var(--accent-primary);background:rgba(37,99,235,0.1);padding:6px 10px;border-radius:6px" onclick="Swal.close(); mostrarDetalleRegistro('${d.id}', '${d.modulo}')" title="Ver ficha completa">
            <i class="fas fa-eye" style="font-size:1.1rem"></i>
          </button>
        </div>
      `;
    });
    html += `</div>`;

    const subTitleText = totalDocs > items.length 
      ? `Mostrando ${items.length} de ${totalDocs.toLocaleString('es-CO')} documentos archivados en este compartimento`
      : `${items.length} documento${items.length !== 1 ? 's' : ''} archivado${items.length !== 1 ? 's' : ''}`;

    Swal.fire({
      title: `📦 Estante Voxelsera ${normId}`,
      html: `
        <div style="font-size:0.82rem;color:var(--accent-cyan);font-weight:700;margin-bottom:12px;text-transform:uppercase">${subTitleText}</div>
        ${html}
      `,
      width: '600px',
      showCloseButton: true,
      showConfirmButton: false
    });
  } catch(e) {
    Swal.fire(`Compartimento ${normId}`, 'Error al obtener inventario del compartimento.', 'error');
  }
}

function toggleFiltrosAvanzados() {
  const panel = document.getElementById('panelFiltrosAvanzados');
  const btn = document.getElementById('btnToggleFiltros');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'grid';
  if (btn) {
    btn.className = isOpen ? 'btn btn-ghost btn-sm' : 'btn btn-primary btn-sm';
  }
}

async function ejecutarBusqueda() {
  const query = document.getElementById('searchInput').value.trim();
  const filtroModulo = document.getElementById('filtroTipo')?.value || 'todos';
  const listDiv = document.getElementById('resultadosBusqueda');
  listDiv.innerHTML = '<div style="text-align:center;padding:35px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin fa-2x"></i><div style="margin-top:10px;font-weight:600">Buscando en base de datos PostgreSQL...</div></div>';

  try {
    const res = await apiCall(`/api/busqueda?query=${encodeURIComponent(query)}`);
    if (res.success) {
      let filtrados = res.resultados;
      if (filtroModulo !== 'todos') {
        filtrados = filtrados.filter(r => {
          const m = r.modulo.toLowerCase();
          return m.includes(filtroModulo);
        });
      }

      document.getElementById('totalRes').textContent = `${filtrados.length} resultados`;
      if (filtrados.length === 0) {
        listDiv.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);background:var(--bg-elevated);border-radius:var(--r-md);border:1px dashed var(--border-medium)">No se encontraron documentos para la búsqueda.</div>';
        return;
      }
      
      let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px">';
      filtrados.forEach(r => {
        const slotTag = r.detalles && r.detalles.VOXELSERA 
          ? `<button class="btn btn-sm btn-ghost" style="padding:2px 8px;font-size:0.72rem;color:var(--accent-violet);border-color:var(--accent-violet)" onclick="event.stopPropagation(); iluminarUbicacionFisica('${r.detalles.VOXELSERA}')" title="Iluminar en el mapa de estanterías"><i class="fas fa-box"></i> ${r.detalles.VOXELSERA}</button>`
          : '';

        html += `
          <div class="card" style="cursor:pointer;position:relative;padding:16px;margin:0;border:1px solid var(--border-medium);transition:all 0.2s;" onclick="mostrarDetalleRegistro('${r.id}', '${r.modulo}')">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <span class="badge badge-info" style="font-size:0.68rem;font-weight:700;letter-spacing:0.5px">${r.modulo}</span>
              <button class="btn btn-sm btn-ghost" style="color:var(--accent-primary);padding:4px 8px;border-radius:var(--r-md);background:rgba(37,99,235,0.1)" onclick="event.stopPropagation(); mostrarDetalleRegistro('${r.id}', '${r.modulo}')" title="Ver detalles completos de este documento">
                <i class="fas fa-eye" style="font-size:1.1rem"></i>
              </button>
            </div>
            <div style="font-family:'Segoe UI',system-ui,sans-serif;font-size:1.15rem;font-weight:800;color:var(--accent-primary);letter-spacing:0.3px;word-break:break-all">
              ${r.codigo}
            </div>
            <div style="font-size:0.84rem;font-weight:600;color:var(--text-secondary);margin-top:6px;line-height:1.35">
              ${r.titulo}
            </div>
            ${slotTag ? `<div style="margin-top:12px;display:flex;justify-content:flex-end">${slotTag}</div>` : ''}
          </div>
        `;
      });
      html += '</div>';
      listDiv.innerHTML = html;
    }
  } catch(e) {
    listDiv.innerHTML = '<div class="alert alert-danger">Error al consultar el buscador universal</div>';
  }
}

async function mostrarDetalleRegistro(id, modulo) {
  const modal = document.getElementById('modalDetalleBusqueda');
  const body = document.getElementById('detalleBusquedaBody');
  if (!modal || !body) return;

  body.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> Cargando información detallada...</div>';
  modal.classList.add('show');

  let d = null;
  const mNorm = (modulo || '').toUpperCase();
  const idStr = String(id || '');

  // 1. Búsqueda instantánea en memoria local (0ms latencia)
  if (mNorm.includes('CONTRATO') && window.todosLosContratos) {
    d = window.todosLosContratos.find(c => String(c.id) === idStr || String(c.codigo_numerico) === idStr || String(c.numero_contrato) === idStr);
  } else if (mNorm.includes('MINUTA') && window.todasLasMinutas) {
    d = window.todasLasMinutas.find(m => String(m.id) === idStr || String(m.codigo_numerico) === idStr);
  } else if ((mNorm.includes('ASOCIADO') || mNorm.includes('PERSONAL')) && window.todoElPersonal) {
    d = window.todoElPersonal.find(p => String(p.id) === idStr || String(p.cedula) === idStr || String(p.codigo_numerico) === idStr);
  }

  if (!d && window.ultimosResultadosBusqueda) {
    d = window.ultimosResultadosBusqueda.find(r => String(r.id) === idStr || String(r.codigo_numerico) === idStr);
  }

  // 2. Si no está en memoria local, hacer fetch
  if (!d) {
    try {
      const res = await apiCall(`/api/registro-detalle/${encodeURIComponent(modulo)}/${encodeURIComponent(id)}`);
      if (res && res.success && res.detalle) {
        d = res.detalle;
      }
    } catch(e) {
      console.warn("API detalle error fallback:", e);
    }
  }

  // 3. Fallback de emergencia si existe en variable global
  if (!d && window.currentDetailRecord) {
    d = window.currentDetailRecord;
  }

  if (!d) {
    body.innerHTML = '<div class="alert alert-danger">No se encontraron detalles para este registro. Por favor recarga la página.</div>';
    return;
  }

  window.currentDetailRecord = d;
  window.currentDetailModulo = modulo;

  let rowsHtml = '';
  let slotFisico = d.voxelsera || d.ubicacion || 'ESTANTE C';

  for (const [key, val] of Object.entries(d)) {
    if (val !== null && val !== undefined && val !== '') {
      const formattedKey = key.replace(/_/g, ' ').toUpperCase();
      let displayVal = val;
      if (typeof val === 'string' && val.includes('T00:00:00')) {
        displayVal = val.substring(0, 10);
      }
      rowsHtml += `
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-subtle);gap:14px">
          <span style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);min-width:140px">${formattedKey}</span>
          <span style="font-size:0.85rem;font-weight:600;color:var(--text-primary);text-align:right;word-break:break-word">${displayVal}</span>
        </div>
      `;
    }
  }

  const fichaBtn = `
    <button class="btn btn-primary w-full" style="margin-top:8px;padding:9px;font-weight:800;background:linear-gradient(135deg,#0284c7,#16a34a);border:none;color:#fff" onclick="generarFichaCustodiaDesdeDetalle()">
      📄 GENERAR FICHA DE CUSTODIA (HOJA DE CONTROL PDF)
    </button>
  `;

  const pdfAttachBtn = d.url_pdf ? `
    <button class="btn btn-ghost w-full" style="margin-top:6px;padding:8px;font-weight:700;color:var(--accent-green);border-color:var(--accent-green)" onclick="abrirVisorPDF('${d.url_pdf}', 'EXPEDIENTE DIGITAL')">
      👁️ VER PDF ESCANEADO VINCULADO
    </button>
  ` : `
    <button class="btn btn-ghost w-full" style="margin-top:6px;padding:8px;font-weight:700;color:var(--accent-violet);border-color:var(--accent-violet)" onclick="abrirModalSubirPDF('${d.codigo_numerico || d.id}', '${d.id}', '${modulo}')">
      📎 ADJUNTAR ENLACE DE PDF ESCANEADO
    </button>
  `;

  const glowBtn = slotFisico ? `
    <button class="btn btn-primary w-full" style="margin-top:10px;padding:10px;background:linear-gradient(135deg,#38bdf8,#f59e0b);border:none;color:#fff;font-weight:800;letter-spacing:0.5px;box-shadow:0 0 15px rgba(245,158,11,0.4)" onclick="iluminarUbicacionFisica('${slotFisico}')">
      ✨ ILUMINAR EN MAPA DE ARCHIVO FÍSICO (${slotFisico})
    </button>
  ` : '';

  const codClean = d.codigo_numerico || d.numero_contrato || d.codigo_unico || d.id;
  const titClean = (d.parte_b || d.nombre_puesto || d.nombre_completo || d.asunto || d.nombre || 'CARPETA ARCHIVO').toUpperCase();
  const nitClean = d.nit || d.cedula || 'N/A';
  const fecClean = d.fecha_inicio ? `${String(d.fecha_inicio).substring(0,10)} -- ${d.fecha_fin ? String(d.fecha_fin).substring(0,10) : 'Vigente'}` : 'N/A';

  const directMarquillaHtml = `
    <div style="margin-top:20px;padding:16px;background:#ffffff;color:#000000;border:2px dashed #0284c7;border-radius:12px;box-shadow:0 8px 25px rgba(0,0,0,0.15);text-align:center" id="directMarquillaContainer">
      <div style="font-size:0.75rem;font-weight:900;color:#0284c7;margin-bottom:10px;text-transform:uppercase">
        ✂️ RÓTULO FÍSICO Y MARQUILLA DE ESTA CARPETA (LISTO PARA IMPRIMIR)
      </div>
      
      <div id="directMarquillaContent" style="display:inline-block;padding:14px;border:2px solid #0f172a;border-radius:6px;background:#ffffff;width:100%;max-width:440px;text-align:left">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0f172a;padding-bottom:4px;margin-bottom:6px;gap:12px">
          <span style="font-size:0.7rem;font-weight:900;color:#0284c7">${modulo.toUpperCase()} · ESTANTE ${slotFisico || 'C'}</span>
          <span style="font-size:0.68rem;font-weight:800;color:#475569">NIT/CC: ${nitClean}</span>
        </div>
        <div style="font-size:1.05rem;font-weight:900;color:#0f172a;margin-bottom:8px;line-height:1.2;text-transform:uppercase">
          ${titClean}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #cbd5e1;padding-top:6px;gap:10px">
          <span style="font-size:0.75rem;font-weight:700;color:#334155">${fecClean}</span>
          <span style="font-size:1.6rem;font-weight:900;color:#0284c7">#${codClean}</span>
        </div>
      </div>

      <div style="margin-top:14px">
        <button class="btn btn-primary w-full" style="padding:12px;font-size:0.95rem;font-weight:900;background:linear-gradient(135deg,#0284c7,#16a34a);border:none;box-shadow:0 4px 15px rgba(2,132,199,0.4);color:#fff" onclick="imprimirDirectoDesdeDetalle()">
          🖨️ IMPRIMIR ESTE RÓTULO AHORA (IMPRESORA / PDF)
        </button>
      </div>
    </div>
  `;

  body.innerHTML = `
    <div style="background:var(--bg-elevated);padding:14px;border-radius:var(--r-md);border:1px solid var(--border-medium);margin-bottom:14px">
      <div style="font-size:0.75rem;font-weight:700;color:var(--accent-primary);text-transform:uppercase">${modulo}</div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--text-primary);margin-top:2px">${d.codigo_unico || d.codigo_documento || (d.codigo_numerico ? '#' + d.codigo_numerico : '') || d.numero_contrato || d.cedula || d.id}</div>
      ${glowBtn}
      ${fichaBtn}
      ${pdfAttachBtn}
    </div>
    ${rowsHtml}
    ${directMarquillaHtml}
  `;
}

function imprimirDirectoDesdeDetalle() {
  const content = document.getElementById('directMarquillaContent');
  if (!content) return;
  imprimirAreaElemento(content.innerHTML, 'Rótulo de Carpeta - Coraza C.T.A.');
}

function iluminarUbicacionFisica(slotId) {
  if (!slotId) return;
  
  // Cerrar modal de búsqueda si está abierto
  const modal = document.getElementById('modalDetalleBusqueda');
  if (modal) modal.classList.remove('show');

  // Asegurar que la sección búsqueda está activa
  showSection('busqueda');

  // Quitar resaltados anteriores
  document.querySelectorAll('.slot').forEach(s => s.classList.remove('highlight'));

  // Normalizar slotId
  const idNorm = slotId.startsWith('VOXEL_') ? slotId : `VOXEL_${slotId}`;
  const el = document.getElementById(`slot_${idNorm}`);

  if (el) {
    el.classList.add('highlight');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: `✨ UBICACIÓN FÍSICA ILUMINADA`,
      text: `El compartimento ${idNorm} se encuentra brillando en el mapa de abajo.`,
      showConfirmButton: false,
      timer: 4000
    });
  } else {
    Swal.fire('Ubicación Física', `Este documento está guardado en el compartimento físico: ${slotId}`, 'info');
  }
}

function busquedaInstantanea() {
  const inp = document.getElementById('searchInput');
  const btnClear = document.getElementById('btnClearSearch');
  if (btnClear) {
    btnClear.style.display = (inp && inp.value.trim().length > 0) ? 'inline-block' : 'none';
  }
  clearTimeout(window.searchTimeout);
  window.searchTimeout = setTimeout(ejecutarBusqueda, 100);
}

function limpiarBusquedaInput() {
  const inp = document.getElementById('searchInput');
  const btnClear = document.getElementById('btnClearSearch');
  if (inp) inp.value = '';
  if (btnClear) btnClear.style.display = 'none';
  ejecutarBusqueda();
}

// Atajo global de teclado (Ctrl + K o / para ir directo a la búsqueda)
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    showSection('busqueda');
    const inp = document.getElementById('searchInput');
    if (inp) { inp.focus(); inp.select(); }
  }
});

// ==========================================
// FUNCIONALIDADES SGD CORAZA v8.0
// 1. GENERADOR DE ETIQUETA QR FISICA IMPRIMIBLE
// 2. VISOR EMBEBIDO DE PDF Y DOCUMENTOS
// 3. ESCÁNER CON CÁMARA O CÓDIGO DE BARRAS
// ==========================================

function cambiarFormatoEtiqueta(formato) {
  const vLeg = document.getElementById('vistaFormatoLegajadora');
  const vLomo = document.getElementById('vistaFormatoLomo');
  const vFrente = document.getElementById('vistaFormatoFrente');
  
  const btnLeg = document.getElementById('btnFormatoLegajadora');
  const btnL = document.getElementById('btnFormatoLomo');
  const btnF = document.getElementById('btnFormatoFrente');

  [vLeg, vLomo, vFrente].forEach(v => { if (v) v.style.display = 'none'; });
  [btnLeg, btnL, btnF].forEach(b => { if (b) b.className = 'btn btn-sm btn-ghost'; });

  if (formato === 'LEGAJADORA') {
    if (vLeg) vLeg.style.display = 'block';
    if (btnLeg) btnLeg.className = 'btn btn-sm btn-primary';
  } else if (formato === 'LOMO') {
    if (vLomo) vLomo.style.display = 'flex';
    if (btnL) btnL.className = 'btn btn-sm btn-primary';
  } else {
    if (vFrente) vFrente.style.display = 'block';
    if (btnF) btnF.className = 'btn btn-sm btn-primary';
  }
}

function generarEtiquetaQR(id, modulo, codigo, titulo, slotFisico, nit = '', numContrato = '', fechas = '', obsEstado = '') {
  // Cerrar otros modales abiertos para que el rótulo quede visible al frente
  const mDet = document.getElementById('modalDetalleRegistro');
  if (mDet) mDet.classList.remove('show');
  const mConf = document.getElementById('modalConfirmacion');
  if (mConf) mConf.classList.remove('show');

  const modal = document.getElementById('modalEtiquetaQR');
  if (!modal) return;

  const codClean = codigo ? String(codigo).replace(/^#/, '') : 'S/N';
  const codFmt = `#${codClean}`;
  const modFmt = modulo || 'CUSTODIA DOCUMENTAL';
  const titFmt = titulo || 'CARPETA ARCHIVO FISICO';
  const slotFmt = slotFisico ? (slotFisico.startsWith('VOXEL_') ? slotFisico.replace('VOXEL_', '') : slotFisico) : 'ESTANTE';

  // 1. CARPETA LEGAJADORA AZUL (FOTO 2)
  const legCod = document.getElementById('legCodigoNum');
  const legTit = document.getElementById('legTituloCliente');
  const legNit = document.getElementById('legNitDoc');
  const legFec = document.getElementById('legFechas');
  const legEst = document.getElementById('legEstadoObs');
  const legMod = document.getElementById('legModuloUbic');
  const legBox = document.getElementById('legQrCanvas');

  if (legCod) legCod.textContent = codClean;
  if (legTit) legTit.textContent = titFmt;
  if (legNit) legNit.textContent = nit ? `NIT/CC: ${nit}` : 'CORAZA SEGURIDAD CTA';
  if (legFec) legFec.textContent = fechas || new Date().toISOString().substring(0, 10);
  if (legEst) legEst.textContent = obsEstado || (numContrato ? `Contrato N° ${numContrato}` : 'Archivo Activo');
  if (legMod) legMod.textContent = `${modFmt} · ESTANTE ${slotFmt}`;

  // 2. LIBRO DE MINUTAS (FOTO 1)
  const lCod = document.getElementById('lomoCodigoNum');
  const lTit = document.getElementById('lomoTituloCliente');
  const lNit = document.getElementById('lomoNitDoc');
  const lCont = document.getElementById('lomoContratoNum');
  const lFec = document.getElementById('lomoFechas');
  const lMod = document.getElementById('lomoModuloUbic');
  const lBox = document.getElementById('lomoQrCanvas');

  if (lCod) lCod.textContent = codFmt;
  if (lTit) lTit.textContent = titFmt;
  if (lNit) lNit.textContent = nit ? `NIT/CC: ${nit}` : 'CORAZA SEGURIDAD CTA';
  if (lCont) lCont.textContent = numContrato ? `Contrato N° ${numContrato}` : modFmt;
  if (lFec) lFec.textContent = fechas || new Date().toISOString().substring(0, 10);
  if (lMod) lMod.textContent = `${modFmt} · ESTANTE ${slotFmt}`;

  // 3. ETIQUETA QR FRENTE
  const lblMod = document.getElementById('qrLabelModulo');
  const lblCod = document.getElementById('qrLabelCodigo');
  const lblTit = document.getElementById('qrLabelTitulo');
  const lblSub = document.getElementById('qrLabelSub');
  const fBox = document.getElementById('qrCanvasBox');

  if (lblMod) lblMod.textContent = `${modFmt} · CORAZA C.T.A.`;
  if (lblCod) lblCod.textContent = codFmt;
  if (lblTit) lblTit.textContent = titFmt;
  if (lblSub) lblSub.textContent = `Estante ${slotFmt} · Archivo Voxelsera`;

  // Renderizar QR en todos los contenedores
  const payload = JSON.stringify({ id, modulo: modFmt, codigo: codFmt, slot: slotFmt, app: 'SGD_CORAZA_v8' });
  
  [legBox, lBox, fBox].forEach(box => {
    if (box) {
      box.innerHTML = '';
      if (typeof QRCode !== 'undefined') {
        new QRCode(box, {
          text: payload,
          width: 75,
          height: 75,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M
        });
      } else {
        box.innerHTML = `<div style="font-size:0.65rem;font-weight:800;border:1px solid #000;padding:2px">${codClean}</div>`;
      }
    }
  });

  // Si es Minuta abre Foto 1 (Lomo Libro), si es Contrato/Retirados abre Foto 2 (Legajadora Azul)
  if (modFmt.toLowerCase().includes('minuta')) {
    cambiarFormatoEtiqueta('LOMO');
  } else {
    cambiarFormatoEtiqueta('LEGAJADORA');
  }

  modal.classList.add('show');
}

function imprimirAreaElemento(htmlContent, tituloDoc) {
  let iframe = document.getElementById('iframePrintCoraza');
  if (iframe) iframe.remove();

  iframe = document.createElement('iframe');
  iframe.id = 'iframePrintCoraza';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0px';
  iframe.style.height = '0px';
  iframe.style.border = 'none';
  iframe.style.zIndex = '-9999';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${tituloDoc || 'Impresión Coraza C.T.A.'}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; padding: 15px; background: #ffffff; color: #000000; display: flex; justify-content: center; align-items: center; margin: 0; }
          @media print {
            body { padding: 0; margin: 0; }
            @page { margin: 8mm; }
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch(e) {
      window.print();
    }
  }, 350);
}

function imprimirEtiquetaQR() {
  const printArea = document.getElementById('etiquetaPrintArea');
  if (!printArea) return;
  imprimirAreaElemento(printArea.innerHTML, 'Etiqueta Carpeta - Coraza C.T.A.');
}

function imprimirLoteTiras(modulo) {
  let items = [];
  const esMinuta = (modulo === 'minutas');

  if (modulo === 'contratos') {
    items = window.todosLosContratos || [];
  } else if (modulo === 'minutas') {
    items = window.todasLasMinutas || [];
  } else if (modulo === 'personal') {
    items = window.todoElPersonal || [];
  }

  if (!items || items.length === 0) {
    Swal.fire('Atención', 'No hay registros cargados para generar el lote de tiras.', 'warning');
    return;
  }

  const lote = items.slice(0, 30);
  let stripsHtml = '';

  lote.forEach(r => {
    const codClean = r.codigo_numerico ? String(r.codigo_numerico) : (r.codigo || r.id || 'S/N').replace('CTR-','');
    const cod = `#${codClean}`;
    const tit = (r.parte_b || r.nombre_puesto || r.nombre || r.asunto || 'REGISTRO').toUpperCase();
    const nit = r.nit || r.cedula || '';
    const num = r.numero_contrato || '';
    const fec = r.fecha_inicio ? `${String(r.fecha_inicio).substring(0,10)} -- ${r.fecha_fin ? String(r.fecha_fin).substring(0,10) : ''}` : '';
    const slot = r.voxelsera || r.ubicacion || 'ESTANTE C';

    if (esMinuta) {
      stripsHtml += `
        <div style="border: 2px dashed #000; width: 130px; height: 400px; padding: 8px; margin: 6px; float: left; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; page-break-inside: avoid; border-radius: 4px; background: #fff;">
          <div style="width: 100%; border-bottom: 2px solid #000; padding-bottom: 4px;">
            <div style="font-size: 0.55rem; font-weight: 800;">CORAZA C.T.A.</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: #0284c7;">${cod}</div>
          </div>
          <div style="font-size: 0.72rem; font-weight: 900; text-transform: uppercase;">${tit}</div>
          <div style="font-size: 0.62rem; font-weight: 700;">${fec}</div>
          <div style="font-size: 0.6rem; font-weight: 800; color: #0284c7;">MINUTAS · ${slot}</div>
          <div style="border-top: 1px solid #000; width: 100%; padding-top: 4px; font-size: 0.55rem;">SGD CORAZA v8</div>
        </div>
      `;
    } else {
      stripsHtml += `
        <div style="border: 2px dashed #000; width: 380px; height: 160px; padding: 8px; margin: 6px; float: left; display: flex; justify-content: space-between; page-break-inside: avoid; border-radius: 4px; background: #fff;">
          <div style="flex: 1; border: 1.5px solid #000; padding: 6px; display: flex; flex-direction: column; justify-content: space-between; border-radius: 4px;">
            <div style="font-size: 0.6rem; font-weight: 900; color: #0284c7;">${modulo.toUpperCase()} · ${slot}</div>
            <div style="font-size: 0.82rem; font-weight: 900; text-transform: uppercase;">${tit}</div>
            <div style="font-size: 0.65rem; font-weight: 700;">${nit ? 'NIT/CC: ' + nit : ''} ${num ? '| Contrato N° ' + num : ''}</div>
            <div style="font-size: 0.62rem; font-weight: 700;">${fec}</div>
          </div>
          <div style="width: 70px; border: 2px solid #0284c7; background: #eff6ff; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-left: 6px; border-radius: 4px;">
            <div style="font-size: 0.5rem; font-weight: 800;">CÓDIGO</div>
            <div style="font-size: 1.7rem; font-weight: 900; color: #0284c7;">${codClean}</div>
          </div>
        </div>
      `;
    }
  });

  const w = window.open('', '_blank');
  w.document.write(`
    <html>
      <head>
        <title>Impresión de Lote de Tiras - Coraza C.T.A.</title>
        <style>
          body { font-family: sans-serif; padding: 15px; margin: 0; background: #fff; color: #000; }
          .grid { display: flex; flex-wrap: wrap; gap: 8px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div style="margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 4px;">
          <h3 style="margin: 0; font-size: 1.1rem;">CORAZA SEGURIDAD C.T.A. — LOTE DE TIRAS PARA CARPETAS FÍSICAS</h3>
          <div style="font-size: 0.75rem; color: #555;">Imprima esta página, corte con tijeras por la línea punteada ✂️ y pegue en las carpetas.</div>
        </div>
        <div class="grid">
          ${stripsHtml}
        </div>
      </body>
    </html>
  `);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 500);
}

function abrirVisorPDF(url, titulo) {
  const modal = document.getElementById('modalVisorPDF');
  const frame = document.getElementById('pdfFrame');
  const lblTitle = document.getElementById('pdfViewerTitle');
  const btnDl = document.getElementById('btnPdfDownload');

  if (!modal || !frame) return;

  if (lblTitle) lblTitle.textContent = titulo || 'Documento Digitalizado';
  if (btnDl) {
    btnDl.href = url || '#';
    btnDl.setAttribute('download', titulo || 'documento.pdf');
  }

  frame.src = url || 'about:blank';
  modal.classList.add('show');
}

function abrirEscanerCamaraQR() {
  Swal.fire({
    title: '📷 Escáner de Código QR / Barras',
    text: 'Ingresa o escanea el código físico impreso en la carpeta (Ej: #362):',
    input: 'text',
    inputPlaceholder: '#362 o código de carpeta...',
    showCancelButton: true,
    confirmButtonText: '🔍 Buscar Carpeta',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#0284c7',
    inputValidator: (value) => {
      if (!value) {
        return 'Debe ingresar un código para buscar';
      }
    }
  }).then((result) => {
    if (result.isConfirmed && result.value) {
      showSection('busqueda');
      const searchInp = document.getElementById('searchInput');
      if (searchInp) {
        searchInp.value = result.value;
        ejecutarBusqueda();
      }
    }
  });
}

// ==========================================
// COLA DE IMPRESIÓN PDF (AHORRO DE PAPEL)
// ==========================================
window.colaImpresionTiras = JSON.parse(localStorage.getItem('colaTirasCoraza') || '[]');

function actualizarBadgeCola() {
  const cnt = document.getElementById('colaTirasCount');
  if (cnt) {
    cnt.textContent = window.colaImpresionTiras ? window.colaImpresionTiras.length : 0;
  }
}

function agregarAColaImpresion(item) {
  if (!window.colaImpresionTiras) window.colaImpresionTiras = [];
  
  // Evitar duplicados por ID
  const existe = window.colaImpresionTiras.some(i => i.id === item.id && i.modulo === item.modulo);
  if (!existe) {
    window.colaImpresionTiras.push(item);
    localStorage.setItem('colaTirasCoraza', JSON.stringify(window.colaImpresionTiras));
    actualizarBadgeCola();
  }
}

function quitarDeColaImpresion(idx) {
  if (window.colaImpresionTiras && window.colaImpresionTiras[idx]) {
    window.colaImpresionTiras.splice(idx, 1);
    localStorage.setItem('colaTirasCoraza', JSON.stringify(window.colaImpresionTiras));
    actualizarBadgeCola();
    abrirModalColaImpresion();
  }
}

function vaciarColaImpresion() {
  window.colaImpresionTiras = [];
  localStorage.setItem('colaTirasCoraza', JSON.stringify([]));
  actualizarBadgeCola();
  abrirModalColaImpresion();
}

function abrirModalColaImpresion() {
  actualizarBadgeCola();
  const modal = document.getElementById('modalColaImpresion');
  const body = document.getElementById('bodyColaImpresion');
  if (!modal || !body) return;

  const items = window.colaImpresionTiras || [];
  if (items.length === 0) {
    body.innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--text-muted);background:var(--bg-elevated);border-radius:var(--r-md);border:1px dashed var(--border-medium)">
        <i class="fas fa-print fa-2x" style="margin-bottom:10px;opacity:0.5"></i>
        <div style="font-weight:700">La cola de impresión está vacía.</div>
        <div style="font-size:0.8rem;margin-top:4px">Cada documento que registres se guardará aquí automáticamente para imprimir todo junto en 1 sola hoja de papel.</div>
      </div>
    `;
  } else {
    let html = `<div style="font-weight:700;font-size:0.88rem;color:var(--accent-primary);margin-bottom:10px">📄 ${items.length} tiras listas para imprimir en lote (Ahorro de Papel):</div>`;
    html += `<div style="display:flex;flex-direction:column;gap:8px">`;
    items.forEach((item, idx) => {
      html += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--bg-elevated);border:1px solid var(--border-medium);border-radius:var(--r-md)">
          <div>
            <span class="badge badge-info" style="font-size:0.68rem">${item.modulo}</span>
            <strong style="margin-left:8px;font-size:1rem;color:var(--accent-primary)">#${item.codigo}</strong>
            <span style="margin-left:10px;font-size:0.85rem;color:var(--text-primary);font-weight:600">${item.titulo}</span>
          </div>
          <button class="btn btn-sm btn-ghost" style="color:#ef4444" onclick="quitarDeColaImpresion(${idx})" title="Quitar de la cola"><i class="fas fa-times"></i></button>
        </div>
      `;
    });
    html += `</div>`;
    body.innerHTML = html;
  }

  modal.classList.add('show');
}

function imprimirHojaPdfCola() {
  const items = window.colaImpresionTiras || [];
  if (items.length === 0) {
    Swal.fire('Atención', 'No hay tiras acumuladas en la cola de impresión.', 'info');
    return;
  }

  let stripsHtml = '';

  items.forEach(r => {
    const codClean = String(r.codigo || r.id || 'S/N').replace(/^#/, '');
    const cod = `#${codClean}`;
    const tit = (r.titulo || 'REGISTRO').toUpperCase();
    const nit = r.nit || '';
    const num = r.numContrato || '';
    const fec = r.fechas || '';
    const slot = r.slotFisico || 'ESTANTE C';
    const esMinuta = r.modulo && r.modulo.toLowerCase().includes('minuta');

    if (esMinuta) {
      // Foto 1: Libro Minuta
      stripsHtml += `
        <div style="border: 2px dashed #000; width: 130px; height: 390px; padding: 8px; margin: 6px; float: left; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; page-break-inside: avoid; border-radius: 4px; background: #fff;">
          <div style="width: 100%; border-bottom: 2px solid #000; padding-bottom: 4px;">
            <div style="font-size: 0.55rem; font-weight: 800;">CORAZA C.T.A.</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: #0284c7;">${cod}</div>
          </div>
          <div style="font-size: 0.72rem; font-weight: 900; text-transform: uppercase;">${tit}</div>
          <div style="font-size: 0.62rem; font-weight: 700;">${fec}</div>
          <div style="font-size: 0.6rem; font-weight: 800; color: #0284c7;">MINUTAS · ${slot}</div>
          <div style="border-top: 1px solid #000; width: 100%; padding-top: 4px; font-size: 0.55rem;">SGD CORAZA v8</div>
        </div>
      `;
    } else {
      // Foto 2: Carpeta Legajadora Azul (Contratos / Retirados)
      stripsHtml += `
        <div style="border: 2px dashed #000; width: 380px; height: 160px; padding: 8px; margin: 6px; float: left; display: flex; justify-content: space-between; page-break-inside: avoid; border-radius: 4px; background: #fff;">
          <div style="flex: 1; border: 1.5px solid #000; padding: 6px; display: flex; flex-direction: column; justify-content: space-between; border-radius: 4px;">
            <div style="font-size: 0.6rem; font-weight: 900; color: #0284c7;">${r.modulo.toUpperCase()} · ${slot}</div>
            <div style="font-size: 0.82rem; font-weight: 900; text-transform: uppercase;">${tit}</div>
            <div style="font-size: 0.65rem; font-weight: 700;">${nit ? 'NIT/CC: ' + nit : ''} ${num ? '| Contrato N° ' + num : ''}</div>
            <div style="font-size: 0.62rem; font-weight: 700;">${fec}</div>
          </div>
          <div style="width: 70px; border: 2px solid #0284c7; background: #eff6ff; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-left: 6px; border-radius: 4px;">
            <div style="font-size: 0.5rem; font-weight: 800;">CÓDIGO</div>
            <div style="font-size: 1.7rem; font-weight: 900; color: #0284c7;">${codClean}</div>
          </div>
        </div>
      `;
    }
  });

  const fullHtml = `
    <div style="margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 4px;">
      <h3 style="margin: 0; font-size: 1.1rem;">CORAZA SEGURIDAD C.T.A. — HOJA DE TIRAS PARA CARPETAS (AHORRO DE PAPEL)</h3>
      <div style="font-size: 0.75rem; color: #555;">Imprima esta página, corte con tijeras por la línea punteada ✂️ y pegue en las carpetas.</div>
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
      ${stripsHtml}
    </div>
  `;

  imprimirAreaElemento(fullHtml, 'Impresión Ahorro de Papel - Coraza C.T.A.');

  setTimeout(() => {
    Swal.fire({
      title: '¿Impresión finalizada?',
      text: '¿Deseas vaciar la cola de impresión de tiras ahora?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, vaciar cola',
      cancelButtonText: 'Mantener en cola'
    }).then((res) => {
      if (res.isConfirmed) {
        vaciarColaImpresion();
      }
    });
  }, 1000);
}

// ==========================================
// FUNCIONES FICHA DE CUSTODIA Y PDF VINCULADO
// ==========================================

function generarEtiquetaDesdeDetalle() {
  const d = window.currentDetailRecord;
  const modulo = window.currentDetailModulo || 'CUSTODIA DOCUMENTAL';
  if (!d) return;

  const slotFisico = d.voxelsera || d.ubicacion || 'ESTANTE C';
  const codigo = d.codigo_numerico || d.numero_contrato || d.codigo_unico || d.id;
  const titulo = d.parte_b || d.nombre_puesto || d.nombre_completo || d.asunto || d.nombre || 'CARPETA ARCHIVO';
  const nit = d.nit || d.cedula || '';
  const numContrato = d.numero_contrato || '';
  const fechas = d.fecha_inicio ? `${String(d.fecha_inicio).substring(0,10)} -- ${d.fecha_fin ? String(d.fecha_fin).substring(0,10) : 'Vigente'}` : '';

  generarEtiquetaQR(d.id, modulo, codigo, titulo, slotFisico, nit, numContrato, fechas);
}

function generarFichaCustodiaDesdeDetalle() {
  const d = window.currentDetailRecord;
  const modulo = window.currentDetailModulo || 'CUSTODIA DOCUMENTAL';
  if (!d) return;

  const slotFisico = d.voxelsera || d.ubicacion || 'ESTANTE C';
  const codigo = d.codigo_numerico || d.numero_contrato || d.codigo_unico || d.id;
  const titular = d.parte_b || d.nombre_puesto || d.nombre_completo || d.asunto || d.nombre || 'CARPETA ARCHIVO';
  const nit = d.nit || d.cedula || 'N/A';
  const numContrato = d.numero_contrato || 'N/A';
  const fechas = d.fecha_inicio ? `${String(d.fecha_inicio).substring(0,10)} -- ${d.fecha_fin ? String(d.fecha_fin).substring(0,10) : 'Vigente'}` : 'N/A';

  generarFichaCustodia(d.id, modulo, codigo, titular, nit, numContrato, slotFisico, fechas);
}

function generarFichaCustodia(id, modulo, codigo, titular, nit, numContrato, slotFisico, fechas) {
  const modal = document.getElementById('modalFichaCustodia');
  if (!modal) return;

  const codClean = codigo ? String(codigo).replace(/^#/, '') : 'S/N';
  const fcCod = document.getElementById('fcCodigo');
  const fcCons = document.getElementById('fcConsecutivo');
  const fcTit = document.getElementById('fcTitular');
  const fcNit = document.getElementById('fcNit');
  const fcNum = document.getElementById('fcNumContrato');
  const fcUbi = document.getElementById('fcUbicacion');
  const fcFec = document.getElementById('fcFechas');

  if (fcCod) fcCod.textContent = `#${codClean}`;
  if (fcCons) fcCons.textContent = `CONSECUTIVO SQL: ${id || 'CTR-' + codClean}`;
  if (fcTit) fcTit.textContent = (titular || 'ENTIDAD / CLIENTE').toUpperCase();
  if (fcNit) fcNit.textContent = nit || 'N/A';
  if (fcNum) fcNum.textContent = numContrato ? `CONTRATO N° ${numContrato}` : (modulo || 'REGISTRO');
  if (fcUbi) fcUbi.textContent = `ESTANTE ${slotFisico || 'C'} · COMPARTIMENTO CUSTODIA`;
  if (fcFec) fcFec.textContent = fechas || '01/12/2011 -- 01/12/2024';

  modal.classList.add('show');
}

function imprimirFichaCustodia() {
  const printArea = document.getElementById('fichaCustodiaPrintArea');
  if (!printArea) return;
  imprimirAreaElemento(printArea.innerHTML, 'Ficha de Custodia - Coraza C.T.A.');
}

function abrirModalSubirPDF(codigo, id, modulo) {
  window.targetPdfId = id;
  window.targetPdfModulo = modulo;
  const inputCod = document.getElementById('targetPdfCodigo');
  const inputUrl = document.getElementById('targetPdfUrl');
  if (inputCod) inputCod.value = `${modulo} #${codigo}`;
  if (inputUrl) inputUrl.value = '';
  
  const modal = document.getElementById('modalSubirPDF');
  if (modal) modal.classList.add('show');
}

function guardarEnlacePDF() {
  const url = document.getElementById('targetPdfUrl')?.value.trim();
  if (!url) {
    Swal.fire('Atención', 'Por favor ingresa una URL válida del archivo PDF.', 'warning');
    return;
  }

  const pdfStorage = JSON.parse(localStorage.getItem('pdfStorageCoraza') || '{}');
  const key = `${window.targetPdfModulo}_${window.targetPdfId}`;
  pdfStorage[key] = url;
  localStorage.setItem('pdfStorageCoraza', JSON.stringify(pdfStorage));

  document.getElementById('modalSubirPDF')?.classList.remove('show');
  
  Swal.fire({
    icon: 'success',
    title: '✅ PDF Vinculado Exitosamente',
    text: 'El documento PDF ha sido enlazado al expediente digital.',
    timer: 2500,
    showConfirmButton: false
  });
}

// Inicializar badge al cargar
document.addEventListener('DOMContentLoaded', function() {
  actualizarBadgeCola();
});

// Listener Global de Rescate para Impresión de Tiras y Rótulos (Fail-Safe)
document.addEventListener('click', function(e) {
  const btn = e.target.closest('button');
  if (!btn) return;

  const text = (btn.textContent || '').toUpperCase();
  if (text.includes('GENERAR TIRA PARA LOMO') || text.includes('IMPRIMIR SOLO ESTA ETIQUETA')) {
    if (window.currentDetailRecord) {
      e.preventDefault();
      generarEtiquetaDesdeDetalle();
    }
  }
});

async function cargarWorkflows() {
  const listDiv = document.getElementById('listaWF');
  if (listDiv) {
    listDiv.innerHTML = '<div class="text-muted text-sm"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';
  }
  try {
    const res = await apiCall('/api/workflows/pendientes');
    if (res && res.success && res.workflows) {
      const badge = document.getElementById('wfBadge');
      if (badge) {
        badge.textContent = res.workflows.length;
        badge.classList.toggle('hidden', res.workflows.length === 0);
      }
      
      if (listDiv) {
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
    }
  } catch(e) {
    if (listDiv) listDiv.innerHTML = '<div class="alert alert-danger">Error de carga de workflows</div>';
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
    const pTitle = document.getElementById('pageTitle');
    if (pTitle) {
      const titles = {
        'dashboard': '📌 Panel de Control Operativo',
        'minutas': '📋 Minutas de Servicio',
        'correspondencia': '📧 Correspondencia y Radicados TRD',
        'personal': '🤝 Asociados Retirados (Personal Inactivo)',
        'contratos': '📑 Gestión Oficial de Contratos',
        'biblioteca': '📚 Biblioteca Virtual de Documentos',
        'prestamos': '🔄 Préstamos de Documentos',
        'busqueda': '🔍 Buscador Universal Omnipresente',
        'informes': '📊 Informes de Auditoría AGN',
        'usuarios': '👥 Gestión de Usuarios',
        'ajustes': '⚙️ Ajustes del Sistema'
      };
      pTitle.innerHTML = titles[secId] || secId.toUpperCase();
    }
  }

  // Resaltar ícono en barra lateral
  const buttons = document.querySelectorAll('.nav-item');
  buttons.forEach(b => {
    if(b.getAttribute('onclick') && b.getAttribute('onclick').includes(secId)) {
      b.classList.add('active');
    }
  });

  // Disparar carga de datos del módulo seleccionado automáticamente
  if (secId === 'dashboard') cargarDashboard();
  if (secId === 'correspondencia') cargarCorrespondencia();
  if (secId === 'personal') cargarPersonal();
  if (secId === 'prestamos') cargarPrestamos();
  if (secId === 'busqueda') ejecutarBusqueda();
  if (secId === 'biblioteca') cargarBiblioteca();
  if (secId === 'contratos') cargarContratos();
  if (secId === 'grafo') cargarGrafoConocimiento();
  if (secId === 'informes') resetInforme();
}

window.sistemaAlertas = [];

async function actualizarNotificacionesSistema() {
  const notifDot = document.getElementById('notifDot');
  try {
    const res = await apiCall('/api/notificaciones');
    if (res && res.success) {
      window.sistemaAlertas = res.alertas || [];
      const total = res.totalAlertas || 0;

      if (notifDot) {
        if (total > 0) {
          notifDot.style.display = 'inline-flex';
          notifDot.style.alignItems = 'center';
          notifDot.style.justifyContent = 'center';
          notifDot.style.minWidth = '18px';
          notifDot.style.height = '18px';
          notifDot.style.borderRadius = '9px';
          notifDot.style.fontSize = '0.7rem';
          notifDot.style.fontWeight = '800';
          notifDot.style.color = '#fff';
          notifDot.style.padding = '0 4px';
          notifDot.textContent = total > 9 ? '9+' : total;
          notifDot.style.background = res.alertas.some(a => a.nivel === 'critico') ? 'var(--accent-red)' : 'var(--accent-amber)';
        } else {
          notifDot.style.display = 'none';
        }
      }
    }
  } catch(e) {
    console.error('Error al actualizar notificaciones:', e);
  }
}

function mostrarNotificaciones() {
  const alertas = window.sistemaAlertas || [];
  
  if (alertas.length === 0) {
    Swal.fire({
      title: '🔔 Sin Alertas Pendientes',
      text: 'Todos los préstamos y contratos se encuentran al día.',
      icon: 'success',
      confirmButtonText: 'Entendido'
    });
    return;
  }

  let htmlCards = '<div style="display:flex;flex-direction:column;gap:12px;max-height:420px;overflow-y:auto;text-align:left;padding-right:4px">';
  
  alertas.forEach(a => {
    const isCritico = a.nivel === 'critico';
    const bgCol = isCritico ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)';
    const borderCol = isCritico ? 'var(--accent-red)' : 'var(--accent-amber)';

    htmlCards += `
      <div style="background:${bgCol};border-left:4px solid ${borderCol};border-radius:8px;padding:14px;box-shadow:0 2px 8px rgba(0,0,0,0.05)">
        <div style="font-weight:800;font-size:0.92rem;color:var(--text-primary);display:flex;align-items:center;gap:8px">
          <i class="${a.icon}" style="color:${borderCol}"></i> ${a.titulo}
        </div>
        <div style="font-size:0.83rem;color:var(--text-secondary);margin-top:6px;line-height:1.45">
          ${a.mensaje}
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm btn-ghost" onclick="Swal.close(); showSection('${a.modulo}')">
            <i class="fas fa-arrow-right"></i> Ver en ${a.modulo.toUpperCase()}
          </button>
          ${a.modulo === 'prestamos' ? `
            <button class="btn btn-sm btn-primary" onclick="Swal.close(); devolverPrestamo('${a.idRegistro}')">
              <i class="fas fa-undo"></i> Registrar Devolución
            </button>
          ` : ''}
        </div>
      </div>
    `;
  });

  htmlCards += '</div>';

  Swal.fire({
    title: `🔔 Alertas y Notificaciones (${alertas.length})`,
    html: htmlCards,
    width: '540px',
    showCloseButton: true,
    showConfirmButton: false
  });
}

function iniciarClocksYPolling() {
  actualizarNotificacionesSistema();
  setInterval(() => {
    const clock = document.getElementById('topbarClock');
    if(clock) {
      const d = new Date();
      clock.textContent = d.toLocaleTimeString();
    }
  }, 1000);

  // Polling de notificaciones cada 45 segundos
  setInterval(() => {
    actualizarNotificacionesSistema();
  }, 45000);
}

function cargarTodoElSistema() {
  try { popularSelectsConfig(); } catch(e) { console.error('Error popularSelectsConfig:', e); }
  try { cargarDashboard(); } catch(e) { console.error('Error cargarDashboard:', e); }
  try { cargarCorrespondencia(); } catch(e) { console.error('Error cargarCorrespondencia:', e); }
  try { cargarPersonal(); } catch(e) { console.error('Error cargarPersonal:', e); }
  try { cargarMapaArchivo(); } catch(e) { console.error('Error cargarMapaArchivo:', e); }
  try { cargarPrestamos(); } catch(e) { console.error('Error cargarPrestamos:', e); }
  try { cargarWorkflows(); } catch(e) { console.error('Error cargarWorkflows:', e); }
  try { cargarBiblioteca(); } catch(e) { console.error('Error cargarBiblioteca:', e); }
  try { cargarContratos(); } catch(e) { console.error('Error cargarContratos:', e); }
  try { ejecutarBusqueda(); } catch(e) { console.error('Error ejecutarBusqueda:', e); }
  try { actualizarNotificacionesSistema(); } catch(e) { console.error('Error actualizarNotificaciones:', e); }
}
// ==========================================
// 7. MÓDULO DE PRÉSTAMOS DE DOCUMENTOS
// ==========================================

async function cargarPrestamos() {
  const container = document.getElementById('listaPrestamos');
  if (!container) return;
  
  container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> Cargando préstamos desde PostgreSQL...</div>';
  
  try {
    const res = await apiCall('/api/prestamos/estado');
    if (res && res.success) {
      window.cachePrestamos = res.prestamos || [];
      renderPrestamos(window.cachePrestamos);
    } else {
      container.innerHTML = '<div class="alert alert-warning">No se pudieron obtener los préstamos</div>';
    }
  } catch (e) {
    console.error('Error al cargar préstamos:', e);
    container.innerHTML = '<div class="alert alert-danger">Error de conexión al cargar préstamos</div>';
  }
}

function renderPrestamos(lista) {
  const container = document.getElementById('listaPrestamos');
  if (!container) return;

  if (!lista || lista.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)"><i class="fas fa-folder-open" style="font-size:2rem;margin-bottom:10px;display:block"></i>No hay préstamos de documentos registrados.</div>';
    return;
  }

  let html = `
    <div class="table-container">
      <table class="table" id="tablaPrest">
        <thead>
          <tr>
            <th>ID Préstamo</th>
            <th>Solicitante</th>
            <th>Departamento</th>
            <th>Documento / Código</th>
            <th>F. Préstamo</th>
            <th>F. Devolución Estimada</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
  `;

  lista.forEach(p => {
    const estado = (p.estado || 'ACTIVO').toUpperCase();
    const isPendiente = estado === 'PENDIENTE_APROBACION';
    const isDevuelto = estado === 'DEVUELTO';
    const isVencido = estado === 'VENCIDO';
    const isRechazado = estado === 'RECHAZADO';
    
    let badgeClass = 'badge-warning';
    let iconTag = '<i class="fas fa-clock"></i>';
    
    if (isPendiente) {
      badgeClass = 'badge-info';
      iconTag = '<i class="fas fa-inbox"></i>';
    } else if (isVencido) {
      badgeClass = 'badge-danger';
      iconTag = '<i class="fas fa-exclamation-triangle"></i>';
    } else if (isDevuelto) {
      badgeClass = 'badge-success';
      iconTag = '<i class="fas fa-check-circle"></i>';
    } else if (isRechazado) {
      badgeClass = 'badge-subtle';
      iconTag = '<i class="fas fa-times-circle"></i>';
    }

    const fPrest = p.fecha_prestamo ? String(p.fecha_prestamo).substring(0, 10) : '--';
    const fDev = p.fecha_devolucion ? String(p.fecha_devolucion).substring(0, 10) : '--';

    let accionBtns = '';
    if (isPendiente) {
      accionBtns = `
        <button class="btn btn-sm btn-success" style="padding:4px 8px;font-size:0.75rem" onclick="aprobarSolicitudPrestamo('${p.id}')" title="Aprobar Solicitud"><i class="fas fa-check"></i> Aprobar</button>
        <button class="btn btn-sm btn-ghost" style="padding:4px 8px;font-size:0.75rem;color:#ef4444" onclick="rechazarSolicitudPrestamo('${p.id}')" title="Rechazar"><i class="fas fa-times"></i> Rechazar</button>
      `;
    } else if (!isDevuelto && !isRechazado) {
      accionBtns = `<button class="btn btn-sm btn-primary" onclick="devolverPrestamo('${p.id}')"><i class="fas fa-undo"></i> Registrar Devolución</button>`;
    } else if (isDevuelto) {
      accionBtns = `<span class="text-sm text-muted"><i class="fas fa-check-circle" style="color:var(--accent-green)"></i> Devuelto</span>`;
    } else {
      accionBtns = `<span class="text-sm text-muted"><i class="fas fa-times-circle" style="color:#ef4444"></i> Rechazado</span>`;
    }

    html += `
      <tr style="${isPendiente ? 'background: rgba(2, 132, 199, 0.08);' : (isVencido ? 'background: rgba(239, 68, 68, 0.04);' : '')}">
        <td><strong style="color:var(--accent-primary)">${p.id}</strong></td>
        <td>${p.solicitante || 'N/A'}</td>
        <td><span class="badge badge-subtle">${p.departamento || 'N/A'}</span></td>
        <td>
          <div style="font-weight:700">${p.documento || 'Sin título'}</div>
          <small style="color:var(--text-muted)">${p.observaciones || '--'}</small>
        </td>
        <td>${fPrest}</td>
        <td>${fDev}</td>
        <td><span class="badge ${badgeClass}">${iconTag} ${isPendiente ? 'PENDIENTE' : estado}</span></td>
        <td>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm btn-ghost" style="color:var(--accent-primary);padding:4px 8px;border-radius:var(--r-md);background:rgba(37,99,235,0.1)" onclick="mostrarDetalleRegistro('${p.id}', 'PRESTAMOS')" title="Ver detalles completos">
              <i class="fas fa-eye" style="font-size:1.1rem"></i>
            </button>
            ${accionBtns}
          </div>
        </td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
}

function copiarEnlacePublicoPrestamo() {
  const url = `${window.location.origin}/solicitud-prestamo.html`;
  navigator.clipboard.writeText(url).then(() => {
    Swal.fire({
      icon: 'success',
      title: '🔗 Enlace Copiado al Portapapeles',
      text: `Enlace público de solicitud:\n${url}\n\nPuedes compartirlo por WhatsApp o correo con cualquier persona que requiera prestar carpetas físicas.`,
      confirmButtonColor: '#0284c7'
    });
  }).catch(() => {
    Swal.fire('Enlace de Solicitud de Préstamos', url, 'info');
  });
}

async function aprobarSolicitudPrestamo(id) {
  Swal.fire({
    title: '¿Aprobar Solicitud de Préstamo?',
    text: `Al aprobar la solicitud ${id}, la carpeta cambiará a estado ACTIVO / EN PRÉSTAMO y se actualizará en el mapa de estanterías físicas.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: '✅ Sí, Aprobar y Entregar Carpeta',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#16a34a'
  }).then(async (res) => {
    if (res.isConfirmed) {
      try {
        const resp = await apiCall(`/api/prestamos/aprobar/${encodeURIComponent(id)}`, 'PUT');
        if (resp.success) {
          Swal.fire('✅ Aprobado Exitosamente', 'La solicitud ha sido aprobada y la carpeta está registrada como entregada.', 'success');
          cargarPrestamos();
        }
      } catch(e) {
        Swal.fire('Error', 'No se pudo aprobar la solicitud.', 'error');
      }
    }
  });
}

async function rechazarSolicitudPrestamo(id) {
  const { value: motivo } = await Swal.fire({
    title: 'Rechazar Solicitud de Préstamo',
    input: 'text',
    inputLabel: 'Motivo del Rechazo:',
    inputPlaceholder: 'Ej: Carpeta en revisión de auditoría / Reservada...',
    showCancelButton: true,
    confirmButtonText: '❌ Rechazar Solicitud',
    confirmButtonColor: '#ef4444'
  });

  if (motivo !== undefined) {
    try {
      const resp = await apiCall(`/api/prestamos/rechazar/${encodeURIComponent(id)}`, 'PUT', { motivoRechazo: motivo });
      if (resp.success) {
        Swal.fire('Rechazado', 'La solicitud ha sido rechazada.', 'info');
        cargarPrestamos();
      }
    } catch(e) {
      Swal.fire('Error', 'No se pudo rechazar la solicitud.', 'error');
    }
  }
}

function filtrarPrestamos() {
  if (!window.cachePrestamos) return;
  const fEstado = document.getElementById('filtroPrestEstado') ? document.getElementById('filtroPrestEstado').value : 'todos';
  const fDepto = document.getElementById('filtroPrestDepto') ? document.getElementById('filtroPrestDepto').value : 'todos';
  const fTexto = document.getElementById('filtroPrestTexto') ? document.getElementById('filtroPrestTexto').value.toLowerCase().trim() : '';

  let filtrados = window.cachePrestamos.filter(p => {
    let matchE = (fEstado === 'todos') || (String(p.estado || '').toUpperCase() === String(fEstado).toUpperCase());
    
    let matchD = true;
    if (fDepto !== 'todos') {
      const pDepto = String(p.departamento || '').toLowerCase();
      const targetSigla = fDepto.toLowerCase();
      const deptoObj = DEPTOS_MOCK.find(d => d.sigla.toLowerCase() === targetSigla);
      const targetNombre = deptoObj ? deptoObj.nombre.toLowerCase() : targetSigla;
      matchD = pDepto.includes(targetSigla) || pDepto.includes(targetNombre);
    }

    let matchT = true;
    if (fTexto) {
      const solic = String(p.solicitante || '').toLowerCase();
      const doc = String(p.documento || '').toLowerCase();
      const cod = String(p.codigo_documento || p.id || '').toLowerCase();
      matchT = solic.includes(fTexto) || doc.includes(fTexto) || cod.includes(fTexto);
    }

    return matchE && matchD && matchT;
  });

  renderPrestamos(filtrados);
}

function limpiarFiltrosPrest() {
  if (document.getElementById('filtroPrestEstado')) document.getElementById('filtroPrestEstado').value = 'todos';
  if (document.getElementById('filtroPrestDepto')) document.getElementById('filtroPrestDepto').value = 'todos';
  if (document.getElementById('filtroPrestTexto')) document.getElementById('filtroPrestTexto').value = '';
  if (window.cachePrestamos) renderPrestamos(window.cachePrestamos);
}

async function devolverPrestamo(id) {
  const confirm = await Swal.fire({
    title: '¿Confirmar Devolución?',
    text: `¿Marcar el préstamo ${id} como DEVUELTO?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, registrar devolución',
    cancelButtonText: 'Cancelar'
  });

  if (confirm.isConfirmed) {
    try {
      const res = await apiCall('/api/prestamos/devolver', 'POST', { id });
      if (res.success) {
        Swal.fire('Devuelto', res.message, 'success');
        cargarPrestamos();
        cargarDashboard();
        actualizarNotificacionesSistema();
      } else {
        Swal.fire('Error', res.message || 'No se pudo procesar la devolución', 'error');
      }
    } catch(e) {
      Swal.fire('Error', 'Fallo de conexión al servidor', 'error');
    }
  }
}

// Mock Dashboard
async function cargarDashboard() {
  const grid = document.getElementById('kpiGrid');
  if(!grid) return;

  try {
    const res = await apiCall('/api/analytics');
    if (res.success) {
      // 1. Renderizar KPIs Interactivos Cliqueables
      grid.innerHTML = `
        <div class="kpi-card" style="--kpi-color:var(--accent-primary);cursor:pointer" onclick="showSection('correspondencia')" title="Ver todas las correspondencias">
          <span class="kpi-icon">📧</span>
          <div class="kpi-value">${res.correspondencia.toLocaleString('es-CO')}</div>
          <div class="kpi-label">Correspondencia Radicada</div>
        </div>
        <div class="kpi-card" style="--kpi-color:var(--accent-green);cursor:pointer" onclick="showSection('minutas')" title="Ver todas las minutas">
          <span class="kpi-icon">📋</span>
          <div class="kpi-value">${res.minutas.toLocaleString('es-CO')}</div>
          <div class="kpi-label">Minutas Registradas</div>
        </div>
        <div class="kpi-card" style="--kpi-color:var(--accent-gold);cursor:pointer" onclick="showSection('personal')" title="Ver asociados retirados">
          <span class="kpi-icon">🤝</span>
          <div class="kpi-value">${(res.asociadosRetirados || 0).toLocaleString('es-CO')}</div>
          <div class="kpi-label">Asociados Retirados</div>
        </div>
        <div class="kpi-card" style="--kpi-color:var(--accent-violet);cursor:pointer" onclick="showSection('contratos')" title="Ver contratos vigentes">
          <span class="kpi-icon">📑</span>
          <div class="kpi-value">${(res.maxContrato || 394).toLocaleString('es-CO')}</div>
          <div class="kpi-label">Contratos (Secuencia #${res.maxContrato || 394})</div>
        </div>
        <div class="kpi-card" style="--kpi-color:var(--accent-amber);cursor:pointer" onclick="showSection('prestamos')" title="Ver préstamos de documentos">
          <span class="kpi-icon">🔄</span>
          <div class="kpi-value">${res.prestamosActivos.toLocaleString('es-CO')}</div>
          <div class="kpi-label">Préstamos Activos</div>
        </div>
        <div class="kpi-card" style="--kpi-color:var(--accent-green);cursor:pointer" onclick="showSection('prestamos')" title="Ver préstamos devueltos">
          <span class="kpi-icon">✅</span>
          <div class="kpi-value">${(res.prestamosDevueltos || 0).toLocaleString('es-CO')}</div>
          <div class="kpi-label">Préstamos Devueltos</div>
        </div>
      `;

      // 2. Renderizar Desglose de Minutas por Categoría
      const mb = res.minutasBreakdown || { SERVICIO: 1312, VISITANTES: 480, CORRESPONDENCIA: 210 };
      const totalMin = res.minutas || (mb.SERVICIO + mb.VISITANTES + mb.CORRESPONDENCIA);
      const pctServ = totalMin ? Math.round((mb.SERVICIO / totalMin) * 100) : 0;
      const pctVis = totalMin ? Math.round((mb.VISITANTES / totalMin) * 100) : 0;
      const pctCorr = totalMin ? Math.round((mb.CORRESPONDENCIA / totalMin) * 100) : 0;

      const minAnalytics = document.getElementById('minutasAnalyticsBody');
      if (minAnalytics) {
        minAnalytics.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:16px">
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:0.85rem">
                <span style="font-weight:700;color:var(--text-primary)"><i class="fas fa-cog" style="color:var(--accent-cyan)"></i> Minutas de Servicio (Puestos)</span>
                <span style="font-weight:800;color:var(--accent-cyan)">${mb.SERVICIO.toLocaleString('es-CO')} (${pctServ}%)</span>
              </div>
              <div style="width:100%;height:8px;background:var(--bg-base);border-radius:4px;overflow:hidden">
                <div style="width:${pctServ}%;height:100%;background:var(--accent-cyan);border-radius:4px"></div>
              </div>
            </div>

            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:0.85rem">
                <span style="font-weight:700;color:var(--text-primary)"><i class="fas fa-user-friends" style="color:var(--accent-green)"></i> Minutas de Visitantes</span>
                <span style="font-weight:800;color:var(--accent-green)">${mb.VISITANTES.toLocaleString('es-CO')} (${pctVis}%)</span>
              </div>
              <div style="width:100%;height:8px;background:var(--bg-base);border-radius:4px;overflow:hidden">
                <div style="width:${pctVis}%;height:100%;background:var(--accent-green);border-radius:4px"></div>
              </div>
            </div>

            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:0.85rem">
                <span style="font-weight:700;color:var(--text-primary)"><i class="fas fa-envelope-open-text" style="color:var(--accent-violet)"></i> Minutas de Novedades / Correspondencia</span>
                <span style="font-weight:800;color:var(--accent-violet)">${mb.CORRESPONDENCIA.toLocaleString('es-CO')} (${pctCorr}%)</span>
              </div>
              <div style="width:100%;height:8px;background:var(--bg-base);border-radius:4px;overflow:hidden">
                <div style="width:${pctCorr}%;height:100%;background:var(--accent-violet);border-radius:4px"></div>
              </div>
            </div>
          </div>
        `;
      }

      // 3. Renderizar Resumen de Módulos Activos
      const modResumen = document.getElementById('modulosResumenBody');
      if (modResumen) {
        modResumen.innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div style="background:var(--bg-elevated);padding:12px;border-radius:var(--r-md);border:1px solid var(--border-subtle);cursor:pointer" onclick="showSection('personal')">
              <div style="font-size:0.75rem;font-weight:700;color:var(--accent-gold);text-transform:uppercase">Asociados Retirados</div>
              <div style="font-size:1.3rem;font-weight:800;color:var(--text-primary);margin-top:2px">${(res.asociadosRetirados || 0).toLocaleString('es-CO')}</div>
              <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">100% en base de datos</div>
            </div>

            <div style="background:var(--bg-elevated);padding:12px;border-radius:var(--r-md);border:1px solid var(--border-subtle);cursor:pointer" onclick="showSection('correspondencia')">
              <div style="font-size:0.75rem;font-weight:700;color:var(--accent-primary);text-transform:uppercase">Correspondencia</div>
              <div style="font-size:1.3rem;font-weight:800;color:var(--text-primary);margin-top:2px">${res.correspondencia.toLocaleString('es-CO')}</div>
              <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">Radicados con TRD AGN</div>
            </div>

            <div style="background:var(--bg-elevated);padding:12px;border-radius:var(--r-md);border:1px solid var(--border-subtle);cursor:pointer" onclick="showSection('contratos')">
              <div style="font-size:0.75rem;font-weight:700;color:var(--accent-violet);text-transform:uppercase">Contratos Vigentes</div>
              <div style="font-size:1.3rem;font-weight:800;color:var(--text-primary);margin-top:2px">${(res.maxContrato || 394).toLocaleString('es-CO')}</div>
              <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">Último Consecutivo: #${res.maxContrato || 394}</div>
            </div>

            <div style="background:var(--bg-elevated);padding:12px;border-radius:var(--r-md);border:1px solid var(--border-subtle);cursor:pointer" onclick="showSection('prestamos')">
              <div style="font-size:0.75rem;font-weight:700;color:var(--accent-green);text-transform:uppercase">Préstamos Devueltos</div>
              <div style="font-size:1.3rem;font-weight:800;color:var(--text-primary);margin-top:2px">${(res.prestamosDevueltos || 0).toLocaleString('es-CO')}</div>
              <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">Documentos reintegrados</div>
            </div>
          </div>
        `;
      }
    }
  } catch(e) {
    grid.innerHTML = '<div class="alert alert-danger" style="grid-column:1/-1">Error al conectar servidor backend</div>';
  }
}

function mostrarModalConfirmacion(titulo, codigo, mensaje, modulo = '', tituloDoc = '', slotFisico = '') {
  document.getElementById('mIcon').textContent = '✅';
  document.getElementById('mTitle').textContent = titulo;
  document.getElementById('mCode').textContent = codigo;
  document.getElementById('mMsg').textContent = mensaje;

  const qrArea = document.getElementById('mQrAction');
  if (qrArea) {
    if (modulo && codigo) {
      const cleanTitle = (tituloDoc || 'DOCUMENTO').replace(/'/g, "\\'");
      qrArea.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:6px;margin:8px 0">
          <button class="btn btn-primary w-full" style="padding:9px;font-size:0.85rem;font-weight:800;background:linear-gradient(135deg,#0284c7,#0284c7)" onclick="generarEtiquetaQR('', '${modulo}', '${codigo}', '${cleanTitle}', '${slotFisico || 'A'}')">
            🖨️ IMPRIMIR SOLO ESTA ETIQUETA AHORA
          </button>
          <div style="font-size:0.72rem;color:var(--text-secondary);text-align:center">
            (También quedó guardada en la <strong>Cola PDF</strong> por si deseas imprimir en lote después)
          </div>
        </div>
      `;
    } else {
      qrArea.innerHTML = '';
    }
  }

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

// ==========================================
// 8. BIBLIOTECA DOCUMENTAL
// ==========================================
window._bibCarpetas = [];
window._bibArchivos = [];
window._bibCarpetaActiva = 'RAIZ';

async function cargarBiblioteca() {
  const arbolDiv = document.getElementById('arbolCarpetas');
  const contenidoDiv = document.getElementById('contenidoCarpeta');
  const carpSelect = document.getElementById('carpBib');
  const catSelect = document.getElementById('catBib');
  
  if (catSelect && catSelect.children.length === 0) {
    catSelect.innerHTML = '<option value="POLITICAS">📜 Políticas Institucionales</option><option value="MANUALES">📖 Manuales de Operaciones</option><option value="REGISTROS">📋 Reglamentos y Formatos CTA</option><option value="SST">🦺 Seguridad y Salud SG-SST</option><option value="JURIDICO">⚖️ Documentos Jurídicos</option>';
  }

  if (arbolDiv) arbolDiv.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> Cargando carpetas...</div>';

  try {
    const res = await apiCall('/api/biblioteca/arbol');
    if (res && res.success) {
      window._bibCarpetas = res.carpetas || [];
      window._bibArchivos = res.archivos || [];

      if (carpSelect) {
        let opts = '<option value="RAIZ">📁 Raíz de Biblioteca</option>';
        window._bibCarpetas.forEach(c => {
          opts += `<option value="${c.id}">📂 ${c.nombre}</option>`;
        });
        carpSelect.innerHTML = opts;
      }

      renderArbolCarpetas();
      renderContenidoCarpeta(window._bibCarpetaActiva || 'RAIZ');
    }
  } catch(e) {
    if (arbolDiv) arbolDiv.innerHTML = '<div class="alert alert-danger">Error al cargar la Biblioteca</div>';
  }
}

function renderArbolCarpetas() {
  const arbolDiv = document.getElementById('arbolCarpetas');
  if (!arbolDiv) return;

  const carpetas = window._bibCarpetas;
  const activa = window._bibCarpetaActiva || 'RAIZ';

  let html = `
    <div style="font-size:0.75rem;font-weight:800;color:var(--text-secondary);text-transform:uppercase;margin-bottom:10px">Estructura de Directorios</div>
    <div onclick="seleccionarCarpetaBib('RAIZ')" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:6px;cursor:pointer;background:${activa === 'RAIZ' ? 'var(--accent-primary)' : 'transparent'};color:${activa === 'RAIZ' ? '#fff' : 'var(--text-primary)'};font-weight:700;margin-bottom:6px">
      <i class="fas fa-folder-open"></i> Raíz de Biblioteca
    </div>
  `;

  carpetas.forEach(c => {
    const isSel = activa === c.id;
    const numArchivos = window._bibArchivos.filter(a => a.carpeta_id === c.id).length;
    html += `
      <div onclick="seleccionarCarpetaBib('${c.id}')" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:6px;cursor:pointer;background:${isSel ? 'var(--accent-primary)' : 'var(--bg-elevated)'};color:${isSel ? '#fff' : 'var(--text-primary)'};font-weight:600;margin-bottom:6px;border:1px solid ${isSel ? 'var(--accent-primary)' : 'var(--border-subtle)'}">
        <span style="display:flex;align-items:center;gap:8px"><i class="fas fa-folder" style="color:${isSel ? '#fff' : (c.color || 'var(--accent-amber)')}"></i> ${c.nombre}</span>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="badge" style="background:${isSel ? 'rgba(255,255,255,0.2)' : 'var(--bg-card)'};color:${isSel ? '#fff' : 'var(--text-muted)'}">${numArchivos}</span>
          <button class="btn btn-sm btn-ghost" onclick="eliminarCarpetaBiblioteca('${c.id}', '${c.nombre}', event)" title="Eliminar carpeta" style="padding:2px 6px;color:${isSel ? '#fff' : 'var(--accent-red)'}">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>
    `;
  });

  arbolDiv.innerHTML = html;
}

function seleccionarCarpetaBib(carpetaId) {
  window._bibCarpetaActiva = carpetaId;
  renderArbolCarpetas();
  renderContenidoCarpeta(carpetaId);
  
  const carpSelect = document.getElementById('carpBib');
  if (carpSelect) carpSelect.value = carpetaId;
}

function renderContenidoCarpeta(carpetaId) {
  const contenidoDiv = document.getElementById('contenidoCarpeta');
  if (!contenidoDiv) return;

  const archivos = window._bibArchivos.filter(a => (a.carpeta_id || 'RAIZ') === carpetaId);
  const nombreCarpeta = carpetaId === 'RAIZ' ? 'Raíz de Biblioteca' : (window._bibCarpetas.find(c => c.id === carpetaId)?.nombre || 'Carpeta Seleccionada');

  if (archivos.length === 0) {
    contenidoDiv.innerHTML = `
      <div style="font-size:0.75rem;font-weight:800;color:var(--text-secondary);text-transform:uppercase;margin-bottom:10px">Documentos en ${nombreCarpeta}</div>
      <div style="text-align:center;padding:40px 10px;color:var(--text-muted);background:var(--bg-elevated);border-radius:8px;border:1px dashed var(--border-medium)">
        <i class="fas fa-folder-open" style="font-size:2.5rem;opacity:0.3"></i>
        <div style="margin-top:10px;font-weight:600">Carpeta Vacía</div>
        <small style="color:var(--text-muted)">Utilice el formulario inferior para subir nuevos documentos a este directorio.</small>
      </div>
    `;
    return;
  }

  let html = `
    <div style="font-size:0.75rem;font-weight:800;color:var(--text-secondary);text-transform:uppercase;margin-bottom:10px">Documentos en ${nombreCarpeta} (${archivos.length})</div>
    <div style="display:flex;flex-direction:column;gap:8px;max-height:400px;overflow-y:auto">
  `;

  archivos.forEach(a => {
    const fElab = a.fecha_elaboracion ? String(a.fecha_elaboracion).substring(0, 10) : '--';
    html += `
      <div style="background:var(--bg-elevated);border:1px solid var(--border-medium);border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div>
          <div style="display:flex;align-items:center;gap:6px">
            <span class="badge badge-info" style="font-size:0.65rem;font-weight:700">${a.categoria || 'DOCUMENTO'}</span>
            <span class="badge badge-subtle" style="font-size:0.65rem;font-weight:700">v${a.version || '1.0'}</span>
          </div>
          <div style="font-weight:800;color:var(--accent-primary);font-size:0.95rem;margin-top:4px">${a.nombre}</div>
          <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px"><i class="fas fa-user-edit"></i> ${a.responsable || 'N/A'} · <i class="fas fa-calendar-alt"></i> ${fElab}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${a.url ? `<a href="${a.url}" target="_blank" class="btn btn-sm btn-primary" style="padding:6px 12px"><i class="fas fa-external-link-alt"></i> Abrir</a>` : `<span class="text-sm text-muted">Sin enlace</span>`}
          <button class="btn btn-sm btn-ghost" onclick="eliminarArchivoBiblioteca('${a.id}', '${a.nombre}')" title="Eliminar documento" style="padding:6px 10px;color:var(--accent-red);background:rgba(239,68,68,0.1)">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>
    `;
  });

  html += '</div>';
  contenidoDiv.innerHTML = html;
}

async function eliminarCarpetaBiblioteca(carpetaId, nombreCarpeta, event) {
  if (event) event.stopPropagation();

  const confirm = await Swal.fire({
    title: '¿Eliminar Carpeta?',
    text: `¿Estás seguro de eliminar la carpeta "${nombreCarpeta}"? Los documentos contenidos no se perderán, se moverán a la Raíz.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'Sí, eliminar carpeta',
    cancelButtonText: 'Cancelar'
  });

  if (confirm.isConfirmed) {
    try {
      const res = await apiCall(`/api/biblioteca/carpetas/${carpetaId}`, 'DELETE');
      if (res && res.success) {
        Swal.fire('¡Eliminada!', res.message || '✅ Carpeta eliminada con éxito', 'success');
        if (window._bibCarpetaActiva === carpetaId) window._bibCarpetaActiva = 'RAIZ';
        cargarBiblioteca();
      } else {
        Swal.fire('Error', res.message || 'No se pudo eliminar la carpeta', 'error');
      }
    } catch(e) {
      Swal.fire('Error', 'Fallo al conectar con el servidor', 'error');
    }
  }
}

async function eliminarArchivoBiblioteca(archivoId, nombreArchivo) {
  const confirm = await Swal.fire({
    title: '¿Eliminar Documento?',
    text: `¿Estás seguro de eliminar el documento "${nombreArchivo}" de la biblioteca?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (confirm.isConfirmed) {
    try {
      const res = await apiCall(`/api/biblioteca/archivos/${archivoId}`, 'DELETE');
      if (res && res.success) {
        Swal.fire('¡Eliminado!', res.message || '✅ Documento eliminado con éxito', 'success');
        cargarBiblioteca();
      } else {
        Swal.fire('Error', res.message || 'No se pudo eliminar el documento', 'error');
      }
    } catch(e) {
      Swal.fire('Error', 'Fallo al conectar con el servidor', 'error');
    }
  }
}

async function subirBiblioteca(event) {
  event.preventDefault();
  const categoria = document.getElementById('catBib').value;
  const nombre = document.getElementById('nomBib').value;
  const version = document.getElementById('verBib').value;
  const carpetaId = document.getElementById('carpBib').value;
  const fechaElab = document.getElementById('fechaBib').value;
  const url = document.getElementById('urlBib').value;
  const responsable = document.getElementById('respBib').value;
  const descCambio = document.getElementById('descBib').value;

  try {
    const res = await apiCall('/api/biblioteca/archivos', 'POST', {
      categoria, nombre, version, carpetaId, fechaElab, url, responsable, descCambio
    });

    if (res && res.success) {
      Swal.fire('¡Éxito!', res.message || '✅ Documento registrado en la biblioteca', 'success');
      document.getElementById('nomBib').value = '';
      document.getElementById('urlBib').value = '';
      document.getElementById('descBib').value = '';
      cargarBiblioteca();
    } else {
      Swal.fire('Error', res.message || 'No se pudo registrar el documento', 'error');
    }
  } catch(e) {
    Swal.fire('Error', 'Fallo de comunicación con el servidor', 'error');
  }
}

async function mostrarModalCarpeta() {
  const { value: nombreCarpeta } = await Swal.fire({
    title: '📁 Crear Nueva Carpeta en Biblioteca',
    input: 'text',
    inputLabel: 'Nombre de la carpeta',
    inputPlaceholder: 'Ej: Procedimientos Operativos 2026',
    showCancelButton: true,
    confirmButtonText: 'Crear Carpeta',
    cancelButtonText: 'Cancelar',
    inputValidator: (value) => {
      if (!value) return '¡Debe ingresar un nombre para la carpeta!';
    }
  });

  if (nombreCarpeta) {
    try {
      const res = await apiCall('/api/biblioteca/carpetas', 'POST', {
        nombre: nombreCarpeta,
        padre: window._bibCarpetaActiva || 'RAIZ',
        color: '#2563eb'
      });

      if (res && res.success) {
        Swal.fire('¡Creada!', res.message || '✅ Carpeta creada con éxito', 'success');
        cargarBiblioteca();
      } else {
        Swal.fire('Error', res.message || 'No se pudo crear la carpeta', 'error');
      }
    } catch(e) {
      Swal.fire('Error', 'Fallo al conectar con el servidor', 'error');
    }
  }
}

// ==========================================
// 9. MÓDULO DE CONTRATOS
// ==========================================
window.todosLosContratos = [];

async function cargarContratos() {
  const container = document.getElementById('listaContratos');
  const inputNum = document.getElementById('numeroContrato');

  // Auto-obtener el siguiente código consecutivo oficial (CTR-395-2026)
  try {
    const resCod = await apiCall('/api/contratos/siguiente-codigo');
    if (resCod && resCod.success && inputNum) {
      inputNum.value = resCod.codigoSugerido;
      inputNum.placeholder = resCod.codigoSugerido;
    }
  } catch(e) {}

  if (!container) return;

  container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> Cargando contratos desde PostgreSQL...</div>';

  try {
    const res = await apiCall('/api/contratos');
    if (res && res.success) {
      window.todosLosContratos = res.contratos || [];
      renderContratos(window.todosLosContratos);
    } else {
      container.innerHTML = '<div class="alert alert-danger">Error al cargar listado de contratos</div>';
    }
  } catch(e) {
    container.innerHTML = '<div class="alert alert-danger">Fallo al conectar con el servidor</div>';
  }
}

function renderContratos(lista) {
  const container = document.getElementById('listaContratos');
  if (!container) return;

  if (lista.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);background:var(--bg-elevated);border-radius:var(--r-md)">No se encontraron contratos registrados.</div>';
    return;
  }

  let html = `
    <div class="table-responsive">
      <table class="table" id="tablaContratos">
        <thead>
          <tr>
            <th>N° SECUENCIAL</th>
            <th>NÚMERO / CÓDIGO</th>
            <th>TIPO</th>
            <th>PARTES (A / B)</th>
            <th>FECHAS (INICIO - FIN)</th>
            <th>VALOR ($)</th>
            <th>ESTADO</th>
            <th>ACCIONES</th>
          </tr>
        </thead>
        <tbody>
  `;

  lista.forEach(c => {
    const numSeq = c.codigo_numerico ? `#${c.codigo_numerico}` : '--';
    const numDoc = c.numero_contrato || c.id;
    const fIni = c.fecha_inicio ? String(c.fecha_inicio).substring(0, 10) : '--';
    const fFin = c.fecha_fin ? String(c.fecha_fin).substring(0, 10) : 'Indefinido';
    const val = c.valor_contrato ? `$ ${parseFloat(c.valor_contrato).toLocaleString('es-CO')}` : 'N/A';
    const estado = (c.estado || 'VIGENTE').toUpperCase();

    let badgeClass = 'badge-active';
    if (estado === 'FINALIZADO' || estado === 'LIQUIDADO') badgeClass = 'badge-subtle';
    if (estado === 'CANCELADO' || estado === 'VENCIDO') badgeClass = 'badge-overdue';

    html += `
      <tr>
        <td><span class="badge badge-info" style="font-size:0.75rem;font-weight:800">${numSeq}</span></td>
        <td><strong style="color:var(--accent-primary)">${numDoc}</strong></td>
        <td><span class="badge badge-subtle">${c.tipo_contrato || 'General'}</span></td>
        <td>
          <div style="font-weight:700">${c.parte_a || 'CORAZA SEGURIDAD CTA'}</div>
          <small style="color:var(--text-secondary);font-weight:600"><i class="fas fa-handshake"></i> ${c.parte_b || 'N/A'}</small>
          ${c.nit ? `<div style="font-size:0.75rem;color:var(--accent-primary);font-weight:700">NIT: ${c.nit}</div>` : ''}
        </td>
        <td>
          <div style="font-size:0.82rem;font-weight:600">${fIni}</div>
          <small style="color:var(--text-muted)">Fin: ${fFin}</small>
        </td>
        <td><strong style="color:var(--accent-green)">${val}</strong></td>
        <td><span class="badge ${badgeClass}">${estado}</span></td>
        <td>
          <div style="display:flex;gap:5px;align-items:center">
            <button class="btn btn-sm btn-ghost" style="color:var(--accent-primary);padding:4px 8px;border-radius:var(--r-md);background:rgba(37,99,235,0.1)" onclick="mostrarDetalleRegistro('${c.id}', 'CONTRATOS')" title="Ver detalles del contrato">
              <i class="fas fa-eye" style="font-size:1.1rem"></i>
            </button>
            <button class="btn btn-sm btn-primary" style="padding:5px 9px;font-size:0.75rem;font-weight:800;background:linear-gradient(135deg,#0284c7,#16a34a);border:none" onclick="imprimirRotuloDirecto('CONTRATOS', '${c.id}')" title="Imprimir Rótulo / Tira de Carpeta en 1 Clic">
              <i class="fas fa-print"></i> Rótulo
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function imprimirRotuloDirecto(modulo, id) {
  // Buscar en cache local primero
  let item = null;
  if (modulo === 'CONTRATOS' && window.todosLosContratos) {
    item = window.todosLosContratos.find(c => String(c.id) === String(id));
  } else if (modulo === 'MINUTAS' && window.todasLasMinutas) {
    item = window.todasLasMinutas.find(m => String(m.id) === String(id));
  } else if (modulo === 'PERSONAL' && window.todoElPersonal) {
    item = window.todoElPersonal.find(p => String(p.id) === String(id));
  }

  if (item) {
    _construirEImprimirRotulo(item, modulo);
  } else {
    // Fallback: buscar en API
    apiCall(`/api/registro-detalle/${encodeURIComponent(modulo)}/${encodeURIComponent(id)}`)
      .then(res => {
        if (res && res.success && res.detalle) {
          _construirEImprimirRotulo(res.detalle, modulo);
        } else {
          Swal.fire('Error', 'No se pudo obtener los datos de la carpeta.', 'error');
        }
      }).catch(() => {
        Swal.fire('Error', 'Error de conexión al intentar obtener los datos del rótulo.', 'error');
      });
  }
}

function _construirEImprimirRotulo(d, modulo) {
  const codClean = String(d.codigo_numerico || d.numero_contrato || d.codigo_unico || d.id || 'S/N').replace(/^#/, '');
  const titulo = (d.parte_b || d.nombre_puesto || d.nombre_completo || d.asunto || d.nombre || 'CARPETA ARCHIVO').toUpperCase();
  const nit = d.nit || d.cedula || 'N/A';
  const numContrato = d.numero_contrato || '';
  const slot = d.voxelsera || d.ubicacion || 'C';
  const slotLabel = slot.startsWith('VOXEL_') ? slot.replace('VOXEL_', '') : slot;
  const fecIni = d.fecha_inicio ? String(d.fecha_inicio).substring(0, 10) : '';
  const fecFin = d.fecha_fin ? String(d.fecha_fin).substring(0, 10) : 'Vigente';
  const fechas = fecIni ? `${fecIni} → ${fecFin}` : 'S/F';
  const esMinuta = (modulo || '').toUpperCase().includes('MINUTA');
  const modLabel = (modulo || 'CUSTODIA DOCUMENTAL').toUpperCase();

  let html = '';

  if (esMinuta) {
    // TIRA VERTICAL (Libro de Minutas) — 3.5cm × 10.5cm
    html = `
      <div style="width:132px;min-height:397px;padding:10px 8px;border:3px solid #0f172a;border-radius:6px;
                  background:#ffffff;display:flex;flex-direction:column;justify-content:space-between;
                  align-items:center;text-align:center;font-family:system-ui,sans-serif;color:#000">
        <div style="width:100%;border-bottom:2px solid #0284c7;padding-bottom:5px">
          <div style="font-size:0.55rem;font-weight:900;color:#0284c7;letter-spacing:1px">CORAZA C.T.A.</div>
          <div style="font-size:2rem;font-weight:900;color:#0f172a">#${codClean}</div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:5px;padding:8px 0">
          <div style="font-size:0.72rem;font-weight:900;text-transform:uppercase;line-height:1.3">${titulo}</div>
          <div style="font-size:0.6rem;font-weight:700;color:#475569">${nit ? 'NIT/CC: ' + nit : ''}</div>
          <div style="font-size:0.6rem;font-weight:700;color:#64748b">${fechas}</div>
        </div>
        <div style="width:100%;border-top:2px solid #0284c7;padding-top:5px">
          <div style="font-size:0.58rem;font-weight:800;color:#0284c7">MINUTAS · EST. ${slotLabel}</div>
          <div style="font-size:0.5rem;font-weight:700;color:#94a3b8">SGD CORAZA v8.5</div>
        </div>
      </div>`;
  } else {
    // TIRA HORIZONTAL (Carpeta Legajadora Azul) — 9.5cm × 4.2cm
    html = `
      <div style="width:360px;height:158px;padding:12px;border:3px solid #0f172a;border-radius:6px;
                  background:#ffffff;display:flex;justify-content:space-between;align-items:stretch;
                  font-family:system-ui,sans-serif;color:#000;gap:10px">
        <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;border:1.5px solid #cbd5e1;border-radius:4px;padding:8px">
          <div style="font-size:0.62rem;font-weight:900;color:#0284c7;text-transform:uppercase">${modLabel} · ESTANTE ${slotLabel}</div>
          <div style="font-size:0.9rem;font-weight:900;text-transform:uppercase;line-height:1.25;color:#0f172a">${titulo}</div>
          <div>
            <div style="font-size:0.65rem;font-weight:700;color:#334155">${nit ? 'NIT/CC: ' + nit : ''} ${numContrato ? ' | Cto. N°: ' + numContrato : ''}</div>
            <div style="font-size:0.62rem;font-weight:700;color:#64748b">${fechas}</div>
          </div>
        </div>
        <div style="width:72px;border:2.5px solid #0284c7;border-radius:6px;background:#eff6ff;
                    display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
          <div style="font-size:0.48rem;font-weight:900;color:#0284c7;letter-spacing:0.5px">CÓDIGO</div>
          <div style="font-size:1.8rem;font-weight:900;color:#0284c7;line-height:1">${codClean}</div>
          <div style="font-size:0.45rem;font-weight:700;color:#94a3b8;margin-top:2px">CORAZA CTA</div>
        </div>
      </div>`;
  }

  const printHtml = `
    <div style="padding:20px;background:#f8fafc;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:16px">
      <div style="font-family:system-ui,sans-serif;font-size:0.8rem;font-weight:700;color:#475569;
                  border-bottom:2px solid #0284c7;padding-bottom:6px;margin-bottom:6px;width:100%;max-width:500px;text-align:center">
        ✂️ CORAZA SEGURIDAD C.T.A. — RÓTULO OFICIAL DE CARPETA<br>
        <span style="font-size:0.65rem;font-weight:600;color:#94a3b8">Recorte y pegue en la carpeta física</span>
      </div>
      ${html}
    </div>
  `;

  imprimirAreaElemento(printHtml, `Rótulo Carpeta #${codClean} - ${titulo}`);
}

function filtrarContratos() {
  const queryRaw = (document.getElementById('filtroContratos')?.value || '').trim();
  if (!queryRaw) {
    renderContratos(window.todosLosContratos);
    return;
  }

  const cleanQuery = queryRaw.replace(/^#/, '').toLowerCase();
  const words = cleanQuery.split(/\s+/).filter(w => w.length > 0);

  const filtrados = window.todosLosContratos.filter(c => {
    const fullText = [
      c.parte_b || '',
      c.nit || '',
      c.numero_contrato || '',
      c.codigo_numerico ? `#${c.codigo_numerico}` : '',
      c.codigo_numerico || '',
      c.id || '',
      c.parte_a || '',
      c.objeto_contrato || '',
      c.tipo_contrato || '',
      c.voxelsera || '',
      c.hoja_origen || '',
      c.estado || '',
      c.fecha_inicio || '',
      c.fecha_fin || ''
    ].join(' ').toLowerCase();

    // Debe coincidir con todas las palabras buscadas
    return words.every(word => fullText.includes(word));
  });

  renderContratos(filtrados);
}

// ==========================================
// 10. EXPORTADOR DE EXCEL (.XLSX) PROFESIONAL
// ==========================================
async function exportarExcelModulo(modulo) {
  try {
    Swal.fire({
      title: '📊 Generando Excel Oficial...',
      text: 'Exportando base de datos completa a formato Excel (.xlsx)...',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

    let data = [];
    let fileName = `SGD_Coraza_${modulo}_${new Date().toISOString().substring(0,10)}.xlsx`;
    let sheetName = modulo.toUpperCase();

    if (modulo === 'personal' || modulo === 'asociados' || modulo === 'tablaPersonal') {
      const res = await apiCall('/api/personal-inactivo');
      if (res && res.success) {
        data = (res.personal || []).map(p => ({
          'CÓDIGO NUMÉRICO': p.codigo_numerico || '--',
          'NOMBRE COMPLETO': p.nombre_completo || 'N/A',
          'CÉDULA DE CIUDADANÍA': p.cedula || 'N/A',
          'TIPO PERSONA': p.tipo_persona || 'ASOCIADO',
          'FECHA BAJA/RETIRO': p.fecha_baja ? String(p.fecha_baja).substring(0,10) : '--',
          'MOTIVO RETIRO': p.motivo_baja || 'N/A',
          'UBICACIÓN VOXELSERA': p.voxelsera || 'B1',
          'ESTADO': p.estado || 'INACTIVO'
        }));
        fileName = `Coraza_Asociados_Retirados_${new Date().toISOString().substring(0,10)}.xlsx`;
        sheetName = 'ASOCIADOS_RETIRADOS';
      }
    } else if (modulo === 'contratos' || modulo === 'tablaContratos') {
      const res = await apiCall('/api/contratos');
      if (res && res.success) {
        data = (res.contratos || []).map(c => ({
          'N° CONSECUTIVO': c.codigo_numerico ? `#${c.codigo_numerico}` : '--',
          'CÓDIGO/NÚMERO': c.numero_contrato || c.id,
          'TIPO CONTRATO': c.tipo_contrato || 'General',
          'PARTE A (CONTRATANTE)': c.parte_a || 'CORAZA SEGURIDAD CTA',
          'PARTE B (CONTRATISTA)': c.parte_b || 'N/A',
          'FECHA INICIO': c.fecha_inicio ? String(c.fecha_inicio).substring(0,10) : '--',
          'FECHA FIN': c.fecha_fin ? String(c.fecha_fin).substring(0,10) : 'Indefinido',
          'VALOR ($ COP)': c.valor_contrato ? parseFloat(c.valor_contrato) : 0,
          'UBICACIÓN VOXELSERA': c.voxelsera || 'C1',
          'ESTADO': c.estado || 'VIGENTE',
          'OBJETO DEL CONTRATO': c.objeto_contrato || 'N/A'
        }));
        fileName = `Coraza_Contratos_${new Date().toISOString().substring(0,10)}.xlsx`;
        sheetName = 'CONTRATOS';
      }
    } else if (modulo === 'correspondencia' || modulo === 'tablaCorr') {
      const res = await apiCall('/api/correspondencia');
      if (res && res.success) {
        data = (res.correspondencia || []).map(cr => ({
          'RADICADO TRD': cr.codigo_documento || cr.id,
          'FECHA DOCUMENTO': cr.fecha_documento ? String(cr.fecha_documento).substring(0,10) : '--',
          'MEDIO RECEPCIÓN': cr.medio || 'FÍSICO',
          'DEPTO ORIGEN': cr.depto_origen || 'GE',
          'DEPTO DESTINO': cr.depto_destino || 'N/A',
          'ASUNTO': cr.asunto || 'N/A',
          'ESTADO': cr.estado || 'RECIBIDO',
          'UBICACIÓN FÍSICA': cr.voxelsera || 'D1'
        }));
        fileName = `Coraza_Correspondencia_${new Date().toISOString().substring(0,10)}.xlsx`;
        sheetName = 'CORRESPONDENCIA';
      }
    } else if (modulo === 'prestamos' || modulo === 'tablaPrest') {
      const res = await apiCall('/api/prestamos/estado');
      if (res && res.success) {
        data = (res.prestamos || []).map(pr => ({
          'ID PRÉSTAMO': pr.id,
          'SOLICITANTE': pr.solicitante || 'N/A',
          'DEPARTAMENTO': pr.departamento || 'N/A',
          'DOCUMENTO PRESTADO': pr.documento || 'N/A',
          'CÓDIGO REGISTRO': pr.codigo_documento || '--',
          'FECHA PRÉSTAMO': pr.fecha_prestamo ? String(pr.fecha_prestamo).substring(0,10) : '--',
          'FECHA DEVOLUCIÓN ESTIMADA': pr.fecha_devolucion ? String(pr.fecha_devolucion).substring(0,10) : '--',
          'ESTADO': pr.estado || 'ACTIVO'
        }));
        fileName = `Coraza_Prestamos_${new Date().toISOString().substring(0,10)}.xlsx`;
        sheetName = 'PRESTAMOS';
      }
    }

    if (data.length === 0) {
      exportarTablaDOMACSV(modulo);
      return;
    }

    if (typeof XLSX !== 'undefined') {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      XLSX.writeFile(workbook, fileName);
      Swal.fire('¡Excel Generado!', `Se exportaron exitosamente ${data.length} registros a ${fileName}`, 'success');
    } else {
      descargarCSVDirecto(data, fileName.replace('.xlsx', '.csv'));
    }
  } catch(e) {
    Swal.fire('Error', 'No se pudo generar el archivo Excel: ' + e.message, 'error');
  }
}

function exportarTablaACSV(tablaId, nombreArchivo) {
  exportarExcelModulo(tablaId);
}

function exportarTablaDOMACSV(tablaId) {
  const table = document.getElementById(tablaId);
  if (!table) {
    Swal.fire('Atención', 'No se encontraron datos para exportar.', 'info');
    return;
  }
  if (typeof XLSX !== 'undefined') {
    const wb = XLSX.utils.table_to_book(table, { sheet: "DATOS" });
    XLSX.writeFile(wb, `Reporte_SGD_Coraza.xlsx`);
    Swal.fire('¡Excel Exportado!', 'El reporte se ha descargado correctamente.', 'success');
  } else {
    let csv = [];
    const rows = table.querySelectorAll('tr');
    for (let i = 0; i < rows.length; i++) {
      const row = [], cols = rows[i].querySelectorAll('td, th');
      for (let j = 0; j < cols.length - 1; j++) {
        let val = cols[j].innerText.replace(/"/g, '""').trim();
        row.push(`"${val}"`);
      }
      if (row.length > 0) csv.push(row.join(';'));
    }
    const blob = new Blob(["\ufeff" + csv.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_SGD_Coraza.csv`;
    link.click();
    Swal.fire('¡Reporte Exportado!', 'Descarga completada.', 'success');
  }
}

function descargarCSVDirecto(data, filename) {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  let csvRows = [headers.map(h => `"${h}"`).join(';')];

  data.forEach(row => {
    const values = headers.map(h => {
      const val = row[h] !== undefined && row[h] !== null ? String(row[h]).replace(/"/g, '""') : '';
      return `"${val}"`;
    });
    csvRows.push(values.join(';'));
  });

  const blob = new Blob(["\ufeff" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  Swal.fire('¡Archivo Generado!', `Se exportó el reporte a ${filename}`, 'success');
}

// ==========================================
// 11. GENERADOR DE INFORMES DE GERENCIA PDF / IMPRENTA
// ==========================================
async function generarInforme() {
  const titulo = document.getElementById('infTitulo')?.value || 'Informe de Gestión Documental';
  const notaLegal = document.getElementById('infEnunciado')?.value || 'Confidencial';
  const fInicio = document.getElementById('infFI')?.value || '';
  const fFin = document.getElementById('infFF')?.value || '';

  const chkMin = document.getElementById('chkMin')?.checked;
  const chkCorr = document.getElementById('chkCorr')?.checked;
  const chkPers = document.getElementById('chkPers')?.checked;
  const chkCont = document.getElementById('chkCont')?.checked;
  const chkPrest = document.getElementById('chkPrest')?.checked;

  try {
    Swal.fire({
      title: '📊 Consolidando Estadísticas...',
      text: 'Recopilando indicadores en tiempo real de la base de datos...',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

    const res = await apiCall('/api/analytics');
    Swal.close();

    if (!res || !res.success) {
      Swal.fire('Error', 'No se pudieron consultar los datos del servidor.', 'error');
      return;
    }

    const fechaHoy = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    const horaHoy = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    const cardConfig = document.getElementById('cardConfigInf');
    const infVacio = document.getElementById('infVacio');
    const infResultados = document.getElementById('infResultados');

    if (infVacio) infVacio.style.display = 'none';
    if (infResultados) infResultados.classList.remove('hidden');

    let html = `
      <div id="printAreaInforme" style="background:#fff;color:#0f172a;padding:36px;border-radius:12px;border:1px solid #cbd5e1;box-shadow:0 10px 25px rgba(0,0,0,0.1);margin-top:20px;font-family:'DM Sans',sans-serif">
        
        <!-- ENCABEZADO GERENCIAL OFICIAL -->
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0284c7;padding-bottom:20px;margin-bottom:24px">
          <div style="display:flex;align-items:center;gap:16px">
            <img src="logo.png" style="width:70px;height:70px;border-radius:50%;border:2px solid #0284c7;object-fit:cover" alt="Logo Coraza">
            <div>
              <h2 style="margin:0;font-family:'Syne',sans-serif;font-size:1.4rem;font-weight:800;color:#0f172a">CORAZA SEGURIDAD C.T.A.</h2>
              <div style="font-size:0.82rem;color:#64748b;font-weight:600">Cooperativa de Trabajo Asociado · NIT 800.123.456-7</div>
              <div style="font-size:0.75rem;color:#0284c7;font-weight:700;margin-top:2px">SISTEMA DE GESTIÓN DOCUMENTAL (SGD) v7.4 SECURE</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:0.75rem;font-weight:800;background:#e0f2fe;color:#0369a1;padding:4px 10px;border-radius:6px;display:inline-block;margin-bottom:6px">INFORME EJECUTIVO</div>
            <div style="font-size:0.8rem;color:#475569;font-weight:600">Fecha: ${fechaHoy} ${horaHoy}</div>
            <div style="font-size:0.75rem;color:#64748b">${fInicio && fFin ? `Rango: ${fInicio} al ${fFin}` : 'Período: General Acumulado'}</div>
          </div>
        </div>

        <!-- TÍTULO DEL INFORME -->
        <div style="text-align:center;margin-bottom:28px">
          <h1 style="font-family:'Syne',sans-serif;font-size:1.6rem;font-weight:800;color:#0f172a;margin:0 0 6px 0">${titulo.toUpperCase()}</h1>
          <p style="margin:0;font-size:0.85rem;color:#64748b;font-style:italic">${notaLegal}</p>
        </div>

        <!-- TARJETAS DE INDICADORES (MÉTRICAS CLAVE DE GERENCIA) -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:30px">
    `;

    if (chkMin) {
      html += `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #06b6d4;border-radius:8px;padding:14px">
          <div style="font-size:0.72rem;font-weight:700;color:#64748b;text-transform:uppercase">Minutas de Servicio</div>
          <div style="font-size:1.6rem;font-weight:800;color:#0891b2;margin-top:4px">${(res.minutas || 0).toLocaleString('es-CO')}</div>
          <div style="font-size:0.72rem;color:#64748b;margin-top:2px">100% Digitalizadas</div>
        </div>
      `;
    }

    if (chkCorr) {
      html += `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #2563eb;border-radius:8px;padding:14px">
          <div style="font-size:0.72rem;font-weight:700;color:#64748b;text-transform:uppercase">Correspondencia TRD</div>
          <div style="font-size:1.6rem;font-weight:800;color:#1d4ed8;margin-top:4px">${(res.correspondencia || 0).toLocaleString('es-CO')}</div>
          <div style="font-size:0.72rem;color:#64748b;margin-top:2px">Radicados Oficiales</div>
        </div>
      `;
    }

    if (chkPers) {
      html += `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #d97706;border-radius:8px;padding:14px">
          <div style="font-size:0.72rem;font-weight:700;color:#64748b;text-transform:uppercase">Asociados Retirados</div>
          <div style="font-size:1.6rem;font-weight:800;color:#b45309;margin-top:4px">${(res.asociadosRetirados || 0).toLocaleString('es-CO')}</div>
          <div style="font-size:0.72rem;color:#64748b;margin-top:2px">Hojas de Vida Custodiadas</div>
        </div>
      `;
    }

    if (chkCont) {
      html += `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #7c3aed;border-radius:8px;padding:14px">
          <div style="font-size:0.72rem;font-weight:700;color:#64748b;text-transform:uppercase">Contratos Vigentes</div>
          <div style="font-size:1.6rem;font-weight:800;color:#6d28d9;margin-top:4px">#${res.maxContrato || 394}</div>
          <div style="font-size:0.72rem;color:#64748b;margin-top:2px">Secuencia consecutiva</div>
        </div>
      `;
    }

    if (chkPrest) {
      html += `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #059669;border-radius:8px;padding:14px">
          <div style="font-size:0.72rem;font-weight:700;color:#64748b;text-transform:uppercase">Préstamos Devueltos</div>
          <div style="font-size:1.6rem;font-weight:800;color:#047857;margin-top:4px">${(res.prestamosDevueltos || 0).toLocaleString('es-CO')}</div>
          <div style="font-size:0.72rem;color:#64748b;margin-top:2px">${(res.prestamosActivos || 0)} Activos</div>
        </div>
      `;
    }

    html += `
        </div>

        <!-- DESGLOSE ESTADÍSTICO DE MINUTAS Y OPERACIONES -->
        <div style="background:#f1f5f9;border-radius:10px;padding:20px;margin-bottom:30px">
          <h3 style="margin:0 0 14px 0;font-size:1.05rem;font-weight:800;color:#1e293b"><i class="fas fa-chart-pie" style="color:#0284c7"></i> Distributivo Operativo de Registro</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">
            <div style="background:#fff;padding:12px;border-radius:8px;border:1px solid #cbd5e1">
              <span style="font-size:0.78rem;color:#64748b;font-weight:700">Puestos de Vigilancia:</span>
              <div style="font-size:1.1rem;font-weight:800;color:#0284c7;margin-top:2px">${(res.minutasBreakdown?.SERVICIO || 1312).toLocaleString('es-CO')} registros</div>
            </div>
            <div style="background:#fff;padding:12px;border-radius:8px;border:1px solid #cbd5e1">
              <span style="font-size:0.78rem;color:#64748b;font-weight:700">Control de Visitantes:</span>
              <div style="font-size:1.1rem;font-weight:800;color:#059669;margin-top:2px">${(res.minutasBreakdown?.VISITANTES || 480).toLocaleString('es-CO')} registros</div>
            </div>
            <div style="background:#fff;padding:12px;border-radius:8px;border:1px solid #cbd5e1">
              <span style="font-size:0.78rem;color:#64748b;font-weight:700">Correspondencia / Novedades:</span>
              <div style="font-size:1.1rem;font-weight:800;color:#7c3aed;margin-top:2px">${(res.minutasBreakdown?.CORRESPONDENCIA || 210).toLocaleString('es-CO')} registros</div>
            </div>
          </div>
        </div>

        <!-- SECCIÓN DE FIRMAS FORMALES DE ENTREGABLE GERENCIAL -->
        <div style="margin-top:50px;padding-top:20px;border-top:2px dashed #cbd5e1">
          <div style="font-size:0.8rem;font-weight:800;color:#475569;margin-bottom:30px;text-align:center;text-transform:uppercase">Firmas de Conformidad y Entrega Oficial</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px">
            <div style="text-align:center">
              <div style="height:45px;border-bottom:1.5px solid #0f172a;width:80%;margin:0 auto 8px auto"></div>
              <div style="font-weight:800;font-size:0.88rem;color:#0f172a">REPRESENTANTE LEGAL / GERENCIA GENERAL</div>
              <div style="font-size:0.75rem;color:#64748b">Coraza Seguridad C.T.A.</div>
            </div>
            <div style="text-align:center">
              <div style="height:45px;border-bottom:1.5px solid #0f172a;width:80%;margin:0 auto 8px auto"></div>
              <div style="font-weight:800;font-size:0.88rem;color:#0f172a">COORDINACIÓN DE GESTIÓN DOCUMENTAL</div>
              <div style="font-size:0.75rem;color:#64748b">Archivo General y Correspondencia</div>
            </div>
          </div>
        </div>

      </div>

      <!-- BOTONES DE ACCIÓN PARA IMPRIMIR / DESCARGAR PDF -->
      <div style="margin-top:20px;display:flex;gap:12px;justify-content:center">
        <button class="btn btn-primary btn-lg" onclick="imprimirInformeGerencia()" style="padding:12px 30px;font-weight:800"><i class="fas fa-print"></i> IMPRIMIR / GUARDAR EN PDF</button>
        <button class="btn btn-ghost" onclick="resetInforme()"><i class="fas fa-arrow-left"></i> Volver a Configurar</button>
      </div>
    `;

    infResultados.innerHTML = html;
  } catch(e) {
    Swal.fire('Error', 'Fallo al generar el informe: ' + e.message, 'error');
  }
}

function imprimirInformeGerencia() {
  const printContent = document.getElementById('printAreaInforme');
  if (!printContent) return;
  const originalBody = document.body.innerHTML;
  
  document.body.innerHTML = printContent.outerHTML;
  window.print();
  document.body.innerHTML = originalBody;
  window.location.reload();
}

function resetInforme() {
  const cardConfig = document.getElementById('cardConfigInf');
  const infVacio = document.getElementById('infVacio');
  const infResultados = document.getElementById('infResultados');

  if (cardConfig) cardConfig.style.display = 'block';
  if (infVacio) infVacio.style.display = 'block';
  if (infResultados) {
    infResultados.innerHTML = '';
    infResultados.classList.add('hidden');
  }
}

// ==========================================
// 12. GRAFO DE CONOCIMIENTO (GRAPHIFY LABS INTEGRATION)
// ==========================================
window.networkGrafo = null;
window.allGrafoNodes = [];
window.allGrafoEdges = [];

async function cargarGrafoConocimiento() {
  const container = document.getElementById('graphifyCanvas');
  if (!container) return;

  container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-weight:700;font-size:1.1rem"><i class="fas fa-spinner fa-spin" style="margin-right:10px;font-size:1.6rem;color:#f59e0b"></i> Construyendo Red de Conocimiento...</div>';

  try {
    const resCarpetas = await apiCall('/api/biblioteca/arbol').catch(() => ({ carpetas: [] }));

    const nodes = [];
    const edges = [];

    // 1. Hub Central
    nodes.push({
      id: 'HUB',
      label: 'CORAZA SEGURIDAD\nC.T.A. · SGD v7.4',
      shape: 'ellipse',
      size: 38,
      color: { background: '#f59e0b', border: '#d97706', highlight: { background: '#fbbf24', border: '#f59e0b' } },
      font: { color: '#fff', size: 15, bold: true, face: 'Inter' },
      shadow: { enabled: true, color: 'rgba(245,158,11,0.6)', size: 20 },
      typeGroup: 'HUB'
    });

    // 2. Departamentos Corporativos
    const deptos = [
      { sigla:'GE', nombre:'Gerencia General' },
      { sigla:'GH', nombre:'Gestión Humana' },
      { sigla:'ST', nombre:'SG-SST' },
      { sigla:'GF', nombre:'Financiera' },
      { sigla:'CP', nombre:'Compras' },
      { sigla:'CM', nombre:'Comercial' },
      { sigla:'OP', nombre:'Operaciones' },
      { sigla:'SE', nombre:'Seg. Electrónica' },
      { sigla:'SP', nombre:'Supervisión' },
      { sigla:'DJ', nombre:'Jurídico' },
      { sigla:'CE', nombre:'Cliente Externo' },
      { sigla:'AS', nombre:'Asociados CTA' }
    ];

    deptos.forEach(d => {
      const nId = `D_${d.sigla}`;
      nodes.push({
        id: nId,
        label: `${d.sigla}\n${d.nombre}`,
        shape: 'box',
        color: { background: '#0284c7', border: '#0369a1', highlight: { background: '#38bdf8', border: '#0284c7' } },
        font: { color: '#fff', size: 11, face: 'Inter' },
        shadow: { enabled: true, color: 'rgba(2,132,199,0.4)', size: 10 },
        typeGroup: 'DEPARTAMENTO'
      });
      edges.push({ from: 'HUB', to: nId, color: { color: 'rgba(2,132,199,0.5)', highlight: '#38bdf8' }, width: 2, length: 180 });
    });

    // 3. TRD Norma AGN (top 2 por depto)
    const trdMap = {
      GE: ['100-10.01 Actas','100-10.02 Resoluciones'],
      GH: ['200-20.01 Historias Lab.','200-20.02 Nómina'],
      ST: ['210-21.01 SG-SST','210-21.02 Exámenes'],
      GF: ['300-30.01 Comprobantes','300-30.02 Presupuesto'],
      CP: ['310-31.01 Órdenes Compra','310-31.02 Proveedores'],
      CM: ['320-32.01 Propuestas','320-32.02 Clientes'],
      OP: ['400-40.01 Minutas Puesto','400-40.02 Informes Op.'],
      SE: ['410-41.01 Seg. Electrónica','410-41.02 Mantenimiento'],
      SP: ['420-42.01 Supervisión','420-42.02 Turnos'],
      DJ: ['500-50.01 Contratos Vig.','500-50.02 Poderes'],
      CE: ['900-90.01 Contratos CE','900-90.02 Correspondencia'],
      AS: ['910-91.01 Actas CTA','910-91.02 Asociados Ret.']
    };

    Object.entries(trdMap).forEach(([sigla, series]) => {
      series.forEach((s, i) => {
        const tId = `TRD_${sigla}_${i}`;
        nodes.push({
          id: tId,
          label: s,
          shape: 'dot',
          size: 12,
          color: { background: '#8b5cf6', border: '#7c3aed', highlight: { background: '#a78bfa', border: '#8b5cf6' } },
          font: { color: '#ddd6fe', size: 9, face: 'Inter' },
          typeGroup: 'TRD'
        });
        edges.push({ from: `D_${sigla}`, to: tId, color: { color: 'rgba(139,92,246,0.5)' }, dashes: true, width: 1.2 });
      });
    });

    // 4. Estanterías Voxelsera
    const voxels = [
      { id:'VOX_A', label:'📋 Estante A\nMinutas de Puesto', depto:'OP' },
      { id:'VOX_B', label:'🤝 Estante B\nAsociados Retirados', depto:'GH' },
      { id:'VOX_C', label:'📑 Estante C\nContratos (#1–#394)', depto:'DJ' },
      { id:'VOX_D', label:'📧 Estante D\nCorrespondencia', depto:'GE' }
    ];
    voxels.forEach(v => {
      nodes.push({
        id: v.id,
        label: v.label,
        shape: 'database',
        color: { background: '#10b981', border: '#059669', highlight: { background: '#34d399', border: '#10b981' } },
        font: { color: '#fff', size: 10, face: 'Inter' },
        shadow: { enabled: true, color: 'rgba(16,185,129,0.4)', size: 10 },
        typeGroup: 'VOXELSERA'
      });
      edges.push({ from: `D_${v.depto}`, to: v.id, color: { color: 'rgba(16,185,129,0.6)' }, width: 2 });
    });

    // 5. Biblioteca Documental
    const carpetasBib = (resCarpetas?.carpetas || []).slice(0, 6);
    carpetasBib.forEach(c => {
      const bId = `BIB_${c.id}`;
      nodes.push({
        id: bId,
        label: `📁 ${c.nombre}`,
        shape: 'diamond',
        size: 13,
        color: { background: '#ec4899', border: '#db2777', highlight: { background: '#f472b6', border: '#ec4899' } },
        font: { color: '#fce7f3', size: 9 },
        typeGroup: 'DOCUMENTO'
      });
      edges.push({ from: 'D_GE', to: bId, color: { color: 'rgba(236,72,153,0.4)' }, dashes: true });
    });

    window.allGrafoNodes = nodes;
    window.allGrafoEdges = edges;

    // Badge
    const badge = document.getElementById('badgeGrafoNodes');
    if (badge) badge.textContent = `${nodes.length} nodos · ${edges.length} conexiones`;

    // Render con Vis.js
    if (typeof vis !== 'undefined') {
      const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
      const opts = {
        nodes: { borderWidth: 2, shadow: true },
        edges: { width: 1.5, smooth: { type: 'curvedCW', roundness: 0.2 } },
        physics: {
          barnesHut: { gravitationalConstant: -4500, centralGravity: 0.4, springLength: 130, damping: 0.15 },
          stabilization: { iterations: 200, updateInterval: 25 }
        },
        interaction: { hover: true, tooltipDelay: 150, zoomView: true, dragNodes: true, navigationButtons: true }
      };
      container.innerHTML = '';
      window.networkGrafo = new vis.Network(container, data, opts);
      window.networkGrafo.on('click', function(p) {
        if (p.nodes.length > 0) {
          const n = nodes.find(x => x.id === p.nodes[0]);
          if (n) Swal.fire({ title: n.label.replace(/\n/g,' '), html: `<b>Tipo:</b> ${n.typeGroup}<br><b>ID Nodo:</b> ${n.id}`, icon: 'info', confirmButtonText: 'Cerrar', confirmButtonColor: '#0284c7' });
        }
      });
    } else {
      container.innerHTML = '<div class="alert alert-warning" style="margin:40px">Librería Vis.js no disponible.</div>';
    }
  } catch(e) {
    container.innerHTML = `<div class="alert alert-danger" style="margin:40px">Error al construir el Grafo: ${e.message}</div>`;
  }
}

function filtrarNodosGrafo() {
  if (!window.networkGrafo) return;
  const filtro = document.getElementById('filtroGrafoTipo')?.value || 'TODOS';
  let fNodes = filtro === 'TODOS' ? window.allGrafoNodes : window.allGrafoNodes.filter(n => n.typeGroup === 'HUB' || n.typeGroup === filtro);
  const ids = new Set(fNodes.map(n => n.id));
  const fEdges = window.allGrafoEdges.filter(e => ids.has(e.from) && ids.has(e.to));
  window.networkGrafo.setData({ nodes: new vis.DataSet(fNodes), edges: new vis.DataSet(fEdges) });
}

function estabilizarGrafo() {
  if (window.networkGrafo) window.networkGrafo.stabilize();
}

function reiniciarZoomGrafo() {
  if (window.networkGrafo) window.networkGrafo.fit({ animation: { duration: 800, easingFunction: 'easeInOutQuad' } });
}


// Al arrancar la página web
window.onload = function() {
  verificarTokenActivo();
  popularSelectsConfig();
};
