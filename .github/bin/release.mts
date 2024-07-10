import yaml from 'js-yaml';
import fs from 'fs-extra';
import path from 'path';
import semver, {ReleaseType} from 'semver';
import git from 'isomorphic-git';
import {fileURLToPath} from 'url';
import {generateReleaseText, getDiff, getGitRoot, getLastReleasedRevisionHash, getLastRevisionHash, getQuizDiff, getVersions, mergeReleaseTypes} from './git.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const compile = async (filename: string, version: string) => {
	const yamlFile = `${filename}.yaml`;
	const releaseYamlFile = `${filename}-v${version}.yaml`;
	const releaseJsonFile = `${filename}-v${version}.json`;

	const yamlContent = await fs.readFile(path.join(__dirname, '../..', yamlFile), 'utf8');
	const jsonContent = yaml.load(yamlContent);

	await fs.ensureDir(path.join(__dirname, '../../release'));
	await fs.writeFile(path.join(__dirname, '../../release', releaseJsonFile), JSON.stringify(jsonContent, null, 2));
	await fs.writeFile(path.join(__dirname, '../../release', releaseYamlFile), yamlContent);
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

	console.log(`Writing the new version to $GITHUB_OUTPUT...`);
	await fs.appendFile(process.env.GITHUB_OUTPUT, `new_version=${newVersion}\n`);

	console.log('Compiling the new version...');

	await compile('it-quiz', newVersion);
	await compile('news-quiz', newVersion);

	console.log('Done.');
};

createNewReleaseIfNecessary();
