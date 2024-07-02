import yaml from 'js-yaml';
import fs from 'fs-extra';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const version = process.env.npm_package_version;

const compile = async (filename: string) => {
  const yamlFile = `${filename}.yaml`;
  const releaseYamlFile = `${filename}-v${version}.yaml`;
  const releaseJsonFile = `${filename}-v${version}.json`;

  const yamlContent = await fs.readFile(path.join(__dirname, '../..', yamlFile), 'utf8');
  const jsonContent = yaml.load(yamlContent);

  await fs.ensureDir(path.join(__dirname, '../../release'));
  await fs.writeFile(path.join(__dirname, '../../release', releaseJsonFile), JSON.stringify(jsonContent, null, 2));
  await fs.writeFile(path.join(__dirname, '../../release', releaseYamlFile), yamlContent);
};

await compile('it-quiz');
await compile('news-quiz');
