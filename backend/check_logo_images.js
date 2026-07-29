const fs = require('fs');
const path = require('path');

const folders = ['LOGO DE LA APP', 'LOGO', 'frontend'];

folders.forEach(folder => {
  const dirPath = path.join(__dirname, '../', folder);
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    console.log(`\nFolder [${folder}]:`);
    files.forEach(f => {
      const p = path.join(dirPath, f);
      const stat = fs.statSync(p);
      if (stat.isFile() && (f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'))) {
        console.log(`  - ${f}: ${stat.size} bytes (${(stat.size / 1024).toFixed(1)} KB)`);
      }
    });
  }
});
