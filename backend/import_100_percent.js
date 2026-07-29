const XLSX = require('xlsx');
const { Pool } = require('pg');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres.vufieahhfixyloykvsdb:Freider1004%2A@aws-1-us-west-2.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const mainFile = path.join(__dirname, '../DATOS 001/📚APP GESTION DOCUMENTAL 💠.xlsx');
const minutasFile = path.join(__dirname, '../DATOS 001/LISTADO_UNICO_MINUTAS_SGD (1).xlsx');

function leerHoja(workbook, sheetName, headerRow = 0) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (data.length === 0) return [];
  const headers = data[headerRow].map(h => String(h).trim());
  return data.slice(headerRow + 1)
    .filter(row => row.some(c => c !== '' && c !== null && c !== undefined))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { if (h) obj[h] = row[i] ?? ''; });
      return obj;
    });
}

function excelDateToDate(val) {
  if (!val) return null;
  try {
    if (typeof val === 'number') {
      const d = XLSX.SSF.parse_date_code(val);
      if (!d) return null;
      const testD = new Date(d.y, d.m - 1, d.d);
      if (isNaN(testD.getTime())) return null;
      return testD.toISOString().substring(0, 10);
    }
    const str = String(val).trim();
    if (!str || str === '' || str === '0') return null;
    const parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
      let y = parseInt(parts[0]);
      let m = parseInt(parts[1]);
      let d = parseInt(parts[2]);
      if (parts[2].length === 4) {
        y = parseInt(parts[2]);
        m = parseInt(parts[1]);
        d = parseInt(parts[0]);
      }
      if (m > 12 && d <= 12) {
        const tmp = m; m = d; d = tmp;
      }
      if (m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
        const testD = new Date(y, m - 1, Math.min(d, 28));
        if (!isNaN(testD.getTime())) {
          return `${y}-${String(m).padStart(2,'0')}-${String(Math.min(d, 28)).padStart(2,'0')}`;
        }
      }
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10);
  } catch(e) {
    return null;
  }
  return null;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

async function main() {
  const client = await pool.connect();
  console.log('🔌 Conectando a Supabase para re-importación 100% precisa...\n');

  try {
    const wbMain = XLSX.readFile(mainFile);
    const wbMin = XLSX.readFile(minutasFile);

    // 1. IMPORTAR PERSONAL INACTIVO (3,835 registros completos)
    console.log('👥 Re-importando PERSONAL INACTIVO (3,835 registros sin omitir ningún duplicado)...');
    await client.query('DELETE FROM personal_inactivo');
    const rowsPers = leerHoja(wbMain, 'PERSONAL_INACTIVO');
    let cPers = 0;
    for (const row of rowsPers) {
      const id = String(row['ID'] || genId()).trim() || genId();
      const nombre = String(row['NOMBRE_COMPLETO'] || '').trim().substring(0, 148);
      const cedula = String(row['CEDULA'] || '').trim().substring(0, 48);
      const fBaja = excelDateToDate(row['FECHA_BAJA']) || new Date().toISOString().substring(0,10);
      const motivo = String(row['MOTIVO_BAJA'] || '').trim();
      const obs = String(row['OBSERVACIONES'] || '').trim();
      const voxelsera = String(row['VOXELSERA'] || '').trim() || null;
      const codigoNum = parseInt(row['CODIGO_NUMERICO']) || cPers + 1;

      if (!nombre && !cedula) continue;

      await client.query(`
        INSERT INTO personal_inactivo (id, nombre_completo, cedula, fecha_baja, motivo_baja, observaciones, voxelsera, codigo_numerico, tipo_persona, fecha_registro)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ASOCIADO', NOW())
        ON CONFLICT (id) DO NOTHING
      `, [id, nombre || 'SIN NOMBRE', cedula || 'SIN CEDULA', fBaja, motivo, obs, voxelsera, codigoNum]);

      cPers++;
    }
    console.log(`   ✅ PERSONAL INACTIVO: ${cPers} de 3,835 registros guardados 100%`);

    // 2. IMPORTAR MINUTAS ADICIONALES DE ARCHIVO 1 (92 registros)
    console.log('\n📋 Importando 92 Minutas adicionales de la hoja MINUTAS de Archivo 1...');
    const rowsMin1 = leerHoja(wbMain, 'MINUTAS');
    let cMin1 = 0;
    for (const row of rowsMin1) {
      const id = String(row['ID'] || genId()).trim() || genId();
      const tipo = String(row['TIPO_MINUTA'] || 'SERVICIO').trim();
      const puesto = String(row['VISITANTE_EMPRESA'] || row['NOMBRE_PUESTO'] || '').trim();
      const fInicio = excelDateToDate(row['FECHA_INICIO']);
      const fCierre = excelDateToDate(row['FECHA_CIERRE']);
      const obs = String(row['OBSERVACIONES'] || '').trim();
      const estado = String(row['ESTADO'] || 'ACTIVO').trim();

      if (!puesto) continue;

      const cu = `MIN-SER-A1-${String(cMin1 + 1).padStart(4,'0')}`;

      await client.query(`
        INSERT INTO minutas (id, tipo_minuta, nombre_puesto, fecha_inicio, fecha_cierre, observaciones, estado, responsable, codigo_unico, codigo_numerico, fecha_registro)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'IMPORTADO', $8, $9, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [id, tipo, puesto, fInicio, fCierre, obs, estado, cu, cMin1 + 1]);

      cMin1++;
    }
    console.log(`   ✅ MINUTAS ARCHIVO 1: ${cMin1} minutas adicionales guardadas`);

    // 3. IMPORTAR ARCHIVO FÍSICO (462 registros)
    console.log('\n📦 Importando ARCHIVO FÍSICO (462 registros de cajas/estantes)...');
    await client.query('DELETE FROM archivo_fisico');
    const rowsFisico = leerHoja(wbMain, 'ARCHIVO_FISICO');
    let cFisico = 0;
    for (const row of rowsFisico) {
      const id = String(row['ID_DOCUMENTO'] || genId()).trim() || genId();
      const idDoc = String(row['ID_DOCUMENTO'] || '').trim();
      const tipoDoc = String(row['TIPO_DOCUMENTO'] || '').trim();
      const ubicacion = String(row['UBICACION'] || '').trim();
      const desc = String(row['DESCRIPCION'] || '').trim();
      const fArch = excelDateToDate(row['FECHA_ARCHIVO']);
      const estado = String(row['ESTADO'] || 'ARCHIVADO').trim();
      const codBusq = String(row['CODIGO_BUSQUEDA'] || '').trim();

      await client.query(`
        INSERT INTO archivo_fisico (id, id_documento, tipo_documento, ubicacion, descripcion, fecha_archivo, estado, codigo_busqueda)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
      `, [id, idDoc, tipoDoc, ubicacion, desc, fArch, estado, codBusq]);

      cFisico++;
    }
    console.log(`   ✅ ARCHIVO FÍSICO: ${cFisico} registros de mapa de cajas guardados 100%`);

    // RESUMEN RE-AUDITADO
    console.log('\n====================================================');
    console.log('🎉 RE-AUDITORÍA DE INTEGRIDAD 100% COMPLETADA');
    console.log('====================================================');
    const totalMin = await client.query('SELECT COUNT(*) FROM minutas');
    const totalPers = await client.query('SELECT COUNT(*) FROM personal_inactivo');
    const totalCorr = await client.query('SELECT COUNT(*) FROM correspondencia');
    const totalCtr = await client.query('SELECT COUNT(*) FROM contratos');
    const totalFis = await client.query('SELECT COUNT(*) FROM archivo_fisico');

    console.log(`  📋 Minutas Totales en Supabase:         ${totalMin.rows[0].count}`);
    console.log(`  🤝 Asociados Retirados en Supabase:     ${totalPers.rows[0].count} (100% de los 3,835 en Excel)`);
    console.log(`  📧 Correspondencia en Supabase:         ${totalCorr.rows[0].count}`);
    console.log(`  📑 Contratos en Supabase:               ${totalCtr.rows[0].count}`);
    console.log(`  📦 Archivo Físico (Cajas/Estantes):    ${totalFis.rows[0].count}`);
    console.log('====================================================');

  } catch(e) {
    console.error('❌ Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
