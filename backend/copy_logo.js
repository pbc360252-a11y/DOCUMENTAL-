const fs = require('fs');
const path = require('path');

const src = 'C:\\Users\\gdocumental\\.gemini\\antigravity\\brain\\0333ad1f-595b-47b7-a911-503c53366a4b\\coraza_sgd_logo_1785354117262.jpg';
const destFolder = path.join(__dirname, '../LOGO DE LA APP/sgd_coraza_logo.jpg');
const destPng = path.join(__dirname, '../frontend/logo.png');
const destJpg = path.join(__dirname, '../frontend/logo.jpg');

fs.copyFileSync(src, destFolder);
fs.copyFileSync(src, destPng);
fs.copyFileSync(src, destJpg);

console.log('✅ Logo copiado exitosamente a frontend/logo.png y LOGO DE LA APP/sgd_coraza_logo.jpg');
