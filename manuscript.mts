import pug from 'pug';
import fs from 'fs/promises';
import AozoraRubyParser from 'aozora-ruby-parser/src/aozora-ruby-parser.js';
import {google} from 'googleapis';
import 'dotenv/config.js';

interface Quiz {
	question: string,
	answer: string,
	alternativeAnswers: string[],
}

const compileRuby = (text: string) => {
	const parser = new AozoraRubyParser(text);
	parser.parse();

	let result = '';
	for (const node of parser.nodes) {
		if (typeof node.rt === 'string') {
			result += `<ruby><rb>${node.text}</rb><rp> (</rp><rt>${node.rt}</rt><rp>)</rp></ruby>`;
		} else {
			result += node.text;
		}
	}

	return result;
};

const auth = new google.auth.GoogleAuth({
	scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({
	version: 'v4',
	auth,
});

const getSheetRows = (rangeText: string) => new Promise<string[][]>((resolve, reject) => {
	sheets.spreadsheets.values.get({
		spreadsheetId: '1357WnNdRvBlDnh3oDtIde7ptDjm2pFFFb-hbytFX4lk',
		range: rangeText,
	}, (error, response) => {
		if (error) {
			reject(error);
		} else if (response?.data.values) {
			resolve(response.data.values as string[][]);
		} else {
			reject(new Error('values not found'));
		}
	});
});

const quizCells = await getSheetRows('hakatashi!A1:F3000');

const quizzes: Quiz[] = [];
for (const [index, question, answer, description = '', oralQuestion, minhayaQuestion] of quizCells) {
	if (description.includes('skip')) {
		continue;
	}

	const [mainAnswer, alternativeAnswersString = ''] = answer.split(/[\[\]]/);
	const alternativeAnswersPool = alternativeAnswersString.split(/[、]/).map((s) => s.trim()).filter((s) => s.length > 0);

	const alternativeAnswers = [mainAnswer];
	for (const alternativeAnswer of alternativeAnswersPool) {
		if (alternativeAnswers.some((a) => a.includes(alternativeAnswer))) {
			continue;
		}
		alternativeAnswers.push(alternativeAnswer);
	}

	quizzes.push({
		question: compileRuby(question),
		answer: mainAnswer,
		alternativeAnswers: alternativeAnswers.slice(1),
	});
}


const pugTemplate = await fs.readFile('manuscript.pug', 'utf-8');
const result = pug.render(pugTemplate, {quizzes: quizzes.slice(0, 100)}, undefined);

await fs.writeFile('manuscript.html', result);
