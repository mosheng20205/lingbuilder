import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const email = process.argv[2]?.trim().toLowerCase(); const password = process.argv[3];
if (!email || !password || password.length < 12) throw new Error('用法：npm run admin:bootstrap -w @lingbuilder/cloud-api -- admin@example.com StrongPassword123');
const prisma = new PrismaClient();
try {
  const user = await prisma.user.upsert({ where: { email }, create: { email, passwordHash: await argon2.hash(password, { type: argon2.argon2id }), status: 'ACTIVE', emailVerifiedAt: new Date(), mustChangePassword: true, creditAccount: { create: {} }, adminMembership: { create: { role: 'SUPER_ADMIN' } } }, update: { adminMembership: { upsert: { create: { role: 'SUPER_ADMIN' }, update: { role: 'SUPER_ADMIN' } } } } });
  console.log(`已创建超级管理员：${user.email}。首次登录必须修改密码并绑定 MFA。`);
} finally { await prisma.$disconnect(); }
