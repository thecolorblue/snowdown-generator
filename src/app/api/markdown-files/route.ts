import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const publicDir = path.join(process.cwd(), 'public');
    const allFiles = fs.readdirSync(publicDir);
    const markdownFiles = allFiles.filter(file => file.endsWith('.md'));
    return NextResponse.json({ files: markdownFiles });
  } catch (error) {
    console.error('Error reading public directory:', error);
    return NextResponse.json({ error: 'Failed to list markdown files' }, { status: 500 });
  }
}