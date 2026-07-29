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

async function main() {
  const client = await pool.connect();
  console.log('====================================================');
  console.log('🔍 AUDITORÍA COMPARATIVA COMPLETA EXCEL VS SUPABASE');
  console.log('====================================================\n');

  try {
    const wbMain = XLSX.readFile(mainFile);
    const wbMin = XLSX.readFile(minutasFile);

    console.log('📊 ARCHIVO 1: 📚APP GESTION DOCUMENTAL 💠.xlsx');
    for (const sheetName of wbMain.SheetNames) {
      const sheet = wbMain.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      const rows = data.slice(1).filter(r => r.some(c => c !== ''));
      console.log(`   • Hoja "${sheetName.padEnd(25)}": ${rows.length.toString().padStart(5)} filas en Excel`);
    }

    console.log('\n📊 ARCHIVO 2: LISTADO_UNICO_MINUTAS_SGD (1).xlsx');
    for (const sheetName of wbMin.SheetNames) {
      const sheet = wbMin.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      const rows = data.slice(2).filter(r => r.some(c => c !== ''));
      console.log(`   • Hoja "${sheetName.padEnd(25)}": ${rows.length.toString().padStart(5)} filas en Excel`);
    }

    console.log('\n====================================================');
    console.log('🗄️ CONTEO REAL ACTUALMENTE GUARDADO EN SUPABASE:');
    console.log('====================================================');

    const cMin = await client.query('SELECT COUNT(*) FROM minutas');
    const cCorr = await client.query('SELECT COUNT(*) FROM correspondencia');
    const cPers = await client.query('SELECT COUNT(*) FROM personal_inactivo');
    const cCtr = await client.query('SELECT COUNT(*) FROM contratos');
    const cPrest = await client.query('SELECT COUNT(*) FROM prestamos');
    const cUsr = await client.query('SELECT COUNT(*) FROM usuarios');
    const cTrd = await client.query('SELECT COUNT(*) FROM tabla_trd');

    console.log(`   • Minutas (Consolidado de 3 hojas) : ${cMin.rows[0].count} en Supabase`);
    console.log(`   • Correspondencia                  : ${cCorr.rows[0].count} en Supabase`);
    console.log(`   • Asociados Retirados (Personal)   : ${cPers.rows[0].count} en Supabase`);
    console.log(`   • Contratos                        : ${cCtr.rows[0].count} en Supabase`);
    console.log(`   • Préstamos                        : ${cPrest.rows[0].count} en Supabase`);
    console.log(`   • Usuarios                         : ${cUsr.rows[0].count} en Supabase`);
    console.log(`   • TRD                              : ${cTrd.rows[0].count} en Supabase`);

  } finally {
    client.release();
    await pool.end();
  }
}

main();
