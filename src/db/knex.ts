import knex from 'knex';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const knexfile = require('../../knexfile.js');

const env = process.env.NODE_ENV || 'development';
const configOptions = knexfile.default[env];

export default knex(configOptions);
