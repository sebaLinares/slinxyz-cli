#!/usr/bin/env node

/**
 * CLI principal para bootstrap de NestJS
 */
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

import {
  checkCommand,
  execCommand,
  readJSON,
  writeJSON,
  writeFile,
  formatElapsed,
} from '../lib/utils.js';

const program = new Command();
program
  .name('nb')
  .version('1.0.0')
  .description('CLI para crear proyectos NestJS preconfigurados')
  .argument('[projectName]', 'Nombre del proyecto a crear (si no se indica, se preguntará).')
  .option('--no-deps', 'Omitir instalación de dependencias extras (solo crear Nest proyecto).')
  .option('--skip-husky', 'Omitir la configuración de Husky y commitlint.')
  .parse(process.argv);

(async () => {
  const options = program.opts();
  let projectName = program.args[0];

  // 1) Si no dieron nombre, preguntar por Inquirer
  if (!projectName) {
    const answers = await inquirer.prompt([
      {
        name: 'projectName',
        message: '📛 Nombre del nuevo proyecto NestJS:',
        type: 'input',
        validate(input) {
          return input.trim() === ''
            ? 'El nombre no puede estar vacío.'
            : true;
        },
      },
    ]);
    projectName = answers.projectName.trim();
  }

  console.log(chalk.blue(`\nCreando proyecto: ${projectName}\n`));
  const startTime = Date.now();

  // 2) Verificar 'yarn' existe
  try {
    checkCommand('yarn');
  } catch {
    console.error(chalk.red('❌ Yarn no está instalado. Instálalo primero.'));
    process.exit(1);
  }

  // 3) Verificar 'nest' existe, si no instalar global
  try {
    checkCommand('nest');
  } catch {
    console.log(chalk.yellow('Nest CLI no encontrado. Instalando @nestjs/cli globalmente…'));
    await execCommand('yarn', ['global', 'add', '@nestjs/cli'], 'Instalando @nestjs/cli');
  }

  // 4) Ejecutar 'nest new'
  // Aquí usamos "nest new" en lugar de "npx nestjs new"
  await execCommand(
    'nest',
    ['new', projectName, '--package-manager', 'yarn'],
    'Creando proyecto NestJS'
  );

  // 5) Cambiar directorio
  const projectPath = path.join(process.cwd(), projectName);
  process.chdir(projectPath);

  // 6) Si no se omiten deps, instalarlas
  if (options.deps) {
    console.log(chalk.blue('\nInstalando dependencias de producción extra…'));
    await execCommand(
      'yarn',
      [
        'add',
        '@aws-sdk/client-cognito-identity-provider',
        '@aws-sdk/client-s3',
        '@aws-sdk/client-ses',
        '@prisma/client',
        'aws-lambda',
        'cookie-parser',
        'date-fns',
        'google-auth-library',
        'handlebars',
        'jwks-rsa',
        'jwt-decode',
        'nest-winston',
        'nestjs-form-data',
        'passport',
        'passport-jwt',
        'reflect-metadata',
        'rut.js',
        'uuid',
        'winston',
        'zod',
      ],
      'yarn add dependencias de producción'
    );

    console.log(chalk.blue('\nInstalando dependencias de desarrollo extra…'));
    await execCommand(
      'yarn',
      [
        'add',
        '-D',
        '@commitlint/cli',
        '@commitlint/config-conventional',
        '@semantic-release/changelog',
        '@semantic-release/commit-analyzer',
        '@semantic-release/git',
        '@semantic-release/github',
        '@semantic-release/npm',
        '@semantic-release/release-notes-generator',
        '@typescript-eslint/eslint-plugin',
        '@typescript-eslint/parser',
        'cross-env',
        'eslint-config-prettier',
        'eslint-plugin-prettier',
        'eslint-plugin-import',
        'eslint-plugin-eslint-comments',
        'husky',
        'lint-staged',
        'prettier',
        'semantic-release',
      ],
      'yarn add -D dependencias de desarrollo'
    );
  } else {
    console.log(chalk.yellow('\n--no-deps : Se omitió instalar dependencias extras.\n'));
  }

  // 7) Actualizar package.json: scripts y lint-staged
  const pkgPath = path.join(process.cwd(), 'package.json');
  const pkgJson = await readJSON(pkgPath);

  // Fusionar scripts (sin pisar los generados por Nest)
  pkgJson.scripts = pkgJson.scripts || {};
  pkgJson.scripts['start:offline'] = 'cross-env NODE_ENV=offline nest start --watch';
  pkgJson.scripts['format'] = 'prettier --write "{src,test}/**/*.{ts,js,json,md,yml}"';
  pkgJson.scripts['lint'] = 'eslint . --ext .ts,.js --fix';
  pkgJson.scripts['prepare'] = 'husky';
  pkgJson.scripts['semantic-release'] = 'semantic-release';

  // Agregar lint-staged
  pkgJson['lint-staged'] = {
    'src/**/*.{ts,js}': ['prettier --write', 'eslint --fix'],
    'src/**/*.{json,yml,md}': ['prettier --write'],
    '*.{json,yml,md}': ['prettier --write'],
  };

  await writeJSON(pkgPath, pkgJson);
  console.log(chalk.green('✓ package.json actualizado.\n'));

  // 8) Ajustar tsconfig.json → agregar paths si no existen
  const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
  if (await fs.pathExists(tsconfigPath)) {
    const tsconfig = await readJSON(tsconfigPath);
    if (!tsconfig.compilerOptions.paths) {
      tsconfig.compilerOptions.paths = { '@app/*': ['src/*'] };
      await writeJSON(tsconfigPath, tsconfig);
      console.log(chalk.green('✓ Paths añadidos a tsconfig.json.\n'));
    }
  }

  // 9) Configurar Husky y Commitlint (si no se omite)
  if (options.skipHusky) {
    console.log(chalk.yellow('--skip-husky : Se omitió configuración de Husky.\n'));
  } else {
    console.log(chalk.blue('Configurando Husky y commitlint…'));
    // npx husky init → crea carpeta .husky/ y hook pre-commit inicial
    await execCommand('npx', ['husky', 'init'], 'Inicializando Husky');

    // Reemplazar contenido de .husky/pre-commit
    const huskyPreCommit = `#!/usr/bin/env sh
npx lint-staged
`;
    await writeFile(path.join(process.cwd(), '.husky/pre-commit'), huskyPreCommit);
    fs.chmodSync(path.join(process.cwd(), '.husky/pre-commit'), 0o755);

    // Crear hook commit-msg
    const huskyCommitMsg = `#!/usr/bin/env sh
npx --no-install commitlint --edit "$1"
`;
    await writeFile(path.join(process.cwd(), '.husky/commit-msg'), huskyCommitMsg);
    fs.chmodSync(path.join(process.cwd(), '.husky/commit-msg'), 0o755);

    // commitlint.config.js
    const commitlintCfg = `module.exports = { extends: ['@commitlint/config-conventional'] };`;
    await writeFile(path.join(process.cwd(), 'commitlint.config.js'), commitlintCfg);

    console.log(chalk.green('✓ Husky y commitlint configurados.\n'));
  }

  // 10) Archivos de configuración adicionales
  console.log(chalk.blue('Creando archivos de configuración…'));

  // .prettierrc
  const prettierRc = `{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "endOfLine": "lf"
}
`;
  await writeFile(path.join(process.cwd(), '.prettierrc'), prettierRc);

  // .prettierignore
  const prettierIgnore = `build
coverage
dist
node_modules
`;
  await writeFile(path.join(process.cwd(), '.prettierignore'), prettierIgnore);

  // .lintstagedrc.json
  const lintstaged = `{
  "src/**/*.{ts,js}": [
    "prettier --write",
    "eslint --fix"
  ],
  "src/**/*.{json,yml,md}": ["prettier --write"],
  "*.{json,yml,md}": ["prettier --write"]
}
`;
  await writeFile(path.join(process.cwd(), '.lintstagedrc.json'), lintstaged);

  // .editorconfig
  const editorconfig = `root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
max_line_length = 100
tab_width = 2
quote = single

[*.md]
max_line_length = off
trim_trailing_whitespace = false

[*.yml]
indent_size = 2
`;
  await writeFile(path.join(process.cwd(), '.editorconfig'), editorconfig);

  // .nvmrc
  await writeFile(path.join(process.cwd(), '.nvmrc'), 'v20.11.0\n');

  // .releaserc.json
  const releaserc = `{
  "repositoryUrl": "<REPOSITORY_URL_HERE>",
  "tagFormat": "v\${version}",
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/changelog",
      { "changelogFile": "CHANGELOG.md" }
    ],
    [
      "@semantic-release/npm",
      { "npmPublish": false }
    ],
    "@semantic-release/github",
    [
      "@semantic-release/git",
      {
        "assets": ["CHANGELOG.md", "package.json"],
        "message": "chore(release): \${nextRelease.version} [skip ci]\\n\\n\${nextRelease.notes}"
      }
    ]
  ],
  "branches": ["main", "dev"]
}
`;
  await writeFile(path.join(process.cwd(), '.releaserc.json'), releaserc);

  console.log(chalk.green('✓ Archivos de configuración creados.\n'));

  // 11) Mostrar tiempo total
  const elapsedSeconds = formatElapsed(startTime);
  console.log(chalk.green(`✅ Proyecto ${projectName} listo.`));
  console.log(chalk.blue(`⏱ Tiempo total de ejecución: ${elapsedSeconds} segundos.`));
})();
