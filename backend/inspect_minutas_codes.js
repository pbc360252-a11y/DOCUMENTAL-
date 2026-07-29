const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://postgres.vufieahhfixyloykvsdb:Freider1004%2A@aws-1-us-west-2.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  console.log('📋 AUDITORÍA DE CÓDIGOS DE MINUTAS:\n');

  try {
    const res = await client.query(`
      SELECT id, tipo_minuta, nombre_puesto, codigo_unico, codigo_numerico, fecha_inicio, fecha_cierre 
      FROM minutas 
      ORDER BY codigo_numerico ASC 
      LIMIT 15
    `);

    console.log(' Muestra de códigos preservados:');
    res.rows.forEach(r => {
      console.log(`   Código Único: ${r.codigo_unico.padEnd(16)} | N° Registrado: ${String(r.codigo_numerico).padEnd(6)} | Puesto: ${r.nombre_puesto.substring(0, 30)}`);
    });

  } catch(e) {
    console.error('❌ Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
