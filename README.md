# CSV → SQL Converter (Electron)

Desktop application for quickly converting CSV/Excel files into SQL queries using **Electron**.

---

## 1. Install Node.js and npm

Before starting, make sure **Node.js** and **npm** are installed:

```bash
# Check Node.js version
node -v

# Check npm version
npm -v
```

If not installed, download from [https://nodejs.org](https://nodejs.org).

---

## 2. Download the project

```bash
# Clone the repository
git clone https://github.com/username/convertor_csv_to_sql.git

# Change directory to the project folder
cd convertor_csv_to_sql
```

---

## 3. Install dependencies

```bash
# Install all required packages (creates node_modules)
npm install
```

- This will install **Electron**, **TailwindCSS**, and all other packages listed in `package.json`.

---

## 4. Run the application

```bash
# Start the desktop application
npm start
```

- This will launch Electron and open the application window.

---

## 5. Tailwind CSS development

If you want to edit styles using TailwindCSS:

```bash
# Watch Tailwind files and build CSS
npm run build-css
```

- Generates or updates `tailwind.css` from `input.css`.
- Automatically watches for changes and rebuilds CSS.

---

## 6. Build a Windows package

To create a Windows executable:

```bash
npm run win-package-build
```

- Creates a folder named **CSV2SQL** with a `.exe` file.
- Uses the icon `assets/icons/icon.ico`.
- Overwrites old packages if they exist (`--overwrite`).
