import {google} from 'googleapis';
import 'dotenv/config';
import type {Quiz} from './quizzes.js';
import yaml from 'js-yaml';
import fs from 'node:fs/promises';
import path from 'node:path';

const startId = parseInt(process.argv[2]);
if (Number.isNaN(startId)) {
  throw new Error('Invalid start ID');
}

const parseQuizAnswer = (answer: string) => {
  const tokens = answer.split(/[[\]、]/);
  return {
    answer: tokens[0].trim(),
    ...(tokens.length > 1
      ? {
        alternativeAnswers:
          tokens
            .slice(1)
            .map((token) => token.trim())
            .filter((token) => token !== ''),
      }
      : {}),
  };
};

const auth = await new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
}).getClient();
const sheets = google.sheets({ version: 'v4', auth });

const sheetsData = await new Promise<string[][]>((resolve, reject) => {
  sheets.spreadsheets.values.get({
    spreadsheetId: process.env.IT_QUIZ_SHEET_ID,
    range: `hakatashi!A${startId}:D`,
  }, (error, response) => {
    if (error) {
      reject(error);
    } else if (response!.data.values) {
      resolve(response!.data.values as string[][]);
    } else {
      reject(new Error('values not found'));
    }
  });
});

const quizzes: Quiz[] = [];

for (const [_id, question, answer, description] of sheetsData) {
  quizzes.push({
    question,
    ...parseQuizAnswer(answer),
    ...(description ? {description} : {}),
  });
}

await fs.appendFile(
  path.join(import.meta.dirname, '../..', 'it-quiz.yaml'),
  yaml.dump(quizzes, {
    lineWidth: -1,
  }),
  'utf8',
);

