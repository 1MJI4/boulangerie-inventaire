#!/usr/bin/env node

const { execSync } = require('child_process');

// Load environment variables
require('dotenv').config();

try {
  console.log('🔄 Generating Prisma Client...');
  
  // Check if DATABASE_URL is available
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.error('Please configure DATABASE_URL in your Railway service settings');
    process.exit(1);
  }
  
  execSync('prisma generate', { stdio: 'inherit' });
  console.log('✅ Prisma Client generated successfully');
} catch (error) {
  console.error('❌ Prisma generation failed');
  console.error('Error:', error.message);
  process.exit(1);
}

try {
  console.log('🔄 Building Next.js application...');
  execSync('next build', { stdio: 'inherit' });
  console.log('✅ Next.js build completed');
} catch (error) {
  console.error('❌ Next.js build failed');
  console.error('Error:', error.message);
  process.exit(1);
}
