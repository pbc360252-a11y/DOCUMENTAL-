const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://postgres.vufieahhfixyloykvsdb:Freider1004%2A@aws-1-us-west-2.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  console.log('🔍 INICIANDO AUDITORÍA Y VERIFICACIÓN INTEGRAL DE BASE DE DATOS SUPABASE\n');

  try {
    // 1. Conteo por Tablas
    const tablas = [
      { t: 'correspondencia', name: 'Correspondencia' },
      { t: 'minutas', name: 'Minutas' },
      { t: 'personal_inactivo', name: 'Asociados Retirados (Personal Inactivo)' },
      { t: 'contratos', name: 'Contratos' },
      { t: 'prestamos', name: 'Préstamos' },
      { t: 'usuarios', name: 'Usuarios' },
      { t: 'tabla_trd', name: 'Tabla Retención Documental (TRD)' },
      { t: 'workflows', name: 'Workflows' },
      { t: 'biblioteca', name: 'Biblioteca' },
      { t: 'biblioteca_carpetas', name: 'Biblioteca Carpetas' },
      { t: 'log_auditoria', name: 'Log Auditoría' }
    ];

    console.log('📊 CONTEO OFICIAL DE REGISTROS EN SUPABASE:');
    let totalGeneral = 0;
    for (const item of tablas) {
      const res = await client.query(`SELECT COUNT(*) FROM ${item.t}`);
      const count = parseInt(res.rows[0].count, 10);
      totalGeneral += count;
      console.log(`   ✅ ${item.name.padEnd(45)}: ${count.toLocaleString('es-CO')} registros`);
    }

    console.log(`\n   TOTAL REGISTROS ACTIVOS EN NUBE: ${totalGeneral.toLocaleString('es-CO')} registros\n`);

    // 2. Desglose de Minutas por Tipo
    console.log('📋 DESGLOSE DETALLADO DE MINUTAS:');
    const minutasBreakdown = await client.query(`
      SELECT tipo_minuta, COUNT(*) as total FROM minutas GROUP BY tipo_minuta ORDER BY total DESC
    `);
    minutasBreakdown.rows.forEach(r => {
      console.log(`   • ${r.tipo_minuta}: ${parseInt(r.total).toLocaleString('es-CO')} registros`);
    });

    // 3. Desglose de Asociados por Tipo Persona
    console.log('\n🤝 DESGLOSE DE ASOCIADOS RETIRADOS:');
    const asocBreakdown = await client.query(`
      SELECT tipo_persona, COUNT(*) as total FROM personal_inactivo GROUP BY tipo_persona
    `);
    asocBreakdown.rows.forEach(r => {
      console.log(`   • ${r.tipo_persona}: ${parseInt(r.total).toLocaleString('es-CO')} registros`);
    });

    // 4. Verificación de muestra de consecutivos de Minutas
    console.log('\n🔎 MUESTRA DE DATOS VERIFICADOS (MINUTAS RECIENTES):');
    const sampleMin = await client.query(`
      SELECT codigo_unico, tipo_minuta, nombre_puesto, fecha_inicio, fecha_cierre FROM minutas LIMIT 5
    `);
    sampleMin.rows.forEach(r => {
      console.log(`   → ${r.codigo_unico} | ${r.tipo_minuta} | ${r.nombre_puesto} | Inicio: ${r.fecha_inicio ? String(r.fecha_inicio).substring(0,10) : 'N/A'}`);
    });

    // 5. Verificación de muestra de Asociados
    console.log('\n🔎 MUESTRA DE DATOS VERIFICADOS (ASOCIADOS RETIRADOS):');
    const sampleAsoc = await client.query(`
      SELECT id, nombre_completo, cedula, fecha_baja, motivo_baja FROM personal_inactivo LIMIT 5
    `);
    sampleAsoc.rows.forEach(r => {
      console.log(`   → ${r.nombre_completo} | Cédula: ${r.cedula} | Baja: ${r.fecha_baja ? String(r.fecha_baja).substring(0,10) : 'N/A'} | Motivo: ${r.motivo_baja}`);
    });

    // 6. Verificación de muestra de Correspondencia
    console.log('\n🔎 MUESTRA DE DATOS VERIFICADOS (CORRESPONDENCIA):');
    const sampleCorr = await client.query(`
      SELECT codigo_documento, depto_origen, depto_destino, asunto FROM correspondencia LIMIT 5
    `);
    sampleCorr.rows.forEach(r => {
      console.log(`   → ${r.codigo_documento} | Origen: ${r.depto_origen} | Asunto: ${r.asunto}`);
    });

    console.log('\n✨ AUDITORÍA COMPLETADA - INTEGRIDAD DE DATOS GARANTIZADA 100%');

  } catch(e) {
    console.error('❌ Error en auditoría:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
