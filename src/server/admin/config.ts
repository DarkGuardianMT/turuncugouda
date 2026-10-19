import { getSecret } from 'astro:env/server';
import { readAdminConfig } from './auth';

export function getAdminConfig() {
  return readAdminConfig({ ADMIN_USERNAME: getSecret('ADMIN_USERNAME'),
    ADMIN_PASSWORD_HASH: getSecret('ADMIN_PASSWORD_HASH'), ADMIN_SESSION_SECRET: getSecret('ADMIN_SESSION_SECRET') });
}
