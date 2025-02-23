import yaml from 'js-yaml';
import fs from 'fs-extra';
import path from 'path';
import semver, {ReleaseType} from 'semver';
import git from 'isomorphic-git';
import {fileURLToPath} from 'url';
import {generateReleaseText, getDiff, getGitRoot, getLastReleasedRevisionHash, getLastRevisionHash, getQuizDiff, getVersions, mergeReleaseTypes, Quiz} from './git.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const escapeCsvCell = (cell: string) => {
	if (cell.includes(',') || cell.includes('"')) {
		return `"${cell.replaceAll('"', '""')}"`;
	}
	return cell;
}

const compileToNewmonicCsv = (jsonContent: Quiz[]) => {
	type Row = [string, string, string];
	const csvContent: Row[] = [];

	for (const quiz of jsonContent) {
		if ('removed' in quiz) {
			continue;
		}

		let answer = quiz.answer;
		if (quiz.alternativeAnswers !== undefined) {
			answer += ` (${quiz.alternativeAnswers.join('、')})`;
		}

		const row: Row = [
			escapeCsvCell(quiz.question.replaceAll(/<.+?>/g, '')),
			escapeCsvCell(answer),
			escapeCsvCell(quiz.description ?? ''),
		];

		csvContent.push(row);
	}

	return csvContent.map(row => row.join(',')).join('\n');
};

export const compile = async (filename: string, version: string) => {
	const yamlFile = `${filename}.yaml`;
	const releaseYamlFile = `${filename}-v${version}.yaml`;
	const releaseJsonFile = `${filename}-v${version}.json`;
	const releaseCsvFile = `${filename}-v${version}.newmonic.csv`;

	const yamlContent = await fs.readFile(path.join(__dirname, '../..', yamlFile), 'utf8');
	const jsonContent = yaml.load(yamlContent) as Quiz[];
	const csvContent = compileToNewmonicCsv(jsonContent);

	await fs.ensureDir(path.join(__dirname, '../../release'));
	await fs.writeFile(path.join(__dirname, '../../release', releaseJsonFile), JSON.stringify(jsonContent, null, 2));
	await fs.writeFile(path.join(__dirname, '../../release', releaseYamlFile), yamlContent);
	await fs.writeFile(path.join(__dirname, '../../release', releaseCsvFile), csvContent);
};

const createNewReleaseIfNecessary = async () => {
	console.log('Checking if a new release is necessary...');
	const versions = await getVersions();
	const lastVersion = versions.sort(semver.rcompare)[0];

	console.log('Getting changes...');
	const changes = await getDiff(
		await getLastReleasedRevisionHash(),
		await getLastRevisionHash(),
	);

	const releases: (ReleaseType | null)[] = [];
	let releaseText = '';

	for (const change of changes) {
		if (change.path === 'it-quiz.yaml') {
			const quizDiff = await getQuizDiff(change);
			const quizReleaseText = generateReleaseText(quizDiff);
			releaseText += `## it-quiz.yaml\n\n${quizReleaseText}\n\n`;

			releases.push(quizDiff.release);
		}

		if (change.path === 'news-quiz.yaml') {
			const quizDiff = await getQuizDiff(change);
			const quizReleaseText = generateReleaseText(quizDiff);
			releaseText += `## news-quiz.yaml\n\n${quizReleaseText}\n\n`;

			releases.push(quizDiff.release);
		}
	}

	const releaseType = mergeReleaseTypes(releases);
	console.log(`Release type: ${releaseType}`);

	if (releaseType === null) {
		console.log('No change detected. Skip creating a new release.');
		return;
	}

	const githubOutput = process.env.GITHUB_OUTPUT;
	if (githubOutput === undefined) {
		throw new Error('GITHUB_OUTPUT is not set.');
	}

	const newVersion = semver.inc(lastVersion, releaseType);
	if (newVersion === null) {
		throw new Error('Failed to increment the version.');
	}
	console.log(`New version: ${newVersion}`);

	releaseText = `# ITクイズ ${newVersion}\n\n${releaseText}`;
	
	console.log('Tagging the new version...');
	await git.tag({
		fs,
		dir: await getGitRoot(),
		ref: newVersion,
	});

	console.log('Writing the release note to release.md...');
	await fs.writeFile('release.md', releaseText);

	console.log('Writing the new version to $GITHUB_OUTPUT...');
	await fs.appendFile(githubOutput, `new_version=${newVersion}\n`);

	console.log('Compiling the new version...');

	await compile('it-quiz', newVersion);
	await compile('news-quiz', newVersion);

	console.log('Done.');
};

createNewReleaseIfNecessary();
