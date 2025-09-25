// ----------------- INIT ELEMENTY -----------------
const csvFileInput = document.getElementById('csvFile');
const fileCard = document.getElementById('fileCard');
const fileNameEl = document.getElementById('fileName');
const fileInfoEl = document.getElementById('fileInfo');
const headerRowInput = document.getElementById('headerRow');
const delimiterSelect = document.getElementById('delimiter');
const applyHeaderBtn = document.getElementById('applyHeader');
const previewTable = document.getElementById('previewTable');
const previewRowsInput = document.getElementById('previewRows');
const generateBtn = document.getElementById('generateBtn');
const sqlOutput = document.getElementById('sqlOutput');
const tableNameInput = document.getElementById('tableName');
const copySqlBtn = document.getElementById('copySql');
const downloadSqlBtn = document.getElementById('downloadSql');
const pctText = document.getElementById('pctText');
const progressWrap = document.getElementById('progressWrap');

let rawCsvText = '';
let parsedRows = []; 
let headers = [];
let mappings = []; 

// ----------------- FUNKCE -----------------
function parseCSV(text, delimiter=',') {
  const lines = text.replace(/\r/g,'').split('\n').filter(l => l.trim() !== '');
  const rows = lines.map(line => {
    const row = [];
    let cur = '';
    let inQuotes = false;
    for (let i=0;i<line.length;i++){
      const ch = line[i];
      if (ch === '"' ) {
        if (inQuotes && line[i+1] === '"') { cur += '"'; i++; } 
        else inQuotes = !inQuotes;
        continue;
      }
      if (ch === delimiter && !inQuotes) {
        row.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    row.push(cur);
    return row.map(v => v.trim());
  });
  return rows;
}

function safeSQL(val, type) {
  if (val === null || val === undefined) return 'NULL';
  if (val === '') return "''";
  const esc = (''+val).replace(/'/g, "''");
  if (type && ['INT','INTEGER','FLOAT','DECIMAL'].includes(type.toUpperCase())) {
    if (!isNaN(Number(val))) return val;
  }
  return `'${esc}'`;
}

function renderMappings() {
  const container = document.getElementById("mappings");
  container.innerHTML = "";
  mappings.forEach((map, idx) => {
    const row = document.createElement("div");
    row.className = "flex items-center gap-3 bg-white rounded-xl shadow p-3 mb-2 text-sm";

    row.innerHTML = `
      <div class="flex-1">
        <label class="block text-xs text-gray-500">SQL název</label>
        <input type="text" value="${map.sqlName}" data-idx="${idx}" 
          class="mapName w-full rounded-lg border-gray-300 shadow-sm px-2 py-1" />
      </div>
      <div>
        <label class="block text-xs text-gray-500">Typ</label>
        <select data-idx="${idx}" class="mapType rounded-lg border-gray-300 shadow-sm px-2 py-1">
          <option ${map.type==="TEXT"?"selected":""}>TEXT</option>
          <option ${map.type==="INT"?"selected":""}>INT</option>
          <option ${map.type==="REAL"?"selected":""}>REAL</option>
          <option ${map.type==="DATE"?"selected":""}>DATE</option>
        </select>
      </div>
      <div>
        <label class="block text-xs text-gray-500">Fixní</label>
        <input type="text" value="${map.fixedValue}" data-idx="${idx}" 
          class="mapFixed w-28 rounded-lg border-gray-300 shadow-sm px-2 py-1" />
      </div>
      <div class="flex items-center mt-5">
        <button data-idx="${idx}" 
          class="toggleInclude px-3 py-1 rounded-lg text-xs font-semibold shadow 
          ${map.include ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'}">
          ${map.include ? 'Použít' : 'Nepoužít'}
        </button>
      </div>
    `;

    container.appendChild(row);
  });

  // Event listeners
  document.querySelectorAll(".mapName").forEach(el => {
    el.addEventListener("input", e => {
      mappings[e.target.dataset.idx].sqlName = e.target.value;
      generateSQL();
    });
  });
  document.querySelectorAll(".mapType").forEach(el => {
    el.addEventListener("change", e => {
      mappings[e.target.dataset.idx].type = e.target.value;
      generateSQL();
    });
  });
  document.querySelectorAll(".mapFixed").forEach(el => {
    el.addEventListener("input", e => {
      mappings[e.target.dataset.idx].fixedValue = e.target.value;
      generateSQL();
    });
  });
  document.querySelectorAll(".toggleInclude").forEach(el => {
    el.addEventListener("click", e => {
      const idx = e.target.dataset.idx;
      mappings[idx].include = !mappings[idx].include;
      renderMappings();
      renderPreview();
      generateSQL();
    });
  });
}

function renderPreview() {
  previewTable.innerHTML = '';
  if (!parsedRows.length) {
    previewTable.innerHTML = '<tr><td class="p-4 text-xs text-gray-400">Žádná data k zobrazení.</td></tr>';
    return;
  }
  const rowsToShow = Math.min(parsedRows.length, Number(previewRowsInput.value || 5));
  const trh = document.createElement('tr');
  trh.className = 'bg-gray-50';
  headers.forEach(h=>{
    const th = document.createElement('th');
    th.className = 'text-left text-xs px-3 py-2 font-medium text-gray-600';
    th.innerText = h || '';
    trh.appendChild(th);
  });
  previewTable.appendChild(trh);
  for (let r=0;r<rowsToShow;r++){
    const tr = document.createElement('tr');
    const row = parsedRows[r];
    headers.forEach((h, c)=>{
      const td = document.createElement('td');
      td.className = 'text-sm px-3 py-2 border-t border-gray-100';
      td.innerText = row[c] ?? '';
      tr.appendChild(td);
    });
    previewTable.appendChild(tr);
  }
}

function generateSQL() {
  const tbl = (tableNameInput.value || 'my_table').trim();
  if (!headers.length || !parsedRows.length) {
    alert('Nahraj CSV a nastav mapování před generováním SQL.');
    return;
  }
  const columns = mappings.map(m => m.sqlName ? m.sqlName.replace(/\s+/g,'_') : (m.orig || 'col')).map(c => c || 'col');
  const headerIdx = Number(headerRowInput.value || 1) - 1;
  const dataRows = parsedRows.slice(headerIdx+1); 
  const maxRows = 10000;
  const rowsForGen = dataRows.slice(0, maxRows);

  const inserts = [];
  rowsForGen.forEach((row)=>{
    const values = mappings.map((m, i)=>{
      if (m.fixedValue && m.fixedValue !== '') {
        return safeSQL(m.fixedValue, m.type);
      }
      const val = row[i] ?? '';
      return safeSQL(val, m.type);
    });
    const insert = `INSERT INTO ${tbl} (${columns.join(', ')}) VALUES (${values.join(', ')});`;
    inserts.push(insert);
  });

  const headerComment = `-- Generated ${rowsForGen.length} INSERTs for table ${tbl}\n`;
  sqlOutput.value = headerComment + inserts.join('\n');
}

function updateProgress() {
  const cnt = parsedRows.length;
  pctText.innerText = cnt;
  const deg = Math.min(360, cnt / 1000 * 360);
  progressWrap.style.setProperty('--pct', deg + 'deg');
}

// ----------------- LISTENERY -----------------
csvFileInput.addEventListener('change', async (e)=>{
  const f = e.target.files[0];
  if (!f) return;
  fileCard.classList.remove('hidden');
  fileNameEl.innerText = `Soubor: ${f.name}`;
  rawCsvText = await f.text();
  const d = delimiterSelect.value === '\\t' ? '\t' : delimiterSelect.value;
  parsedRows = parseCSV(rawCsvText, d);
  headers = parsedRows.length ? parsedRows[0] : [];
  mappings = headers.map(h=>({orig: h, sqlName: h, type: 'TEXT', fixedValue: ''}));
  fileInfoEl.innerText = `Počet řádků: ${parsedRows.length} • Sloupců: ${headers.length}`;
  updateProgress();
  renderMappings();
  renderPreview();
});

applyHeaderBtn.addEventListener('click', ()=>{
  if (!rawCsvText) return alert('Nejprve nahraj CSV.');
  const d = delimiterSelect.value === '\\t' ? '\t' : delimiterSelect.value;
  parsedRows = parseCSV(rawCsvText, d);
  const headerIdx = Number(headerRowInput.value || 1) - 1;
  if (headerIdx < 0 || headerIdx >= parsedRows.length) {
    alert('Neplatný index hlavičky.');
    return;
  }
  headers = parsedRows[headerIdx] || [];
  mappings = headers.map(h=>({orig: h, sqlName: h, type: 'TEXT', fixedValue: ''}));
  fileInfoEl.innerText = `Počet řádků: ${parsedRows.length} • Sloupců: ${headers.length}`;
  renderMappings();
  renderPreview();
  updateProgress();
});

generateBtn.addEventListener('click', ()=> generateSQL());

copySqlBtn.addEventListener('click', async ()=>{
  if (!sqlOutput.value) return alert('Žádné SQL k zkopírování.');
  try {
    await navigator.clipboard.writeText(sqlOutput.value);
    alert('SQL zkopírováno do schránky.');
  } catch (e) {
    alert('Kopírování selhalo.');
  }
});

downloadSqlBtn.addEventListener('click', ()=>{
  if (!sqlOutput.value) return alert('Žádné SQL k uložení.');
  const blob = new Blob([sqlOutput.value], {type: 'text/sql'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (tableNameInput.value || 'export') + '.sql';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// drag & drop
document.addEventListener('dragover', (e)=>e.preventDefault());
document.addEventListener('drop', (e)=>{
  e.preventDefault();
  if (e.dataTransfer?.files?.length) {
    csvFileInput.files = e.dataTransfer.files;
    csvFileInput.dispatchEvent(new Event('change'));
  }
});

// defaults
headerRowInput.value = 1;
