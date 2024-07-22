import {compileFromFile} from 'json-schema-to-typescript';
import fs from 'fs-extra';
import {fileURLToPath} from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);

const definition = await compileFromFile(
	path.join(__filename, '../../../quizzes.schema.json'),
	{
		customName(schema, keyNameFromDefinition) {
			if (Object.hasOwn(schema, 'meta:name')) {
				return schema['meta:name'];
			}
			return keyNameFromDefinition;
		}
	},
);

await fs.writeFile(path.join(__filename, '../quizzes.d.ts'), definition);
