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

    // 1. Agregar columna tipo_persona si no existe
    await client.query(`
      ALTER TABLE personal_inactivo 
      ADD COLUMN IF NOT EXISTS tipo_persona VARCHAR(20) DEFAULT 'EMPLEADO';
    `);
    console.log('✅ Columna tipo_persona agregada');

    // 2. Agregar columna departamento si no existe
    await client.query(`
      ALTER TABLE personal_inactivo 
      ADD COLUMN IF NOT EXISTS departamento VARCHAR(50) DEFAULT '';
    `);
    console.log('✅ Columna departamento agregada');

    // 3. Crear índice para búsqueda por tipo
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_personal_tipo ON personal_inactivo(tipo_persona);
    `);
    console.log('✅ Índice de tipo_persona creado');

    // 4. Verificar estructura final
    const res = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'personal_inactivo'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 Estructura actual de personal_inactivo:');
    res.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) default: ${col.column_default || 'ninguno'}`);
    });

    // 5. Contar registros por tipo
    const count = await client.query(`
      SELECT tipo_persona, COUNT(*) as total FROM personal_inactivo GROUP BY tipo_persona;
    `);
    console.log('\n📊 Distribución actual:');
    count.rows.forEach(r => console.log(`  ${r.tipo_persona}: ${r.total} registros`));

    console.log('\n🎉 ¡Tabla actualizada correctamente!');

  } catch(e) {
    console.error('❌ Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
