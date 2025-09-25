// ---------- INIT ----------
const csvFileInput = document.getElementById("csvFile");
const fileCard = document.getElementById("fileCard");
const fileNameEl = document.getElementById("fileName");
const fileInfoEl = document.getElementById("fileInfo");
const headerRowInput = document.getElementById("headerRow");
const delimiterSelect = document.getElementById("delimiter");
const applyHeaderBtn = document.getElementById("applyHeader");
const previewTable = document.getElementById("previewTable");
const previewRowsInput = document.getElementById("previewRows");
const sqlOutput = document.getElementById("sqlOutput");
const tableNameInput = document.getElementById("tableName");
const copySqlBtn = document.getElementById("copySql");
const downloadSqlBtn = document.getElementById("downloadSql");
const pctText = document.getElementById("pctText");
const progressWrap = document.getElementById("progressWrap");
const sqlTypeSelect = document.getElementById("sqlType");
const mappingsContainer = document.getElementById("mappings");

let rawCsvText = "";
let parsedRows = [];
let headers = [];
let mappings = [];

// ---------- FUNKCE ----------
function parseCSV(text, delimiter = ",") {
	const lines = text
		.replace(/\r/g, "")
		.split("\n")
		.filter((l) => l.trim() !== "");
	return lines.map((line) => {
		const row = [];
		let cur = "",
			inQuotes = false;
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (ch === '"') {
				if (inQuotes && line[i + 1] === '"') {
					cur += '"';
					i++;
				} else inQuotes = !inQuotes;
				continue;
			}
			if (ch === delimiter && !inQuotes) {
				row.push(cur);
				cur = "";
				continue;
			}
			cur += ch;
		}
		row.push(cur);
		return row.map((v) => v.trim());
	});
}

function safeSQL(val, type) {
	if (val == null) return "NULL";
	if (val === "") return "''";
	const esc = ("" + val).replace(/'/g, "''");
	if (type && ["INT", "INTEGER", "FLOAT", "DECIMAL"].includes(type.toUpperCase()) && !isNaN(Number(val))) return val;
	return `'${esc}'`;
}

function renderMappings() {
	mappingsContainer.innerHTML = "";
	mappings.forEach((map, idx) => {
		const row = document.createElement("div");
		row.className = "flex items-center gap-3 bg-white rounded-xl shadow p-3 mb-2 text-sm";
		row.innerHTML = `
      <div class="flex-1">
        <label class="block text-xs text-gray-500">SQL název</label>
        <input type="text" value="${map.sqlName}" data-idx="${idx}" class="mapName w-full rounded-lg border-gray-300 shadow-sm px-2 py-1" />
      </div>
      <div>
        <label class="block text-xs text-gray-500">Typ</label>
        <select data-idx="${idx}" class="mapType rounded-lg border-gray-300 shadow-sm px-2 py-1">
          <option ${map.type === "TEXT" ? "selected" : ""}>TEXT</option>
          <option ${map.type === "INT" ? "selected" : ""}>INT</option>
          <option ${map.type === "REAL" ? "selected" : ""}>REAL</option>
          <option ${map.type === "DATE" ? "selected" : ""}>DATE</option>
        </select>
      </div>
      <div>
        <label class="block text-xs text-gray-500">Hodnota</label>
        <input type="text" value="${map.fixedValue}" data-idx="${idx}" class="mapFixed w-28 rounded-lg border-gray-300 shadow-sm px-2 py-1" />
      </div>
      <div class="flex items-center mt-5">
        <button data-idx="${idx}" class="toggleInclude px-3 py-1 rounded-lg text-xs font-semibold shadow ${map.include ? "bg-green-500 text-white hover:bg-green-600" : "bg-gray-300 text-gray-700 hover:bg-gray-400"}">
          ${map.include ? "Použít" : "Nepoužít"}
        </button>
      </div>
    `;
		mappingsContainer.appendChild(row);
	});

	// Eventy
	document.querySelectorAll(".mapName").forEach((el) =>
		el.addEventListener("input", (e) => {
			mappings[e.target.dataset.idx].sqlName = e.target.value;
			generateSQL();
		})
	);
	document.querySelectorAll(".mapType").forEach((el) =>
		el.addEventListener("change", (e) => {
			mappings[e.target.dataset.idx].type = e.target.value;
			generateSQL();
		})
	);
	document.querySelectorAll(".mapFixed").forEach((el) =>
		el.addEventListener("input", (e) => {
			mappings[e.target.dataset.idx].fixedValue = e.target.value;
			generateSQL();
		})
	);
	document.querySelectorAll(".toggleInclude").forEach((el) =>
		el.addEventListener("click", (e) => {
			const idx = e.target.dataset.idx;
			mappings[idx].include = !mappings[idx].include;
			renderMappings();
			renderPreview();
			generateSQL();
		})
	);
}

// ---------- PREVIEW ----------
function renderPreview() {
	previewTable.innerHTML = "";
	if (!parsedRows.length) {
		previewTable.innerHTML = '<tr><td class="p-4 text-xs text-gray-400">Žádná data k zobrazení.</td></tr>';
		return;
	}
	const rowsToShow = Math.min(parsedRows.length, Number(previewRowsInput.value || 5));
	const trh = document.createElement("tr");
	trh.className = "bg-gray-50";
	headers.forEach((h) => {
		const th = document.createElement("th");
		th.className = "text-left text-xs px-3 py-2 font-medium text-gray-600";
		th.innerText = h || "";
		trh.appendChild(th);
	});
	previewTable.appendChild(trh);
	for (let r = 0; r < rowsToShow; r++) {
		const tr = document.createElement("tr");
		const row = parsedRows[r];
		headers.forEach((h, c) => {
			const td = document.createElement("td");
			td.className = "text-sm px-3 py-2 border-t border-gray-100";
			td.innerText = row[c] ?? "";
			tr.appendChild(td);
		});
		previewTable.appendChild(tr);
	}
}

// ---------- SQL ----------
function generateSQL() {
	const tbl = (tableNameInput.value || "my_table").trim();
	const sqlType = sqlTypeSelect.value || "INSERT";
	if (!headers.length && !mappings.some((m) => m.isCustom)) {
		alert("Nahraj CSV/Excel a nastav mapování před generováním SQL.");
		return;
	}
	const usedColumns = mappings.filter((m) => m.include);
	const columns = usedColumns.map((m) => m.sqlName.replace(/\s+/g, "_"));
	const headerIdx = Number(headerRowInput.value || 1) - 1;
	const dataRows = parsedRows.slice(headerIdx + 1);
	const maxRows = 10000;
	const rowsForGen = dataRows.slice(0, maxRows);
	const inserts = [];

	rowsForGen.forEach((row) => {
		const values = usedColumns.map((m, i) => {
			if (m.fixedValue && m.fixedValue !== "") return safeSQL(m.fixedValue, m.type);
			if (m.isCustom) return safeSQL(m.fixedValue || "", m.type);
			const val = row[i] ?? "";
			return safeSQL(val, m.type);
		});
		inserts.push(`${sqlType} INTO ${tbl} (${columns.join(", ")}) VALUES (${values.join(", ")});`);
	});

	sqlOutput.value = `-- Generated ${rowsForGen.length} ${sqlType} statements for table ${tbl}\n` + inserts.join("\n");
}

// ---------- HELP ----------
function showHelp() {
	alert(
		"Nápověda k používání aplikace:\n\n" +
			"1. Načíst soubor\n" +
			"2. Zvolit oddělovač\n" +
			"3. Zvolit sloupce\n" +
			"4. Upravit názvy sloupců (Soubor → DB název)\n" +
			"5. Zvolit typ insertu (INSERT, INSERT IGNORE)\n" +
			"6. Zadat název tabulky\n" +
			"7. Generovat SQL příkazy\n" +
			"8. Stáhnout nebo zkopírovat výstup"
	);
}

// ---------- CUSTOM COLUMN ----------
function addCustomColumn() {
	const name = prompt("Název vlastního sloupce:");
	if (!name) return;
	const value = prompt("Hodnota pro tento sloupec:");
	mappings.push({ orig: "", sqlName: name, type: "TEXT", fixedValue: value || "", include: true, isCustom: true });
	renderMappings();
}

// ---------- PROGRESS ----------
function updateProgress() {
	pctText.innerText = parsedRows.length;
	progressWrap.style.setProperty("--pct", Math.min(360, (parsedRows.length / 1000) * 360) + "deg");
}

// ---------- EVENTS ----------
csvFileInput.addEventListener("change", async (e) => {
	const f = e.target.files[0];
	if (!f) return;
	fileCard.classList.remove("hidden");
	fileNameEl.innerText = `Soubor: ${f.name}`;

	if (f.name.endsWith(".xlsx")) {
		const data = await f.arrayBuffer();
		const workbook = XLSX.read(data, { type: "array" });
		const wsname = workbook.SheetNames[0];
		const ws = workbook.Sheets[wsname];
		const arr = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
		parsedRows = arr;
	} else {
		rawCsvText = await f.text();
		const d = delimiterSelect.value === "\\t" ? "\t" : delimiterSelect.value;
		parsedRows = parseCSV(rawCsvText, d);
	}

	headers = parsedRows.length ? parsedRows[0] : [];
	mappings = headers.map((h) => ({ orig: h, sqlName: h, type: "TEXT", fixedValue: "", include: true }));
	fileInfoEl.innerText = `Počet řádků: ${parsedRows.length} • Sloupců: ${headers.length}`;
	updateProgress();
	renderMappings();
	renderPreview();
});

applyHeaderBtn.addEventListener("click", () => {
	if (!parsedRows.length) return alert("Nejprve nahraj CSV/Excel.");
	const headerIdx = Number(headerRowInput.value || 1) - 1;
	headers = parsedRows[headerIdx] || [];
	mappings = headers.map((h) => ({ orig: h, sqlName: h, type: "TEXT", fixedValue: "", include: true }));
	renderMappings();
	renderPreview();
	updateProgress();
});

delimiterSelect.addEventListener("change", () => {
	if (!rawCsvText) return;
	const d = delimiterSelect.value === "\\t" ? "\t" : delimiterSelect.value;
	parsedRows = parseCSV(rawCsvText, d);
	const headerIdx = Number(headerRowInput.value || 1) - 1;
	headers = parsedRows[headerIdx] || [];
	renderPreview();
	updateProgress();
});

copySqlBtn.addEventListener("click", async () => {
	if (!sqlOutput.value) return alert("Žádné SQL k zkopírování.");
	try {
		await navigator.clipboard.writeText(sqlOutput.value);
		alert("SQL zkopírováno do schránky.");
	} catch {
		alert("Kopírování selhalo.");
	}
});

downloadSqlBtn.addEventListener("click", () => {
	if (!sqlOutput.value) return alert("Žádné SQL k uložení.");
	const blob = new Blob([sqlOutput.value], { type: "text/sql" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = (tableNameInput.value || "my_table") + ".sql";
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
});

// Preview řádků
previewRowsInput.addEventListener("input", renderPreview);

// ---------- CUSTOM COLUMN BUTTON ----------
function initCustomColumnButton() {
	const btn = document.querySelector('button[onclick="addCustomColumn()"]');
	if (btn) btn.addEventListener("click", addCustomColumn);
}

// Inicializace
initCustomColumnButton();

const showCustomFormBtn = document.getElementById("showCustomFormBtn");
const customColumnForm = document.getElementById("customColumnForm");
const addCustomColBtn = document.getElementById("addCustomColBtn");
const customColName = document.getElementById("customColName");
const customColValue = document.getElementById("customColValue");
const generateSQLBtn = document.getElementById("generateSQLBtn");

// Zobrazit/skrytí formuláře
showCustomFormBtn.addEventListener("click", () => {
	customColumnForm.classList.toggle("hidden");
});

// Přidání vlastního sloupce
addCustomColBtn.addEventListener("click", (e) => {
	e.preventDefault();
	const name = customColName.value.trim();
	if (!name) return alert("Zadej název sloupce");
	const value = customColValue.value.trim();
	mappings.push({ orig: "", sqlName: name, type: "TEXT", fixedValue: value, include: true, isCustom: true });
	renderMappings();
	customColName.value = "";
	customColValue.value = "";
	customColumnForm.classList.add("hidden");
});

// Generovat SQL tlačítko
generateSQLBtn.addEventListener("click", () => {
	generateSQL();
});
