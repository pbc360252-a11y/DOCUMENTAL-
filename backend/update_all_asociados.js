const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://postgres.vufieahhfixyloykvsdb:Freider1004%2A@aws-1-us-west-2.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('🔌 Conectando a Supabase...');

    // 1. Cambiar todos los registros a ASOCIADO
    const updateRes = await client.query(`
      UPDATE personal_inactivo SET tipo_persona = 'ASOCIADO';
    `);
    console.log(`✅ ${updateRes.rowCount} registros actualizados a 'ASOCIADO'`);

    // 2. Cambiar el valor por defecto de la columna a 'ASOCIADO'
    await client.query(`
      ALTER TABLE personal_inactivo ALTER COLUMN tipo_persona SET DEFAULT 'ASOCIADO';
    `);
    console.log('✅ Default de columna cambiado a ASOCIADO');

    // 3. Verificar distribución
    const count = await client.query(`
      SELECT tipo_persona, COUNT(*) as total FROM personal_inactivo GROUP BY tipo_persona;
    `);
    console.log('\n📊 Nueva distribución en la base de datos:');
    count.rows.forEach(r => console.log(`  ${r.tipo_persona}: ${r.total} registros`));

  } catch(e) {
    console.error('❌ Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
