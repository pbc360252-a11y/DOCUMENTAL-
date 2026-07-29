const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://postgres.vufieahhfixyloykvsdb:Freider1004%2A@aws-1-us-west-2.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testSearch(queryStr) {
  const client = await pool.connect();
  try {
    const searchVal = `%${queryStr}%`;
    const numVal = parseInt(queryStr) || 0;
    const resultados = [];

    // Minutas
    const min = await client.query(
      `SELECT id, tipo_minuta, nombre_puesto, codigo_unico, voxelsera, fecha_inicio FROM minutas 
       WHERE codigo_unico ILIKE $1 OR nombre_puesto ILIKE $1 OR voxelsera ILIKE $1 OR codigo_numerico = $2`,
      [searchVal, numVal]
    );
    min.rows.forEach(r => resultados.push({ modulo: '📋 MINUTAS', codigo: r.codigo_unico, titulo: `${r.tipo_minuta} - ${r.nombre_puesto}`, ubicacion: r.voxelsera }));

    // Correspondencia
    const corr = await client.query(
      `SELECT id, codigo_documento, depto_origen, depto_destino, asunto, voxelsera FROM correspondencia 
       WHERE codigo_documento ILIKE $1 OR asunto ILIKE $1 OR detalle ILIKE $1 OR depto_origen ILIKE $1 OR voxelsera ILIKE $1`,
      [searchVal]
    );
    corr.rows.forEach(r => resultados.push({ modulo: '📧 CORRESPONDENCIA', codigo: r.codigo_documento, titulo: `[${r.depto_origen}] ${r.asunto}`, ubicacion: r.voxelsera }));

    // Asociados Retirados
    const asoc = await client.query(
      `SELECT id, nombre_completo, cedula, motivo_baja, voxelsera FROM personal_inactivo 
       WHERE nombre_completo ILIKE $1 OR cedula ILIKE $1 OR motivo_baja ILIKE $1 OR voxelsera ILIKE $1`,
      [searchVal]
    );
    asoc.rows.forEach(r => resultados.push({ modulo: '🤝 ASOCIADOS RETIRADOS', codigo: `CC: ${r.cedula}`, titulo: `${r.nombre_completo} (${r.motivo_baja})`, ubicacion: r.voxelsera }));

    // Contratos
    const ctr = await client.query(
      `SELECT id, tipo_contrato, numero_contrato, objeto_contrato, voxelsera FROM contratos 
       WHERE numero_contrato ILIKE $1 OR parte_a ILIKE $1 OR parte_b ILIKE $1 OR objeto_contrato ILIKE $1 OR voxelsera ILIKE $1`,
      [searchVal]
    );
    ctr.rows.forEach(r => resultados.push({ modulo: '📑 CONTRATOS', codigo: r.numero_contrato, titulo: `${r.tipo_contrato} - ${r.objeto_contrato}`, ubicacion: r.voxelsera }));

    console.log(`\n🔍 RESULTADOS PARA LA BÚSQUEDA "${queryStr}" (${resultados.length} encontrados):`);
    resultados.slice(0, 8).forEach(r => {
      console.log(`   [${r.modulo}] ${r.codigo.padEnd(20)} | ${r.titulo.substring(0, 45)}`);
    });

  } finally {
    client.release();
  }
}

async function main() {
  await testSearch('563');
  await testSearch('70221119');
  await testSearch('GOMEZ');
  await testSearch('SP001');
  await pool.end();
}

main();
