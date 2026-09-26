import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const output=execFileSync('supabase',['db','query','--linked','--file','supabase/tests/data_foundation.sql','--output','json'],{cwd:root,encoding:'utf8',timeout:60000});
console.log(output);
