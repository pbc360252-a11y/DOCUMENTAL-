const { Pool } = require('pg');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://postgres.vufieahhfixyloykvsdb:Freider1004%2A@aws-1-us-west-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

function isValidCalendarDate(y, m, d) {
  if (isNaN(y) || isNaN(m) || isNaN(d)) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && (dt.getUTCMonth() + 1) === m && dt.getUTCDate() === d;
}

function excelDateToString(serial) {
  if (!serial) return null;
  if (typeof serial === 'string') {
    const clean = serial.trim();
    if (clean.includes('-')) {
      const parts = clean.split('-');
      if (parts.length === 2 && parts[0].includes('/')) {
        return excelDateToString(parts[0]);
      }
    }
    if (clean.includes('/')) {
      const parts = clean.split('/');
      if (parts.length === 3) {
        let d = parseInt(parts[0].trim(), 10);
        let m = parseInt(parts[1].trim(), 10);
        let y = parseInt(parts[2].trim(), 10);
        if (y < 100) y += 2000;
        if (isValidCalendarDate(y, m, d)) {
          return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
      }
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const parts = clean.split('-').map(Number);
      if (isValidCalendarDate(parts[0], parts[1], parts[2])) return clean;
    }
    return null;
  }
  if (!isNaN(serial) && Number(serial) > 1000) {
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      const y = date.getUTCFullYear();
      const m = date.getUTCMonth() + 1;
      const d = date.getUTCDate();
      if (isValidCalendarDate(y, m, d)) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
  }
  return null;
}

async function reindexContratos() {
  console.log('=== REESTRUCTURANDO BASE DE DATOS DE CONTRATOS EN SUPABASE ===\n');

  const wb = XLSX.readFile(path.join(__dirname, '../CONTRATOS/CONTROL SISTEMA ARCHIVO COMERCIAL INACTIVO ACTUALIZADO.xlsx'));

  // Limpiar tabla contratos en Supabase para mapeo exacto de codigos fisicos
  await pool.query('TRUNCATE TABLE contratos RESTART IDENTITY');
  console.log('✅ Tabla contratos reiniciada en Supabase');

  const finalContratos = [];

  // =========================================================================
  // HOJA 1: ARCHIVO COMERCIAL (362 CONTRATOS FISICOS, N° 1 A 362)
  // =========================================================================
  const ws1 = wb.Sheets['ARCHIVO COMERCIAL'];
  const raw1 = XLSX.utils.sheet_to_json(ws1, {defval:''});

  raw1.slice(1).forEach(r => {
    const numFisico = Number(r['__EMPTY']);
    const nit = String(r['__EMPTY_1'] || '').trim();
    const nombre = String(r['CONTROL DOCUMENTAL \r\nARCHIVO COMERCIAL'] || '').trim();
    const numContrato = String(r['__EMPTY_2'] || '').trim();

    if (!nombre || nombre === 'NOMBRE DEL PUESTO' || isNaN(numFisico) || numFisico <= 0) return;

    finalContratos.push({
      id: 'CTR-' + String(numFisico).padStart(4, '0'),
      tipo_contrato: 'VIGILANCIA Y SEGURIDAD',
      numero_contrato: numContrato || String(numFisico),
      parte_a: 'CORAZA SEGURIDAD C.T.A.',
      parte_b: nombre,
      nit: nit,
      fecha_inicio: excelDateToString(r['__EMPTY_3']),
      fecha_fin: excelDateToString(r['__EMPTY_4']),
      valor_contrato: 0,
      objeto_contrato: 'PRESTACION DE SERVICIOS DE VIGILANCIA Y SEGURIDAD PRIVADA',
      voxelsera: 'C',
      estado: 'INACTIVO',
      codigo_numerico: numFisico, // EXACTAMENTE EL N° FISICO DEL EXCEL (Ej: 362 para Tierra Grata Cumbres)
      hoja_origen: 'ARCHIVO COMERCIAL'
    });
  });

  console.log(`✅ ${finalContratos.length} contratos de ARCHIVO COMERCIAL procesados (N° 1 al 362)`);

  let currentId = 363;

  // =========================================================================
  // HOJA 2: CONTRATO DE SEGURIDAD ELECTRONICA (5 CONTRATOS)
  // =========================================================================
  const ws3 = wb.Sheets['CONTRATO DE SEGURIDAD ELECTRONI'];
  const raw3 = XLSX.utils.sheet_to_json(ws3, {defval:''});
  const col3 = Object.keys(raw3[0] || {});
  raw3.forEach(r => {
    const nit = String(r[col3[1]] || '').trim();
    const nombre = String(r[col3[2]] || '').trim();
    const numContrato = String(r[col3[3]] || '').trim();
    if (!nit || !nombre || nombre.includes('NOMBRE DEL PUESTO')) return;

    finalContratos.push({
      id: 'CTR-' + String(currentId).padStart(4, '0'),
      tipo_contrato: 'SEGURIDAD ELECTRONICA',
      numero_contrato: numContrato || String(currentId),
      parte_a: 'CORAZA SEGURIDAD C.T.A.',
      parte_b: nombre,
      nit: nit,
      fecha_inicio: excelDateToString(r[col3[4]]),
      fecha_fin: excelDateToString(r[col3[5]]),
      valor_contrato: 0,
      objeto_contrato: 'PRESTACION DE SERVICIOS DE SEGURIDAD ELECTRONICA',
      voxelsera: 'C',
      estado: 'INACTIVO',
      codigo_numerico: currentId,
      hoja_origen: 'SEGURIDAD ELECTRONICA'
    });
    currentId++;
  });

  // =========================================================================
  // HOJA 3: ESCOLTAS (4 CONTRATOS)
  // =========================================================================
  const ws4 = wb.Sheets['ESCOLTAS'];
  const raw4 = XLSX.utils.sheet_to_json(ws4, {defval:''});
  const col4 = Object.keys(raw4[0] || {});
  raw4.slice(1).forEach(r => {
    const nit = String(r[col4[1]] || '').trim();
    const nombre = String(r[col4[2]] || '').trim();
    const numContrato = String(r[col4[3]] || '').trim();
    if (!nit || !nombre || nombre.includes('NOMBRE DEL PUESTO')) return;

    finalContratos.push({
      id: 'CTR-' + String(currentId).padStart(4, '0'),
      tipo_contrato: 'ESCOLTA',
      numero_contrato: numContrato || String(currentId),
      parte_a: 'CORAZA SEGURIDAD C.T.A.',
      parte_b: nombre,
      nit: nit,
      fecha_inicio: excelDateToString(r[col4[4]]),
      fecha_fin: excelDateToString(r[col4[5]]),
      valor_contrato: 0,
      objeto_contrato: 'PRESTACION DE SERVICIOS DE ESCOLTA',
      voxelsera: 'C',
      estado: 'INACTIVO',
      codigo_numerico: currentId,
      hoja_origen: 'ESCOLTAS'
    });
    currentId++;
  });

  // =========================================================================
  // HOJA 4: CARPETAS PARA ESCANEAR (REVISAR SI HAY CONTRATOS ADICIONALES)
  // =========================================================================
  const ws2 = wb.Sheets['CARPETAS PARA ESCANEAR'];
  const raw2 = XLSX.utils.sheet_to_json(ws2, {defval:''});
  const nombresExistentes = new Set(finalContratos.map(c => c.parte_b.toLowerCase().trim()));

  raw2.slice(1).forEach(r => {
    const nit = String(r['__EMPTY'] || '').trim();
    const nombre = String(r['__EMPTY_1'] || '').trim();
    const numContrato = String(r['__EMPTY_4'] || '').trim();

    if (!nombre || nombre === 'NOMBRE DEL PUESTO' || nombresExistentes.has(nombre.toLowerCase().trim())) return;

    nombresExistentes.add(nombre.toLowerCase().trim());
    finalContratos.push({
      id: 'CTR-' + String(currentId).padStart(4, '0'),
      tipo_contrato: 'VIGILANCIA Y SEGURIDAD',
      numero_contrato: numContrato || String(currentId),
      parte_a: 'CORAZA SEGURIDAD C.T.A.',
      parte_b: nombre,
      nit: nit,
      fecha_inicio: excelDateToString(r['__EMPTY_2']),
      fecha_fin: excelDateToString(r['__EMPTY_3']),
      valor_contrato: 0,
      objeto_contrato: 'DOCUMENTO PENDIENTE POR ESCANEAR',
      voxelsera: 'C',
      estado: 'INACTIVO',
      codigo_numerico: currentId,
      hoja_origen: 'CARPETAS PARA ESCANEAR'
    });
    currentId++;
  });

  console.log(`📊 TOTAL REGISTROS UNICOS A INSERTAR: ${finalContratos.length}`);

  // Insertar lote en Supabase
  for (const c of finalContratos) {
    await pool.query(
      `INSERT INTO contratos (
        id, tipo_contrato, numero_contrato, parte_a, parte_b, nit, 
        fecha_inicio, fecha_fin, valor_contrato, objeto_contrato, 
        voxelsera, estado, codigo_numerico, hoja_origen, fecha_registro
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())`,
      [
        c.id, c.tipo_contrato, String(c.numero_contrato), c.parte_a, c.parte_b, c.nit || null,
        c.fecha_inicio, c.fecha_fin, c.valor_contrato || 0,
        c.objeto_contrato, c.voxelsera || 'C', c.estado || 'INACTIVO',
        c.codigo_numerico, c.hoja_origen
      ]
    );
  }

  console.log('✅ INSERCIÓN EN SUPABASE FINALIZADA CON ÉXITO');

  // Guardar en JSON local también
  const jsonPath = path.join(__dirname, 'data/contratos.json');
  fs.writeFileSync(jsonPath, JSON.stringify(finalContratos, null, 2), 'utf8');
  console.log('✅ Guardado en backend/data/contratos.json');

  // Verificar el contrato #362 de Tierra Grata Cumbres especificamente
  const tg = await pool.query("SELECT * FROM contratos WHERE parte_b LIKE '%TIERRA GRATA CUMBRES%' OR codigo_numerico = 362");
  console.log('\n=== VERIFICACION CONTRATO #362 TIERRA GRATA CUMBRES ===');
  console.log(JSON.stringify(tg.rows, null, 2));

  pool.end();
}

reindexContratos().catch(err => {
  console.error('❌ Error:', err);
  pool.end();
});
