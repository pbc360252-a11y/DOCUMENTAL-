const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.vufieahhfixyloykvsdb:Freider1004%2A@aws-1-us-west-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkContratos() {
  const client = await pool.connect();
  try {
    const totalRes = await client.query('SELECT COUNT(*) FROM contratos');
    const total = parseInt(totalRes.rows[0].count);
    console.log('Total contratos in PostgreSQL:', total);

    const maxNumRes = await client.query('SELECT MAX(codigo_numerico) as max_num FROM contratos');
    console.log('MAX codigo_numerico in PostgreSQL contratos:', maxNumRes.rows[0].max_num);

    const lastRows = await client.query('SELECT id, numero_contrato, codigo_numerico, parte_a, parte_b, fecha_registro FROM contratos ORDER BY codigo_numerico DESC LIMIT 5');
    console.log('Last 5 contratos in PostgreSQL:');
    console.log(lastRows.rows);
  } catch(e) {
    console.error('Error querying PostgreSQL:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkContratos();
