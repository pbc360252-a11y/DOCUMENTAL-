const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Lee la DATABASE_URL desde el argumento o .env
const DATABASE_URL = process.argv[2];

if (!DATABASE_URL) {
  console.error('❌ ERROR: Debes pasar la DATABASE_URL como argumento.');
  console.error('   Uso: node init_db.js "postgresql://postgres:[PASSWORD]@..."');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const SQL = `
-- 1. TABLA DE USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
    email VARCHAR(100) PRIMARY KEY,
    password VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    departamento VARCHAR(50) NOT NULL,
    estado VARCHAR(20) DEFAULT 'ACTIVO',
    rol VARCHAR(20) DEFAULT 'USUARIO',
    ultimo_acceso TIMESTAMP,
    intentos_logout INT DEFAULT 0,
    salt VARCHAR(100)
);

-- 2. TABLA DE MINUTAS
CREATE TABLE IF NOT EXISTS minutas (
    id VARCHAR(50) PRIMARY KEY,
    tipo_minuta VARCHAR(100),
    nombre_puesto VARCHAR(150),
    fecha_inicio TIMESTAMP,
    fecha_cierre TIMESTAMP,
    observaciones TEXT,
    estado VARCHAR(20) DEFAULT 'ACTIVO',
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responsable VARCHAR(100),
    voxelsera VARCHAR(50),
    codigo_unico VARCHAR(50),
    codigo_numerico INT
);

-- 3. TABLA DE CORRESPONDENCIA
CREATE TABLE IF NOT EXISTS correspondencia (
    id VARCHAR(50) PRIMARY KEY,
    codigo_documento VARCHAR(50) UNIQUE,
    fecha_documento TIMESTAMP NOT NULL,
    medio VARCHAR(20),
    tipo_documento VARCHAR(100),
    depto_origen VARCHAR(10) NOT NULL,
    depto_destino VARCHAR(10),
    asunto TEXT,
    detalle TEXT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'PENDIENTE',
    usuario_registro VARCHAR(100) NOT NULL,
    voxelsera VARCHAR(50),
    codigo_unico VARCHAR(50),
    codigo_numerico INT
);

-- 4. TABLA DE PERSONAL INACTIVO
CREATE TABLE IF NOT EXISTS personal_inactivo (
    id VARCHAR(50) PRIMARY KEY,
    nombre_completo VARCHAR(150) NOT NULL,
    cedula VARCHAR(50) UNIQUE NOT NULL,
    fecha_baja TIMESTAMP NOT NULL,
    motivo_baja TEXT,
    observaciones TEXT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    voxelsera VARCHAR(50),
    codigo_numerico INT
);

-- 5. TABLA DE CONTRATOS
CREATE TABLE IF NOT EXISTS contratos (
    id VARCHAR(50) PRIMARY KEY,
    tipo_contrato VARCHAR(100),
    numero_contrato VARCHAR(100) UNIQUE,
    parte_a VARCHAR(150),
    parte_b VARCHAR(150),
    fecha_inicio TIMESTAMP,
    fecha_fin TIMESTAMP,
    valor_contrato NUMERIC(15,2),
    objeto_contrato TEXT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    voxelsera VARCHAR(50),
    estado VARCHAR(20) DEFAULT 'VIGENTE',
    codigo_numerico INT
);

-- 6. TABLA DE PRESTAMOS
CREATE TABLE IF NOT EXISTS prestamos (
    id VARCHAR(50) PRIMARY KEY,
    solicitante VARCHAR(100) NOT NULL,
    departamento VARCHAR(50),
    documento VARCHAR(150),
    codigo_documento VARCHAR(50),
    fecha_prestamo TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_devolucion TIMESTAMP,
    fecha_devolucion_real TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'ACTIVO'
);

-- 7. TABLA DE WORKFLOWS
CREATE TABLE IF NOT EXISTS workflows (
    id VARCHAR(50) PRIMARY KEY,
    tipo VARCHAR(100),
    documento_id VARCHAR(50),
    solicitante VARCHAR(100),
    aprobador VARCHAR(100),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_limite TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'PENDIENTE',
    comentarios TEXT,
    comentarios_aprobacion TEXT,
    dias_sla INT
);

-- 8. TABLA DE BIBLIOTECA
CREATE TABLE IF NOT EXISTS biblioteca (
    id VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    categoria VARCHAR(100),
    version VARCHAR(20) DEFAULT '1.0',
    estado VARCHAR(20) DEFAULT 'ACTIVO',
    url TEXT,
    fecha_elaboracion TIMESTAMP,
    descripcion_cambio TEXT,
    responsable VARCHAR(100),
    carpeta_id VARCHAR(50) DEFAULT 'RAIZ',
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_registro VARCHAR(100)
);

-- 9. TABLA DE BIBLIOTECA CARPETAS
CREATE TABLE IF NOT EXISTS biblioteca_carpetas (
    id VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    padre VARCHAR(50) DEFAULT 'RAIZ',
    color VARCHAR(20) DEFAULT '#2563eb',
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    es_sistema BOOLEAN DEFAULT FALSE
);

-- 10. TABLA DE AUDITORIA
CREATE TABLE IF NOT EXISTS log_auditoria (
    id SERIAL PRIMARY KEY,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario VARCHAR(100),
    modulo VARCHAR(100),
    accion VARCHAR(100),
    detalle TEXT,
    estado VARCHAR(20),
    respuesta TEXT,
    version VARCHAR(20)
);

-- 11. TABLA TRD
CREATE TABLE IF NOT EXISTS tabla_trd (
    id VARCHAR(50) PRIMARY KEY,
    codigo_dep VARCHAR(10) NOT NULL,
    nombre_dep VARCHAR(100) NOT NULL,
    codigo_serie VARCHAR(10) NOT NULL,
    nombre_serie VARCHAR(100) NOT NULL,
    codigo_subserie VARCHAR(10),
    nombre_subserie VARCHAR(100),
    tiempo_gestion_anos INT,
    tiempo_central_anos INT,
    disposicion_final VARCHAR(100),
    normativa_base TEXT
);

-- INDICES
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_corr_depto ON correspondencia(depto_origen);
CREATE INDEX IF NOT EXISTS idx_corr_codigo ON correspondencia(codigo_documento);
CREATE INDEX IF NOT EXISTS idx_minutas_codigo ON minutas(codigo_unico);
CREATE INDEX IF NOT EXISTS idx_prestamos_solic ON prestamos(solicitante);
CREATE INDEX IF NOT EXISTS idx_wf_estado ON workflows(estado);
CREATE INDEX IF NOT EXISTS idx_audit_modulo ON log_auditoria(modulo);

-- TRD INICIALES
INSERT INTO tabla_trd (id, codigo_dep, nombre_dep, codigo_serie, nombre_serie, codigo_subserie, nombre_subserie, tiempo_gestion_anos, tiempo_central_anos, disposicion_final, normativa_base) VALUES
('TRD-001','100','GERENCIA GENERAL','10','COMUNICACIONES OFICIALES','01','CARTAS Y MEMORANDOS',2,8,'CONSERVACION TOTAL','Codigo de Comercio Art. 60 / Ley 594'),
('TRD-002','200','GESTION HUMANA','20','HISTORIAS LABORALES Y SG-SST','01','EXAMENES MEDICOS Y SALUD OCUPACIONAL',5,15,'CONSERVACION TOTAL (20 ANOS)','Decreto 1072 de 2015 SG-SST'),
('TRD-003','300','FINANCIERA Y CONTABLE','30','REGISTROS Y COMPROBANTES CONTABLES','01','COMPROBANTES DE PAGO Y FACTURAS',3,7,'ELIMINACION REGULADA','Ley 527 de 1999 / C.Co Art. 60'),
('TRD-004','400','OPERACIONES Y SEGURIDAD','40','MINUTAS Y REPORTES OPERATIVOS','01','NOVEDADES Y SEGUIMIENTO DE PUESTO',2,3,'SELECCION','Ley 594 de 2000 AGN'),
('TRD-005','500','JURIDICA Y CONTRATOS','50','CONTRATOS Y CONVENIOS','01','CONTRATOS COMERCIALES Y LABORALES',5,15,'CONSERVACION TOTAL','Ley 80 / Codigo de Comercio')
ON CONFLICT (id) DO NOTHING;

-- ADMIN POR DEFECTO (Contrasena: Admin123)
INSERT INTO usuarios (email, password, nombre, departamento, estado, rol, salt) VALUES
('admin@coraza.com','$2a$10$TqyYtQ8/QeYgH8C7pGkCeu7j1Xo643q.tY/0tHl5h02.73G6h4l2q','Administrador Principal','GERENCIA','ACTIVO','ADMINISTRADOR','salt_static_init')
ON CONFLICT (email) DO NOTHING;
`;

async function initDB() {
  console.log('🔌 Conectando a Supabase PostgreSQL...');
  const client = await pool.connect();
  try {
    console.log('✅ Conexión exitosa. Ejecutando SQL de inicialización...');
    await client.query(SQL);
    console.log('');
    console.log('🎉 ¡BASE DE DATOS INICIALIZADA CORRECTAMENTE!');
    console.log('   ✅ 11 tablas creadas');
    console.log('   ✅ Índices de búsqueda configurados');
    console.log('   ✅ TRD (AGN) precargadas');
    console.log('   ✅ Admin creado: admin@coraza.com / Admin123');
    console.log('');
    console.log('🚀 El sistema SGD CORAZA está listo para usar.');
  } catch(err) {
    console.error('❌ Error al inicializar:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

initDB();
