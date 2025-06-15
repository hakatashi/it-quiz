import {fileURLToPath} from "node:url";
import fs from "node:fs/promises";
import {chunk} from "lodash-es";
import { Quiz, NormalQuiz } from "./quizzes.js";

const isNormalQuiz = (quiz: Quiz): quiz is NormalQuiz => {
  return !('removed' in quiz);
};

const generateNotebookLMSources = async () => {
  await fs.mkdir('notebooklm-sources', {recursive: true});

  const quizUrl = 'https://github.com/hakatashi/it-quiz/releases/download/1.13.1/it-quiz-v1.13.1.json';
  const quizzes: Quiz[] = await fetch(quizUrl).then(res => res.json());

  for (const [index, chunkedQuizzes] of chunk(quizzes, 100).entries()) {
    const contentMarkdown = chunkedQuizzes.map((quiz, i) => {
      const quizId = i + (100 * index);
      if (!isNormalQuiz(quiz)) {
        return `### 第${quizId}問\n\n` +
               `削除\n\n` +
               `**削除の理由:** ${quiz.removed.reason}\n\n` +
               `**削除の種類:** ${quiz.removed.type}`;
      }

      return `### 第${quizId}問\n\n` +
             `**問題:** ${quiz.question}\n\n` +
             `**回答:** ${quiz.answer}${quiz.alternativeAnswers ? `\n\n**別解:** ${quiz.alternativeAnswers.join(', ')}` : ''}\n\n` +
             `${quiz.description ? `**説明:** ${quiz.description}\n\n` : ''}`;
    }).join('');

    await fs.writeFile(
      `notebooklm-sources/ITクイズ第${index * 100}-${index * 100 + 99}問.md`,
      `# ITクイズ第${index * 100}-${index * 100 + 99}問\n\n` +
      `このファイルは、ITクイズの問題をNotebookLMで使用するためのソースファイルです。\n\n` +
      `## 問題一覧\n\n` +
      contentMarkdown
    );
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await generateNotebookLMSources();
}
