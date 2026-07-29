const XLSX = require('xlsx');
const path = require('path');

const mainFile = path.join(__dirname, '../DATOS 001/📚APP GESTION DOCUMENTAL 💠.xlsx');
const wb = XLSX.readFile(mainFile);

const sheet = wb.Sheets['PERSONAL_INACTIVO'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log('📋 COLUMNAS DE PERSONAL_INACTIVO:');
console.log('  ', data[0]);

console.log('\n📋 PRIMERAS 5 FILAS DE DATOS:');
data.slice(1, 6).forEach((row, i) => {
  console.log(`  Fila ${i + 1}:`, row);
});

console.log('\n🔍 ANÁLISIS DE COLUMNAS ÚNICAS:');
// Ver valores únicos de columnas importantes
const colNames = data[0];
const rows = data.slice(1).filter(r => r.some(c => c !== ''));

// Buscar columna de tipo/departamento/categoria
colNames.forEach((col, idx) => {
  if (!col) return;
  const uniqueVals = [...new Set(rows.map(r => String(r[idx] || '')).filter(v => v))];
  if (uniqueVals.length < 20) {
    console.log(`\n  Columna "${col}" (${uniqueVals.length} valores únicos):`);
    uniqueVals.forEach(v => console.log(`    - ${v}`));
  } else {
    console.log(`\n  Columna "${col}": ${uniqueVals.length} valores únicos (demasiados para mostrar)`);
    console.log(`    Muestra: ${uniqueVals.slice(0, 5).join(', ')}...`);
  }
});
