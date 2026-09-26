import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('app/dist/reference/references', {recursive:true});
cpSync('docs/references/bt','app/dist/reference/references/bt',{recursive:true});
cpSync('docs/design','app/dist/reference/design',{recursive:true});
