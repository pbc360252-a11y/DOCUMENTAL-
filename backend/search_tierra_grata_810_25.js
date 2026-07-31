const { Pool } = require('pg');
const XLSX = require('xlsx');

const pool = new Pool({
  connectionString: 'postgresql://postgres.vufieahhfixyloykvsdb:Freider1004%2A@aws-1-us-west-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

const wb = XLSX.readFile('CONTRATOS/CONTROL SISTEMA ARCHIVO COMERCIAL INACTIVO ACTUALIZADO.xlsx');

console.log('=====================================================');
console.log('1. REGISTROS EN EXCEL (TODAS LAS HOJAS)');
console.log('=====================================================');

wb.SheetNames.forEach(sheet => {
  const ws = wb.Sheets[sheet];
  const rows = XLSX.utils.sheet_to_json(ws, {defval:''});
  rows.forEach((r, i) => {
    const str = JSON.stringify(r).toUpperCase();
    if (str.includes('TIERRA GRATA') || str.includes('CUMBRES') || str.includes('810')) {
      console.log(`\n--- [Hoja: ${sheet} | Fila #${i+1}] ---`);
      console.log(JSON.stringify(r, null, 2));
    }
  });
});

async function queryDb() {
  console.log('\n=====================================================');
  console.log('2. REGISTROS EN SUPABASE (TABLA CONTRATOS)');
  console.log('=====================================================');
  
  const resC = await pool.query(`
    SELECT * FROM contratos 
    WHERE UPPER(parte_b) LIKE '%TIERRA GRATA%' 
       OR UPPER(parte_b) LIKE '%CUMBRES%'
       OR numero_contrato IN ('810', '25', '362')
       OR codigo_numerico IN (810, 25, 362)
  `);
  
  console.log(`Total contratos coincidentes en BD: ${resC.rows.length}`);
  resC.rows.forEach(c => {
    console.log(`\nID: ${c.id} | Cod. Num: #${c.codigo_numerico} | Contrato N°: ${c.numero_contrato}`);
    console.log(`Parte B (Puesto): ${c.parte_b}`);
    console.log(`NIT: ${c.nit}`);
    console.log(`Tipo: ${c.tipo_contrato}`);
    console.log(`Fechas: ${c.fecha_inicio ? c.fecha_inicio.toISOString().split('T')[0] : 'N/A'} -> ${c.fecha_fin ? c.fecha_fin.toISOString().split('T')[0] : 'N/A'}`);
    console.log(`Estado: ${c.estado} | Voxelsera: Estante ${c.voxelsera} | Hoja Origen: ${c.hoja_origen}`);
    console.log(`Objeto: ${c.objeto_contrato}`);
  });

  console.log('\n=====================================================');
  console.log('3. CONTRATO #810 EN SUPABASE (SI EXISTE)');
  console.log('=====================================================');
  const res810 = await pool.query(`
    SELECT * FROM contratos 
    WHERE numero_contrato = '810' OR codigo_numerico = 810
  `);
  console.log(`Contratos con numero 810 o codigo 810: ${res810.rows.length}`);
  res810.rows.forEach(c => {
    console.log(JSON.stringify(c, null, 2));
  });

  pool.end();
}

queryDb().catch(e => { console.error(e); pool.end(); });
