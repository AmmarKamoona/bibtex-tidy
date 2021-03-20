import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import dsv from '@rollup/plugin-dsv';
import { version } from './package.json';
import ts from 'typescript';
import fs from 'fs';
import pegjs from 'rollup-plugin-pegjs';
import { builtinModules } from 'module';
import babel from '@rollup/plugin-babel';

const extensions = ['.ts', '.js'];

const tsv = {
	processRow(row) {
		return [row.unicode, row.latex];
	},
};

// Allows CLI util to get the option documentation from ts source files
const docsResolve = {
	name: 'docs-resolve',
	resolveId(source) {
		return source === 'DOCS' ? source : null;
	},
	load(id) {
		if (id !== 'DOCS') return null;
		const program = ts.createProgram([__dirname + '/src/options.ts'], {
			target: ts.ScriptTarget.ES5,
			module: ts.ModuleKind.CommonJS,
		});
		const checker = program.getTypeChecker();
		const sourceFile = program
			.getSourceFiles()
			.find(({ path }) => path.endsWith('/src/options.ts'));
		const typeToString = (member) => {
			try {
				return checker.typeToString(
					checker.getTypeOfSymbolAtLocation(
						member.symbol,
						member.symbol.valueDeclaration
					)
				);
			} catch (e) {
				console.error(member, e);
			}
		};

		const members = [];
		ts.forEachChild(sourceFile, (node) => {
			const symbol = checker.getSymbolAtLocation(node.name);
			if (!symbol) return;
			if (symbol.escapedName === 'Options') {
				members.push(...symbol.declarations[0].type.members);
			} else if (symbol.escapedName === 'CLIOptions') {
				// Make sure these are at the top, e.g. --help, --quiet
				members.push(...symbol.declarations[0].type.types[1].members);
			}
		});

		const options = members
			.sort((a, b) => (a.name.escapedText === 'help' ? -1 : 0))
			.map((member) => {
				const key = member.name.escapedText;
				return {
					key,
					cli: key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), // convert camelCase to --dash-argument
					description: member.jsDoc[0].comment.replace(
						/([\w,.;:])\s+([A-Za-z])/g,
						'$1 $2'
					),
					examples: (member.jsDoc[0].tags || [])
						.filter((tag) => tag.tagName.escapedText === 'example')
						.map((m) => m.comment),
					type: typeToString(member),
					deprecated: (member.jsDoc[0].tags || []).some(
						(tag) => tag.tagName.escapedText === 'deprecated'
					),
				};
			});
		return 'export default ' + JSON.stringify(options, null, 2) + ';';
	},
};

const makeExecutable = {
	name: 'make-executable',
	writeBundle(options) {
		const filename = options && (options.file || options.dest);
		fs.chmodSync(filename, 0o755); // rwxr-xr-x
	},
};

const banner = `/**
 * bibtex-tidy v${version}
 * https://github.com/FlamingTempura/bibtex-tidy
 * 
 * DO NOT EDIT THIS FILE. This file is automatically generated 
 * using \`npm run build\`. Edit files in './src' then rebuild.
 **/`;

const browserTargets = {
	edge: '17',
	firefox: '60',
	chrome: '67',
	safari: '11.1',
};
const cliTargets = { node: '4.0.0' };

export default [
	{
		input: 'src/index.ts',
		plugins: [
			docsResolve,
			pegjs(),
			dsv(tsv),
			commonjs(),
			nodeResolve({ extensions }),
			babel({
				extensions,
				babelHelpers: 'bundled',
				// see https://babeljs.io/docs/en/usage/#configuration
				presets: [
					'@babel/typescript',
					['@babel/env', { targets: browserTargets }],
				],
				comments: false,
			}),
		],
		output: {
			name: 'bibtexTidy',
			file: 'bibtex-tidy.js',
			format: 'umd',
			banner,
		},
	},
	{
		input: 'src/cli.ts',
		external: builtinModules,
		plugins: [
			docsResolve,
			pegjs(),
			dsv(tsv),
			commonjs(),
			nodeResolve({ extensions }),
			babel({
				extensions,
				babelHelpers: 'bundled',
				presets: ['@babel/typescript', ['@babel/env', { targets: cliTargets }]],
				comments: false,
			}),
			makeExecutable,
		],
		output: {
			name: 'bibtexTidy',
			file: 'bin/bibtex-tidy',
			format: 'cjs',
			banner: '#!/usr/bin/env node\n' + banner,
		},
	},
	{
		input: 'docs/index.ts',
		plugins: [
			docsResolve,
			pegjs(),
			dsv(tsv),
			commonjs(),
			nodeResolve({ extensions }),
			babel({
				extensions,
				babelHelpers: 'bundled',
				// see https://babeljs.io/docs/en/usage/#configuration
				presets: [
					'@babel/typescript',
					['@babel/env', { targets: browserTargets }],
				],
				comments: false,
			}),
		],
		output: {
			name: 'bibtexTidy',
			file: 'docs/bundle.js',
			format: 'umd',
			banner,
		},
	},
];
