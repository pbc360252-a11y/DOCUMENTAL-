const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const filePath = path.join(__dirname, '../DATOS 001/📚APP GESTION DOCUMENTAL 💠.xlsx');

if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

const workbook = xlsx.readFile(filePath);
console.log('Sheet names:', workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  console.log(`\n=================== Sheet [${sheetName}]: ${data.length} rows ===================`);
  if (data.length > 0) {
    console.log('Sample columns:', Object.keys(data[0]));
    console.log('First 2 rows:', JSON.stringify(data.slice(0, 2), null, 2));
    console.log('Last 3 rows:', JSON.stringify(data.slice(-3), null, 2));
  }
});
