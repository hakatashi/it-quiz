import {Ajv2020} from "ajv/dist/2020.js"
import fs from 'fs-extra';
import path from 'path';
import {fileURLToPath} from "url";
import yaml from 'js-yaml';
import type {Quiz} from "./quizzes.d.ts";

const __filename = fileURLToPath(import.meta.url);

const githubOutput = process.env.GITHUB_OUTPUT;

const ajv = new Ajv2020();
ajv.addKeyword('meta:name');

const schema = await fs.readJSON(path.join(__filename, '../../../quizzes.schema.json'));
const validate = ajv.compile(schema);

for (const filename of ['it-quiz.yaml', 'news-quiz.yaml']) {
	const content = await fs.readFile(path.join(__filename, '../../..', filename), 'utf-8');
	const quizzes = yaml.load(content);
	console.log(`${filename}: ${(quizzes as Quiz[]).length} quizzes`);

	if (githubOutput === undefined) {
		console.log('No GITHUB_OUTPUT is set. Skip writing.');
	} else {
		console.log('Writing quizzes counts to GITHUB_OUTPUT...');
		const basename = path.basename(filename, '.yaml').replaceAll('-', '_');
		const countWithDecimals = (quizzes as Quiz[]).length.toLocaleString('en-US');
		await fs.appendFile(githubOutput, `${basename}_count=${countWithDecimals}\n`);
	}

	if (!validate(quizzes)) {
		console.error(validate.errors);
		process.exit(1);
	}
}

console.log('Validation succeeded.');

