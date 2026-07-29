const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
let pool = null;
let useJsonFallback = false;

try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sgd_coraza',
    ssl: isProduction ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 2000
  });
} catch(e) {
  console.log("PostgreSQL setup failed. Switching to local JSON fallback database.");
  useJsonFallback = true;
}

// JSON Fallback Mock Database Engine (Para pruebas locales sin programas instalados)
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

function getJsonData(table) {
  const filePath = path.join(DATA_DIR, `${table}.json`);
  if (!fs.existsSync(filePath)) {
    // Semillas por defecto para algunas tablas
    if (table === 'tabla_trd') {
      return [
        { id: 'TRD-001', codigo_dep: '100', nombre_dep: 'GERENCIA GENERAL', codigo_serie: '10', nombre_serie: 'COMUNICACIONES OFICIALES', codigo_subserie: '01', nombre_subserie: 'CARTAS Y MEMORANDOS', tiempo_gestion_anos: 2, tiempo_central_anos: 8, disposicion_final: 'CONSERVACION TOTAL', normativa_base: 'Código de Comercio Art. 60 / Ley 594' },
        { id: 'TRD-002', codigo_dep: '200', nombre_dep: 'GESTION HUMANA', codigo_serie: '20', nombre_serie: 'HISTORIAS LABORALES Y SG-SST', codigo_subserie: '01', nombre_subserie: 'EXAMENES MEDICOS Y SALUD OCUPACIONAL', tiempo_gestion_anos: 5, tiempo_central_anos: 15, disposicion_final: 'CONSERVACION TOTAL (20 AÑOS)', normativa_base: 'Decreto 1072 de 2015 SG-SST' },
        { id: 'TRD-003', codigo_dep: '300', nombre_dep: 'FINANCIERA Y CONTABLE', codigo_serie: '30', nombre_serie: 'REGISTROS Y COMPROBANTES CONTABLES', codigo_subserie: '01', nombre_subserie: 'COMPROBANTES DE PAGO Y FACTURAS', tiempo_gestion_anos: 3, tiempo_central_anos: 7, disposicion_final: 'ELIMINACION REGULADA', normativa_base: 'Ley 527 de 1999 / C.Co Art. 60' },
        { id: 'TRD-004', codigo_dep: '400', nombre_dep: 'OPERACIONES Y SEGURIDAD', codigo_serie: '40', nombre_serie: 'MINUTAS Y REPORTES OPERATIVOS', codigo_subserie: '01', nombre_subserie: 'NOVEDADES Y SEGUIMIENTO DE PUESTO', tiempo_gestion_anos: 2, tiempo_central_anos: 3, disposicion_final: 'SELECCION', normativa_base: 'Ley 594 de 2000 AGN' },
        { id: 'TRD-005', codigo_dep: '500', nombre_dep: 'JURIDICA Y CONTRATOS', codigo_serie: '50', nombre_serie: 'CONTRATOS Y CONVENIOS', codigo_subserie: '01', nombre_subserie: 'CONTRATOS COMERCIALES Y LABORALES', tiempo_gestion_anos: 5, tiempo_central_anos: 15, disposicion_final: 'CONSERVACION TOTAL', normativa_base: 'Ley 80 / Código de Comercio' }
      ];
    }
    if (table === 'usuarios') {
      return [
        { email: 'admin@coraza.com', password: '$2a$10$TqyYtQ8/QeYgH8C7pGkCeu7j1Xo643q.tY/0tHl5h02.73G6h4l2q', nombre: 'Administrador Principal', departamento: 'GERENCIA', estado: 'ACTIVO', rol: 'ADMINISTRADOR', salt: 'salt_static_init' }
      ];
    }
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveJsonData(table, data) {
  const filePath = path.join(DATA_DIR, `${table}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function query(text, params) {
  // Intentar primero con PostgreSQL si está disponible
  if (pool && !useJsonFallback) {
    try {
      return await pool.query(text, params);
    } catch(err) {
      console.log("PostgreSQL query failed. Switching to local JSON fallback database.");
      useJsonFallback = true;
    }
  }

  // Lógica de Mock de Consultas SQL a JSON
  const upperText = text.trim().toUpperCase();
  
  if (upperText.startsWith('SELECT * FROM TABLA_TRD')) {
    return { rows: getJsonData('tabla_trd') };
  }
  
  if (upperText.startsWith('SELECT * FROM USUARIOS WHERE EMAIL = $1')) {
    const users = getJsonData('usuarios');
    const match = users.filter(u => u.email === params[0]);
    return { rows: match };
  }

  if (upperText.startsWith('SELECT EMAIL FROM USUARIOS WHERE EMAIL = $1')) {
    const users = getJsonData('usuarios');
    const match = users.filter(u => u.email === params[0]).map(u => ({ email: u.email }));
    return { rows: match };
  }

  if (upperText.startsWith('SELECT EMAIL, NOMBRE, DEPARTAMENTO, ESTADO, ROL, ULTIMO_ACCESO FROM USUARIOS')) {
    return { rows: getJsonData('usuarios') };
  }

  if (upperText.startsWith('UPDATE USUARIOS SET ULTIMO_ACCESO = NOW() WHERE EMAIL = $1')) {
    const users = getJsonData('usuarios');
    users.forEach(u => { if (u.email === params[0]) u.ultimo_acceso = new Date(); });
    saveJsonData('usuarios', users);
    return { rows: [] };
  }

  if (upperText.startsWith('INSERT INTO USUARIOS')) {
    const users = getJsonData('usuarios');
    users.push({
      email: params[0],
      password: params[1],
      nombre: params[2],
      departamento: params[3],
      rol: params[4],
      estado: 'ACTIVO',
      salt: params[5]
    });
    saveJsonData('usuarios', users);
    return { rows: [] };
  }

  if (upperText.startsWith('SELECT CODIGO_DOCUMENTO FROM CORRESPONDENCIA') || upperText.includes('FROM CORRESPONDENCIA')) {
    const data = getJsonData('correspondencia');
    if (params && params.length > 0) {
      const matchDept = params[0];
      const match = data.filter(r => String(r.depto_origen).toUpperCase() === matchDept.toUpperCase());
      return { rows: match };
    }
    return { rows: data };
  }

  if (upperText.startsWith('SELECT CODIGO_UNICO FROM MINUTAS')) {
    return { rows: getJsonData('minutas') };
  }

  if (upperText.startsWith('SELECT ID FROM PERSONAL_INACTIVO')) {
    return { rows: getJsonData('personal_inactivo') };
  }

  if (upperText.startsWith('SELECT ID FROM CONTRATOS')) {
    return { rows: getJsonData('contratos') };
  }

  if (upperText.startsWith('INSERT INTO CORRESPONDENCIA')) {
    const data = getJsonData('correspondencia');
    data.push({
      id: params[0], codigo_documento: params[1], fecha_documento: params[2], medio: params[3], tipo_documento: params[4],
      depto_origen: params[5], depto_destino: params[6], asunto: params[7], detalle: params[8], estado: params[9],
      usuario_registro: params[10], voxelsera: params[11], codigo_unico: params[12], codigo_numerico: params[13],
      fecha_registro: new Date()
    });
    saveJsonData('correspondencia', data);
    return { rows: [] };
  }

  if (upperText.startsWith('INSERT INTO MINUTAS')) {
    const data = getJsonData('minutas');
    data.push({
      id: params[0], tipo_minuta: params[1], nombre_puesto: params[2], fecha_inicio: params[3], fecha_cierre: params[4],
      observaciones: params[5], estado: params[6], responsable: params[7], voxelsera: params[8], codigo_unico: params[9],
      codigo_numerico: params[10], fecha_registro: new Date()
    });
    saveJsonData('minutas', data);
    return { rows: [] };
  }

  if (upperText.startsWith('INSERT INTO PERSONAL_INACTIVO')) {
    const data = getJsonData('personal_inactivo');
    data.push({
      id: params[0], nombre_completo: params[1], cedula: params[2], fecha_baja: params[3], motivo_baja: params[4],
      observaciones: params[5], voxelsera: params[6], codigo_numerico: params[7], fecha_registro: new Date()
    });
    saveJsonData('personal_inactivo', data);
    return { rows: [] };
  }

  if (upperText.startsWith('INSERT INTO CONTRATOS')) {
    const data = getJsonData('contratos');
    data.push({
      id: params[0], tipo_contrato: params[1], numero_contrato: params[2], parte_a: params[3], parte_b: params[4],
      fecha_inicio: params[5], fecha_fin: params[6], valor_contrato: params[7], objeto_contrato: params[8],
      voxelsera: params[9], estado: params[10], codigo_numerico: params[11], fecha_registro: new Date()
    });
    saveJsonData('contratos', data);
    return { rows: [] };
  }

  if (upperText.startsWith('INSERT INTO PRESTAMOS')) {
    const data = getJsonData('prestamos');
    data.push({
      id: params[0], solicitante: params[1], departamento: params[2], documento: params[3], codigo_documento: params[4],
      fecha_prestamo: params[5], fecha_devolucion: params[6], estado: params[7]
    });
    saveJsonData('prestamos', data);
    return { rows: [] };
  }

  if (upperText.startsWith('INSERT INTO WORKFLOWS')) {
    const data = getJsonData('workflows');
    data.push({
      id: params[0], tipo: params[1], documento_id: params[2], solicitante: params[3], aprobador: params[4],
      estado: params[5], comentarios: params[6], dias_sla: params[7], fecha_creacion: new Date()
    });
    saveJsonData('workflows', data);
    return { rows: [] };
  }

  if (upperText.startsWith('UPDATE PRESTAMOS SET FECHA_DEVOLUCION_REAL = NOW()')) {
    const data = getJsonData('prestamos');
    data.forEach(r => { if (r.id === params[0]) { r.fecha_devolucion_real = new Date(); r.estado = 'DEVUELTO'; } });
    saveJsonData('prestamos', data);
    return { rows: [] };
  }

  if (upperText.startsWith('SELECT * FROM PRESTAMOS')) {
    return { rows: getJsonData('prestamos') };
  }

  if (upperText.startsWith('SELECT * FROM WORKFLOWS')) {
    return { rows: getJsonData('workflows') };
  }

  if (upperText.startsWith('UPDATE WORKFLOWS SET ESTADO = $1')) {
    const data = getJsonData('workflows');
    data.forEach(r => { if (r.id === params[2]) { r.estado = params[0]; r.comentarios_aprobacion = params[1]; } });
    saveJsonData('workflows', data);
    return { rows: [] };
  }

  if (upperText.startsWith('SELECT * FROM BIBLIOTECA_CARPETAS')) {
    return { rows: getJsonData('biblioteca_carpetas') };
  }

  if (upperText.startsWith('SELECT * FROM BIBLIOTECA')) {
    return { rows: getJsonData('biblioteca') };
  }

  if (upperText.startsWith('INSERT INTO BIBLIOTECA_CARPETAS')) {
    const data = getJsonData('biblioteca_carpetas');
    data.push({ id: params[0], nombre: params[1], padre: params[2], color: params[3], fecha_registro: new Date() });
    saveJsonData('biblioteca_carpetas', data);
    return { rows: [] };
  }

  if (upperText.startsWith('INSERT INTO BIBLIOTECA')) {
    const data = getJsonData('biblioteca');
    data.push({
      id: params[0], nombre: params[1], categoria: params[2], version: params[3], estado: params[4], url: params[5],
      fecha_elaboracion: params[6], descripcion_cambio: params[7], responsable: params[8], carpeta_id: params[9],
      usuario_registro: params[10], fecha_registro: new Date()
    });
    saveJsonData('biblioteca', data);
    return { rows: [] };
  }

  if (upperText.startsWith('SELECT ID, TIPO_MINUTA, NOMBRE_PUESTO, CODIGO_UNICO, FECHA_REGISTRO FROM MINUTAS')) {
    return { rows: getJsonData('minutas') };
  }

  if (upperText.startsWith('SELECT ID, CODIGO_DOCUMENTO, ASUNTO, DETALLE, FECHA_REGISTRO FROM CORRESPONDENCIA')) {
    return { rows: getJsonData('correspondencia') };
  }

  if (upperText.startsWith('SELECT ID, TIPO_CONTRATO, NUMERO_CONTRATO, OBJETO_CONTRATO, FECHA_REGISTRO FROM CONTRATOS')) {
    return { rows: getJsonData('contratos') };
  }

  if (upperText.startsWith('SELECT * FROM LOG_AUDITORIA')) {
    return { rows: getJsonData('log_auditoria') };
  }

  if (upperText.startsWith('INSERT INTO LOG_AUDITORIA')) {
    const data = getJsonData('log_auditoria');
    data.push({
      id: data.length + 1, usuario: params[0], modulo: params[1], accion: params[2], detalle: params[3],
      estado: params[4], respuesta: params[5], version: params[6], fecha: new Date()
    });
    saveJsonData('log_auditoria', data);
    return { rows: [] };
  }

  if (upperText.startsWith('SELECT COUNT(*) FROM CORRESPONDENCIA')) {
    return { rows: [{ count: getJsonData('correspondencia').length }] };
  }

  if (upperText.startsWith('SELECT COUNT(*) FROM MINUTAS')) {
    return { rows: [{ count: getJsonData('minutas').length }] };
  }

  if (upperText.startsWith('SELECT COUNT(*) FROM CONTRATOS')) {
    return { rows: [{ count: getJsonData('contratos').length }] };
  }

  if (upperText.startsWith('SELECT COUNT(*) FROM PRESTAMOS WHERE ESTADO = \'ACTIVO\'')) {
    return { rows: [{ count: getJsonData('prestamos').filter(r => r.estado === 'ACTIVO').length }] };
  }

  return { rows: [] };
}

module.exports = {
  query,
  pool
};
