// lib/utils.js
import { execa, execaSync } from 'execa';
import fs from 'fs-extra';
import ora from 'ora';

/**
 * Verifica que el comando exista en el PATH. Si no existe, sale con error.
 * @param {string} cmdName - Nombre del comando a verificar (ej: "yarn", "nest")
 */
export function checkCommand(cmdName) {
  const which = execaSync('which', [cmdName]);
  if (which.exitCode !== 0) {
    console.error(`❌ '${cmdName}' no está instalado o no está en el PATH.`);
    process.exit(1);
  }
}

/**
 * Ejecuta un comando externo usando execa y muestra spinner hasta que termine.
 * @param {string} cmd - comando principal (ej: "npm", "npx", "nest")
 * @param {Array<string>} args - arreglo de argumentos
 * @param {string|null} message - mensaje a mostrar junto al spinner
 * @param {object} options - opciones opcionales para execa
 * @returns {Promise<void>}
 */
export async function execCommand(cmd, args = [], message = null, options = {}) {
  let spinner = null;
  if (message) {
    spinner = ora({ text: message, spinner: 'dots' }).start();
  }
  try {
    await execa(cmd, args, { stdio: 'inherit', ...options });
    if (spinner) spinner.succeed();
  } catch (err) {
    if (spinner) spinner.fail();
    console.error(`❌ Error ejecutando: ${cmd} ${args.join(' ')}`);
    console.error(err);
    process.exit(1);
  }
}

/**
 * Lee un JSON desde la ruta dada y lo parsea a JS object.
 * @param {string} filepath - ruta al archivo JSON
 * @returns {Promise<Object>}
 */
export async function readJSON(filepath) {
  try {
    return await fs.readJson(filepath);
  } catch (err) {
    console.error(`❌ No se pudo leer JSON de: ${filepath}`);
    console.error(err);
    process.exit(1);
  }
}

/**
 * Escribe un objeto JS como JSON en la ruta dada (pretty-print).
 * @param {string} filepath - ruta de destino
 * @param {Object} content - objeto a serializar
 * @returns {Promise<void>}
 */
export async function writeJSON(filepath, content) {
  try {
    await fs.writeJson(filepath, content, { spaces: 2 });
  } catch (err) {
    console.error(`❌ No se pudo escribir JSON en: ${filepath}`);
    console.error(err);
    process.exit(1);
  }
}

/**
 * Escribe un archivo de texto con el contenido dado.
 * @param {string} filepath - ruta de destino
 * @param {string} content - contenido a escribir (texto plano)
 * @returns {Promise<void>}
 */
export async function writeFile(filepath, content) {
  try {
    await fs.outputFile(filepath, content);
  } catch (err) {
    console.error(`❌ No se pudo escribir el archivo: ${filepath}`);
    console.error(err);
    process.exit(1);
  }
}

/**
 * Recibe un timestamp (en milisegundos) y calcula tiempo transcurrido en segundos.
 * @param {number} startTimestamp - resultado de Date.now() al inicio
 * @returns {number} segundos transcurridos redondeados
 */
export function formatElapsed(startTimestamp) {
  const end = Date.now();
  const elapsedMs = end - startTimestamp;
  return Math.round(elapsedMs / 1000);
}
