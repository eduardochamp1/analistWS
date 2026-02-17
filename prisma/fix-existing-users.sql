-- Script para criar organização para usuários existentes
-- Execute este SQL no Prisma Studio ou via migration

-- Criar organizações pessoais para todos os usuários que não têm
INSERT INTO Organization (id, name, isPersonal, createdAt, updatedAt)
SELECT 
  lower(hex(randomblob(16))),
  name || ' (Pessoal)',
  1,
  datetime('now'),
  datetime('now')
FROM User
WHERE id NOT IN (
  SELECT DISTINCT userId FROM OrganizationMember
);

-- Criar memberships para vincular usuários às suas organizações
INSERT INTO OrganizationMember (id, userId, organizationId, role, createdAt, updatedAt)
SELECT 
  lower(hex(randomblob(16))),
  u.id,
  o.id,
  'ADMIN',
  datetime('now'),
  datetime('now')
FROM User u
JOIN Organization o ON o.name = u.name || ' (Pessoal)'
WHERE u.id NOT IN (
  SELECT DISTINCT userId FROM OrganizationMember
);
