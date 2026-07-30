const { Pool } = require('pg');
const XLSX = require('xlsx');

const pool = new Pool({
  connectionString: 'postgresql://postgres.vufieahhfixyloykvsdb:Freider1004%2A@aws-1-us-west-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

const wb = XLSX.readFile('CONTRATOS/CONTROL SISTEMA ARCHIVO COMERCIAL INACTIVO ACTUALIZADO.xlsx');
const ws = wb.Sheets['ARCHIVO COMERCIAL'];
const data = XLSX.utils.sheet_to_json(ws, {defval:''});

console.log('=== BUSQUEDA EN EXCEL ===');
data.forEach((r, idx) => {
  const str = JSON.stringify(r).toUpperCase();
  if (str.includes('TIERRA GRATA') || str.includes('CUMBRES')) {
    console.log(`Fila Excel #${idx+1}:`, JSON.stringify(r, null, 2));
  }
});

async function checkDb() {
  console.log('\n=== BUSQUEDA EN SUPABASE ===');
  const res = await pool.query(`
    SELECT id, numero_contrato, codigo_numerico, parte_b, nit, fecha_inicio, fecha_fin, hoja_origen 
    FROM contratos 
    WHERE UPPER(parte_b) LIKE '%TIERRA GRATA%' OR numero_contrato IN ('362', '25') OR codigo_numerico = 362
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  pool.end();
}

checkDb();
