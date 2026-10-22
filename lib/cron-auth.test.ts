import { expect, it } from 'vitest';
import { authorizedCron } from './cron-auth';
it('fails closed when cron configuration is missing or credentials differ',()=>{
 expect(authorizedCron('Bearer undefined',undefined)).toBe(false);
 expect(authorizedCron('Bearer ','')).toBe(false);
 expect(authorizedCron(null,'secret')).toBe(false);
 expect(authorizedCron('Bearer wrong','secret')).toBe(false);
 expect(authorizedCron('Bearer secret','secret')).toBe(true);
});
