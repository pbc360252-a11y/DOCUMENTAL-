const XLSX = require('xlsx');
const { Pool } = require('pg');
const path = require('path');

const DATABASE_URL = process.argv[2] || 'postgresql://postgres.vufieahhfixyloykvsdb:Freider1004%2A@aws-1-us-west-2.pooler.supabase.com:6543/postgres';

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
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (!d) return null;
    return new Date(d.y, d.m - 1, d.d).toISOString().substring(0, 10);
  }
  const str = String(val).trim();
  if (!str || str === '' || str === '0') return null;
  // Intentar parsear fechas en diferentes formatos
  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    // DD/MM/YYYY o YYYY-MM-DD
    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
    if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10);
  return null;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

let importados = { minutas: 0, correspondencia: 0, contratos: 0, personal: 0, usuarios: 0, prestamos: 0, errores: 0 };

async function importarMinutas(client, wb) {
  console.log('\n📋 Importando MINUTAS...');
  const tiposHojas = [
    { hoja: 'SERVICIOS',       tipo: 'SERVICIO' },
    { hoja: 'VISITANTES',      tipo: 'VISITANTES' },
    { hoja: 'CORRESPONDENCIA', tipo: 'CORRESPONDENCIA' }
  ];

  for (const { hoja, tipo } of tiposHojas) {
    const sheet = wb.Sheets[hoja];
    if (!sheet) continue;
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    // La fila de headers está en la posición 2 (índice 1 del raw)
    const headerIdx = raw.findIndex(row => String(row[1] || '').toUpperCase().includes('REGISTRO ORIGINAL') || String(row[0] || '').trim() === 'N°');
    if (headerIdx === -1) continue;

    const headers = raw[headerIdx];
    const rows = raw.slice(headerIdx + 1).filter(r => r.some(c => c !== ''));

    let count = 0;
    for (const row of rows) {
      try {
        const numReg = row[1] || row[0];
        const nombrePuesto = String(row[2] || '').trim();
        const fechaInicio = excelDateToDate(row[3]);
        const fechaCierre = excelDateToDate(row[4]);
        const anio = row[5] || '';

        if (!nombrePuesto) continue;

        const id = genId();
        const codigoUnico = `MIN-${tipo.substring(0,3)}-${String(numReg).padStart(4,'0')}`;

        await client.query(`
          INSERT INTO minutas (id, tipo_minuta, nombre_puesto, fecha_inicio, fecha_cierre, estado, responsable, codigo_unico, codigo_numerico, fecha_registro)
          VALUES ($1, $2, $3, $4, $5, 'ACTIVO', 'IMPORTADO', $6, $7, NOW())
          ON CONFLICT (id) DO NOTHING
        `, [id, tipo, nombrePuesto, fechaInicio, fechaCierre, codigoUnico, parseInt(numReg) || count + 1]);

        count++;
        importados.minutas++;
      } catch(e) {
        importados.errores++;
      }
    }
    console.log(`   ✅ ${tipo}: ${count} registros importados`);
  }
}

async function importarCorrespondencia(client, wb) {
  console.log('\n📧 Importando CORRESPONDENCIA...');
  const rows = leerHoja(wb, 'CORRESPONDENCIA');
  let count = 0;

  for (const row of rows) {
    try {
      const id = String(row['ID'] || genId()).trim() || genId();
      const codigo = String(row['CODIGO_DOCUMENTO'] || '').trim();
      const fecha = excelDateToDate(row['FECHA_DOCUMENTO']) || excelDateToDate(row['FECHA']);
      const medio = String(row['MEDIO'] || 'FISICO').trim();
      const tipo = String(row['TIPO_DOCUMENTO'] || '').trim();
      const origen = String(row['DEPTO_ORIGEN'] || 'GE').trim();
      const destino = String(row['DEPTO_DESTINO'] || '').trim();
      const asunto = String(row['ASUNTO'] || '').trim().substring(0, 500);
      const detalle = String(row['DETALLE'] || row['OBSERVACIONES'] || '').trim();
      const estado = String(row['ESTADO'] || 'PENDIENTE').trim();
      const codigoNum = parseInt(row['CODIGO_NUMERICO'] || row['CONSECUTIVO']) || null;

      if (!fecha && !codigo) continue;

      await client.query(`
        INSERT INTO correspondencia (id, codigo_documento, fecha_documento, medio, tipo_documento, depto_origen, depto_destino, asunto, detalle, estado, usuario_registro, codigo_numerico, fecha_registro)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'IMPORTADO', $11, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [id, codigo || `IMP-${count + 1}`, fecha || new Date().toISOString().substring(0,10), medio, tipo, origen, destino || null, asunto, detalle, estado, codigoNum]);

      count++;
      importados.correspondencia++;
    } catch(e) {
      importados.errores++;
    }
  }
  console.log(`   ✅ CORRESPONDENCIA: ${count} registros importados`);
}

async function importarContratos(client, wb) {
  console.log('\n📑 Importando CONTRATOS...');
  const rows = leerHoja(wb, 'CONTRATOS');
  let count = 0;

  for (const row of rows) {
    try {
      const id = String(row['ID'] || genId()).trim() || genId();
      const tipo = String(row['TIPO_CONTRATO'] || '').trim();
      const numero = String(row['NUMERO_CONTRATO'] || `CTR-${count + 1}`).trim();
      const parteA = String(row['PARTE_A'] || '').trim().substring(0, 148);
      const parteB = String(row['PARTE_B'] || '').trim().substring(0, 148);
      const fInicio = excelDateToDate(row['FECHA_INICIO']);
      const fFin = excelDateToDate(row['FECHA_FIN']);
      const valor = parseFloat(String(row['VALOR_CONTRATO'] || '0').replace(/[^0-9.]/g, '')) || 0;
      const objeto = String(row['OBJETO_CONTRATO'] || row['OBJETO'] || '').trim();
      const estado = String(row['ESTADO'] || 'VIGENTE').trim();
      const voxelsera = String(row['VOXELSERA'] || '').trim() || null;
      const codigoNum = parseInt(row['CODIGO_NUMERICO']) || count + 1;

      if (!parteA && !objeto) continue;

      await client.query(`
        INSERT INTO contratos (id, tipo_contrato, numero_contrato, parte_a, parte_b, fecha_inicio, fecha_fin, valor_contrato, objeto_contrato, estado, voxelsera, codigo_numerico, fecha_registro)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [id, tipo, numero, parteA, parteB, fInicio, fFin, valor, objeto, estado, voxelsera, codigoNum]);

      count++;
      importados.contratos++;
    } catch(e) {
      importados.errores++;
    }
  }
  console.log(`   ✅ CONTRATOS: ${count} registros importados`);
}

async function importarPersonal(client, wb) {
  console.log('\n👥 Importando PERSONAL INACTIVO (3,835 registros)...');
  const rows = leerHoja(wb, 'PERSONAL_INACTIVO');
  let count = 0;
  const BATCH = 100;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    for (const row of batch) {
      try {
        const id = String(row['ID'] || genId()).trim() || genId();
        const nombre = String(row['NOMBRE_COMPLETO'] || '').trim().substring(0, 148);
        const cedula = String(row['CEDULA'] || `CC-${i + count + 1}`).trim().substring(0, 48);
        const fBaja = excelDateToDate(row['FECHA_BAJA']) || new Date().toISOString().substring(0,10);
        const motivo = String(row['MOTIVO_BAJA'] || '').trim();
        const obs = String(row['OBSERVACIONES'] || '').trim();
        const voxelsera = String(row['VOXELSERA'] || '').trim() || null;
        const codigoNum = parseInt(row['CODIGO_NUMERICO']) || count + 1;

        if (!nombre) continue;

        await client.query(`
          INSERT INTO personal_inactivo (id, nombre_completo, cedula, fecha_baja, motivo_baja, observaciones, voxelsera, codigo_numerico, fecha_registro)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          ON CONFLICT (cedula) DO NOTHING
        `, [id, nombre, cedula, fBaja, motivo, obs, voxelsera, codigoNum]);

        count++;
        importados.personal++;
      } catch(e) {
        importados.errores++;
      }
    }
    if ((i + BATCH) % 500 === 0 || i + BATCH >= rows.length) {
      process.stdout.write(`   ⏳ Personal: ${Math.min(count, rows.length)} / ${rows.length} registros...\r`);
    }
  }
  console.log(`\n   ✅ PERSONAL INACTIVO: ${count} registros importados`);
}

async function importarUsuarios(client, wb) {
  console.log('\n👤 Importando USUARIOS...');
  const rows = leerHoja(wb, 'USUARIOS');
  let count = 0;

  for (const row of rows) {
    try {
      const email = String(row['EMAIL'] || '').trim().toLowerCase();
      const password = String(row['PASSWORD'] || '$2a$10$TqyYtQ8/QeYgH8C7pGkCeu7j1Xo643q.tY/0tHl5h02.73G6h4l2q').trim();
      const nombre = String(row['NOMBRE'] || '').trim();
      const depto = String(row['DEPARTAMENTO'] || 'GENERAL').trim();
      const estado = String(row['ESTADO'] || 'ACTIVO').trim();
      const rol = String(row['ROL'] || 'USUARIO').trim();

      if (!email || !email.includes('@')) continue;

      await client.query(`
        INSERT INTO usuarios (email, password, nombre, departamento, estado, rol, salt)
        VALUES ($1, $2, $3, $4, $5, $6, 'importado')
        ON CONFLICT (email) DO UPDATE SET nombre=$3, departamento=$4, estado=$5, rol=$6
      `, [email, password, nombre, depto, estado, rol]);

      count++;
      importados.usuarios++;
    } catch(e) {
      importados.errores++;
    }
  }
  console.log(`   ✅ USUARIOS: ${count} registros importados`);
}

async function importarPrestamos(client, wb) {
  console.log('\n🔄 Importando PRÉSTAMOS...');
  const rows = leerHoja(wb, 'PRESTAMOS');
  let count = 0;

  for (const row of rows) {
    try {
      const id = String(row['ID'] || genId()).trim() || genId();
      const solicitante = String(row['SOLICITANTE'] || '').trim();
      const depto = String(row['DEPARTAMENTO'] || '').trim();
      const documento = String(row['DOCUMENTO'] || '').trim();
      const codigo = String(row['CODIGO_DOCUMENTO'] || '').trim();
      const fPrest = excelDateToDate(row['FECHA_PRESTAMO']) || new Date().toISOString().substring(0,10);
      const fDev = excelDateToDate(row['FECHA_DEVOLUCION']);
      const fDevReal = excelDateToDate(row['FECHA_DEVOLUCION_REAL']);
      const estado = fDevReal ? 'DEVUELTO' : (row['ESTADO'] ? String(row['ESTADO']).trim() : 'ACTIVO');

      if (!solicitante) continue;

      await client.query(`
        INSERT INTO prestamos (id, solicitante, departamento, documento, codigo_documento, fecha_prestamo, fecha_devolucion, fecha_devolucion_real, estado)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING
      `, [id, solicitante, depto, documento, codigo, fPrest, fDev, fDevReal, estado]);

      count++;
      importados.prestamos++;
    } catch(e) {
      importados.errores++;
    }
  }
  console.log(`   ✅ PRÉSTAMOS: ${count} registros importados`);
}

async function main() {
  console.log('🔌 Conectando a Supabase...');
  const client = await pool.connect();

  try {
    console.log('✅ Conexión exitosa\n');
    console.log('📖 Leyendo archivos Excel...');

    const wbMain = XLSX.readFile(mainFile);
    const wbMinutas = XLSX.readFile(minutasFile);

    console.log('✅ Archivos leídos. Comenzando importación masiva...');

    await importarUsuarios(client, wbMain);
    await importarMinutas(client, wbMinutas);
    await importarCorrespondencia(client, wbMain);
    await importarContratos(client, wbMain);
    await importarPersonal(client, wbMain);
    await importarPrestamos(client, wbMain);

    console.log('\n' + '='.repeat(55));
    console.log('🎉  IMPORTACIÓN MASIVA COMPLETADA');
    console.log('='.repeat(55));
    console.log(`  📋 Minutas importadas:          ${importados.minutas}`);
    console.log(`  📧 Correspondencia importada:   ${importados.correspondencia}`);
    console.log(`  📑 Contratos importados:        ${importados.contratos}`);
    console.log(`  👥 Personal inactivo:           ${importados.personal}`);
    console.log(`  👤 Usuarios importados:         ${importados.usuarios}`);
    console.log(`  🔄 Préstamos importados:        ${importados.prestamos}`);
    console.log(`  ⚠️  Errores (omitidos):         ${importados.errores}`);
    console.log('='.repeat(55));
    console.log('🚀 Base de datos Supabase lista con todos los datos históricos.');

  } catch(e) {
    console.error('❌ Error general:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
