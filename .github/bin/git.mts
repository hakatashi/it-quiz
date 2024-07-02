import fs from 'fs/promises';
import git from 'isomorphic-git';
import {fileURLToPath} from 'url';
import {inspect} from 'util';
import semver from 'semver';

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

const getLastCommitHash = async () => {
	return git.resolveRef({
		fs,
		dir: await getGitRoot(),
		ref: 'HEAD',
	});
};

const changes = await getDiff(
	await getLastReleasedRevisionHash(),
	await getLastCommitHash(),
);

console.log(inspect(changes, { depth: null, maxStringLength: 50, colors: true }));
