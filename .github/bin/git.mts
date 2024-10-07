import fs from 'fs/promises';
import git from 'isomorphic-git';
import {fileURLToPath} from 'url';
import semver, { ReleaseType } from 'semver';
import yaml from 'js-yaml';
import zip from 'lodash/zip.js';
import * as Diff from 'diff';
import assert from 'assert';
import type {NormalQuiz, Quiz, RemovedQuiz} from './quizzes.d.ts';

process.env.GITHUB_OUTPUT = process.env.GITHUB_OUTPUT || 'output.txt';

const releaseErrorDiffThreshold = 300;

interface Change {
	path: string,
	oldContent: string | null,
	newContent: string | null,
}

const isQuizRemoved = (quiz: Quiz): quiz is RemovedQuiz => {
	return 'removed' in quiz;
};

const getDiff = async (commitHash1: string, commitHash2: string) => {
	return git.walk({
		fs,
		dir: await getGitRoot(),
		trees: [git.TREE({ref: commitHash1}), git.TREE({ref: commitHash2})],
		async map(filepath, [oldEntry, newEntry]) {
			if (filepath === '.') {
				return;
			}

			if ((await oldEntry?.type()) === 'tree' || (await newEntry?.type()) === 'tree') {
				return;
			}

			const oldOid = await oldEntry?.oid()
			const newOid = await newEntry?.oid()

			if (oldOid === newOid) {
				// no change
				return;
			}

			const oldContentBinary = await oldEntry?.content();
			const oldContent = oldContentBinary ? Buffer.from(oldContentBinary).toString() : null;
			const newContentBinary = await newEntry?.content();
			const newContent = newContentBinary ? Buffer.from(newContentBinary).toString() : null;

			return {
				path: filepath,
				oldContent,
				newContent,
			}
		},
	});
};

const getGitRoot = async () => {
	const root = await git.findRoot({
		fs,
		filepath: fileURLToPath(import.meta.url),
	});
	return root;
};

const getTags = async () => {
	return git.listTags({ fs, dir: await getGitRoot() });
};

const getVersions = async () => {
	const tags = await getTags();
	return tags.filter((tag) => semver.valid(tag));
};

const getLastReleasedRevisionHash = async () => {
	const versions = await getVersions();
	const lastVersion = versions.sort(semver.rcompare)[0];
	return git.resolveRef({
		fs,
		dir: await getGitRoot(),
		ref: lastVersion,
	});
};

const getLastRevisionHash = async () => {
	return git.resolveRef({
		fs,
		dir: await getGitRoot(),
		ref: 'HEAD',
	});
};

const setDiff = <T,>(set1: Set<T>, set2: Set<T>) => {
	const additions = new Set<T>();
	const deletions = new Set<T>();
	const intersection = new Set<T>();

	for (const item of set1) {
		if (set2.has(item)) {
			intersection.add(item);
		} else {
			deletions.add(item);
		}
	}

	for (const item of set2) {
		if (!set1.has(item)) {
			additions.add(item);
		}
	}

	return {
		additions,
		deletions,
		intersection,
		changes: additions.size + deletions.size,
	};
};

export const mergeReleaseTypes = (releases: (ReleaseType | null)[]): ReleaseType | null => {
	if (releases.includes('major')) {
		return 'major';
	}

	if (releases.includes('minor')) {
		return 'minor';
	}

	if (releases.includes('patch')) {
		return 'patch';
	}

	return null;
};

interface QuizAddition {
	id: number,
	quiz: NormalQuiz,
}

interface QuizDeletion {
	id: number,
	type: 'deleted' | 'moved',
	reason?: string,
}

interface Modification {
	id: number,
	oldContent: string | null,
	newContent: string | null,
};

interface AlternativeAnswersModification {
	id: number,
	deletions: string[],
	additions: string[],
}

interface QuizDiff {
	release: ReleaseType | null,
	quizAdditions: QuizAddition[],
	quizDeletions: QuizDeletion[],
	questionModifications: Modification[],
	answerModifications: Modification[],
	alternativeAnswersModifications: AlternativeAnswersModification[],
	descriptionModifications: Modification[],
	paperQuestionModifications: Modification[],
	minhayaQuestionModifications: Modification[],
};

const getQuizDiff = async (change: Change): Promise<QuizDiff> => {
	if (change.oldContent === null || change.newContent === null) {
		throw new Error('oldContent and newContent must be defined');
	}

	const oldQuizzes = yaml.load(change.oldContent) as Quiz[];
	const newQuizzes = yaml.load(change.newContent) as Quiz[];

	const releases: (ReleaseType | null)[] = [];

	const quizAdditions: QuizAddition[] = [];
	const quizDeletions: QuizDeletion[] = [];
	const questionModifications: Modification[] = [];
	const answerModifications: Modification[] = [];
	const alternativeAnswersModifications: AlternativeAnswersModification[] = [];
	const descriptionModifications: Modification[] = [];
	const paperQuestionModifications: Modification[] = [];
	const minhayaQuestionModifications: Modification[] = [];

	for (const [id, [oldQuiz, newQuiz]] of zip(oldQuizzes, newQuizzes).entries()) {
		assert(newQuiz !== undefined, 'Quiz must not be deleted in the new version');

		if (oldQuiz === undefined) {
			assert(!isQuizRemoved(newQuiz), 'Removed quiz must not be also removed in the new version');

			quizAdditions.push({
				id,
				quiz: newQuiz,
			});
			releases.push('minor');
			continue;
		}

		if (isQuizRemoved(oldQuiz)) {
			assert(isQuizRemoved(newQuiz), 'Quiz must be removed in the new version');
			continue;
		}

		if (isQuizRemoved(newQuiz)) {
			quizDeletions.push({
				id,
				type: newQuiz.removed.type,
				reason: newQuiz.removed.reason,
			});
			releases.push('minor');
			continue;
		}

		if (oldQuiz.question !== newQuiz.question) {
			questionModifications.push({
				id,
				oldContent: oldQuiz.question,
				newContent: newQuiz.question,
			});
			releases.push('patch');
		}

		if (oldQuiz.answer !== newQuiz.answer) {
			answerModifications.push({
				id,
				oldContent: oldQuiz.answer,
				newContent: newQuiz.answer,
			});
			releases.push('patch');
		}

		const alternativeAnswersDiff = setDiff(
			new Set(oldQuiz.alternativeAnswers ?? []),
			new Set(newQuiz.alternativeAnswers ?? []),
		);
		if (alternativeAnswersDiff.changes > 0) {
			alternativeAnswersModifications.push({
				id,
				deletions: Array.from(alternativeAnswersDiff.deletions),
				additions: Array.from(alternativeAnswersDiff.additions),
			});
			releases.push('patch');
		}

		if (oldQuiz.description !== newQuiz.description) {
			descriptionModifications.push({
				id,
				oldContent: oldQuiz.description ?? null,
				newContent: newQuiz.description ?? null,
			});
			releases.push('patch');
		}

		if (oldQuiz.paperQuestion !== newQuiz.paperQuestion) {
			paperQuestionModifications.push({
				id,
				oldContent: oldQuiz.paperQuestion ?? null,
				newContent: newQuiz.paperQuestion ?? null,
			});
			releases.push('patch');
		}

		if (oldQuiz.minhayaQuestion !== newQuiz.minhayaQuestion) {
			minhayaQuestionModifications.push({
				id,
				oldContent: oldQuiz.minhayaQuestion ?? null,
				newContent: newQuiz.minhayaQuestion ?? null,
			});
			releases.push('patch');
		}
	}

	if (releases.length > releaseErrorDiffThreshold) {
		throw new Error(`Too many changes detected: ${releases.length}`);
	}

	return {
		release: mergeReleaseTypes(releases),
		quizAdditions,
		quizDeletions,
		questionModifications,
		answerModifications,
		alternativeAnswersModifications,
		descriptionModifications,
		paperQuestionModifications,
		minhayaQuestionModifications,
	};
};

const stripHtmlTags = (text: string) => {
	return text.replace(/<[^>]*>/g, '');
};

const generateDiffMarkdown = (oldText: string | null, newText: string | null) => {
	const diff = Diff.diffChars(stripHtmlTags(oldText ?? ''), stripHtmlTags(newText ?? ''));
	const diffMarkdown = diff.map((part) => {
		if (part.added) {
			return ` **${part.value.trim()}** `;
		}

		if (part.removed) {
			return ` ~~${part.value.trim()}~~ `;
		}

		return part.value;
	}).join('');

	return diffMarkdown;
};

const generateReleaseText = (quizDiff: QuizDiff) => {
	const lines: string[] = [];

	if (quizDiff.quizAdditions.length > 0) {
		lines.push('* 問題を追加しました');
		for (const quizAddition of quizDiff.quizAdditions) {
			const quiz = quizAddition.quiz;
			lines.push(`  * Q${quizAddition.id}`);
			lines.push(`    * Q. ${quiz.question}`);
			lines.push(`    * A. ${quiz.answer}`);
		}
	}

	if (quizDiff.quizDeletions.length > 0) {
		lines.push('* 問題を削除しました');
		for (const quizDeletion of quizDiff.quizDeletions) {
			lines.push(`  * Q${quizDeletion.id}`);
			lines.push(`    * 理由: ${quizDeletion.reason}`);
		}
	}

	if (quizDiff.questionModifications.length > 0) {
		lines.push('* 問題文を修正しました');
		for (const questionModification of quizDiff.questionModifications) {
			lines.push(`  * Q${questionModification.id}: ${generateDiffMarkdown(questionModification.oldContent, questionModification.newContent)}`);
		}
	}

	if (quizDiff.answerModifications.length > 0) {
		lines.push('* 模範解答を修正しました');
		for (const answerModification of quizDiff.answerModifications) {
			lines.push(`  * Q${answerModification.id}: ${answerModification.oldContent} -> ${answerModification.newContent}`);
		}
	}

	if (quizDiff.alternativeAnswersModifications.length > 0) {
		lines.push('* 別解を修正しました');
		for (const alternativeAnswersModification of quizDiff.alternativeAnswersModifications) {
			let modificationTexts: string[] = [];
			if (alternativeAnswersModification.deletions.length > 0) {
				modificationTexts.push(`「${alternativeAnswersModification.deletions.join('」「')}」を削除`);
			}
			if (alternativeAnswersModification.additions.length > 0) {
				modificationTexts.push(`「${alternativeAnswersModification.additions.join('」「')}」を追加`);
			}
			lines.push(`  * Q${alternativeAnswersModification.id}: ${modificationTexts.join('、')}`);
		}
	}

	if (quizDiff.descriptionModifications.length > 0) {
		lines.push('* コメントを修正しました');
		for (const descriptionModification of quizDiff.descriptionModifications) {
			lines.push(`  * Q${descriptionModification.id}: ${generateDiffMarkdown(descriptionModification.oldContent, descriptionModification.newContent)}`);
		}
	}

	if (quizDiff.paperQuestionModifications.length > 0) {
		lines.push('* ペーパー用問題文を修正しました');
		for (const paperQuestionModification of quizDiff.paperQuestionModifications) {
			lines.push(`  * Q${paperQuestionModification.id}: ${generateDiffMarkdown(paperQuestionModification.oldContent, paperQuestionModification.newContent)}`);
		}
	}

	if (quizDiff.minhayaQuestionModifications.length > 0) {
		lines.push('* みんはや用問題文を修正しました');
		for (const minhayaQuestionModification of quizDiff.minhayaQuestionModifications) {
			lines.push(`  * Q${minhayaQuestionModification.id}: ${generateDiffMarkdown(minhayaQuestionModification.oldContent, minhayaQuestionModification.newContent)}`);
		}
	}

	return lines.join('\n');
};

export {
	getDiff,
	getGitRoot,
	getTags,
	getVersions,
	getLastReleasedRevisionHash,
	getLastRevisionHash,
	setDiff,
	Quiz,
	Change,
	QuizAddition,
	Modification,
	AlternativeAnswersModification,
	QuizDiff,
	getQuizDiff,
	stripHtmlTags,
	generateDiffMarkdown,
	generateReleaseText,
};